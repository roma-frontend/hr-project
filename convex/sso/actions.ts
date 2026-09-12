/**
 * SSO OIDC protocol layer — internalConvex actions that do the network I/O
 * (Convex actions may fetch; mutations may not).
 *
 * The flow lives in two Convex httpActions (see convex/http.ts):
 *   GET /api/sso/<connectionId>          → redirect to the IdP (state+PKCE)
 *   GET /api/sso/callback/<connectionId> → validate, consume flow, open session
 *
 * Sessions are then bridged to the Next.js app by the existing imid-callback
 * pattern (Convex httpAction → /api/auth/imid-callback?sessionToken=… → JWT
 * cookies), so SSO sessions are identical to password/Google/imID sessions
 * downstream. Nothing in the existing auth stack changes.
 *
 * Pure protocol helpers live in ./protocol.ts (unit-testable without Convex).
 */
import { internalAction, internalQuery, action } from '../_generated/server';
import { v } from 'convex/values';
import { normalizeIssuer } from './protocol';
import { getAuthCaller } from '../lib/getAuthCaller';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';

export interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
}

/** Fetch and validate the IdP's discovery document. */
export const fetchDiscovery = internalAction({
  args: { issuer: v.string() },
  handler: async (_ctx, { issuer }): Promise<OidcDiscovery> => {
    return runDiscovery(issuer);
  },
});

/** Shared discovery fetch (also used by the admin test-connection action). */
async function runDiscovery(issuer: string): Promise<OidcDiscovery> {
  const normalized = normalizeIssuer(issuer);
  const res = await fetch(`${normalized}/.well-known/openid-configuration`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Discovery request failed (${res.status})`);
  const doc = (await res.json()) as Partial<OidcDiscovery>;
  if (!doc.authorization_endpoint || !doc.token_endpoint) {
    throw new Error('IdP discovery document is missing required endpoints');
  }
  return {
    authorization_endpoint: doc.authorization_endpoint,
    token_endpoint: doc.token_endpoint,
    userinfo_endpoint: doc.userinfo_endpoint,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: test connection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Org-admin connection check with the caller's row projected after auth.
 * Public actions have no DB access — this internal query is the gate.
 */
export const getConnectionForTest = internalQuery({
  args: { connectionId: v.id('ssoConnections') },
  handler: async (ctx, args): Promise<{ issuer: string; label?: string }> => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    if (caller.role !== 'admin' && caller.role !== 'superadmin') {
      throw new Error('Only organization admins can test SSO connections');
    }
    const row = await ctx.db.get(args.connectionId);
    if (!row || row.organizationId !== caller.organizationId) {
      throw new Error('Connection not found');
    }
    return { issuer: row.issuer, label: row.label };
  },
});

/**
 * Verify an SSO connection is actually usable — the closest thing to the
 * webhook test-delivery without a full browser redirect round-trip:
 *
 * 1. discovery document fetches and parses, with the required endpoints present
 * 2. the JWKS endpoint answers and holds at least one signing key
 *
 * This catches the most common setup mistakes (typo'd issuer, IdP down, TLS,
 * wrong well-known path). It cannot prove the client secret is correct — that
 * needs a real authorization-code exchange from a browser login.
 *
 * A public action so the client gets the result synchronously and can toast it.
 */
interface TestConnectionResult {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  jwksUri: string;
  keyCount: number;
}

export const testConnection = action({
  args: { connectionId: v.id('ssoConnections') },
  handler: async (ctx, args): Promise<TestConnectionResult> => {
    const conn: { issuer: string; label?: string } = await ctx.runQuery(
      internal.sso.actions.getConnectionForTest,
      { connectionId: args.connectionId as Id<'ssoConnections'> },
    );

    const discovery = await runDiscovery(conn.issuer);

    // The JWKS URL is normally <issuer>/.well-known/jwks.json; prefer the
    // discovery document's jwks_uri when the IdP publishes one.
    let jwksUri = `${normalizeIssuer(conn.issuer)}/.well-known/jwks.json`;
    try {
      const res = await fetch(`${normalizeIssuer(conn.issuer)}/.well-known/openid-configuration`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const doc = (await res.json()) as { jwks_uri?: string };
        if (doc.jwks_uri) jwksUri = doc.jwks_uri;
      }
    } catch {
      // Discovery already succeeded above; fall back to the conventional URL.
    }

    const jwksRes = await fetch(jwksUri, { cache: 'no-store' });
    if (!jwksRes.ok) throw new Error(`JWKS request failed (${jwksRes.status})`);
    const jwks = (await jwksRes.json()) as { keys?: unknown[] };
    const keyCount = Array.isArray(jwks.keys) ? jwks.keys.length : 0;
    if (keyCount === 0) throw new Error('JWKS document contains no signing keys');

    return {
      issuer: conn.issuer,
      authorizationEndpoint: discovery.authorization_endpoint,
      tokenEndpoint: discovery.token_endpoint,
      userinfoEndpoint: discovery.userinfo_endpoint,
      jwksUri,
      keyCount,
    } satisfies TestConnectionResult;
  },
});

export interface TokenExchangeResult {
  idToken: string;
  accessToken?: string;
}

/**
 * Authorization-code + PKCE token exchange (client_secret_basic auth).
 * Returns the raw id_token — signature verification happens in verifyIdToken.
 */
export const exchangeCode = internalAction({
  args: {
    tokenEndpoint: v.string(),
    clientId: v.string(),
    clientSecret: v.string(),
    code: v.string(),
    codeVerifier: v.string(),
    redirectUri: v.string(),
  },
  handler: async (_ctx, args): Promise<TokenExchangeResult | null> => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: args.code,
      redirect_uri: args.redirectUri,
      code_verifier: args.codeVerifier,
    });
    const res = await fetch(args.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${encodeURIComponent(args.clientId)}:${encodeURIComponent(args.clientSecret)}`)}`,
      },
      body,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { id_token?: string; access_token?: string };
    if (!json.id_token) return null;
    return { idToken: json.id_token, accessToken: json.access_token };
  },
});

export interface IdTokenClaims {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
}

/**
 * Verify an OIDC id_token against the IdP's JWKS: signature, issuer,
 * audience and expiry. Throws 'SSO_LOGIN_FAILED|<key>' on any failure —
 * the httpAction maps the key to a translated login-page message.
 */
export const verifyIdToken = internalAction({
  args: {
    idToken: v.string(),
    issuer: v.string(),
    clientId: v.string(),
  },
  handler: async (_ctx, { idToken, issuer, clientId }): Promise<IdTokenClaims> => {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    const normalized = normalizeIssuer(issuer);
    const JWKS = createRemoteJWKSet(new URL(`${normalized}/.well-known/jwks.json`));
    try {
      const { payload } = await jwtVerify(idToken, JWKS, {
        issuer: normalized,
        audience: clientId,
      });
      return payload as unknown as IdTokenClaims;
    } catch {
      throw new Error('SSO_LOGIN_FAILED|invalid_id_token');
    }
  },
});

/** Best-effort userinfo fetch — enriches name/picture when present. */
export const fetchUserinfo = internalAction({
  args: {
    userinfoEndpoint: v.string(),
    accessToken: v.string(),
  },
  handler: async (_ctx, { userinfoEndpoint, accessToken }): Promise<IdTokenClaims | null> => {
    try {
      const res = await fetch(userinfoEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      return (await res.json()) as IdTokenClaims;
    } catch {
      return null;
    }
  },
});
