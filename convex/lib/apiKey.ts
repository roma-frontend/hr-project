/**
 * Public API key helpers — pure, no Convex imports, so they unit-test without a
 * runtime (and so the HTTP router can use them without dragging in registered
 * functions).
 */

import { randomToken } from '../sso/protocol';

/** Distinguishable prefix, so a leaked key is recognisable in a log or a repo. */
export const API_KEY_PREFIX = 'strata_';

/**
 * The v1 read surface. Deliberately four resources: an API that promises
 * everything and delivers half of it is worse than a small one that is exact.
 */
export const API_SCOPES = [
  'employees:read',
  'departments:read',
  'positions:read',
  'leaves:read',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

/** Keep only recognised scopes, de-duplicated, in canonical order. */
export function normalizeScopes(requested: readonly string[]): ApiScope[] {
  const wanted = new Set(requested);
  return API_SCOPES.filter((scope) => wanted.has(scope));
}

/** Does this key's scope list cover what the endpoint requires? */
export function hasScope(granted: readonly string[], required: ApiScope): boolean {
  return granted.includes(required);
}

/** A fresh key: `strata_` + 24 bytes of base64url entropy. */
export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomToken(24)}`;
}

/** The non-secret part stored alongside the hash for display. */
export function apiKeyPrefix(raw: string): string {
  return raw.slice(0, API_KEY_PREFIX.length + 6);
}

/** Extract the presented token from an `Authorization` header, or null. */
export function bearerToken(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}
