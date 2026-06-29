import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { auth } from './auth';
import { getRole, type Role, type RoleSubject } from './roles';

/**
 * Thin service that derives the current caller's session + role from an
 * incoming Express request. Wraps Better-Auth's `getSession` so callers
 * never need to know about cookie names or session storage details, and
 * applies the env-var allowlist to classify the user into a `Role`.
 *
 * Designed to fail soft: any error reading the session is treated as
 * "no session" so a flaky auth dependency never breaks a probe like
 * `/health`.
 */
@Injectable()
export class SessionService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Return the authenticated user (Better-Auth session subject) or
   * `null` when the request has no valid session cookie. Never throws.
   */
  async getSubject(req: Request): Promise<RoleSubject | null> {
    try {
      const session = await auth.api.getSession({
        headers: toHeaders(req.headers),
      });
      return session?.user ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Classify the request into a role. Returns `undefined` when the
   * caller is unauthenticated; otherwise one of `owner | admin | user`.
   */
  async getRole(req: Request): Promise<Role | undefined> {
    const subject = await this.getSubject(req);
    return getRole(subject, this.config);
  }
}

/**
 * Convert Express's mutable plain-object headers into the fetch
 * `Headers` shape Better-Auth's API expects.
 */
function toHeaders(
  reqHeaders: Record<string, string | string[] | undefined>,
): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(reqHeaders)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(name, v);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}
