/**
 * Public API v1 — key helpers and the employee projection.
 *
 * Two things are worth testing here above everything else:
 *
 *   1. `toEmployeeDto` must never leak a credential field. The `users` document
 *      carries `passwordHash`, `sessionToken`, `totpSecret`, `backupCodes`,
 *      `resetPasswordToken` and `faceDescriptor`; shipping any of them to a
 *      read-only integration key is the worst mistake available in this feature.
 *   2. `bearerToken` decides whether a request is authenticated at all, so its
 *      parsing must not be permissive (e.g. accepting an empty token).
 */

import {
  API_KEY_PREFIX,
  API_SCOPES,
  apiKeyPrefix,
  bearerToken,
  generateApiKey,
  hasScope,
  isApiScope,
  normalizeScopes,
} from '../../convex/lib/apiKey';
import { toEmployeeDto } from '../../convex/apiV1';

// jsdom does not always expose WebCrypto; the key generator needs it.
beforeAll(() => {
  if (!globalThis.crypto?.getRandomValues) {
    const nodeCrypto = require('node:crypto') as typeof import('node:crypto');
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: (arr: Uint8Array) => nodeCrypto.randomFillSync(arr) },
      configurable: true,
    });
  }
});

describe('bearerToken', () => {
  it('reads a well-formed Authorization header', () => {
    expect(bearerToken('Bearer strata_abc123')).toBe('strata_abc123');
  });

  it('accepts a case-insensitive scheme and surrounding whitespace', () => {
    expect(bearerToken('  bearer   strata_abc123  ')).toBe('strata_abc123');
  });

  it('returns null for a missing, empty or malformed header', () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken('')).toBeNull();
    expect(bearerToken('Bearer')).toBeNull();
    // Reserved for the future: the key must never be taken from these.
    expect(bearerToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(bearerToken('strata_abc123')).toBeNull();
  });

  it('does not accept an empty credential', () => {
    expect(bearerToken('Bearer    ')).toBeNull();
  });
});

describe('scopes', () => {
  it('recognizes only declared scopes', () => {
    expect(isApiScope('employees:read')).toBe(true);
    expect(isApiScope('employees:write')).toBe(false);
    expect(isApiScope('')).toBe(false);
  });

  it('drops unknown scopes and de-duplicates, in canonical order', () => {
    const normalized = normalizeScopes([
      'leaves:read',
      'employees:write',
      'employees:read',
      'leaves:read',
    ]);
    expect(normalized).toEqual(['employees:read', 'leaves:read']);
    // Canonical order comes from API_SCOPES, not from the caller's order.
    expect(normalized).toEqual(API_SCOPES.filter((s) => normalized.includes(s)));
  });

  it('returns nothing when no requested scope is recognized', () => {
    expect(normalizeScopes(['nope:read'])).toEqual([]);
  });

  it('checks granted scope coverage', () => {
    expect(hasScope(['employees:read'], 'employees:read')).toBe(true);
    expect(hasScope(['leaves:read'], 'employees:read')).toBe(false);
    expect(hasScope([], 'employees:read')).toBe(false);
  });
});

describe('generateApiKey', () => {
  it('prefixes the key so a leak is recognizable', () => {
    expect(generateApiKey().startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it('produces a distinct key every time', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey()));
    expect(keys.size).toBe(50);
  });

  it('has enough entropy to be unguessable', () => {
    const key = generateApiKey();
    // `strata_` + 24 bytes of base64url ≈ 32 characters of payload.
    expect(key.length).toBeGreaterThan(API_KEY_PREFIX.length + 20);
  });

  it('stores a display prefix shorter than the whole key', () => {
    const key = generateApiKey();
    const prefix = apiKeyPrefix(key);
    expect(prefix.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(prefix.length).toBeLessThan(key.length);
    // Must not be long enough to weaken the key if it leaks into a list view.
    expect(prefix.length).toBeLessThanOrEqual(API_KEY_PREFIX.length + 6);
  });
});

describe('toEmployeeDto', () => {
  const fullUser = {
    _id: 'user_1',
    _creationTime: 1,
    organizationId: 'org_1',
    name: 'Aram Sargsyan',
    email: 'aram@example.am',
    passwordHash: 'super-secret-bcrypt-hash',
    sessionToken: 'session-token-xyz',
    resetPasswordToken: 'reset-token',
    totpSecret: 'totp-secret',
    backupCodes: ['a', 'b'],
    faceDescriptor: [0.1, 0.2, 0.3],
    nationalId: '1234567890',
    webauthnChallenge: 'challenge',
    role: 'employee',
    employeeType: 'staff',
    departmentId: 'dept_1',
    department: 'Engineering',
    positionId: 'pos_1',
    position: 'Backend Engineer',
    supervisorId: 'user_2',
    phone: '+37400000000',
    location: 'Yerevan',
    avatarUrl: null,
    isActive: true,
    isApproved: true,
    language: 'hy',
    paidLeaveBalance: 14,
    sickLeaveBalance: 7,
    familyLeaveBalance: 3,
    createdAt: 1750000000000,
  } as never;

  it('projects the fields an integration needs', () => {
    const dto = toEmployeeDto(fullUser);
    expect(dto.email).toBe('aram@example.am');
    expect(dto.name).toBe('Aram Sargsyan');
    expect(dto.department).toBe('Engineering');
    expect(dto.position).toBe('Backend Engineer');
    expect(dto.leaveBalances.paid).toBe(14);
  });

  it('never exposes credentials or biometrics', () => {
    const serialized = JSON.stringify(toEmployeeDto(fullUser));
    for (const forbidden of [
      'passwordHash',
      'sessionToken',
      'resetPasswordToken',
      'resetPasswordExpiry',
      'totpSecret',
      'backupCodes',
      'faceDescriptor',
      'webauthnChallenge',
      'nationalId',
      'super-secret-bcrypt-hash',
      'session-token-xyz',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('emits null (not undefined) for absent optional values', () => {
    // JSON.stringify drops `undefined`, which makes a field disappear from the
    // payload entirely instead of reading as "not set".
    const dto = toEmployeeDto({ ...(fullUser as object), phone: undefined } as never);
    expect(dto.phone).toBeNull();
    expect(JSON.parse(JSON.stringify(dto)).phone).toBeNull();
  });
});
