import { describe, expect, it } from 'bun:test';
import type { ConfigService } from '@nestjs/config';
import { getRole, isPrivileged } from './roles';

function fakeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => overrides[key],
  } as unknown as ConfigService;
}

describe('getRole', () => {
  it('returns undefined when there is no subject (unauthenticated)', () => {
    expect(getRole(null, fakeConfig())).toBeUndefined();
    expect(getRole(undefined, fakeConfig())).toBeUndefined();
  });

  it('classifies a matching owner email as "owner"', () => {
    const config = fakeConfig({
      OWNER_EMAILS: 'iliakmlv@synctip.com,iliakmlv@gmail.com',
    });
    expect(getRole({ email: 'iliakmlv@synctip.com' }, config)).toBe('owner');
    expect(getRole({ email: 'IliaKmlv@Gmail.com' }, config)).toBe('owner');
  });

  it('classifies a matching owner phone as "owner"', () => {
    const config = fakeConfig({ OWNER_PHONES: '+972503592156' });
    expect(getRole({ phoneNumber: '+972503592156' }, config)).toBe('owner');
  });

  it('classifies an admin email as "admin"', () => {
    const config = fakeConfig({
      OWNER_EMAILS: 'iliakmlv@synctip.com',
      ADMIN_EMAILS: 'admin@synctip.com,synctip.app@gmail.com',
    });
    expect(getRole({ email: 'admin@synctip.com' }, config)).toBe('admin');
  });

  it('prefers owner over admin when both lists match', () => {
    const config = fakeConfig({
      OWNER_EMAILS: 'me@example.com',
      ADMIN_EMAILS: 'me@example.com',
    });
    expect(getRole({ email: 'me@example.com' }, config)).toBe('owner');
  });

  it('returns "user" for an authenticated subject with no allowlist match', () => {
    const config = fakeConfig({
      OWNER_EMAILS: 'iliakmlv@synctip.com',
      ADMIN_EMAILS: 'admin@synctip.com',
    });
    expect(getRole({ email: 'random@example.com' }, config)).toBe('user');
  });

  it('does not promote on an empty / unset allowlist', () => {
    expect(getRole({ email: 'random@example.com' }, fakeConfig())).toBe('user');
    expect(
      getRole(
        { email: 'random@example.com' },
        fakeConfig({ OWNER_EMAILS: '', ADMIN_EMAILS: '' }),
      ),
    ).toBe('user');
  });

  it('ignores empty / whitespace entries in the allowlist', () => {
    const config = fakeConfig({
      OWNER_EMAILS: ' ,iliakmlv@synctip.com, ,',
    });
    expect(getRole({ email: 'iliakmlv@synctip.com' }, config)).toBe('owner');
    // An empty subject email must not be matched by empty allowlist entries.
    expect(getRole({ email: '' }, config)).toBe('user');
  });
});

describe('isPrivileged', () => {
  it('is true for owner and admin only', () => {
    expect(isPrivileged('owner')).toBe(true);
    expect(isPrivileged('admin')).toBe(true);
    expect(isPrivileged('user')).toBe(false);
    expect(isPrivileged(undefined)).toBe(false);
  });
});
