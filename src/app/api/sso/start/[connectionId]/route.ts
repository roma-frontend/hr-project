/**
 * SAML 2.0 SP-initiated login start.
 *
 * GET /api/sso/start/<connectionId>?redirect=<path>
 *
 * Creates a single-use login flow (the same ssoLoginFlows table the OIDC flow
 * uses — free replay protection) and 302s the browser to the IdP's
 * Single Sign-On URL. RelayState carries the CSRF-protected state, which the
 * ACS verifies before consuming the flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomToken } from '@/lib/sso/protocol';

export const runtime = 'nodejs';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;
const FLOW_TTL_MS = 10 * 60 * 1000;

interface ConvexResponse {
  status: string;
  value?: unknown;
  errorMessage?: string;
}

/**
 * Convex HTTP bridge. Any transport failure (unreachable deployment, bad
 * gateway, non-JSON body) resolves to null so the route responds with its
 * graceful `sso_disabled`/`sso_error` login redirect instead of a 500 —
 * a login entry point must never crash the browser flow.
 */
async function convexQuery<T>(path: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
      cache: 'no-store',
    });
    const data = (await res.json()) as ConvexResponse;
    if (data.status === 'error') return null;
    return (data.value ?? null) as T | null;
  } catch {
    return null;
  }
}

async function convexMutation<T>(path: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${CONVEX_URL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
      cache: 'no-store',
    });
    const data = (await res.json()) as ConvexResponse;
    if (data.status === 'error') return null;
    return (data.value ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const connectionId = request.nextUrl.pathname.split('/').filter(Boolean).pop() ?? '';
  const appUrl = request.nextUrl.origin;

  if (!CONVEX_URL) {
    return NextResponse.redirect(new URL('/login?error=sso_config_error', appUrl));
  }

  // Resolve the IdP SSO URL through the internal projection (enabled only).
  const conn = await convexQuery<{ idpSsoUrl: string } | null>(
    'sso/flows:getSamlConnectionForStart',
    { connectionId },
  );
  const ssoUrl = conn?.idpSsoUrl;
  if (!ssoUrl) {
    return NextResponse.redirect(new URL('/login?error=sso_disabled', appUrl));
  }

  const state = randomToken(16);
  const flow = await convexMutation<{ _id: string } | null>('sso/flows:createFlow', {
    state,
    connectionId,
    redirectUri: `${appUrl}/api/sso/acs/${connectionId}`,
    codeVerifier: randomToken(24), // SAML has no PKCE; the slot is unused
    ttlMs: FLOW_TTL_MS,
  });
  if (!flow) {
    return NextResponse.redirect(new URL('/login?error=sso_error', appUrl));
  }

  const redirect = request.nextUrl.searchParams.get('redirect') ?? '/dashboard';
  const relay = Buffer.from(
    JSON.stringify({ state, redirect: redirect.startsWith('/') ? redirect : '/dashboard' }),
  ).toString('base64url');

  const idpUrl = new URL(ssoUrl);
  idpUrl.searchParams.set('RelayState', relay);

  const res = NextResponse.redirect(idpUrl.toString());
  // HttpOnly cookie mirrors the OIDC start route's CSRF defense in depth.
  res.cookies.set('hr-saml-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: FLOW_TTL_MS / 1000,
    path: '/',
  });
  return res;
}
