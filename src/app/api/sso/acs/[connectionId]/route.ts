/**
 * SAML 2.0 Assertion Consumer Service.
 *
 * POST /api/sso/acs/<connectionId>   (SAMLResponse + RelayState)
 *
 * Flow:
 *   1. Look up the SAML connection (internal projection).
 *   2. Validate the assertion via convex/sso/samlActions (Node runtime):
 *      signature (pinned cert), audience, recipient, freshness, schema.
 *   3. Verify RelayState against the single-use login flow — SP-initiated
 *      replay is impossible because the flow row is consumed exactly once.
 *   4. Domain allowlist, then find-or-provision the user.
 *   5. Open the session via completeSsoLogin and bridge to
 *      /api/auth/imid-callback?sessionToken=… (the established JWT-cookie
 *      handshake), so SAML sessions are identical to every other login.
 *
 * Failure → redirect to /login?error=<key> (never leaks validation detail).
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

interface ConvexResponse {
  status: string;
  value?: unknown;
  errorMessage?: string;
}

async function convexQuery<T>(path: string, args: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
    cache: 'no-store',
  });
  const data = (await res.json()) as ConvexResponse;
  if (data.status === 'error') return null;
  return (data.value ?? null) as T | null;
}

async function convexMutation<T>(path: string, args: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
    cache: 'no-store',
  });
  const data = (await res.json()) as ConvexResponse;
  if (data.status === 'error') return null;
  return (data.value ?? null) as T | null;
}

async function convexAction<T>(path: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${CONVEX_URL}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
    cache: 'no-store',
  });
  const data = (await res.json()) as ConvexResponse;
  if (data.status === 'error') throw new Error(data.errorMessage ?? 'SAML validation failed');
  return data.value as T;
}

function backToLogin(errorKey: string, appUrl: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorKey)}`, appUrl));
}

export async function POST(request: NextRequest) {
  const appUrl = request.nextUrl.origin;
  const connectionId = request.nextUrl.pathname.split('/').filter(Boolean).pop() ?? '';

  try {
    const form = await request.formData();
    const samlResponse = form.get('SAMLResponse');
    const relayState = form.get('RelayState');
    if (typeof samlResponse !== 'string' || !samlResponse) {
      return backToLogin('sso_missing_params', appUrl);
    }
    if (typeof relayState !== 'string' || !relayState) {
      return backToLogin('sso_state_mismatch', appUrl);
    }

    let relay: { state: string; redirect: string };
    try {
      const parsed: unknown = JSON.parse(Buffer.from(relayState, 'base64url').toString('utf-8'));
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as { state?: unknown }).state !== 'string'
      ) {
        return backToLogin('sso_state_mismatch', appUrl);
      }
      relay = parsed as { state: string; redirect: string };
    } catch {
      return backToLogin('sso_state_mismatch', appUrl);
    }
    if (!relay.state) return backToLogin('sso_state_mismatch', appUrl);

    if (!CONVEX_URL) return backToLogin('sso_config_error', appUrl);

    const conn = await convexQuery<null | {
      organizationId: string;
      connectionId: string;
      idpEntityId: string;
      idpSsoUrl: string;
      idpCertificate: string;
      domains: string[];
      autoProvision: boolean;
      enabled: boolean;
      appUrl: string;
      spEntityId: string;
      acsUrl: string;
    }>('sso/flows:getSamlConnectionForAcs', { connectionId });
    if (!conn || !conn.enabled) return backToLogin('sso_disabled', appUrl);

    // Consume the flow FIRST: a rejected/forged response can never be retried
    // against a still-live state (fail-closed replay protection).
    const flow = await convexMutation<null | {
      _id: string;
      state: string;
      connectionId: string;
      expiresAt: number;
    }>('sso/flows:consumeFlow', { state: relay.state });
    if (!flow || flow.connectionId !== connectionId) {
      return backToLogin('sso_state_mismatch', appUrl);
    }

    // 1-2. Assertion validation (signature/audience/recipient/freshness).
    let claims: { email: string; name?: string };
    try {
      claims = await convexAction<{ email: string; name?: string }>(
        'sso/samlActions:validateAssertion',
        {
          samlResponse,
          idpEntityId: conn.idpEntityId,
          idpSsoUrl: conn.idpSsoUrl,
          idpCertificate: conn.idpCertificate,
          spEntityId: conn.spEntityId,
          acsUrl: conn.acsUrl,
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      logger.warn('[saml-acs] assertion rejected:', msg);
      await recordError(conn.organizationId, connectionId, msg);
      const key = msg.startsWith('SSO_LOGIN_FAILED|')
        ? (msg.split('|')[1] ?? 'sso_error')
        : 'sso_error';
      return backToLogin(key, appUrl);
    }

    // 3. Domain allowlist (mirrors the OIDC callback).
    const email = claims.email.toLowerCase().trim();
    if (conn.domains.length > 0) {
      const domain = email.split('@')[1] ?? '';
      if (!conn.domains.includes(domain)) {
        await record(conn.organizationId, connectionId, email, 'domain_denied');
        return backToLogin('sso_domain_denied', appUrl);
      }
    }

    const user = await convexQuery<null | { _id: string; isActive: boolean }>(
      'sso/flows:findUserByEmail',
      { email, organizationId: conn.organizationId },
    );
    if (user && !user.isActive) {
      await record(conn.organizationId, connectionId, email, 'inactive_user');
      return backToLogin('sso_account_inactive', appUrl);
    }

    let userId = user?._id ?? null;
    if (!userId && conn.autoProvision) {
      userId = await convexMutation<string | null>('sso/main:provisionUser', {
        organizationId: conn.organizationId,
        email,
        name: claims.name ?? '',
        connectionId,
      });
    }
    if (!userId) {
      await record(conn.organizationId, connectionId, email, 'user_not_found');
      return backToLogin('sso_user_not_found', appUrl);
    }

    const sessionToken = crypto.randomUUID();
    const login = await convexMutation<null | { userId: string }>('sso/main:completeSsoLogin', {
      userId,
      sessionToken,
      sessionExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
      connectionId,
    });
    if (!login) {
      await record(conn.organizationId, connectionId, email, 'error', 'login_rejected');
      return backToLogin('sso_login_rejected', appUrl);
    }

    await convexMutation('sso/main:recordLoginEvent', {
      organizationId: conn.organizationId,
      connectionId,
      userId,
      email,
      result: user ? 'success' : 'provisioned',
    });

    // 5. Bridge into the Next.js JWT-cookie flow (imid-callback pattern).
    const cb = new URL('/api/auth/imid-callback', conn.appUrl || appUrl);
    cb.searchParams.set('sessionToken', sessionToken);
    return NextResponse.redirect(cb.toString());
  } catch (e) {
    logger.error('[saml-acs] unexpected error:', e);
    return backToLogin('sso_error', appUrl);
  }
}

async function record(
  organizationId: string,
  connectionId: string,
  email: string,
  result: string,
  detail?: string,
): Promise<void> {
  try {
    await convexMutation('sso/main:recordLoginEvent', {
      organizationId,
      connectionId,
      email,
      result,
      detail,
    });
  } catch {
    /* audit must never break the flow */
  }
}

async function recordError(
  organizationId: string,
  connectionId: string,
  detail: string,
): Promise<void> {
  await record(organizationId, connectionId, '', 'error', detail.slice(0, 200));
}
