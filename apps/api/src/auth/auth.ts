import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@synctip/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { phoneNumber } from 'better-auth/plugins';
import { sendOtpSms } from './twilio';

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

  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber: to, code }) => {
        await sendOtpSms(to, code);
      },
      // signUp on first successful OTP if the phone number is unknown
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.replace(/\D/g, '')}@phone.synctip`,
      },
    }),
  ],
});

export type Auth = typeof auth;
