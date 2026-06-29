/**
 * Role-based authorization helpers.
 *
 * We classify each authenticated session into one of three roles by
 * matching the user's email and phone against env-var allowlists:
 *
 *   OWNER_EMAILS, OWNER_PHONES   → 'owner'
 *   ADMIN_EMAILS, ADMIN_PHONES   → 'admin'
 *   (no match)                   → 'user'
 *
 * Unauthenticated callers have no role at all (`undefined`).
 *
 * Email/phone allowlisting (rather than a DB column) is intentional for
 * the first iteration:
 *   - No schema migration / admin UI required to get protection live.
 *   - Source of truth lives in Render env vars, which only the deploy
 *     owner can change.
 *   - Promotion / demotion happens by editing env vars + redeploying —
 *     a deliberately heavyweight action for high-privilege changes.
 *
 * A later iteration can replace this with a `User.role` column and an
 * admin UI without changing the call-sites that consume `Role`.
 */

import type { ConfigService } from '@nestjs/config';

export type Role = 'owner' | 'admin' | 'user';

/**
 * Subset of the Better-Auth user we need to derive a role. Kept narrow so
 * the helper can be reused with the user objects returned by either
 * `auth.api.getSession` or direct Prisma queries.
 */
export interface RoleSubject {
  email?: string | null;
  phoneNumber?: string | null;
}

/**
 * Classify a session subject into a role. Returns `undefined` when no
 * subject is provided — callers should treat that as "unauthenticated".
 *
 * Match is case-insensitive for emails and exact for phone numbers
 * (which must be E.164 with a leading `+` in both the allowlist and the
 * stored User row).
 */
export function getRole(
  subject: RoleSubject | null | undefined,
  config: Pick<ConfigService, 'get'>,
): Role | undefined {
  if (!subject) return undefined;

  const ownerEmails = parseList(config.get<string>('OWNER_EMAILS'));
  const ownerPhones = parseList(config.get<string>('OWNER_PHONES'));
  if (matches(subject, ownerEmails, ownerPhones)) return 'owner';

  const adminEmails = parseList(config.get<string>('ADMIN_EMAILS'));
  const adminPhones = parseList(config.get<string>('ADMIN_PHONES'));
  if (matches(subject, adminEmails, adminPhones)) return 'admin';

  return 'user';
}

/** True for owner or admin — the privileged tier. */
export function isPrivileged(role: Role | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

function parseList(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase()),
  );
}

function matches(
  subject: RoleSubject,
  emails: Set<string>,
  phones: Set<string>,
): boolean {
  const email = subject.email?.toLowerCase();
  const phone = subject.phoneNumber?.toLowerCase();
  return (
    (email !== undefined && email !== '' && emails.has(email)) ||
    (phone !== undefined && phone !== '' && phones.has(phone))
  );
}
