/* eslint-disable @typescript-eslint/require-await -- fake Prisma methods mirror the real async signatures but operate on in-memory arrays */
import { describe, expect, it } from 'bun:test';
import { absorbIfEligible, type ContestedIdentity } from './account-merge';

/**
 * Tiny in-memory stand-in for the Prisma surface this module touches. Holds
 * `User`, `Account`, `Session` rows in arrays and exposes only the methods
 * the merge service calls. Each call mutates the same arrays so we can
 * assert end-state after `absorbIfEligible` runs.
 *
 * Not a generic mock — only the column subsets / where shapes used by the
 * service are honored. Anything else throws, by design, so accidental new
 * Prisma usages get caught immediately.
 */
type FakeUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  phoneNumber: string | null;
  phoneNumberVerified: boolean | null;
};
type FakeAccount = {
  userId: string;
  providerId: string;
  accountId: string;
};
type FakeSession = { userId: string };

function fakePrisma(seed: {
  users: FakeUser[];
  accounts: FakeAccount[];
  sessions: FakeSession[];
}) {
  const state = {
    users: [...seed.users],
    accounts: [...seed.accounts],
    sessions: [...seed.sessions],
  };

  const tx = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const u = state.users.find((x) => x.id === where.id);
        if (!u) return null;
        return {
          ...u,
          accounts: state.accounts
            .filter((a) => a.userId === u.id)
            .map((a) => ({ providerId: a.providerId, accountId: a.accountId })),
        };
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const u = state.users.find((x) => x.id === where.id);
        if (!u) throw new Error(`user ${where.id} not found`);
        return u;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeUser>;
      }) => {
        const u = state.users.find((x) => x.id === where.id);
        if (!u) throw new Error(`user ${where.id} not found`);
        Object.assign(u, data);
        return u;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = state.users.findIndex((x) => x.id === where.id);
        if (idx === -1) throw new Error(`user ${where.id} not found`);
        const [removed] = state.users.splice(idx, 1);
        return removed;
      },
    },
    account: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { userId: string; providerId: string; accountId: string };
        data: { userId: string };
      }) => {
        let count = 0;
        for (const a of state.accounts) {
          if (
            a.userId === where.userId &&
            a.providerId === where.providerId &&
            a.accountId === where.accountId
          ) {
            a.userId = data.userId;
            count++;
          }
        }
        return { count };
      },
    },
    session: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        const before = state.sessions.length;
        state.sessions = state.sessions.filter(
          (s) => s.userId !== where.userId,
        );
        return { count: before - state.sessions.length };
      },
    },
  };

  return {
    state,
    prisma: {
      // `canAbsorbOrphan` reads outside a transaction, so the merge surface
      // also exposes `user.findUnique` at the top level. Tests share the same
      // in-memory user table by reusing `tx.user.findUnique`.
      user: { findUnique: tx.user.findUnique },
      $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => {
        // No real isolation — fine for unit tests. The real Prisma client
        // enforces atomicity in production.
        return fn(tx);
      },
    },
  };
}

const GOOGLE_IDENTITY: ContestedIdentity = {
  kind: 'account',
  providerId: 'google',
  accountId: 'google-sub-123',
};
const PHONE_IDENTITY: ContestedIdentity = {
  kind: 'phone',
  phoneNumber: '+972503592156',
};

describe('absorbIfEligible — Google-link direction (phone-only survivor)', () => {
  it('absorbs a Google-only orphan into a phone-only survivor and copies real email', async () => {
    const { state, prisma } = fakePrisma({
      users: [
        {
          id: 'survivor-P',
          email: '972503592156@phone.synctip',
          emailVerified: false,
          name: null,
          image: null,
          phoneNumber: '+972503592156',
          phoneNumberVerified: true,
        },
        {
          id: 'orphan-G',
          email: 'real@example.com',
          emailVerified: true,
          name: 'Real Person',
          image: 'https://img/real.png',
          phoneNumber: null,
          phoneNumberVerified: false,
        },
      ],
      accounts: [
        {
          userId: 'orphan-G',
          providerId: 'google',
          accountId: 'google-sub-123',
        },
      ],
      sessions: [{ userId: 'orphan-G' }, { userId: 'survivor-P' }],
    });

    const outcome = await absorbIfEligible(prisma, {
      survivorUserId: 'survivor-P',
      orphanUserId: 'orphan-G',
      contested: GOOGLE_IDENTITY,
    });

    expect(outcome).toEqual({ result: 'absorbed', orphanUserId: 'orphan-G' });
    expect(state.users.map((u) => u.id)).toEqual(['survivor-P']);

    const survivor = state.users[0];
    expect(survivor.email).toBe('real@example.com');
    expect(survivor.emailVerified).toBe(true);
    expect(survivor.name).toBe('Real Person');
    expect(survivor.image).toBe('https://img/real.png');
    // Phone fields untouched (survivor already had them).
    expect(survivor.phoneNumber).toBe('+972503592156');

    // Google account row moved to survivor.
    expect(state.accounts).toEqual([
      {
        userId: 'survivor-P',
        providerId: 'google',
        accountId: 'google-sub-123',
      },
    ]);

    // Only survivor's session remains; orphan's was deleted.
    expect(state.sessions).toEqual([{ userId: 'survivor-P' }]);
  });

  it('refuses when the Google orphan also has a verified phone (looks like a real second human)', async () => {
    const { state, prisma } = fakePrisma({
      users: [
        {
          id: 'survivor-P',
          email: '972503592156@phone.synctip',
          emailVerified: false,
          name: null,
          image: null,
          phoneNumber: '+972503592156',
          phoneNumberVerified: true,
        },
        {
          id: 'orphan-G',
          email: 'real@example.com',
          emailVerified: true,
          name: 'Real Person',
          image: null,
          // Orphan ALSO has a (different) verified phone — second identity.
          phoneNumber: '+15550001111',
          phoneNumberVerified: true,
        },
      ],
      accounts: [
        {
          userId: 'orphan-G',
          providerId: 'google',
          accountId: 'google-sub-123',
        },
      ],
      sessions: [],
    });

    const outcome = await absorbIfEligible(prisma, {
      survivorUserId: 'survivor-P',
      orphanUserId: 'orphan-G',
      contested: GOOGLE_IDENTITY,
    });

    expect(outcome).toEqual({ result: 'refused', reason: 'not_thin' });
    // Nothing mutated.
    expect(state.users.map((u) => u.id).sort()).toEqual([
      'orphan-G',
      'survivor-P',
    ]);
    expect(state.accounts[0]?.userId).toBe('orphan-G');
  });

  it('refuses when the Google orphan also has a second OAuth account', async () => {
    const { prisma } = fakePrisma({
      users: [
        {
          id: 'survivor-P',
          email: '972503592156@phone.synctip',
          emailVerified: false,
          name: null,
          image: null,
          phoneNumber: '+972503592156',
          phoneNumberVerified: true,
        },
        {
          id: 'orphan-G',
          email: 'real@example.com',
          emailVerified: true,
          name: null,
          image: null,
          phoneNumber: null,
          phoneNumberVerified: false,
        },
      ],
      accounts: [
        {
          userId: 'orphan-G',
          providerId: 'google',
          accountId: 'google-sub-123',
        },
        {
          // A *different* OAuth provider also on orphan — second identity.
          userId: 'orphan-G',
          providerId: 'github',
          accountId: 'github-42',
        },
      ],
      sessions: [],
    });

    const outcome = await absorbIfEligible(prisma, {
      survivorUserId: 'survivor-P',
      orphanUserId: 'orphan-G',
      contested: GOOGLE_IDENTITY,
    });

    expect(outcome).toEqual({ result: 'refused', reason: 'not_thin' });
  });

  it('does not overwrite the survivor email when survivor already has a real email', async () => {
    const { state, prisma } = fakePrisma({
      users: [
        {
          id: 'survivor-P',
          // Survivor has a REAL email — orphan email must not clobber it.
          email: 'survivor@example.com',
          emailVerified: true,
          name: 'Survivor',
          image: 'https://img/survivor.png',
          phoneNumber: '+972503592156',
          phoneNumberVerified: true,
        },
        {
          id: 'orphan-G',
          email: 'orphan@example.com',
          emailVerified: true,
          name: 'Orphan',
          image: 'https://img/orphan.png',
          phoneNumber: null,
          phoneNumberVerified: false,
        },
      ],
      accounts: [
        {
          userId: 'orphan-G',
          providerId: 'google',
          accountId: 'google-sub-123',
        },
      ],
      sessions: [],
    });

    const outcome = await absorbIfEligible(prisma, {
      survivorUserId: 'survivor-P',
      orphanUserId: 'orphan-G',
      contested: GOOGLE_IDENTITY,
    });

    expect(outcome.result).toBe('absorbed');
    const survivor = state.users[0];
    expect(survivor.email).toBe('survivor@example.com');
    expect(survivor.name).toBe('Survivor');
    expect(survivor.image).toBe('https://img/survivor.png');
  });
});

describe('absorbIfEligible — phone-link direction (Google-only survivor)', () => {
  it('absorbs a phone-only orphan into a Google-only survivor and moves the phone', async () => {
    const { state, prisma } = fakePrisma({
      users: [
        {
          id: 'survivor-G',
          email: 'real@example.com',
          emailVerified: true,
          name: 'Real Person',
          image: 'https://img/real.png',
          phoneNumber: null,
          phoneNumberVerified: false,
        },
        {
          id: 'orphan-P',
          email: '972503592156@phone.synctip',
          emailVerified: false,
          name: null,
          image: null,
          phoneNumber: '+972503592156',
          phoneNumberVerified: true,
        },
      ],
      accounts: [
        {
          userId: 'survivor-G',
          providerId: 'google',
          accountId: 'google-sub-123',
        },
      ],
      sessions: [{ userId: 'orphan-P' }],
    });

    const outcome = await absorbIfEligible(prisma, {
      survivorUserId: 'survivor-G',
      orphanUserId: 'orphan-P',
      contested: PHONE_IDENTITY,
    });

    expect(outcome).toEqual({ result: 'absorbed', orphanUserId: 'orphan-P' });
    expect(state.users.map((u) => u.id)).toEqual(['survivor-G']);

    const survivor = state.users[0];
    expect(survivor.phoneNumber).toBe('+972503592156');
    expect(survivor.phoneNumberVerified).toBe(true);
    // Email/name/image stay — survivor's were already populated.
    expect(survivor.email).toBe('real@example.com');
    expect(survivor.name).toBe('Real Person');

    expect(state.sessions).toEqual([]);
  });

  it('refuses when the phone orphan also has an OAuth account', async () => {
    const { prisma } = fakePrisma({
      users: [
        {
          id: 'survivor-G',
          email: 'real@example.com',
          emailVerified: true,
          name: null,
          image: null,
          phoneNumber: null,
          phoneNumberVerified: false,
        },
        {
          id: 'orphan-P',
          email: '972503592156@phone.synctip',
          emailVerified: false,
          name: null,
          image: null,
          phoneNumber: '+972503592156',
          phoneNumberVerified: true,
        },
      ],
      accounts: [
        {
          userId: 'survivor-G',
          providerId: 'google',
          accountId: 'google-sub-123',
        },
        {
          // Orphan also has its own Google — second identity → refuse.
          userId: 'orphan-P',
          providerId: 'google',
          accountId: 'google-sub-other',
        },
      ],
      sessions: [],
    });

    const outcome = await absorbIfEligible(prisma, {
      survivorUserId: 'survivor-G',
      orphanUserId: 'orphan-P',
      contested: PHONE_IDENTITY,
    });

    expect(outcome).toEqual({ result: 'refused', reason: 'not_thin' });
  });
});

describe('absorbIfEligible — edge cases', () => {
  it('refuses when survivor and orphan are the same user', async () => {
    const { prisma } = fakePrisma({ users: [], accounts: [], sessions: [] });
    const outcome = await absorbIfEligible(prisma, {
      survivorUserId: 'same-id',
      orphanUserId: 'same-id',
      contested: GOOGLE_IDENTITY,
    });
    expect(outcome).toEqual({ result: 'refused', reason: 'self' });
  });

  it('refuses when the orphan does not exist', async () => {
    const { prisma } = fakePrisma({
      users: [
        {
          id: 'survivor-P',
          email: '972503592156@phone.synctip',
          emailVerified: false,
          name: null,
          image: null,
          phoneNumber: '+972503592156',
          phoneNumberVerified: true,
        },
      ],
      accounts: [],
      sessions: [],
    });

    const outcome = await absorbIfEligible(prisma, {
      survivorUserId: 'survivor-P',
      orphanUserId: 'ghost',
      contested: GOOGLE_IDENTITY,
    });

    expect(outcome).toEqual({ result: 'refused', reason: 'orphan_not_found' });
  });
});
