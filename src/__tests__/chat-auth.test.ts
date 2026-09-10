/**
 * Tests for src/lib/chat-auth.ts
 *
 * next/headers and jose are mocked; the cookie store is configurable per test.
 */

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('jose', () => ({ jwtVerify: jest.fn() }));

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { verifyChatAuth } from '@/lib/chat-auth';

const cookiesMock = cookies as jest.Mock;
const jwtVerifyMock = jwtVerify as jest.Mock;

function mockCookies(map: Record<string, string>) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (map[name] ? { value: map[name] } : undefined),
  });
}

const originalSecret = process.env.JWT_SECRET;

afterAll(() => {
  process.env.JWT_SECRET = originalSecret;
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret-for-jest-only-not-for-production-32chars';
});

describe('verifyChatAuth', () => {
  it('returns null when no cookie is present', async () => {
    mockCookies({});
    expect(await verifyChatAuth()).toBeNull();
    expect(jwtVerifyMock).not.toHaveBeenCalled();
  });

  it('returns null when JWT_SECRET is not configured', async () => {
    mockCookies({ 'hr-auth-token': 'jwt' });
    delete process.env.JWT_SECRET;
    expect(await verifyChatAuth()).toBeNull();
    expect(jwtVerifyMock).not.toHaveBeenCalled();
  });

  it('reads the hr-auth-token cookie first', async () => {
    mockCookies({ 'hr-auth-token': 'primary', 'oauth-session': 'secondary' });
    jwtVerifyMock.mockResolvedValue({ payload: { sub: 'u1' } });

    await verifyChatAuth();

    expect(jwtVerifyMock).toHaveBeenCalledWith('primary', expect.anything());
  });

  it('falls back to the oauth-session cookie', async () => {
    mockCookies({ 'oauth-session': 'secondary' });
    jwtVerifyMock.mockResolvedValue({ payload: { sub: 'u1' } });

    await verifyChatAuth();

    expect(jwtVerifyMock).toHaveBeenCalledWith('secondary', expect.anything());
  });

  it('maps the payload to a ChatAuth object', async () => {
    mockCookies({ 'hr-auth-token': 'jwt' });
    jwtVerifyMock.mockResolvedValue({
      payload: { sub: 'user-42', role: 'admin', organizationId: 'org-9' },
    });

    await expect(verifyChatAuth()).resolves.toEqual({
      userId: 'user-42',
      role: 'admin',
      organizationId: 'org-9',
    });
  });

  it('defaults the role to employee', async () => {
    mockCookies({ 'hr-auth-token': 'jwt' });
    jwtVerifyMock.mockResolvedValue({ payload: { sub: 'user-42' } });

    const result = await verifyChatAuth();

    expect(result?.role).toBe('employee');
    expect(result?.organizationId).toBeUndefined();
  });

  it('returns null when jwtVerify rejects', async () => {
    mockCookies({ 'hr-auth-token': 'jwt' });
    jwtVerifyMock.mockRejectedValue(new Error('bad token'));

    expect(await verifyChatAuth()).toBeNull();
  });
});
