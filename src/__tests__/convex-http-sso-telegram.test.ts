/**
 * Tests for the Telegram webhook and SSO (OIDC) routes in convex/http.ts.
 *
 * The router is mocked so the route handlers registered at import time can be
 * captured and invoked with a fake `ctx` + `Request`. `Response`, `Request` and
 * `Headers` are polyfilled on the jsdom global (which lacks the fetch surface
 * the handlers construct).
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ── fetch-surface polyfills ──────────────────────────────────────────────────
class HeadersPoly {
  private map = new Map<string, string>();
  constructor(init?: Record<string, string> | HeadersPoly) {
    if (init instanceof HeadersPoly) {
      init.map.forEach((v, k) => this.map.set(k, v));
    } else if (init) {
      for (const [k, v] of Object.entries(init)) this.map.set(k.toLowerCase(), v);
    }
  }
  set(k: string, v: string) {
    this.map.set(k.toLowerCase(), v);
  }
  append(k: string, v: string) {
    const key = k.toLowerCase();
    this.map.set(key, this.map.has(key) ? `${this.map.get(key)}, ${v}` : v);
  }
  get(k: string) {
    return this.map.get(k.toLowerCase()) ?? null;
  }
}

class ResponsePoly {
  status: number;
  headers: HeadersPoly;
  private body: string;
  constructor(
    body: string | null,
    init: { status?: number; headers?: Record<string, string> | HeadersPoly } = {},
  ) {
    this.body = body ?? '';
    this.status = init.status ?? 200;
    this.headers =
      init.headers instanceof HeadersPoly ? init.headers : new HeadersPoly(init.headers);
  }
  async text() {
    return this.body;
  }
}

class RequestPoly {
  url: string;
  method: string;
  headers: HeadersPoly;
  private body: string;
  constructor(
    url: string,
    init: { method?: string; body?: string; headers?: Record<string, string> } = {},
  ) {
    this.url = url;
    this.method = init.method ?? 'GET';
    this.body = init.body ?? '';
    this.headers = new HeadersPoly(init.headers);
  }
  async text() {
    return this.body;
  }
  async json() {
    return JSON.parse(this.body || '{}');
  }
}

(globalThis as any).Response = ResponsePoly;
(globalThis as any).Request = RequestPoly;
(globalThis as any).Headers = HeadersPoly;
if (!(globalThis as any).crypto) (globalThis as any).crypto = {};
if (typeof (globalThis as any).crypto.randomUUID !== 'function') {
  (globalThis as any).crypto.randomUUID = () => 'uuid-1234';
}

// ── Router capture ───────────────────────────────────────────────────────────
const routeRegistry: Array<{ path?: string; pathPrefix?: string; method: string; handler: any }> =
  [];

jest.mock('convex/server', () => ({
  httpRouter: () => ({
    route: (r: any) => {
      routeRegistry.push(r);
    },
  }),
}));

jest.mock('../../convex/_generated/server', () => ({
  httpAction: (handler: any) => handler,
}));

jest.mock('../../convex/_generated/api', () => ({
  api: {
    recruitmentAI: { scoreScreeningResponses: 'api.recruitmentAI.scoreScreeningResponses' },
  },
  internal: {
    telegram: {
      getAppForScreening: 'internal.telegram.getAppForScreening',
      markScreeningComplete: 'internal.telegram.markScreeningComplete',
      saveScreeningScore: 'internal.telegram.saveScreeningScore',
      findActiveScreeningApp: 'internal.telegram.findActiveScreeningApp',
      saveScreeningResponse: 'internal.telegram.saveScreeningResponse',
    },
    sso: {
      flows: {
        consumeFlow: 'internal.sso.flows.consumeFlow',
        getConnectionForCallback: 'internal.sso.flows.getConnectionForCallback',
        getConnectionForStart: 'internal.sso.flows.getConnectionForStart',
        createFlow: 'internal.sso.flows.createFlow',
        findUserByEmail: 'internal.sso.flows.findUserByEmail',
      },
      actions: {
        fetchDiscovery: 'internal.sso.actions.fetchDiscovery',
        exchangeCode: 'internal.sso.actions.exchangeCode',
        verifyIdToken: 'internal.sso.actions.verifyIdToken',
      },
      main: {
        provisionUser: 'internal.sso.main.provisionUser',
        completeSsoLogin: 'internal.sso.main.completeSsoLogin',
        recordLoginEvent: 'internal.sso.main.recordLoginEvent',
      },
    },
  },
}));

jest.mock('../../convex/integrations', () => ({
  WEBHOOK_SIGNATURE_HEADER: 'x-lucky-carrot-signature',
  WEBHOOK_TIMESTAMP_HEADER: 'x-lucky-carrot-timestamp',
  WEBHOOK_MAX_BODY_BYTES: 1_000_000,
}));

jest.mock('../../convex/sso/protocol', () => ({
  randomToken: jest.fn((n: number) => `token-${n}`),
  pkceChallenge: jest.fn(async (v: string) => `challenge-${v}`),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../../convex/http');

function routeFor(method: string, path: string) {
  return routeRegistry.find(
    (r) => r.method === method && (r.path === path || r.pathPrefix === path),
  );
}

const TELEGRAM_ROUTE = routeFor('POST', '/api/telegram')!;
const SSO_ROUTE = routeFor('GET', '/api/sso/')!;

let fetchMock: jest.Mock;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock = jest.fn().mockResolvedValue({ ok: true });
  (globalThis as any).fetch = fetchMock;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

function telegramRequest(update: unknown) {
  return new RequestPoly('https://site/api/telegram', {
    method: 'POST',
    body: JSON.stringify(update),
  });
}

const telegramApp = {
  organizationId: 'org1',
  screeningResponses: [{ message: 'hi', createdAt: 1 }],
  vacancy: { title: 'Dev', description: 'd', requirements: 'r' },
  screeningInstructions: 'instr',
  candidate: { telegramChatId: '123' },
};

describe('telegram webhook - callback queries', () => {
  it('rejects a callback with a mismatched secret', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'sec';
    const ctx = { runQuery: jest.fn(), runMutation: jest.fn(), runAction: jest.fn() };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ callback_query: { data: 'screening_done:a1' }, secret_token: 'wrong' }),
    );

    expect(res.status).toBe(401);
    expect(ctx.runQuery).not.toHaveBeenCalled();
  });

  it('processes screening_done and scores responses', async () => {
    const runQuery = jest.fn().mockResolvedValue(telegramApp);
    const runMutation = jest.fn().mockResolvedValue(undefined);
    const runAction = jest.fn().mockResolvedValue({
      score: 9,
      verdict: 'yes',
      reasoning: 'r',
      strengths: ['s'],
      concerns: [],
    });
    const ctx = { runQuery, runMutation, runAction };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ callback_query: { data: 'screening_done:a1' } }),
    );

    expect(res.status).toBe(200);
    expect(runQuery).toHaveBeenCalledWith('internal.telegram.getAppForScreening', {
      applicationId: 'a1',
    });
    expect(runAction).toHaveBeenCalledWith(
      'api.recruitmentAI.scoreScreeningResponses',
      expect.objectContaining({ applicationId: 'a1', vacancyTitle: 'Dev' }),
    );
    expect(runMutation).toHaveBeenCalledWith(
      'internal.telegram.saveScreeningScore',
      expect.objectContaining({ score: 9, verdict: 'yes' }),
    );
  });

  it('sends a Telegram confirmation when a bot token and chat id exist', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
    const ctx = {
      runQuery: jest.fn().mockResolvedValue(telegramApp),
      runMutation: jest.fn().mockResolvedValue(undefined),
      runAction: jest.fn().mockResolvedValue({
        score: 1,
        verdict: 'no',
        reasoning: '',
        strengths: [],
        concerns: [],
      }),
    };

    await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ callback_query: { data: 'screening_done:a1' } }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org/botbot-token/sendMessage'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('survives a failing AI scoring call', async () => {
    const ctx = {
      runQuery: jest.fn().mockResolvedValue(telegramApp),
      runMutation: jest.fn().mockResolvedValue(undefined),
      runAction: jest.fn().mockRejectedValue(new Error('ai down')),
    };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ callback_query: { data: 'screening_done:a1' } }),
    );

    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalledWith('AI scoring failed:', expect.any(Error));
  });

  it('handles an app that does not exist', async () => {
    const ctx = {
      runQuery: jest.fn().mockResolvedValue(null),
      runMutation: jest.fn(),
      runAction: jest.fn(),
    };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ callback_query: { data: 'screening_done:missing' } }),
    );

    expect(res.status).toBe(200);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it('returns 500 when the screening lookup throws', async () => {
    const ctx = {
      runQuery: jest.fn().mockRejectedValue(new Error('boom')),
      runMutation: jest.fn(),
      runAction: jest.fn(),
    };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ callback_query: { data: 'screening_done:a1' } }),
    );

    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith('Screening completion error:', expect.any(Error));
  });

  it('acknowledges link callbacks without side effects', async () => {
    const ctx = { runQuery: jest.fn(), runMutation: jest.fn(), runAction: jest.fn() };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ callback_query: { data: 'link:jane@example.com' } }),
    );

    expect(res.status).toBe(200);
    expect(ctx.runQuery).not.toHaveBeenCalled();
  });

  it('acknowledges an unrecognised callback', async () => {
    const ctx = { runQuery: jest.fn(), runMutation: jest.fn(), runAction: jest.fn() };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ callback_query: { data: 'something-else' } }),
    );

    expect(res.status).toBe(200);
  });
});

describe('telegram webhook - text messages', () => {
  it('ignores bot commands', async () => {
    const ctx = { runQuery: jest.fn(), runMutation: jest.fn(), runAction: jest.fn() };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ message: { text: '/start', chat: { id: 5 }, message_id: 1 } }),
    );

    expect(res.status).toBe(200);
    expect(ctx.runQuery).not.toHaveBeenCalled();
  });

  it('stores a screening response for a linked candidate', async () => {
    const runQuery = jest.fn().mockResolvedValue({ _id: 'app1', organizationId: 'org1' });
    const runMutation = jest.fn().mockResolvedValue(undefined);
    const ctx = { runQuery, runMutation, runAction: jest.fn() };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ message: { text: 'My answer', chat: { id: 5 }, message_id: 7 } }),
    );

    expect(res.status).toBe(200);
    expect(runMutation).toHaveBeenCalledWith('internal.telegram.saveScreeningResponse', {
      applicationId: 'app1',
      organizationId: 'org1',
      message: 'My answer',
      telegramChatId: '5',
      telegramMessageId: 7,
    });
  });

  it('silently ignores an unlinked candidate', async () => {
    const ctx = {
      runQuery: jest.fn().mockResolvedValue(null),
      runMutation: jest.fn(),
      runAction: jest.fn(),
    };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ message: { text: 'Hi', chat: { id: 5 }, message_id: 1 } }),
    );

    expect(res.status).toBe(200);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it('swallows errors from the screening lookup', async () => {
    const ctx = {
      runQuery: jest.fn().mockRejectedValue(new Error('nope')),
      runMutation: jest.fn(),
      runAction: jest.fn(),
    };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ message: { text: 'Hi', chat: { id: 5 }, message_id: 1 } }),
    );

    expect(res.status).toBe(200);
  });

  it('does nothing when the chat id is missing', async () => {
    const ctx = { runQuery: jest.fn(), runMutation: jest.fn(), runAction: jest.fn() };

    const res = await TELEGRAM_ROUTE.handler(
      ctx,
      telegramRequest({ message: { text: 'Hi', message_id: 1 } }),
    );

    expect(res.status).toBe(200);
    expect(ctx.runQuery).not.toHaveBeenCalled();
  });

  it('handles an update with neither callback nor message', async () => {
    const ctx = { runQuery: jest.fn(), runMutation: jest.fn(), runAction: jest.fn() };

    const res = await TELEGRAM_ROUTE.handler(ctx, telegramRequest({}));

    expect(res.status).toBe(200);
  });
});

// ── SSO ──────────────────────────────────────────────────────────────────────

const ssoConn = {
  connectionId: 'c1',
  enabled: true,
  issuer: 'https://idp.example',
  clientId: 'client',
  clientSecret: 'secret',
  organizationId: 'org1',
  domains: [] as string[],
  autoProvision: false,
  appUrl: 'https://app.example',
  tokenEndpoint: 'https://idp.example/token',
  authorizationEndpoint: 'https://idp.example/auth',
  scopes: 'openid email',
};

function ssoCallbackRequest(query: string, cookieState?: string) {
  return new RequestPoly(`https://site/api/sso/callback/c1?${query}`, {
    headers: cookieState ? { cookie: `sso_flow_state=${cookieState}` } : {},
  });
}

type CbOverrides = {
  flow?: unknown;
  conn?: unknown;
  discovery?: unknown;
  tokens?: unknown;
  claims?: unknown;
  user?: unknown;
  provisionedId?: string | null;
  login?: unknown;
};

/** `has` distinguishes "not provided" from an explicit `null`. */
function pick<T>(overrides: Record<string, unknown>, key: string, fallback: T): T {
  return (key in overrides ? overrides[key] : fallback) as T;
}

function fullCallbackCtx(overrides: CbOverrides = {}) {
  const o = overrides as Record<string, unknown>;
  const runMutation = jest.fn();
  const runQuery = jest.fn();
  const runAction = jest.fn();

  runMutation.mockImplementation(async (ref: string) => {
    if (ref === 'internal.sso.flows.consumeFlow') {
      return pick(o, 'flow', { connectionId: 'c1', codeVerifier: 'v', redirectUri: 'r' });
    }
    if (ref === 'internal.sso.main.provisionUser') return pick(o, 'provisionedId', 'new-user');
    if (ref === 'internal.sso.main.completeSsoLogin') return pick(o, 'login', { ok: true });
    return undefined;
  });

  runQuery.mockImplementation(async (ref: string) => {
    if (ref === 'internal.sso.flows.getConnectionForCallback') return pick(o, 'conn', ssoConn);
    if (ref === 'internal.sso.flows.findUserByEmail') return pick(o, 'user', null);
    return null;
  });

  runAction.mockImplementation(async (ref: string) => {
    if (ref === 'internal.sso.actions.fetchDiscovery') return pick(o, 'discovery', {});
    if (ref === 'internal.sso.actions.exchangeCode')
      return pick(o, 'tokens', { idToken: 'id-token' });
    if (ref === 'internal.sso.actions.verifyIdToken') {
      return pick(o, 'claims', { email: 'jane@example.com' });
    }
    return null;
  });

  return { runMutation, runQuery, runAction };
}

describe('SSO callback', () => {
  it('redirects with sso_cancelled when the IdP returns an error', async () => {
    const ctx = fullCallbackCtx();
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('error=access_denied'));

    expect(res.headers.get('location')).toContain('sso_error=sso_cancelled');
  });

  it('redirects with sso_missing_params when code or state is absent', async () => {
    const ctx = fullCallbackCtx();
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc'));
    expect(res.headers.get('location')).toContain('sso_error=sso_missing_params');
  });

  it('rejects a missing state cookie', async () => {
    const ctx = fullCallbackCtx();
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st'));
    expect(res.headers.get('location')).toContain('sso_error=sso_state_mismatch');
  });

  it('rejects a mismatched state cookie', async () => {
    const ctx = fullCallbackCtx();
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'other'));
    expect(res.headers.get('location')).toContain('sso_error=sso_state_mismatch');
  });

  it('rejects an unknown flow', async () => {
    const ctx = fullCallbackCtx({ flow: null });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_error=sso_state_mismatch');
  });

  it('rejects a flow belonging to another connection', async () => {
    const ctx = fullCallbackCtx({ flow: { connectionId: 'other', codeVerifier: 'v' } });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_error=sso_state_mismatch');
  });

  it('rejects a disabled connection', async () => {
    const ctx = fullCallbackCtx({ conn: { ...ssoConn, enabled: false } });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_error=sso_disabled');
  });

  it('rejects a missing connection', async () => {
    const ctx = fullCallbackCtx({ conn: null });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_error=sso_disabled');
  });

  it('resolves the token endpoint via discovery when no override exists', async () => {
    const ctx = fullCallbackCtx({
      conn: { ...ssoConn, tokenEndpoint: undefined },
      discovery: { token_endpoint: 'https://idp.example/discovered-token' },
      user: { _id: 'u1', isActive: true },
    });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));

    expect(res.headers.get('location')).toContain('/api/auth/imid-callback');
    expect(ctx.runAction).toHaveBeenCalledWith('internal.sso.actions.fetchDiscovery', {
      issuer: ssoConn.issuer,
    });
  });

  it('redirects when the token exchange fails', async () => {
    const ctx = fullCallbackCtx({ tokens: null });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_token_exchange_failed');
  });

  it('redirects when the id token has no email', async () => {
    const ctx = fullCallbackCtx({ claims: {} });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_error=sso_no_email');
  });

  it('redirects when the email is unverified', async () => {
    const ctx = fullCallbackCtx({ claims: { email: 'a@b.com', email_verified: false } });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_email_unverified');
  });

  it('redirects when the email domain is not allowed', async () => {
    const ctx = fullCallbackCtx({
      conn: { ...ssoConn, domains: ['allowed.com'] },
      claims: { email: 'jane@other.com' },
    });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_domain_denied');
  });

  it('redirects when the account is inactive', async () => {
    const ctx = fullCallbackCtx({ user: { _id: 'u1', isActive: false } });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_account_inactive');
  });

  it('redirects when no user exists and auto-provision is off', async () => {
    const ctx = fullCallbackCtx();
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_user_not_found');
  });

  it('provisions a user when auto-provision is on', async () => {
    const ctx = fullCallbackCtx({
      conn: { ...ssoConn, autoProvision: true },
      claims: { email: 'New@Example.com', name: 'New Hire' },
      provisionedId: 'u-new',
    });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));

    expect(res.headers.get('location')).toContain('/api/auth/imid-callback');
    expect(ctx.runMutation).toHaveBeenCalledWith(
      'internal.sso.main.provisionUser',
      expect.objectContaining({ email: 'new@example.com', name: 'New Hire' }),
    );
  });

  it('redirects when auto-provisioning returns no id', async () => {
    const ctx = fullCallbackCtx({
      conn: { ...ssoConn, autoProvision: true },
      provisionedId: null,
    });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_user_not_found');
  });

  it('redirects when the login is rejected', async () => {
    const ctx = fullCallbackCtx({ user: { _id: 'u1', isActive: true }, login: null });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));
    expect(res.headers.get('location')).toContain('sso_login_rejected');
  });

  it('completes the login and clears the state cookie', async () => {
    const ctx = fullCallbackCtx({ user: { _id: 'u1', isActive: true } });
    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('https://app.example/api/auth/imid-callback');
    expect(res.headers.get('location')).toMatch(/sessionToken=.+/);
    expect(res.headers.get('set-cookie')).toContain('sso_flow_state=;');
    expect(ctx.runMutation).toHaveBeenCalledWith(
      'internal.sso.main.recordLoginEvent',
      expect.objectContaining({ result: 'success' }),
    );
  });

  it('records a provisioned login for a newly created user', async () => {
    const ctx = fullCallbackCtx({
      conn: { ...ssoConn, autoProvision: true },
      claims: { email: 'new@example.com' },
      provisionedId: 'u-new',
    });
    await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));

    expect(ctx.runMutation).toHaveBeenCalledWith(
      'internal.sso.main.recordLoginEvent',
      expect.objectContaining({ result: 'provisioned' }),
    );
  });

  it('surfaces an SSO_LOGIN_FAILED key from a thrown error', async () => {
    const ctx = fullCallbackCtx();
    ctx.runAction.mockImplementation(async (ref: string) => {
      if (ref === 'internal.sso.actions.exchangeCode') return { idToken: 't' };
      if (ref === 'internal.sso.actions.verifyIdToken') {
        throw new Error('SSO_LOGIN_FAILED|bad_signature');
      }
      return {};
    });

    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));

    expect(res.headers.get('location')).toContain('sso_error=bad_signature');
    expect(ctx.runMutation).toHaveBeenCalledWith(
      'internal.sso.main.recordLoginEvent',
      expect.objectContaining({ result: 'error' }),
    );
  });

  it('falls back to a generic error for other exceptions', async () => {
    const ctx = fullCallbackCtx();
    ctx.runAction.mockRejectedValue(new Error('network blew up'));

    const res = await SSO_ROUTE.handler(ctx, ssoCallbackRequest('code=abc&state=st', 'st'));

    expect(res.headers.get('location')).toContain('sso_error=sso_error');
  });
});

describe('SSO start', () => {
  function startCtx(overrides: { conn?: unknown; discovery?: unknown } = {}) {
    const o = overrides as Record<string, unknown>;
    const runMutation = jest.fn().mockResolvedValue(undefined);
    const runQuery = jest.fn().mockResolvedValue(pick(o, 'conn', ssoConn));
    const runAction = jest.fn().mockResolvedValue(pick(o, 'discovery', {}));
    return { runMutation, runQuery, runAction };
  }

  it('returns 404 when no connection id is present', async () => {
    const ctx = startCtx();
    const res = await SSO_ROUTE.handler(ctx, new RequestPoly('https://site/api/sso/'));
    expect(res.status).toBe(404);
  });

  it('rejects a disabled connection', async () => {
    const ctx = startCtx({ conn: { ...ssoConn, enabled: false } });
    const res = await SSO_ROUTE.handler(ctx, new RequestPoly('https://site/api/sso/c1'));
    expect(res.headers.get('location')).toContain('sso_error=sso_disabled');
  });

  it('rejects an unknown connection', async () => {
    const ctx = startCtx({ conn: null });
    const res = await SSO_ROUTE.handler(ctx, new RequestPoly('https://site/api/sso/c1'));
    expect(res.headers.get('location')).toContain('sso_error=sso_disabled');
  });

  it('starts the flow and sets the state cookie', async () => {
    const ctx = startCtx();
    const res = await SSO_ROUTE.handler(ctx, new RequestPoly('https://site/api/sso/c1'));

    expect(res.status).toBe(302);
    const location = res.headers.get('location') || '';
    expect(location).toContain('https://idp.example/auth');
    expect(location).toContain('code_challenge=challenge-token-48');
    expect(location).toContain('code_challenge_method=S256');
    expect(res.headers.get('set-cookie')).toContain('sso_flow_state=token-16');
    expect(ctx.runMutation).toHaveBeenCalledWith(
      'internal.sso.flows.createFlow',
      expect.objectContaining({ connectionId: 'c1', codeVerifier: 'token-48' }),
    );
  });

  it('discovers the authorization endpoint when not overridden', async () => {
    const ctx = startCtx({
      conn: { ...ssoConn, authorizationEndpoint: undefined },
      discovery: { authorization_endpoint: 'https://idp.example/discovered-auth' },
    });
    const res = await SSO_ROUTE.handler(ctx, new RequestPoly('https://site/api/sso/c1'));

    expect(res.headers.get('location')).toContain('https://idp.example/discovered-auth');
    expect(ctx.runAction).toHaveBeenCalledWith('internal.sso.actions.fetchDiscovery', {
      issuer: ssoConn.issuer,
    });
  });
});
