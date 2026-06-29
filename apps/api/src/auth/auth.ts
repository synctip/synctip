import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@synctip/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { phoneNumber } from 'better-auth/plugins';
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

  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber: to }) => {
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
