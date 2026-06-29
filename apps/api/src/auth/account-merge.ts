/**
 * Identity being claimed by the survivor that currently belongs to the orphan.
 *  - `account`  — an OAuth row in the `Account` table (e.g. Google).
 *  - `phone`    — a phone number on the `User` row.
 */
export type ContestedIdentity =
  | { kind: 'account'; providerId: string; accountId: string }
  | { kind: 'phone'; phoneNumber: string };

export type MergeOutcome =
  | { result: 'absorbed'; orphanUserId: string }
  | {
      result: 'refused';
      reason: 'self' | 'orphan_not_found' | 'not_thin';
    };

/** Snapshot of an orphan user used by the eligibility check. */
type OrphanInventory = {
  phoneNumber: string | null;
  phoneNumberVerified: boolean | null;
  accounts: Array<{ providerId: string; accountId: string }>;
};

/** Full orphan row the absorb transaction reads before deleting. */
type OrphanRow = OrphanInventory & {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
};

/** Survivor fields the absorb transaction reads after deleting the orphan. */
type SurvivorSnapshot = {
  email: string;
  name: string | null;
  image: string | null;
};

/** Field set the absorb transaction may write back to the survivor. */
type SurvivorUpdates = {
  email?: string;
  emailVerified?: boolean;
  name?: string | null;
  image?: string | null;
  phoneNumber?: string;
  phoneNumberVerified?: boolean;
};

/**
 * Read-only subset used for `canAbsorbOrphan` so callers that only need the
 * pre-check (e.g. the pre-OTP guard) don't have to pretend to support `$transaction`.
 */
type MergePrismaRead = {
  user: {
    findUnique: (args: {
      where: { id: string };
      select: Record<string, unknown>;
    }) => Promise<OrphanInventory | null>;
  };
};

/**
 * Transactional Prisma surface used inside `absorbIfEligible`. Defined
 * structurally so unit tests can supply a tiny in-memory fake without
 * satisfying Prisma's overloaded generated types.
 */
type MergeTx = {
  user: {
    findUnique: (args: {
      where: { id: string };
      select: Record<string, unknown>;
    }) => Promise<OrphanRow | null>;
    findUniqueOrThrow: (args: {
      where: { id: string };
      select: Record<string, unknown>;
    }) => Promise<SurvivorSnapshot>;
    update: (args: {
      where: { id: string };
      data: SurvivorUpdates;
    }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  account: {
    updateMany: (args: {
      where: { userId: string; providerId: string; accountId: string };
      data: { userId: string };
    }) => Promise<{ count: number }>;
  };
  session: {
    deleteMany: (args: {
      where: { userId: string };
    }) => Promise<{ count: number }>;
  };
};

/**
 * Top-level Prisma surface that also satisfies the read-only one, so a single
 * mock/cast at the boundary covers both `canAbsorbOrphan` and `absorbIfEligible`.
 */
type MergePrisma = MergePrismaRead & {
  $transaction: <R>(fn: (tx: MergeTx) => Promise<R>) => Promise<R>;
};

/**
 * Pure eligibility check, reused by both the pre-write guard
 * (`canAbsorbOrphan`) and the transactional absorb. Given the orphan's
 * identity inventory, decide whether the contested identity is its **only**
 * sign-in path.
 */
function isThinOrphan(
  orphan: OrphanInventory,
  contested: ContestedIdentity,
): boolean {
  const remainingAccounts = orphan.accounts.filter((a) => {
    if (contested.kind !== 'account') return true;
    return !(
      a.providerId === contested.providerId &&
      a.accountId === contested.accountId
    );
  });
  const orphanPhoneIsContested =
    contested.kind === 'phone' && orphan.phoneNumber === contested.phoneNumber;
  const hasOtherPhone =
    Boolean(orphan.phoneNumberVerified) &&
    !!orphan.phoneNumber &&
    !orphanPhoneIsContested;
  return remainingAccounts.length === 0 && !hasOtherPhone;
}

/**
 * Read-only "would absorb succeed?" check. Used by the pre-OTP guard to
 * decide whether to allow Twilio to send the SMS before we have an actually-
 * verified phone in hand. The eligibility is re-checked inside the absorb
 * transaction so a TOCTOU race only loses the opportunity to merge, never
 * corrupts data.
 */
export async function canAbsorbOrphan(
  prisma: MergePrismaRead,
  orphanUserId: string,
  contested: ContestedIdentity,
): Promise<boolean> {
  const orphan = await prisma.user.findUnique({
    where: { id: orphanUserId },
    select: {
      phoneNumber: true,
      phoneNumberVerified: true,
      accounts: { select: { providerId: true, accountId: true } },
    },
  });
  if (!orphan) return false;
  return isThinOrphan(orphan, contested);
}

/**
 * Attempt to silently absorb `orphanUserId` into `survivorUserId` when the
 * contested identity is the orphan's **sole** sign-in path — i.e. removing it
 * would leave the orphan with no way to authenticate.
 *
 * Designed for the post-#19 split-account problem: a user who signed up via
 * one method (phone), then signed up again via another (Google) at some
 * earlier point, ends up with two thin `User` rows. Either direction of
 * linking should silently merge them, since both halves are demonstrably the
 * same human (whoever's at the keyboard just proved control of both).
 *
 * Refuses (returns without writing) when the orphan also has a second
 * independent identity — that case looks like a real second human and must
 * be resolved via the explicit merge UX, not silently.
 *
 * Ordering inside the transaction is deliberate:
 *   1. Reparent the contested OAuth row (no-op for the phone case — phone
 *      lives on the `User` row, not in `Account`).
 *   2. Delete orphan sessions.
 *   3. Delete the orphan user — frees the unique `email` + `phoneNumber`
 *      constraints before we copy those fields onto the survivor.
 *   4. Update the survivor with whatever orphan fields are worth keeping
 *      (real email, name, image; phone for the phone-link direction).
 */
export async function absorbIfEligible(
  prisma: MergePrisma,
  args: {
    survivorUserId: string;
    orphanUserId: string;
    contested: ContestedIdentity;
  },
): Promise<MergeOutcome> {
  const { survivorUserId, orphanUserId, contested } = args;

  if (survivorUserId === orphanUserId) {
    return { result: 'refused', reason: 'self' };
  }

  return prisma.$transaction(async (tx) => {
    const orphan = await tx.user.findUnique({
      where: { id: orphanUserId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
        image: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        accounts: { select: { providerId: true, accountId: true } },
      },
    });
    if (!orphan) return { result: 'refused', reason: 'orphan_not_found' };

    if (!isThinOrphan(orphan, contested)) {
      return { result: 'refused', reason: 'not_thin' };
    }

    // 1. Reparent the contested OAuth row (only for `account` kind — phone
    //    has no Account row; it moves with the user delete).
    if (contested.kind === 'account') {
      await tx.account.updateMany({
        where: {
          userId: orphanUserId,
          providerId: contested.providerId,
          accountId: contested.accountId,
        },
        data: { userId: survivorUserId },
      });
    }

    // 2. Kill orphan sessions.
    await tx.session.deleteMany({ where: { userId: orphanUserId } });

    // 3. Delete orphan — frees its unique `email` and `phoneNumber` so the
    //    survivor can claim them in step 4 without a constraint violation.
    await tx.user.delete({ where: { id: orphanUserId } });

    // 4. Copy worthwhile orphan fields onto the survivor.
    const survivor = await tx.user.findUniqueOrThrow({
      where: { id: survivorUserId },
      select: {
        email: true,
        name: true,
        image: true,
      },
    });

    const updates: {
      email?: string;
      emailVerified?: boolean;
      name?: string | null;
      image?: string | null;
      phoneNumber?: string;
      phoneNumberVerified?: boolean;
    } = {};

    if (!survivor.name && orphan.name) updates.name = orphan.name;
    if (!survivor.image && orphan.image) updates.image = orphan.image;

    if (contested.kind === 'account') {
      // Google-link direction: orphan likely carried the real verified email
      // and survivor is a phone-signup with a `@phone.synctip` placeholder.
      const survivorEmailIsTemp = survivor.email.endsWith('@phone.synctip');
      if (orphan.email && survivorEmailIsTemp) {
        updates.email = orphan.email;
        updates.emailVerified = orphan.emailVerified;
      }
    } else {
      // Phone-link direction: move the phone from orphan to survivor.
      if (orphan.phoneNumber) {
        updates.phoneNumber = orphan.phoneNumber;
        updates.phoneNumberVerified = Boolean(orphan.phoneNumberVerified);
      }
    }

    if (Object.keys(updates).length > 0) {
      await tx.user.update({ where: { id: survivorUserId }, data: updates });
    }

    return { result: 'absorbed', orphanUserId };
  });
}
