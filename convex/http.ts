/**
 * HTTP router for Convex
 */

import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  WEBHOOK_MAX_BODY_BYTES,
} from './integrations';
import { randomToken, pkceChallenge } from './sso/protocol';

const http = httpRouter();

/** Minimal shape of the Telegram update this router consumes. */
interface TelegramUpdate {
  callback_query?: {
    data?: string;
    message?: { chat?: { id?: number | string } };
  };
  message?: {
    text?: string;
    chat?: { id?: number | string };
    message_id?: number;
  };
  secret_token?: string;
}

// ── Telegram Bot Webhook ────────────────────────────────────────────────────
/**
 * Receives updates from the Telegram bot: inline keyboard callbacks
 * ("I completed screening") and text messages for screening responses.
 *
 * Set the webhook URL in Telegram BotFather:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<CONVEX_SITE>/api/telegram
 */
http.route({
  path: '/api/telegram',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as TelegramUpdate;

    // Handle inline keyboard callbacks (button presses)
    if (body.callback_query) {
      const cb = body.callback_query;
      const data: string = cb.data ?? '';

      // Validate the webhook secret
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (secret && body.secret_token !== secret) {
        return new Response('Unauthorized', { status: 401 });
      }

      // Handle screening completion callback: screening_done:<applicationId>
      if (data.startsWith('screening_done:')) {
        const applicationId = data.replace('screening_done:', '') as Id<'applications'>;
        try {
          // Look up the application to get organizationId for the mutation
          const app = await ctx.runQuery(internal.telegram.getAppForScreening, {
            applicationId,
          });
          if (app) {
            await ctx.runMutation(internal.telegram.markScreeningComplete, {
              applicationId,
              organizationId: app.organizationId,
            });

            // Fetch all screening responses for AI scoring
            const responses: { message: string; createdAt: number }[] = [];
            for (const resp of app.screeningResponses ?? []) {
              responses.push({ message: resp.message, createdAt: resp.createdAt });
            }

            // Run AI scoring (non-blocking — don't fail the webhook if scoring fails)
            if (responses.length > 0) {
              try {
                const scoreResult = await ctx.runAction(api.recruitmentAI.scoreScreeningResponses, {
                  applicationId,
                  vacancyTitle: app.vacancy?.title ?? 'Position',
                  vacancyDescription: app.vacancy?.description,
                  requirements: app.vacancy?.requirements,
                  screeningInstructions: app.screeningInstructions,
                  responses,
                });
                await ctx.runMutation(internal.telegram.saveScreeningScore, {
                  applicationId,
                  score: scoreResult.score,
                  verdict: scoreResult.verdict,
                  reasoning: scoreResult.reasoning,
                  strengths: scoreResult.strengths,
                  concerns: scoreResult.concerns,
                });
              } catch (scoringErr) {
                console.error('AI scoring failed:', scoringErr);
              }
            }

            // Send confirmation to candidate via Telegram
            if (app.candidate?.telegramChatId) {
              const botToken = process.env.TELEGRAM_BOT_TOKEN;
              if (botToken) {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: app.candidate.telegramChatId,
                    text: '✅ Скрининг завершен! / Screening completed!\n\nСпасибо за ответы. HR уведомлен и свяжется с вами.\nThank you for your answers. HR has been notified and will contact you.',
                    parse_mode: 'HTML',
                  }),
                }).catch(() => {}); // Non-critical
              }
            }
          }
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          console.error('Screening completion error:', e);
          return new Response(JSON.stringify({ ok: false, error: String(e) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Handle Telegram account linking: link:<email>
      if (data.startsWith('link:')) {
        // Email extracted but not used yet — the linking flow is handled by the bot command.
        void data.replace('link:', '');
        // TODO: find candidate profile by email and link Telegram chat
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle text messages (for screening responses)
    if (body.message) {
      const msg = body.message;
      const chatId = String(msg.chat?.id ?? '');
      const text = msg.text ?? '';

      // Ignore commands and non-text messages
      if (text.startsWith('/')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Find candidate by Telegram chat ID and store their screening response
      if (chatId) {
        try {
          // Find the active screening application for this Telegram user
          const screeningApp = (await ctx.runQuery(internal.telegram.findActiveScreeningApp, {
            telegramChatId: chatId,
          })) as {
            _id: Id<'applications'>;
            organizationId: Id<'organizations'>;
          } | null;
          if (screeningApp) {
            // Save the response to the screeningResponses table
            await ctx.runMutation(internal.telegram.saveScreeningResponse, {
              applicationId: screeningApp._id,
              organizationId: screeningApp.organizationId,
              message: text,
              telegramChatId: chatId,
              telegramMessageId: msg.message_id,
            });
          }
        } catch {
          // Non-critical — candidate may not be linked or in screening
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

// ── OIDC Discovery (required for Convex auth) ────────────────────────────────
http.route({
  path: '/.well-known/openid-configuration',
  method: 'GET',
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        issuer: process.env.CONVEX_SITE_URL,
        jwks_uri: process.env.CONVEX_SITE_URL + '/.well-known/jwks.json',
        authorization_endpoint: process.env.CONVEX_SITE_URL + '/oauth/authorize',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=15, stale-if-error=86400',
        },
      },
    );
  }),
});

http.route({
  path: '/.well-known/jwks.json',
  method: 'GET',
  handler: httpAction(async () => {
    if (!process.env.JWKS) {
      throw new Error('Missing JWKS Convex environment variable');
    }
    return new Response(process.env.JWKS, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=15, stale-if-error=86400',
      },
    });
  }),
});

// ── Lucky Carrot inbound webhook ─────────────────────────────────────────────
/**
 * Employee changes pushed by Lucky Carrot, so a new hire lands here in seconds
 * instead of waiting for the hourly sync sweep.
 *
 * The organization is named in the path rather than the body: the signature is
 * checked against that organization's own secret, so a caller cannot present a
 * valid signature for one tenant and have it applied to another.
 *
 * Authentication, replay rejection and every write live in
 * `internal.integrations.ingestLuckyCarrotWebhook` — this handler only moves
 * bytes and maps the outcome onto a status code.
 */
http.route({
  pathPrefix: '/webhooks/lucky-carrot/',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const organizationIdRaw = new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? '';

    const tooLarge = () =>
      new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });

    // Reject an oversized body before reading it into memory or hashing it.
    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > WEBHOOK_MAX_BODY_BYTES) {
      return tooLarge();
    }

    // The raw text is what was signed — parsing and re-serializing would change
    // key order and whitespace, and the HMAC would never match.
    const body = await request.text();
    // Re-check: content-length is advisory and may be absent or understated.
    if (body.length > WEBHOOK_MAX_BODY_BYTES) return tooLarge();

    const outcome = await ctx.runAction(internal.integrations.ingestLuckyCarrotWebhook, {
      organizationIdRaw,
      body,
      signature: request.headers.get(WEBHOOK_SIGNATURE_HEADER) ?? '',
      timestamp: request.headers.get(WEBHOOK_TIMESTAMP_HEADER) ?? '',
    });

    const json = (status: number, payload: Record<string, unknown>) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

    switch (outcome.status) {
      case 'unauthorized':
        return json(401, { error: 'Invalid signature' });
      case 'disabled':
        // 202: authentic sender, nothing applied. A 4xx here would make Lucky
        // Carrot retry and eventually disable the endpoint on its side.
        return json(202, { ok: false, error: 'Webhook is disabled for this organization' });
      case 'invalid':
        // 400 — the delivery is malformed, so retrying it verbatim cannot help.
        return json(400, { ok: false, error: outcome.message });
      case 'ok':
        return json(200, {
          ok: true,
          message: outcome.message,
          created: outcome.created,
          updated: outcome.updated,
          skipped: outcome.skipped,
        });
      default:
        return json(500, { error: 'Unknown outcome status' });
    }
  }),
});

// ── imID OAuth Login Callback ────────────────────────────────────────────────
/**
 * OAuth redirect target for imID login.
 *
 * imID redirects the user here after authentication with an authorization code
 * and state parameter. This handler exchanges the code for a session, then
 * redirects the browser to the app with a session cookie.
 *
 * The state parameter is validated against the stored value to prevent CSRF.
 */
http.route({
  pathPrefix: '/auth/imid/callback/',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('code') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const error = url.searchParams.get('error') ?? '';

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // User denied or imID returned an error.
    if (error) {
      const loc = new URL('/login?error=imid_denied', APP_URL);
      loc.searchParams.set('imid_error', error);
      return new Response(null, { status: 302, headers: { Location: loc.toString() } });
    }

    if (!code || !state) {
      const loc = new URL('/login?error=imid_missing_params', APP_URL);
      return new Response(null, { status: 302, headers: { Location: loc.toString() } });
    }

    // The org id is embedded in the state when we generated the authorize URL
    // (see imidGetAuthorizationUrl). It was persisted as a hex string alongside
    // the org id in the config. To keep the state simple, the state IS the hex
    // and we try every enabled imID config — but that's O(n). Better: extract
    // the org from the redirect_uri which is in the saved config.
    // We store state per-org, so try to find the right org from the code+state.
    // For simplicity, the state ties to the latest config.
    // In a multi-org setup, the app should ensure org-specific redirect URIs.

    // Scan all imID configs for a matching state.
    // (This is an httpAction so we have no direct db access — use internal query.)
    const orgResult = await ctx.runAction(internal.integrations.imidResolveOrgByState, {
      state,
    });

    if (!orgResult || !orgResult.organizationId) {
      const loc = new URL('/login?error=imid_invalid_state', APP_URL);
      return new Response(null, { status: 302, headers: { Location: loc.toString() } });
    }

    // Exchange the code for a session.
    const result = await ctx.runAction(internal.integrations.imidLoginCallback, {
      organizationId: orgResult.organizationId,
      code,
      state,
    });

    if (result.status === 'error') {
      const loc = new URL('/login?error=imid_login_failed', APP_URL);
      loc.searchParams.set('imid_message', result.message);
      return new Response(null, { status: 302, headers: { Location: loc.toString() } });
    }

    // The Convex HTTP runtime cannot sign a JWT (no access to JWT_SECRET),
    // so we delegate to the Next.js API route which will:
    //   1. Verify the session token via Convex query `auth:verifySession`
    //   2. Sign a proper JWT with user info
    //   3. Set hr-auth-token (JWT) + hr-session-token (UUID) cookies
    //   4. Redirect to /dashboard
    const callbackUrl = new URL('/api/auth/imid-callback', APP_URL);
    callbackUrl.searchParams.set('sessionToken', result.sessionToken);
    if (result.isNewUser) {
      callbackUrl.searchParams.set('welcome', 'true');
    }
    if (result.needsApproval) {
      callbackUrl.searchParams.set('pending_approval', 'true');
    }

    return new Response(null, {
      status: 302,
      headers: { Location: callbackUrl.toString() },
    });
  }),
});

// ── imID Sign Webhook ────────────────────────────────────────────────────────
/**
 * Receive signing callbacks from imID.
 *
 * When a user completes or declines a signing request in the imID app, imID
 * sends a POST to this endpoint with the outcome.
 */
http.route({
  pathPrefix: '/webhooks/imid/sign/',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const organizationIdRaw = new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? '';

    const body = await request.text();
    if (body.length > 1_000_000) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const outcome = await ctx.runAction(internal.integrations.ingestImidSignCallback, {
      organizationIdRaw,
      body,
    });

    return new Response(JSON.stringify({ ok: true, message: outcome.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

// ── imID Verify Webhook ───────────────────────────────────────────────────────
/**
 * Receive verification callbacks from imID.
 *
 * Delegates to `ingestImidVerifyCallback` because `httpAction` has no `ctx.db`.
 */
http.route({
  pathPrefix: '/webhooks/imid/verify/',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    if (body.length > 1_000_000) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const organizationIdRaw = new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? '';

    await ctx.runAction(internal.integrations.ingestImidVerifyCallback, {
      organizationIdRaw,
      body,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

// ── imID Resolve Org By State (internal) ──────────────────────────────────────
/**
 * Resolve the organization that owns a given OAuth state value.
 * Scans all integration configs for a matching `oauthState`.
 */
export {};

// ── SSO (OIDC) — start + callback ────────────────────────────────────────────
// Full protocol in convex/sso/actions.ts (discovery, PKCE, token exchange,
// id_token verification); single-use state in convex/sso/flows.ts. Sessions
// bridge into the Next.js app via the same imid-callback pattern every other
// federated login already uses — nothing in the existing auth stack changes.

const SSO_FLOW_TTL_MS = 10 * 60 * 1000;
const SSO_COOKIE = 'sso_flow_state';

function ssoSetCookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SSO_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

/** Safe post-login redirect target — never allow open redirects. */

function ssoBackToLogin(errorKey: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `/login?sso_error=${errorKey}` },
  });
}

http.route({
  pathPrefix: '/api/sso/',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // ['api','sso',…]
    const tail = parts.slice(2);

    // ── GET /api/sso/callback/<connectionId>?code&state ────────────────────
    if (tail[0] === 'callback') {
      const connectionId = tail[1] ?? '';
      const code = url.searchParams.get('code') ?? '';
      const state = url.searchParams.get('state') ?? '';

      if (url.searchParams.get('error')) return ssoBackToLogin('sso_cancelled');
      if (!code || !state) return ssoBackToLogin('sso_missing_params');

      // CSRF: the state must match the single-use HttpOnly cookie set at start.
      const cookieState = request.headers
        .get('cookie')
        ?.split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${SSO_COOKIE}=`))
        ?.slice(SSO_COOKIE.length + 1);
      if (!cookieState || cookieState !== state) return ssoBackToLogin('sso_state_mismatch');

      const flow = await ctx.runMutation(internal.sso.flows.consumeFlow, { state });
      if (!flow || flow.connectionId !== connectionId) {
        return ssoBackToLogin('sso_state_mismatch');
      }

      const conn = await ctx.runQuery(internal.sso.flows.getConnectionForCallback, {
        connectionId,
      });
      if (!conn || !conn.enabled) return ssoBackToLogin('sso_disabled');

      try {
        // Resolve the token endpoint: explicit override first, then discovery.
        let tokenEndpoint = conn.tokenEndpoint;
        if (!tokenEndpoint) {
          const discovery = await ctx.runAction(internal.sso.actions.fetchDiscovery, {
            issuer: conn.issuer,
          });
          tokenEndpoint = discovery.token_endpoint;
        }

        const tokens = await ctx.runAction(internal.sso.actions.exchangeCode, {
          tokenEndpoint,
          clientId: conn.clientId,
          clientSecret: conn.clientSecret,
          code,
          codeVerifier: flow.codeVerifier,
          redirectUri: flow.redirectUri,
        });
        if (!tokens) return ssoBackToLogin('sso_token_exchange_failed');

        // Throws 'SSO_LOGIN_FAILED|<key>' — signature/issuer/audience/expiry.
        const claims = await ctx.runAction(internal.sso.actions.verifyIdToken, {
          idToken: tokens.idToken,
          issuer: conn.issuer,
          clientId: conn.clientId,
        });
        if (!claims.email) return ssoBackToLogin('sso_no_email');
        if (claims.email_verified === false) return ssoBackToLogin('sso_email_unverified');

        const email = claims.email.toLowerCase().trim();
        if (conn.domains.length > 0) {
          const domain = email.split('@')[1] ?? '';
          if (!conn.domains.includes(domain)) return ssoBackToLogin('sso_domain_denied');
        }

        const user = await ctx.runQuery(internal.sso.flows.findUserByEmail, {
          email,
          organizationId: conn.organizationId,
        });
        if (user && !user.isActive) return ssoBackToLogin('sso_account_inactive');

        let userId = user?._id ?? null;
        if (!userId && conn.autoProvision) {
          userId = await ctx.runMutation(internal.sso.main.provisionUser, {
            organizationId: conn.organizationId,
            email,
            name: claims.name ?? claims.preferred_username ?? '',
            avatarUrl: claims.picture,
            connectionId,
          });
        }
        if (!userId) return ssoBackToLogin('sso_user_not_found');

        const sessionToken = crypto.randomUUID();
        const sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
        const login = await ctx.runMutation(internal.sso.main.completeSsoLogin, {
          userId,
          sessionToken,
          sessionExpiry,
          connectionId,
        });
        if (!login) return ssoBackToLogin('sso_login_rejected');

        await ctx.runMutation(internal.sso.main.recordLoginEvent, {
          organizationId: conn.organizationId,
          connectionId,
          userId,
          email,
          result: user ? 'success' : 'provisioned',
        });

        // Bridge into the Next.js JWT-cookie flow (imid-callback pattern).
        const cb = new URL(`${conn.appUrl}/api/auth/imid-callback`);
        cb.searchParams.set('sessionToken', sessionToken);
        const headers = new Headers({ Location: cb.toString() });
        headers.append('Set-Cookie', ssoSetCookie('', 0));
        return new Response(null, { status: 302, headers });
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        await ctx.runMutation(internal.sso.main.recordLoginEvent, {
          organizationId: conn.organizationId,
          connectionId,
          email: '',
          result: 'error' as const,
          detail: msg.slice(0, 200),
        });
        if (msg.startsWith('SSO_LOGIN_FAILED|')) {
          return ssoBackToLogin(msg.split('|')[1] ?? 'sso_error');
        }
        return ssoBackToLogin('sso_error');
      }
    }

    // ── GET /api/sso/<connectionId>?redirect=<path> ────────────────────────
    const connectionId = tail[0] ?? '';
    if (!connectionId) return new Response('Not found', { status: 404 });

    const conn = await ctx.runQuery(internal.sso.flows.getConnectionForStart, {
      connectionId,
    });
    if (!conn || !conn.enabled) return ssoBackToLogin('sso_disabled');

    // Explicit endpoint override first; IdP discovery as the fallback.
    let authorizationEndpoint = conn.authorizationEndpoint;
    if (!authorizationEndpoint) {
      const discovery = await ctx.runAction(internal.sso.actions.fetchDiscovery, {
        issuer: conn.issuer,
      });
      authorizationEndpoint = discovery.authorization_endpoint;
    }

    const state = randomToken(16);
    const codeVerifier = randomToken(48);
    const codeChallenge = await pkceChallenge(codeVerifier);
    const redirectUri = `${conn.appUrl}/api/sso/callback/${conn.connectionId}`;

    await ctx.runMutation(internal.sso.flows.createFlow, {
      state,
      connectionId: conn.connectionId,
      redirectUri,
      codeVerifier,
      ttlMs: SSO_FLOW_TTL_MS,
    });

    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', conn.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', conn.scopes || 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('code_challenge', codeChallenge);

    const headers = new Headers({ Location: authUrl.toString() });
    headers.append('Set-Cookie', ssoSetCookie(state, 600));
    return new Response(null, { status: 302, headers });
  }),
});

// ── SCIM 2.0 provisioning (RFC 7644) ──────────────────────────────────────────
/**
 * Serves the subset of RFC 7644 that IdPs actually exercise:
 *   GET  /api/scim/v2/ServiceProviderConfig
 *   GET  /api/scim/v2/Users            (list/filter/pagination)
 *   POST /api/scim/v2/Users            (create → 201)
 *   GET  /api/scim/v2/Users/{id}       (retrieve → 200)
 *   PUT  /api/scim/v2/Users/{id}       (replace)
 *   PATCH /api/scim/v2/Users/{id}      (path ops incl. the "active" toggle)
 *   DELETE /api/scim/v2/Users/{id}     (soft delete: deactivate + unlink)
 *
 * Auth: `Authorization: Bearer <token>`; only the SHA-256 of the token is
 * stored, so the hash is computed here before the lookup.
 */
const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';

function scimError(status: number, detail: string): Response {
  return Response.json(
    { schemas: [SCIM_ERROR_SCHEMA], status: String(status), detail },
    { status },
  );
}

async function authenticateScim(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  request: Request,
): Promise<{ organizationId: Id<'organizations'> } | null> {
  const auth = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) return null;
  const token = match[1]!.trim();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const resolved = await ctx.runMutation(internal.scim.main.authenticateToken, { tokenHash });
  return resolved ?? null;
}

interface ScimCoreUser {
  schemas?: string[];
  id?: string;
  userName?: string;
  name?: { formatted?: string; givenName?: string; familyName?: string } | string;
  active?: boolean;
  emails?: { value?: string; primary?: boolean }[];
  'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'?: { department?: string };
  department?: string;
  title?: string;
}

function scimDisplayName(body: ScimCoreUser): string {
  if (typeof body.name === 'string') return body.name;
  return body.name?.formatted ?? body.name?.givenName ?? '';
}

function scimDepartment(body: ScimCoreUser): string | undefined {
  const ent = body['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'];
  return body.department ?? ent?.department ?? undefined;
}

/** Extract the manager's IdP id from a SCIM enterprise manager ref, if any. */
function scimManagerExternalId(body: Record<string, unknown>): string | undefined {
  const ent = body['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'] as
    | { manager?: { value?: string } }
    | undefined;
  const mgr = ent?.manager?.value ?? (body.manager as { value?: string } | undefined)?.value;
  return mgr ? String(mgr) : undefined;
}

/** Pick the primary (or first) email from a SCIM payload. */
function scimEmail(body: ScimCoreUser): string | undefined {
  const primary = body.emails?.find((e) => e.primary) ?? body.emails?.[0];
  return primary?.value ?? body.userName;
}

// SCIM 2.0 (RFC 7644) — one shared handler registered per HTTP method
// (Convex routers don't support wildcard methods).
type ScimActionCtx = Parameters<Parameters<typeof httpAction>[0]>[0];
async function scimHandler(ctx: ScimActionCtx, request: Request): Promise<Response> {
  {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // ['api','scim','v2',…]
    const tail = parts.slice(3);
    const method = request.method.toUpperCase();

    // ── ServiceProviderConfig — public capability discovery ─────────────
    if (tail[0] === 'ServiceProviderConfig' && method === 'GET') {
      return Response.json({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
        documentationUri: 'https://www.rfc-editor.org/rfc/rfc7644',
        patch: { supported: true },
        filter: { supported: true, maxResults: 200 },
        changePassword: { supported: false },
        sort: { supported: false },
        etag: { supported: false },
        authenticationSchemes: [
          {
            type: 'oauthbearertoken',
            name: 'OAuth Bearer Token',
            description: 'Token generated in Settings → SCIM',
          },
        ],
      });
    }

    // Every other endpoint requires a valid token.
    const auth = await authenticateScim(ctx, request);
    if (!auth) {
      return scimError(401, 'Invalid or disabled SCIM token');
    }
    const orgId = auth.organizationId;

    // ── /Users collection ─────────────────────────────────────────────────
    if (tail[0] === 'Users' && tail.length === 1) {
      if (method === 'GET') {
        const startIndex = Math.max(Number(url.searchParams.get('startIndex') ?? 1) || 1, 1);
        const count = Math.min(Number(url.searchParams.get('count') ?? 100) || 100, 200);
        const filter = url.searchParams.get('filter') ?? '';
        // The one filter IdPs rely on: userName eq "value" (also email eq).
        const emailEq = /(?:userName|emails\.value|email)\s+eq\s+"([^"]+)"/i
          .exec(filter)?.[1]
          ?.toLowerCase();
        const page = await ctx.runQuery(internal.scim.main.listUsers, {
          organizationId: orgId,
          startIndex,
          count,
          emailEq: emailEq ?? undefined,
        });
        return Response.json({ schemas: [SCIM_LIST_SCHEMA], ...page });
      }
      if (method === 'POST') {
        let body: ScimCoreUser;
        try {
          body = (await request.json()) as ScimCoreUser;
        } catch {
          return scimError(400, 'Request body is not valid JSON');
        }
        const email = scimEmail(body)?.toLowerCase().trim();
        if (!email) return scimError(400, 'userName (or a primary email) is required');
        const result = await ctx.runMutation(internal.scim.main.createUser, {
          organizationId: orgId,
          userName: email,
          name: scimDisplayName(body) || email.split('@')[0] || 'User',
          active: body.active ?? true,
          department: scimDepartment(body),
          position: body.title ?? undefined,
          managerExternalId: scimManagerExternalId(body as unknown as Record<string, unknown>),
        });
        if (result.conflict) return scimError(409, 'A user with this email already exists');
        if ('seatLimit' in result && result.seatLimit) {
          return scimError(400, 'Organization seat limit reached');
        }
        if (!result.scimUser) return scimError(500, 'User created but could not be read back');
        return Response.json(result.scimUser, {
          status: 201,
          headers: { Location: `/api/scim/v2/Users/${result.userId}` },
        });
      }
      return scimError(405, 'Method not allowed');
    }

    // ── /Users/{id} resource ─────────────────────────────────────────────
    if (tail[0] === 'Users' && tail.length === 2) {
      const userId = tail[1] as Id<'users'>;
      if (method === 'GET') {
        const user = await ctx.runQuery(internal.scim.main.getUser, {
          organizationId: orgId,
          userId,
        });
        if (!user) return scimError(404, 'User not found');
        return Response.json(user);
      }
      if (method === 'PUT') {
        let body: ScimCoreUser;
        try {
          body = (await request.json()) as ScimCoreUser;
        } catch {
          return scimError(400, 'Request body is not valid JSON');
        }
        const result = await ctx.runMutation(internal.scim.main.updateUser, {
          organizationId: orgId,
          userId,
          name: scimDisplayName(body) || undefined,
          active: body.active,
          department: scimDepartment(body),
          position: body.title ?? undefined,
          managerExternalId: scimManagerExternalId(body as unknown as Record<string, unknown>),
        });
        if (result.notFound) return scimError(404, 'User not found');
        if (result.lastAdmin) {
          return scimError(400, 'Cannot deactivate the last active admin');
        }
        if (!result.scimUser) return scimError(500, 'User updated but could not be read back');
        return Response.json(result.scimUser);
      }
      if (method === 'PATCH') {
        let body: {
          Operations?: { op?: string; path?: string; value?: unknown }[];
        };
        try {
          body = (await request.json()) as {
            Operations?: { op?: string; path?: string; value?: unknown }[];
          };
        } catch {
          return scimError(400, 'Request body is not valid JSON');
        }
        const ops = body.Operations ?? [];
        const patch: Record<string, unknown> = {};
        for (const op of ops) {
          const value = op.value;
          if (
            op.path === 'active' ||
            (value && typeof value === 'object' && 'active' in (value as object))
          ) {
            const activeVal =
              op.path === 'active' ? value : (value as { active?: unknown } | undefined)?.active;
            if (typeof activeVal === 'boolean') patch.active = activeVal;
          } else if (!op.path && value && typeof value === 'object') {
            // path-less op: merge the attribute object (Name, title, department…)
            const attrs = value as Record<string, unknown>;
            if (typeof attrs.name === 'string') patch.name = attrs.name;
            if (typeof attrs.title === 'string') patch.position = attrs.title;
            if (typeof attrs.department === 'string') patch.department = attrs.department;
            if (typeof attrs.active === 'boolean') patch.active = attrs.active;
            const nameObj = attrs.name as { formatted?: string; givenName?: string } | undefined;
            if (
              nameObj &&
              typeof nameObj === 'object' &&
              (nameObj.formatted || nameObj.givenName)
            ) {
              patch.name = nameObj.formatted ?? nameObj.givenName;
            }
          } else if (op.path === 'name' || op.path === 'title' || op.path === 'department') {
            if (typeof value === 'string') {
              if (op.path === 'name') patch.name = value;
              if (op.path === 'title') patch.position = value;
              if (op.path === 'department') patch.department = value;
            } else if (value && typeof value === 'object') {
              const nameObj = value as { formatted?: string; givenName?: string };
              if (op.path === 'name' && (nameObj.formatted || nameObj.givenName)) {
                patch.name = nameObj.formatted ?? nameObj.givenName;
              }
            }
          }
        }
        if (Object.keys(patch).length === 0) {
          return scimError(400, 'No supported operations in patch');
        }
        const result = await ctx.runMutation(internal.scim.main.updateUser, {
          organizationId: orgId,
          userId,
          name: typeof patch.name === 'string' ? patch.name : undefined,
          active: typeof patch.active === 'boolean' ? patch.active : undefined,
          department: typeof patch.department === 'string' ? patch.department : undefined,
          position: typeof patch.position === 'string' ? patch.position : undefined,
        });
        if (result.notFound) return scimError(404, 'User not found');
        if (result.lastAdmin) {
          return scimError(400, 'Cannot deactivate the last active admin');
        }
        if (!result.scimUser) return scimError(500, 'User updated but could not be read back');
        return Response.json(result.scimUser);
      }
      if (method === 'DELETE') {
        const result = await ctx.runMutation(internal.scim.main.deleteUser, {
          organizationId: orgId,
          userId,
        });
        if (result.notFound) return scimError(404, 'User not found');
        return new Response(null, { status: 204 });
      }
      return scimError(405, 'Method not allowed');
    }

    return scimError(404, 'Unknown SCIM resource');
  }
}

for (const scimMethod of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
  http.route({
    pathPrefix: '/api/scim/v2/',
    method: scimMethod,
    handler: httpAction(scimHandler),
  });
}

export default http;
