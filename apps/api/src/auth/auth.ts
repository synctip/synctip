import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@synctip/db';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { phoneNumber } from 'better-auth/plugins';
import { absorbIfEligible, canAbsorbOrphan } from './account-merge';
import { sendOtp, verifyOtp } from './twilio';

/**
 * Better-Auth instance.
 *
 * Auth methods enabled:
 *   - Phone-number + SMS OTP (via Twilio)
 *   - Google OAuth
 *
 * Sessions are stored in the database (Session table) and authenticated via
 * HTTP-only Secure cookies. A future JWT plugin can be added without breaking
 * the existing session model.
 *
 * Note: this creates a second PrismaClient (separate from PrismaService) so
 * Better-Auth can be initialized at module load, before Nest's DI container
 * exists. Two small connection pools is acceptable; revisit if it matters.
 */
const connectionString = process.env.DATABASE_URL ?? '';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// The merge helpers are typed against a narrow structural subset of Prisma
// (so unit tests can pass a tiny in-memory fake). The real PrismaClient is
// strictly wider, but TypeScript can't see the structural compatibility
// because Prisma's generated return types depend on the inferred `select`
// shape. The cast is the boundary between "real Prisma" and "merge surface";
// the merge module is fully typed internally.
const mergePrisma = prisma as unknown as Parameters<typeof absorbIfEligible>[0];

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  secret: process.env.AUTH_SECRET,
  baseURL: process.env.AUTH_BASE_URL,
  basePath: '/auth',

  // Behind Render's proxy the real client IP is in X-Forwarded-For. Without
  // this, Better-Auth's rate limiter falls back to one shared bucket per path.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for'],
    },
    // Web and API live on different subdomains of synctip.com
    // (e.g. dev.synctip.com calls api-dev.synctip.com). We need:
    //   1. The cookie's Domain attribute set to the shared parent so the
    //      browser will send it on both subdomains.
    //   2. SameSite=None + Secure so the browser will attach it to
    //      cross-site fetches at all (modern browsers block SameSite=Lax
    //      cookies on cross-origin XHR even between same-parent hosts).
    //
    // AUTH_COOKIE_DOMAIN should be set per environment, e.g.
    //   .synctip.com    for dev / stage / beta / prod
    //   (unset)         for plain localhost (cookie defaults to host-only)
    crossSubDomainCookies: process.env.AUTH_COOKIE_DOMAIN
      ? {
          enabled: true,
          domain: process.env.AUTH_COOKIE_DOMAIN,
        }
      : { enabled: false },
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
    },
  },

  // List of trusted origins that may receive Set-Cookie + send credentialed
  // requests. Synced with the API's CORS allowlist (WEB_ORIGIN).
  trustedOrigins:
    process.env.WEB_ORIGIN?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? [],

  // Database sessions: opaque token in an HTTP-only Secure cookie. Sessions
  // can be revoked individually, rotate on a schedule, and never appear in
  // client-readable storage.
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day if used
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes of in-memory cache to skip DB hits
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },

  account: {
    accountLinking: {
      // Required because users who sign up via phone are given a temporary
      // email (+<digits>@phone.synctip). When they later link Google, the
      // Google email won't match — but it's still the same person.
      allowDifferentEmails: true,
      // The `account` table only tracks OAuth/credential entries, not the
      // phone number (which lives on the user row). Without this, Better-Auth
      // refuses to unlink the only OAuth account even when phone is still
      // attached. The client guards against actual lockout.
      allowUnlinkingAll: true,
      // Copy the provider's display name + avatar onto the user when an
      // account is linked. Lets a phone-signup user finally have a real
      // name and photo after they link Google.
      updateUserInfoOnLink: true,
    },
  },

  // Hooks that implement the "thin orphan absorb" merge from #20 — when a
  // user tries to link an identity (Google OAuth or phone) that's already
  // attached to another `User` row whose **only** sign-in method is that
  // identity, silently transfer it to the current user and delete the
  // orphan. The orphan has no other auth path, so this is non-destructive:
  // nobody is being locked out. The transactional eligibility re-check and
  // ordering live in `./account-merge.ts`.
  databaseHooks: {
    account: {
      create: {
        before: async (account) => {
          // The link flow always sets `userId` to the currently-signed-in
          // user (the survivor); we rely on that rather than fishing the
          // session out of ctx (less coupling, fewer null checks).
          const survivorUserId = account.userId;
          if (!survivorUserId) return { data: account };

          const existing = await prisma.account.findFirst({
            where: {
              providerId: account.providerId,
              accountId: account.accountId,
              NOT: { userId: survivorUserId },
            },
            select: { userId: true },
          });
          if (!existing) return { data: account };

          const outcome = await absorbIfEligible(mergePrisma, {
            survivorUserId,
            orphanUserId: existing.userId,
            contested: {
              kind: 'account',
              providerId: account.providerId,
              accountId: account.accountId,
            },
          });

          if (outcome.result === 'absorbed') {
            // The orphan's account row was reparented to survivor inside the
            // transaction. Aborting the create avoids a unique-constraint
            // violation on (providerId, accountId).
            return false;
          }

          // Not absorbable (orphan has 2+ identities = a real second human).
          // Let Better-Auth's own conflict path fire; the client surfaces
          // it via the friendly toast wired in #19.
          return { data: account };
        },
      },
    },
    user: {
      update: {
        before: async (data, ctx) => {
          // Only intervene when phoneNumber is being set to a non-empty
          // value. Every other user update (name, image, etc.) flows
          // through unchanged.
          const newPhone =
            typeof data.phoneNumber === 'string' && data.phoneNumber
              ? data.phoneNumber
              : null;
          if (!newPhone) return { data };

          const survivorUserId = ctx?.context?.session?.user?.id;
          if (!survivorUserId) return { data };

          const orphan = await prisma.user.findFirst({
            where: { phoneNumber: newPhone, NOT: { id: survivorUserId } },
            select: { id: true },
          });
          if (!orphan) return { data };

          const outcome = await absorbIfEligible(mergePrisma, {
            survivorUserId,
            orphanUserId: orphan.id,
            contested: { kind: 'phone', phoneNumber: newPhone },
          });

          if (outcome.result === 'absorbed') {
            // Survivor already holds the phone now. Strip `phoneNumber`
            // from the upcoming update so it doesn't re-set the same
            // unique value; keep any companion fields like
            // `phoneNumberVerified` so Better-Auth can mark it verified.
            const rest = { ...data };
            delete (rest as Record<string, unknown>).phoneNumber;
            return { data: rest };
          }

          // Not absorbable — let the unique constraint fire its existing
          // error, surfaced to the user by #19.
          return { data };
        },
      },
    },
  },

  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber: to }, ctx) => {
        // Fail fast before billing Twilio: if a signed-in user is trying to
        // link a phone that's already attached to a different account, decide
        // here whether the eventual verify step would be able to absorb the
        // orphan (#20). If yes, allow the SMS — the actual merge happens
        // post-verification in `databaseHooks.user.update.before`. If no,
        // reject so we never send the SMS.
        const existing = await prisma.user.findFirst({
          where: { phoneNumber: to },
          select: { id: true },
        });
        if (existing) {
          // `auth` is referenced via late-binding closure; safe because hooks
          // only run on live requests, after `auth` is fully constructed.
          const session = ctx?.headers
            ? await auth.api.getSession({ headers: ctx.headers })
            : null;
          if (session?.user?.id && session.user.id !== existing.id) {
            const absorbable = await canAbsorbOrphan(mergePrisma, existing.id, {
              kind: 'phone',
              phoneNumber: to,
            });
            if (!absorbable) {
              throw new APIError('BAD_REQUEST', {
                message:
                  'This phone number is already linked to another account.',
              });
            }
            // Fall through — OTP send proceeds; absorb runs on verify.
          }
          // Not signed in => normal sign-in flow for the existing user.
          // Signed in as the same user => re-verification, allow.
        }
        // Twilio Verify generates its own code; ignore Better-Auth's.
        await sendOtp(to);
      },
      verifyOTP: async ({ phoneNumber: to, code }) => {
        return verifyOtp(to, code);
      },
      // signUp on first successful OTP if the phone number is unknown
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.replace(/\D/g, '')}@phone.synctip`,
      },
    }),
  ],
});

export type Auth = typeof auth;
