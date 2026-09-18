/**
 * Tests for convex/http.ts — the Convex HTTP router: OIDC discovery, JWKS,
 * Lucky Carrot inbound webhook and the imID OAuth/webhook endpoints.
 *
 * The `httpRouter` from convex/server is mocked so the routes registered at
 * module load time can be captured and their handlers invoked with a fake
 * ctx + Request.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ── jsdom has no fetch globals; Node has them but they are not visible from
// the jsdom window. The handlers under test construct `new Response(...)`, so
// polyfill the surface they use (status, text(), headers.get()).
if (typeof (globalThis as any).Response === 'undefined') {
  (globalThis as any).Response = class Response {
    status: number;
    headers: Map<string, string>;
    private body: string;
    constructor(
      body: string | null,
      init: { status?: number; headers?: Record<string, string> } = {},
    ) {
      this.body = body ?? '';
      this.status = init.status ?? 200;
      this.headers = new Map();
      for (const [k, v] of Object.entries(init.headers ?? {})) {
        this.headers.set(k.toLowerCase(), v);
      }
    }
    async text() {
      return this.body;
    }
  };
}

// ── Mock plumbing ────────────────────────────────────────────────────────────
const routeRegistry: Array<{ path?: string; pathPrefix?: string; method: string; handler: any }> =
  [];

// jsdom has no fetch globals; Node has them but they are not visible from the
// jsdom window. The handlers under test read request.url / headers / text() and
// construct `new Response(...)`, so polyfill the surface they use.
if (typeof (globalThis as any).Request === 'undefined') {
  (globalThis as any).Request = class Request {
    url: string;
    method: string;
    headers: Map<string, string>;
    private body: string;
    constructor(
      url: string,
      init: { method?: string; body?: string; headers?: Record<string, string> } = {},
    ) {
      this.url = url;
      this.method = init.method ?? 'GET';
      this.body = init.body ?? '';
      this.headers = new Map();
      for (const [k, v] of Object.entries(init.headers ?? {})) {
        this.headers.set(k.toLowerCase(), v);
      }
    }
    async text() {
      return this.body;
    }
  };
}

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
  internal: {
    apiKeys: { authorizeApiRequest: 'internal.apiKeys.authorizeApiRequest' },
    apiV1: {
      listEmployees: 'internal.apiV1.listEmployees',
      getEmployee: 'internal.apiV1.getEmployee',
      listDepartments: 'internal.apiV1.listDepartments',
      listPositions: 'internal.apiV1.listPositions',
      listLeaves: 'internal.apiV1.listLeaves',
    },
    inbound: {
      resolveInboundToken: 'internal.inbound.resolveInboundToken',
      ingestDevicePunches: 'internal.inbound.ingestDevicePunches',
      ingestJiraEvent: 'internal.inbound.ingestJiraEvent',
    },
    webhooks: {
      main: {
        listEndpointsForOrg: 'internal.webhooks.main.listEndpointsForOrg',
        createEndpointForOrg: 'internal.webhooks.main.createEndpointForOrg',
        deleteEndpointForOrg: 'internal.webhooks.main.deleteEndpointForOrg',
      },
    },
    integrations: {
      ingestLuckyCarrotWebhook: 'internal.ingestLuckyCarrotWebhook',
      imidResolveOrgByState: 'internal.imidResolveOrgByState',
      imidLoginCallback: 'internal.imidLoginCallback',
      ingestImidSignCallback: 'internal.ingestImidSignCallback',
      ingestImidVerifyCallback: 'internal.ingestImidVerifyCallback',
    },
  },
}));

jest.mock('../../convex/integrations', () => ({
  WEBHOOK_SIGNATURE_HEADER: 'x-lucky-carrot-signature',
  WEBHOOK_TIMESTAMP_HEADER: 'x-lucky-carrot-timestamp',
  WEBHOOK_MAX_BODY_BYTES: 1_000_000,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../../convex/http');

const routes = routeRegistry;

function routeFor(method: string, path: string) {
  return routes.find((r) => r.method === method && (r.path === path || r.pathPrefix === path));
}

function textRequest(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/route', { method: 'POST', body, headers });
}

async function jsonOf(response: Response) {
  return JSON.parse(await response.text());
}

const originalSiteUrl = process.env.CONVEX_SITE_URL;
const originalJwks = process.env.JWKS;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

beforeEach(() => {
  // NOTE: do not clear routeRegistry here — the module was required once at
  // import time and its routes are the fixtures under test.
  jest.clearAllMocks();
});

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.CONVEX_SITE_URL;
  else process.env.CONVEX_SITE_URL = originalSiteUrl;
  if (originalJwks === undefined) delete process.env.JWKS;
  else process.env.JWKS = originalJwks;
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe('convex/http.ts route registration', () => {
  it('registers the OIDC discovery and jwks endpoints', () => {
    expect(routeFor('GET', '/.well-known/openid-configuration')).toBeDefined();
    expect(routeFor('GET', '/.well-known/jwks.json')).toBeDefined();
  });

  it('registers the Lucky Carrot webhook with a path prefix', () => {
    expect(routeFor('POST', '/webhooks/lucky-carrot/')).toBeDefined();
  });

  it('registers the imID callback and webhook routes', () => {
    expect(routeFor('GET', '/auth/imid/callback/')).toBeDefined();
    expect(routeFor('POST', '/webhooks/imid/sign/')).toBeDefined();
    expect(routeFor('POST', '/webhooks/imid/verify/')).toBeDefined();
  });
});

describe('OIDC discovery', () => {
  it('returns issuer metadata from CONVEX_SITE_URL', async () => {
    process.env.CONVEX_SITE_URL = 'https://project.convex.site';
    const { handler } = routeFor('GET', '/.well-known/openid-configuration')!;

    const response = await handler(
      {},
      new Request('https://project.convex.site/.well-known/openid-configuration'),
    );

    expect(response.status).toBe(200);
    const body = await jsonOf(response);
    expect(body.issuer).toBe('https://project.convex.site');
    expect(body.jwks_uri).toBe('https://project.convex.site/.well-known/jwks.json');
    expect(body.authorization_endpoint).toBe('https://project.convex.site/oauth/authorize');
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});

describe('JWKS endpoint', () => {
  it('returns the configured JWKS', async () => {
    process.env.JWKS = '{"keys":[]}';
    const { handler } = routeFor('GET', '/.well-known/jwks.json')!;

    const response = await handler(
      {},
      new Request('https://project.convex.site/.well-known/jwks.json'),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"keys":[]}');
  });

  it('throws when JWKS is not configured', async () => {
    delete process.env.JWKS;
    const { handler } = routeFor('GET', '/.well-known/jwks.json')!;

    await expect(
      handler({}, new Request('https://project.convex.site/.well-known/jwks.json')),
    ).rejects.toThrow('Missing JWKS Convex environment variable');
  });
});

describe('Lucky Carrot webhook', () => {
  const { handler } = routeFor('POST', '/webhooks/lucky-carrot/')!;

  function runActionMock(outcome: any) {
    return jest.fn().mockResolvedValue(outcome);
  }

  it('rejects an oversized payload based on content-length with 413', async () => {
    const runAction = runActionMock({ status: 'ok' });
    const ctx = { runAction };
    const request = textRequest('{"x":1}', { 'content-length': '5000000' });

    const response = await handler(ctx, request);

    expect(response.status).toBe(413);
    expect(await jsonOf(response)).toEqual({ error: 'Payload too large' });
    expect(runAction).not.toHaveBeenCalled();
  });

  it('rejects an oversized body after reading it with 413', async () => {
    const runAction = runActionMock({ status: 'ok' });
    const ctx = { runAction };
    const request = textRequest('x'.repeat(1_000_001), {});

    const response = await handler(ctx, request);

    expect(response.status).toBe(413);
    expect(runAction).not.toHaveBeenCalled();
  });

  it('extracts the organization id from the path', async () => {
    const runAction = runActionMock({
      status: 'ok',
      message: 'done',
      created: 1,
      updated: 0,
      skipped: 0,
    });
    const ctx = { runAction };
    const request = new Request('http://localhost/webhooks/lucky-carrot/org_123', {
      method: 'POST',
      body: '{"name":"Anna"}',
      headers: {
        'x-lucky-carrot-signature': 'sig',
        'x-lucky-carrot-timestamp': '12345',
      },
    });

    const response = await handler(ctx, request);

    expect(runAction).toHaveBeenCalledWith('internal.ingestLuckyCarrotWebhook', {
      organizationIdRaw: 'org_123',
      body: '{"name":"Anna"}',
      signature: 'sig',
      timestamp: '12345',
    });
    expect(response.status).toBe(200);
  });

  it('maps unauthorized to 401', async () => {
    const ctx = { runAction: runActionMock({ status: 'unauthorized' }) };
    const response = await handler(ctx, textRequest('{}'));

    expect(response.status).toBe(401);
    expect(await jsonOf(response)).toEqual({ error: 'Invalid signature' });
  });

  it('maps disabled to 202 so the sender stops retrying', async () => {
    const ctx = { runAction: runActionMock({ status: 'disabled' }) };
    const response = await handler(ctx, textRequest('{}'));

    expect(response.status).toBe(202);
    expect((await jsonOf(response)).ok).toBe(false);
  });

  it('maps invalid to 400 with the message', async () => {
    const ctx = { runAction: runActionMock({ status: 'invalid', message: 'Bad payload' }) };
    const response = await handler(ctx, textRequest('{}'));

    expect(response.status).toBe(400);
    expect((await jsonOf(response)).error).toBe('Bad payload');
  });

  it('maps ok to 200 with the outcome details', async () => {
    const ctx = {
      runAction: runActionMock({
        status: 'ok',
        message: 'done',
        created: 2,
        updated: 1,
        skipped: 0,
      }),
    };
    const response = await handler(ctx, textRequest('{}'));

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual({
      ok: true,
      message: 'done',
      created: 2,
      updated: 1,
      skipped: 0,
    });
  });

  it('maps unknown outcomes to 500', async () => {
    const ctx = { runAction: runActionMock({ status: 'mystery' as never }) };
    const response = await handler(ctx, textRequest('{}'));

    expect(response.status).toBe(500);
  });
});

describe('imID OAuth callback', () => {
  const { handler } = routeFor('GET', '/auth/imid/callback/')!;

  it('redirects to login with imid_denied when imID reports an error', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
    const ctx = { runAction: jest.fn() };
    const request = new Request(
      'https://project.convex.site/auth/imid/callback/org_1?error=access_denied',
    );

    const response = await handler(ctx, request);

    expect(response.status).toBe(302);
    const location = response.headers.get('location') || '';
    expect(location).toContain('/login?error=imid_denied');
    expect(location).toContain('imid_error=access_denied');
    expect(ctx.runAction).not.toHaveBeenCalled();
  });

  it('redirects with imid_missing_params when code or state is absent', async () => {
    const ctx = { runAction: jest.fn() };
    const request = new Request('https://project.convex.site/auth/imid/callback/org_1?code=abc');

    const response = await handler(ctx, request);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('imid_missing_params');
  });

  it('redirects with imid_invalid_state when no org resolves', async () => {
    const ctx = { runAction: jest.fn().mockResolvedValue(null) };
    const request = new Request(
      'https://project.convex.site/auth/imid/callback/org_1?code=abc&state=xyz',
    );

    const response = await handler(ctx, request);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('imid_invalid_state');
  });

  it('redirects with imid_login_failed when the login callback errors', async () => {
    const ctx = {
      runAction: jest
        .fn()
        .mockResolvedValueOnce({ organizationId: 'org_1' })
        .mockResolvedValueOnce({ status: 'error', message: 'bad code' }),
    };
    const request = new Request(
      'https://project.convex.site/auth/imid/callback/org_1?code=abc&state=xyz',
    );

    const response = await handler(ctx, request);

    expect(response.status).toBe(302);
    const location = response.headers.get('location') || '';
    expect(location).toContain('imid_login_failed');
    expect(location).toContain('imid_message=bad+code');
  });

  it('redirects to the Next.js callback with the session token', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
    const ctx = {
      runAction: jest
        .fn()
        .mockResolvedValueOnce({ organizationId: 'org_1' })
        .mockResolvedValueOnce({
          status: 'ok',
          sessionToken: 'tok-1',
          isNewUser: true,
          needsApproval: true,
        }),
    };
    const request = new Request(
      'https://project.convex.site/auth/imid/callback/org_1?code=abc&state=xyz',
    );

    const response = await handler(ctx, request);

    expect(response.status).toBe(302);
    const location = response.headers.get('location') || '';
    expect(location).toContain('https://app.example/api/auth/imid-callback');
    expect(location).toContain('sessionToken=tok-1');
    expect(location).toContain('welcome=true');
    expect(location).toContain('pending_approval=true');
  });
});

describe('imID sign webhook', () => {
  const { handler } = routeFor('POST', '/webhooks/imid/sign/')!;

  it('rejects payloads over 1MB with 413', async () => {
    const ctx = { runAction: jest.fn() };
    const response = await handler(ctx, textRequest('x'.repeat(1_000_001)));

    expect(response.status).toBe(413);
    expect(ctx.runAction).not.toHaveBeenCalled();
  });

  it('delegates to the sign callback and returns ok', async () => {
    const runAction = jest.fn().mockResolvedValue({ message: 'signed' });
    const ctx = { runAction };
    const request = new Request('http://localhost/webhooks/imid/sign/org_1', {
      method: 'POST',
      body: '{"status":"signed"}',
    });

    const response = await handler(ctx, request);

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual({ ok: true, message: 'signed' });
    expect(runAction).toHaveBeenCalledWith('internal.ingestImidSignCallback', {
      organizationIdRaw: 'org_1',
      body: '{"status":"signed"}',
    });
  });
});

describe('imID verify webhook', () => {
  const { handler } = routeFor('POST', '/webhooks/imid/verify/')!;

  it('rejects payloads over 1MB with 413', async () => {
    const ctx = { runAction: jest.fn() };
    const response = await handler(ctx, textRequest('x'.repeat(1_000_001)));

    expect(response.status).toBe(413);
  });

  it('delegates to the verify callback and returns ok', async () => {
    const runAction = jest.fn().mockResolvedValue(undefined);
    const ctx = { runAction };
    const request = new Request('http://localhost/webhooks/imid/verify/org_1', {
      method: 'POST',
      body: '{"verified":true}',
    });

    const response = await handler(ctx, request);

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual({ ok: true });
    expect(runAction).toHaveBeenCalledWith('internal.ingestImidVerifyCallback', {
      organizationIdRaw: 'org_1',
      body: '{"verified":true}',
    });
  });
});

/**
 * `POST`/`DELETE /api/v1/webhooks` — the REST-hooks pair an integration platform
 * (Zapier's subscribeHook/unsubscribeHook, Make, n8n) calls to register and
 * remove its own callback URL without an admin touching Settings → Webhooks.
 *
 * The three things worth pinning down: a read-only key cannot write, the secret
 * is handed out exactly once, and the organization always comes from the key.
 */
describe('Public API v1 — webhook subscriptions', () => {
  const post = routeFor('POST', '/api/v1/')!;
  const remove = routeFor('DELETE', '/api/v1/')!;

  const KEY = { authorization: 'Bearer strata_test' };

  function apiRequest(method: string, path: string, body?: unknown) {
    return new Request(`https://project.convex.site/api/v1/${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: KEY,
    });
  }

  /** ctx whose runMutation answers the auth check, then the write it guards. */
  function makeCtx(auth: unknown, writeResult: unknown = { ok: true }) {
    const runMutation = jest
      .fn()
      .mockResolvedValueOnce(auth)
      .mockResolvedValue(writeResult) as jest.Mock;
    return { ctx: { runMutation, runQuery: jest.fn() }, runMutation };
  }

  const granted = {
    ok: true,
    status: 200,
    organizationId: 'org1',
    scopes: ['webhooks:write'],
    used: 1,
    limit: null,
  };

  it('registers the write routes', () => {
    expect(post).toBeDefined();
    expect(remove).toBeDefined();
  });

  it('rejects a request with no key', async () => {
    const { ctx, runMutation } = makeCtx(granted);
    const response = await post.handler(
      ctx,
      new Request('https://project.convex.site/api/v1/webhooks', { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(401);
    expect(runMutation).not.toHaveBeenCalled();
  });

  it('refuses a key without webhooks:write', async () => {
    const { ctx, runMutation } = makeCtx({
      ok: false,
      status: 403,
      error: 'Missing scope webhooks:write',
    });
    const response = await post.handler(
      ctx,
      apiRequest('POST', 'webhooks', { url: 'https://consumer.example/hook' }),
    );
    expect(response.status).toBe(403);
    // The scope was decided from the route, not after the write attempt.
    expect(runMutation).toHaveBeenCalledWith('internal.apiKeys.authorizeApiRequest', {
      rawKey: 'strata_test',
      requiredScope: 'webhooks:write',
    });
  });

  it('creates the endpoint for the key’s organization and returns the secret once', async () => {
    const { ctx, runMutation } = makeCtx(granted, {
      endpointId: 'wh_1',
      secret: 'a'.repeat(64),
      events: ['leave.approved'],
      createdAt: 1,
    });
    const response = await post.handler(
      ctx,
      apiRequest('POST', 'webhooks', {
        url: 'https://hooks.zapier.com/hooks/catch/1/abc/'.trim(),
        events: ['leave.approved'],
        label: 'Zapier',
        appId: 'zapier',
      }),
    );

    expect(response.status).toBe(201);
    const body = await jsonOf(response);
    expect(body.data.id).toBe('wh_1');
    expect(body.data.secret).toHaveLength(64);
    expect(body.data.secretShownOnce).toBe(true);
    expect(runMutation).toHaveBeenLastCalledWith('internal.webhooks.main.createEndpointForOrg', {
      organizationId: 'org1',
      url: 'https://hooks.zapier.com/hooks/catch/1/abc/',
      events: ['leave.approved'],
      label: 'Zapier',
      appId: 'zapier',
    });
  });

  it('rejects a non-https target and an unknown event type', async () => {
    const insecure = makeCtx(granted);
    const insecureResponse = await post.handler(
      insecure.ctx,
      apiRequest('POST', 'webhooks', { url: 'http://plain.example/hook' }),
    );
    expect(insecureResponse.status).toBe(400);

    const bogus = makeCtx(granted);
    const bogusResponse = await post.handler(
      bogus.ctx,
      apiRequest('POST', 'webhooks', {
        url: 'https://consumer.example/hook',
        events: ['leave.exploded'],
      }),
    );
    expect(bogusResponse.status).toBe(400);
    expect(await jsonOf(bogusResponse)).toMatchObject({
      error: expect.stringContaining('leave.exploded'),
    });
    // Nothing was written: validation happens before the mutation.
    expect(bogus.runMutation).toHaveBeenCalledTimes(1);
  });

  it('deletes by id, scoped to the key’s organization', async () => {
    const { ctx, runMutation } = makeCtx(granted, { ok: true });
    const response = await remove.handler(ctx, apiRequest('DELETE', 'webhooks/wh_1'));

    expect(response.status).toBe(200);
    expect(runMutation).toHaveBeenLastCalledWith('internal.webhooks.main.deleteEndpointForOrg', {
      organizationId: 'org1',
      endpointId: 'wh_1',
    });
  });

  it('requires the id on delete', async () => {
    const { ctx } = makeCtx(granted);
    const response = await remove.handler(ctx, apiRequest('DELETE', 'webhooks'));
    expect(response.status).toBe(400);
  });
});

/**
 * `POST /api/in/{token}` — inbound from attendance hardware and Jira.
 *
 * The token is the only credential and it is bound to one organization, so these
 * tests care about the three ways that could go wrong: an unknown or disabled
 * token, a payload the mapping cannot read (which must still be acknowledged — a
 * terminal that gets a 500 retries the same batch forever), and the tenant the
 * write is scoped to.
 */
describe('Inbound integration route', () => {
  const route = routeFor('POST', '/api/in/')!;

  function post(path: string, body: unknown) {
    return new Request(`https://project.convex.site/api/in/${path}`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  function makeCtx(token: unknown, writeResult: unknown = { recorded: 1, unmatched: 0 }) {
    const runQuery = jest.fn().mockResolvedValue(token);
    const runMutation = jest.fn().mockResolvedValue(writeResult);
    return { ctx: { runQuery, runMutation }, runQuery, runMutation };
  }

  const deviceToken = {
    tokenId: 'tok_1',
    organizationId: 'org1',
    provider: 'device',
    enabled: true,
    defaultAssigneeId: null,
    createdBy: 'u_admin',
  };

  it('registers the inbound route', () => {
    expect(route).toBeDefined();
  });

  it('rejects a request with no token in the path', async () => {
    const { ctx, runQuery } = makeCtx(deviceToken);
    const response = await route.handler(ctx, post('', { pin: '1' }));
    expect(response.status).toBe(401);
    expect(runQuery).not.toHaveBeenCalled();
  });

  it('rejects an unknown token before reading the body', async () => {
    const { ctx, runMutation } = makeCtx(null);
    const response = await route.handler(ctx, post('inb_nope', { pin: '1' }));
    expect(response.status).toBe(404);
    expect(runMutation).not.toHaveBeenCalled();
  });

  it('refuses a disabled token', async () => {
    const { ctx } = makeCtx({ ...deviceToken, enabled: false });
    const response = await route.handler(ctx, post('inb_off', { pin: '1' }));
    expect(response.status).toBe(403);
  });

  it('stores device punches against the token’s organization', async () => {
    const { ctx, runMutation } = makeCtx(deviceToken, {
      recorded: 1,
      unmatched: 0,
      duplicates: 0,
      total: 1,
    });
    const response = await route.handler(
      ctx,
      post('inb_device', { pin: '1024', timestamp: 1_787_000_000, punch_state: '0' }),
    );

    expect(response.status).toBe(200);
    const body = await jsonOf(response);
    expect(body.received).toBe(1);
    const [fn, args] = runMutation.mock.calls[0];
    expect(fn).toBe('internal.inbound.ingestDevicePunches');
    expect(args.organizationId).toBe('org1');
    expect(args.tokenId).toBe('tok_1');
    expect(args.punches).toHaveLength(1);
    expect(args.punches[0]).toMatchObject({ employeeNumber: '1024', direction: 'in' });
  });

  it('acknowledges a payload the mapping cannot read instead of erroring', async () => {
    const { ctx, runMutation } = makeCtx(deviceToken);
    const response = await route.handler(ctx, post('inb_device', { hello: 'world' }));

    // 202, not 500: the device clears its queue and the reason stays visible in
    // the token's lastError rather than retrying the same batch forever.
    expect(response.status).toBe(202);
    expect(await jsonOf(response)).toMatchObject({ stored: 0 });
    expect(runMutation).not.toHaveBeenCalled();
  });

  it('turns a Jira event into a task for the configured assignee', async () => {
    const jiraToken = { ...deviceToken, provider: 'jira', defaultAssigneeId: 'u_hr' };
    const { ctx, runMutation } = makeCtx(jiraToken, { created: true, taskId: 'task_1' });
    const response = await route.handler(
      ctx,
      post('inb_jira', {
        webhookEvent: 'jira:issue_created',
        issue: { key: 'HR-1', fields: { summary: 'Do the thing' } },
      }),
    );

    expect(response.status).toBe(201);
    const [fn, args] = runMutation.mock.calls[0];
    expect(fn).toBe('internal.inbound.ingestJiraEvent');
    expect(args).toMatchObject({ tokenId: 'tok_1', organizationId: 'org1' });
  });

  it('rejects a non-JSON body with 400', async () => {
    const { ctx } = makeCtx(deviceToken);
    const response = await route.handler(ctx, post('inb_device', 'not json'));
    expect(response.status).toBe(400);
  });
});
