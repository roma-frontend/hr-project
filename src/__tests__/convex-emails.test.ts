/**
 * Tests for convex/emails.ts — the outgoing mail path.
 *
 * The sending is one `fetch`. Everything that can go wrong around it is decided
 * here, and every case below is one of those decisions:
 *
 *   - a deployment with no key must record `skipped`, not throw: the caller is
 *     usually a workflow run, and "email is not set up" is an outcome;
 *   - while the domain is unverified Resend only delivers to the account owner,
 *     so the redirect has to be written into the row *and* marked on the subject,
 *     or a workflow that emails a new hire looks delivered when it went to an
 *     administrator;
 *   - a 4xx is a configuration or content problem and fails identically on a
 *     retry, while a 5xx or a 429 is worth another attempt — retrying the first
 *     forever is how a domain mistake turns into a hammered API;
 *   - every attempt sends the same `Idempotency-Key`, so a retry after a lost
 *     response cannot become a second copy in somebody's inbox.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../../convex/_generated/server', () => ({
  internalAction: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
  internalQuery: ({ handler, args }: any) => ({ handler, args }),
  mutation: ({ handler, args }: any) => ({ handler, args }),
  query: ({ handler, args }: any) => ({ handler, args }),
}));

const mockInternal = {
  emails: {
    deliverEmail: { _name: 'deliverEmail' },
    queueEmail: { _name: 'queueEmail' },
    getDelivery: { _name: 'getDelivery' },
    scheduleEmailRetry: { _name: 'scheduleEmailRetry' },
    finishDelivery: { _name: 'finishDelivery' },
  },
};

jest.mock('../../convex/_generated/api', () => ({ internal: mockInternal }));

jest.mock('../../convex/lib/getAuthCaller', () => ({ getAuthCaller: jest.fn() }));

jest.mock('../../convex/lib/auth', () => ({ isSuperadmin: jest.fn() }));

// ── Module under test ────────────────────────────────────────────────────────
let mockGetAuthCaller: jest.Mock;
let mockIsSuperadmin: jest.Mock;

type Handler = (ctx: any, args: any) => Promise<any>;
const handlers: Record<string, Handler> = {};

const MAX_ATTEMPTS = 3;
const ORG = 'org-1';
const DELIVERY_ID = 'delivery_1';
const KEY = 're_test_1234567890';

const ENV_KEYS = [
  'RESEND_API_KEY',
  'RESEND_DOMAIN_VERIFIED',
  'RESEND_TEST_EMAIL',
  'RESEND_FROM_EMAIL',
  'BOOTSTRAP_SUPERADMIN_EMAIL',
] as const;

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  mockGetAuthCaller = jest.requireMock('../../convex/lib/getAuthCaller').getAuthCaller;
  mockIsSuperadmin = jest.requireMock('../../convex/lib/auth').isSuperadmin;
  mockGetAuthCaller.mockReset();
  mockIsSuperadmin.mockReset();
  mockIsSuperadmin.mockReturnValue(false);

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../convex/emails');
    for (const [name, def] of Object.entries(mod)) {
      if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
        handlers[name] = (def as any).handler;
      }
    }
  });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────
/** A deployment that can send to anyone. */
function configureVerified() {
  process.env.RESEND_API_KEY = KEY;
  process.env.RESEND_DOMAIN_VERIFIED = 'true';
}

/** A deployment with a key, but the sending domain not yet verified. */
function configureUnverified() {
  process.env.RESEND_API_KEY = KEY;
}

function makeMutationCtx(existing: unknown = null) {
  const insert = jest.fn().mockResolvedValue(DELIVERY_ID);
  const patch = jest.fn().mockResolvedValue(undefined);
  const runAfter = jest.fn().mockResolvedValue(undefined);
  return {
    ctx: {
      db: { insert, patch, get: jest.fn().mockResolvedValue(existing) },
      scheduler: { runAfter },
    },
    insert,
    patch,
    runAfter,
  };
}

function makeActionCtx() {
  const runQuery = jest.fn();
  const runMutation = jest.fn().mockResolvedValue(undefined);
  return { ctx: { runQuery, runMutation }, runQuery, runMutation };
}

function deliveryRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: DELIVERY_ID,
    intendedTo: 'ani@example.com',
    to: 'ani@example.com',
    from: 'Strata <hr@strata.work>',
    subject: 'Welcome',
    html: '<p>hi</p>',
    text: 'hi',
    status: 'pending',
    attempts: 0,
    organizationId: ORG,
    ...overrides,
  };
}

const QUEUE_ARGS = {
  organizationId: ORG,
  intendedTo: 'ani@example.com',
  subject: 'Welcome',
  body: 'First paragraph.\n\nSecond paragraph.',
  source: 'workflow',
};

function requester(role: 'admin' | 'employee' = 'admin', organizationId: string | null = ORG) {
  return {
    _id: 'user_admin',
    role,
    email: 'admin@example.com',
    organizationId: organizationId === null ? undefined : organizationId,
    name: 'Admin',
  };
}

let fetchMock: jest.Mock;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function okResponse(body: unknown = { id: 're_provider_1' }) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

function errorResponse(status: number, body = 'nope') {
  return { ok: false, status, text: async () => body };
}

// ── queueEmail ───────────────────────────────────────────────────────────────
describe('queueEmail', () => {
  it('records `skipped` instead of throwing when the deployment has no mail key', async () => {
    const { ctx, insert, runAfter } = makeMutationCtx();

    const result = await handlers.queueEmail!(ctx, QUEUE_ARGS);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('email_no_api_key');
    expect(insert).toHaveBeenCalledWith(
      'emailDeliveries',
      expect.objectContaining({ status: 'skipped', reason: 'email_no_api_key', attempts: 0 }),
    );
    // Nothing to deliver, so nothing is scheduled.
    expect(runAfter).not.toHaveBeenCalled();
  });

  it('queues the message and schedules delivery when configured', async () => {
    configureVerified();
    const { ctx, insert, runAfter } = makeMutationCtx();

    const result = await handlers.queueEmail!(ctx, QUEUE_ARGS);

    expect(result.status).toBe('pending');
    expect(result.to).toBe('ani@example.com');
    expect(result.redirected).toBe(false);
    expect(insert).toHaveBeenCalledWith(
      'emailDeliveries',
      expect.objectContaining({
        status: 'pending',
        to: 'ani@example.com',
        organizationId: ORG,
        source: 'workflow',
      }),
    );
    expect(runAfter).toHaveBeenCalledWith(0, mockInternal.emails.deliverEmail, {
      deliveryId: DELIVERY_ID,
    });
  });

  it('redirects to the fallback while the domain is unverified, and marks the subject', async () => {
    // Resend only delivers to the account owner until the domain is verified, so
    // a message addressed to anyone else goes to the fallback — visibly.
    configureUnverified();
    process.env.RESEND_TEST_EMAIL = 'owner@example.com';
    const { ctx, insert } = makeMutationCtx();

    const result = await handlers.queueEmail!(ctx, QUEUE_ARGS);

    expect(result.redirected).toBe(true);
    expect(result.to).toBe('owner@example.com');
    expect(insert).toHaveBeenCalledWith(
      'emailDeliveries',
      expect.objectContaining({
        intendedTo: 'ani@example.com',
        to: 'owner@example.com',
        redirected: true,
        subject: '[For ani@example.com] Welcome',
      }),
    );
  });

  it('skips rather than guessing when the domain is unverified and there is no fallback', async () => {
    configureUnverified();
    const { ctx } = makeMutationCtx();

    const result = await handlers.queueEmail!(ctx, QUEUE_ARGS);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('email_no_fallback');
  });

  it('skips an address that is not one', async () => {
    configureVerified();
    const { ctx } = makeMutationCtx();

    const result = await handlers.queueEmail!(ctx, { ...QUEUE_ARGS, intendedTo: 'not-an-email' });

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('email_invalid_recipient');
  });

  it('treats markup in the body as text, not as markup', async () => {
    configureVerified();
    const { ctx, insert } = makeMutationCtx();

    await handlers.queueEmail!(ctx, { ...QUEUE_ARGS, body: '<script>alert(1)</script>' });

    const row = insert.mock.calls[0]![1] as { html: string; text: string };
    expect(row.html).not.toContain('<script>');
    expect(row.html).toContain('&lt;script&gt;');
    expect(row.text).toContain('<script>alert(1)</script>');
  });

  it('falls back to the shared default sender when none is configured', async () => {
    configureVerified();
    const { ctx, insert } = makeMutationCtx();

    await handlers.queueEmail!(ctx, QUEUE_ARGS);

    expect(insert).toHaveBeenCalledWith(
      'emailDeliveries',
      expect.objectContaining({ from: 'Strata <hr@strata.work>' }),
    );
  });

  it('records what produced the email, for the audit trail', async () => {
    configureVerified();
    const { ctx, insert } = makeMutationCtx();

    await handlers.queueEmail!(ctx, {
      ...QUEUE_ARGS,
      source: 'workflow',
      workflowId: 'wf_1' as never,
      createdBy: 'user_1' as never,
    });

    expect(insert).toHaveBeenCalledWith(
      'emailDeliveries',
      expect.objectContaining({ source: 'workflow', workflowId: 'wf_1', createdBy: 'user_1' }),
    );
  });
});

// ── getDelivery / finishDelivery / scheduleEmailRetry ────────────────────────
describe('delivery bookkeeping', () => {
  it('reads a delivery by id for the worker', async () => {
    const get = jest.fn().mockResolvedValue(deliveryRow());
    const ctx = { db: { get } };

    const result = await handlers.getDelivery!(ctx, { deliveryId: DELIVERY_ID });

    expect(get).toHaveBeenCalledWith(DELIVERY_ID);
    expect(result).toMatchObject({ _id: DELIVERY_ID });
  });

  it('stamps sentAt only when the message actually went out', async () => {
    const { ctx, patch } = makeMutationCtx();

    await handlers.finishDelivery!(ctx, {
      deliveryId: DELIVERY_ID,
      outcome: 'sent',
      providerId: 're_1',
      attempts: 1,
    });

    expect(patch).toHaveBeenCalledWith(
      DELIVERY_ID,
      expect.objectContaining({ status: 'sent', providerId: 're_1', sentAt: expect.any(Number) }),
    );
  });

  it('keeps a failed-and-retrying message `pending`, with the attempt count and the error', async () => {
    // Pending here means "still trying" — what tells an operator apart from
    // "gave up", which is `failed`.
    const { ctx, patch } = makeMutationCtx();

    await handlers.finishDelivery!(ctx, {
      deliveryId: DELIVERY_ID,
      outcome: 'pending',
      error: 'Resend 503: unavailable',
      attempts: 2,
    });

    expect(patch).toHaveBeenCalledWith(
      DELIVERY_ID,
      expect.objectContaining({
        status: 'pending',
        error: 'Resend 503: unavailable',
        attempts: 2,
        sentAt: undefined,
      }),
    );
  });

  it('schedules the next attempt', async () => {
    const { ctx, runAfter } = makeMutationCtx();

    await handlers.scheduleEmailRetry!(ctx, { deliveryId: DELIVERY_ID, delayMs: 30_000 });

    expect(runAfter).toHaveBeenCalledWith(30_000, mockInternal.emails.deliverEmail, {
      deliveryId: DELIVERY_ID,
    });
  });

  it('clamps a negative delay rather than passing it to the scheduler', async () => {
    const { ctx, runAfter } = makeMutationCtx();

    await handlers.scheduleEmailRetry!(ctx, { deliveryId: DELIVERY_ID, delayMs: -5000 });

    expect(runAfter).toHaveBeenCalledWith(0, mockInternal.emails.deliverEmail, expect.anything());
  });
});

// ── deliverEmail ─────────────────────────────────────────────────────────────
describe('deliverEmail', () => {
  it('stops when the row is gone', async () => {
    const { ctx, runQuery } = makeActionCtx();
    runQuery.mockResolvedValue(null);

    const result = await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(result).toEqual({ sent: false, reason: 'not_found' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send again after a successful delivery', async () => {
    const { ctx, runQuery } = makeActionCtx();
    runQuery.mockResolvedValue(deliveryRow({ status: 'sent' }));

    const result = await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(result).toEqual({ sent: true, reason: 'noop' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send a message that was skipped', async () => {
    const { ctx, runQuery } = makeActionCtx();
    runQuery.mockResolvedValue(deliveryRow({ status: 'skipped' }));

    const result = await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(result).toEqual({ sent: false, reason: 'noop' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails finally when the key disappeared between queueing and sending', async () => {
    // No key in the environment anymore: the row must not stay pending forever.
    const { ctx, runQuery, runMutation } = makeActionCtx();
    runQuery.mockResolvedValue(deliveryRow());

    const result = await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(result).toEqual({ sent: false, reason: 'no_api_key' });
    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.finishDelivery,
      expect.objectContaining({
        outcome: 'failed',
        error: 'RESEND_API_KEY is not set',
        attempts: 1,
      }),
    );
  });

  it('posts to Resend with a stable idempotency key and records the provider id', async () => {
    configureVerified();
    const { ctx, runQuery, runMutation } = makeActionCtx();
    runQuery.mockResolvedValue(deliveryRow());
    fetchMock.mockResolvedValue(okResponse({ id: 're_provider_1' }));

    const result = await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(result).toEqual({ sent: true, providerId: 're_provider_1' });
    const [url, init] = fetchMock.mock.calls[0]! as [string, any];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    // Derived from the row id, so every attempt of this delivery carries the same
    // key and a retry after a lost response is deduplicated.
    expect(init.headers['Idempotency-Key']).toBe(DELIVERY_ID);
    expect(JSON.parse(init.body)).toMatchObject({
      from: 'Strata <hr@strata.work>',
      to: ['ani@example.com'],
      subject: 'Welcome',
    });
    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.finishDelivery,
      expect.objectContaining({ outcome: 'sent', providerId: 're_provider_1', attempts: 1 }),
    );
  });

  it('treats a 4xx as final — a retry would fail identically', async () => {
    configureVerified();
    const { ctx, runQuery, runMutation } = makeActionCtx();
    runQuery.mockResolvedValue(deliveryRow());
    fetchMock.mockResolvedValue(errorResponse(422, 'domain not verified'));

    const result = await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(result).toEqual({ sent: false, reason: 'http_422' });
    const calls = runMutation.mock.calls.map((c) => c[0]);
    expect(calls).toContain(mockInternal.emails.finishDelivery);
    expect(calls).not.toContain(mockInternal.emails.scheduleEmailRetry);
    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.finishDelivery,
      expect.objectContaining({ outcome: 'failed', attempts: 1 }),
    );
  });

  it('retries a 5xx with backoff', async () => {
    configureVerified();
    const { ctx, runQuery, runMutation } = makeActionCtx();
    runQuery.mockResolvedValue(deliveryRow());
    fetchMock.mockResolvedValue(errorResponse(503, 'unavailable'));

    const result = await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(result.sent).toBe(false);
    expect(runMutation).toHaveBeenCalledWith(mockInternal.emails.scheduleEmailRetry, {
      deliveryId: DELIVERY_ID,
      delayMs: 30_000,
    });
    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.finishDelivery,
      expect.objectContaining({ outcome: 'pending', attempts: 1 }),
    );
  });

  it('retries a 429 — the provider is asking for patience, not reporting a mistake', async () => {
    configureVerified();
    const { ctx, runQuery, runMutation } = makeActionCtx();
    runQuery.mockResolvedValue(deliveryRow());
    fetchMock.mockResolvedValue(errorResponse(429, 'slow down'));

    await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.scheduleEmailRetry,
      expect.anything(),
    );
  });

  it('retries a network-level failure', async () => {
    configureVerified();
    const { ctx, runQuery, runMutation } = makeActionCtx();
    runQuery.mockResolvedValue(deliveryRow());
    fetchMock.mockRejectedValue(new Error('socket hang up'));

    const result = await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(result.sent).toBe(false);
    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.scheduleEmailRetry,
      expect.anything(),
    );
    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.finishDelivery,
      expect.objectContaining({ outcome: 'pending', error: 'socket hang up' }),
    );
  });

  it('gives up on the last attempt instead of retrying forever', async () => {
    configureVerified();
    const { ctx, runQuery, runMutation } = makeActionCtx();
    // attempts is already at the limit, so this attempt is the final one.
    runQuery.mockResolvedValue(deliveryRow({ attempts: MAX_ATTEMPTS - 1 }));
    fetchMock.mockResolvedValue(errorResponse(503, 'unavailable'));

    await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    const calls = runMutation.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain(mockInternal.emails.scheduleEmailRetry);
    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.finishDelivery,
      expect.objectContaining({ outcome: 'failed', attempts: MAX_ATTEMPTS }),
    );
  });

  it('counts the attempt even when it succeeds late', async () => {
    configureVerified();
    const { ctx, runQuery, runMutation } = makeActionCtx();
    runQuery.mockResolvedValue(deliveryRow({ attempts: 1 }));
    fetchMock.mockResolvedValue(okResponse({ id: 're_2' }));

    await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.finishDelivery,
      expect.objectContaining({ outcome: 'sent', attempts: 2 }),
    );
  });

  it('accepts a 2xx whose body is not JSON — accepted is accepted', async () => {
    configureVerified();
    const { ctx, runQuery, runMutation } = makeActionCtx();
    runQuery.mockResolvedValue(deliveryRow());
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => 'not json' });

    const result = await handlers.deliverEmail!(ctx, { deliveryId: DELIVERY_ID });

    expect(result).toEqual({ sent: true, providerId: undefined });
    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.finishDelivery,
      expect.objectContaining({ outcome: 'sent' }),
    );
  });
});

// ── getEmailConfiguration ────────────────────────────────────────────────────
describe('getEmailConfiguration', () => {
  it('returns null without a session', async () => {
    mockGetAuthCaller.mockResolvedValue(null);

    expect(await handlers.getEmailConfiguration!({ db: { get: jest.fn() } }, {})).toBeNull();
  });

  it('returns null for a caller who is not an administrator', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const ctx = { db: { get: jest.fn().mockResolvedValue(requester('employee')) } };

    expect(await handlers.getEmailConfiguration!(ctx, {})).toBeNull();
  });

  it('reports the problem when nothing can be sent', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const ctx = { db: { get: jest.fn().mockResolvedValue(requester('admin')) } };

    const config = await handlers.getEmailConfiguration!(ctx, {});

    expect(config).toEqual(
      expect.objectContaining({ configured: false, problem: 'no_api_key', redirectTo: null }),
    );
  });

  it('reports where a message would actually land while the domain is unverified', async () => {
    configureUnverified();
    process.env.RESEND_TEST_EMAIL = 'owner@example.com';
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const ctx = { db: { get: jest.fn().mockResolvedValue(requester('admin')) } };

    const config = await handlers.getEmailConfiguration!(ctx, {});

    expect(config).toEqual(
      expect.objectContaining({
        configured: true,
        domainVerified: false,
        redirectTo: 'owner@example.com',
      }),
    );
  });
});

// ── sendTestEmail ────────────────────────────────────────────────────────────
describe('sendTestEmail', () => {
  it('refuses a caller who is not an administrator', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const ctx = {
      db: { get: jest.fn().mockResolvedValue(requester('employee')) },
      runMutation: jest.fn(),
    };

    await expect(handlers.sendTestEmail!(ctx, {})).rejects.toThrow(/Only administrators/);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it('goes through the same queue every other message uses', async () => {
    // The point of a test send is that success means the real path works.
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const runMutation = jest.fn().mockResolvedValue({
      deliveryId: DELIVERY_ID,
      status: 'pending',
      to: 'owner@example.com',
      redirected: true,
    });
    const ctx = { db: { get: jest.fn().mockResolvedValue(requester('admin')) }, runMutation };

    const result = await handlers.sendTestEmail!(ctx, {});

    expect(runMutation).toHaveBeenCalledWith(
      mockInternal.emails.queueEmail,
      expect.objectContaining({ intendedTo: 'admin@example.com', source: 'email_test' }),
    );
    expect(result).toMatchObject({ success: true, to: 'owner@example.com', redirected: true });
  });

  it('reports a skipped send as a failure with the reason', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const ctx = {
      db: { get: jest.fn().mockResolvedValue(requester('admin')) },
      runMutation: jest.fn().mockResolvedValue({
        deliveryId: DELIVERY_ID,
        status: 'skipped',
        reason: 'email_no_api_key',
        to: 'a@b.c',
        redirected: false,
      }),
    };

    const result = await handlers.sendTestEmail!(ctx, {});

    expect(result).toMatchObject({ success: false, reason: 'email_no_api_key' });
  });

  it('sends to an address the admin asked for', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const ctx = {
      db: { get: jest.fn().mockResolvedValue(requester('admin')) },
      runMutation: jest.fn().mockResolvedValue({
        deliveryId: DELIVERY_ID,
        status: 'pending',
        to: 'other@example.com',
        redirected: false,
      }),
    };

    await handlers.sendTestEmail!(ctx, { intendedTo: ' other@example.com ' });

    expect(ctx.runMutation).toHaveBeenCalledWith(
      mockInternal.emails.queueEmail,
      expect.objectContaining({ intendedTo: 'other@example.com' }),
    );
  });
});

// ── retryDelivery ────────────────────────────────────────────────────────────
describe('retryDelivery', () => {
  it('refuses a caller who is not an administrator', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const ctx = {
      db: { get: jest.fn().mockResolvedValue(requester('employee')) },
      patch: jest.fn(),
    };

    await expect(handlers.retryDelivery!(ctx, { deliveryId: DELIVERY_ID })).rejects.toThrow(
      /Only administrators/,
    );
  });

  it('throws when the delivery does not exist', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const get = jest.fn().mockResolvedValueOnce(requester('admin')).mockResolvedValueOnce(null);

    await expect(
      handlers.retryDelivery!({ db: { get } }, { deliveryId: DELIVERY_ID }),
    ).rejects.toThrow('Delivery not found');
  });

  it('refuses a delivery belonging to another organisation', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const get = jest
      .fn()
      .mockResolvedValueOnce(requester('admin', ORG))
      .mockResolvedValueOnce(deliveryRow({ organizationId: 'org-other' }));

    await expect(
      handlers.retryDelivery!({ db: { get } }, { deliveryId: DELIVERY_ID }),
    ).rejects.toThrow('Access denied');
  });

  it('refuses to resend something already delivered', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const get = jest
      .fn()
      .mockResolvedValueOnce(requester('admin'))
      .mockResolvedValueOnce(deliveryRow({ status: 'sent' }));

    await expect(
      handlers.retryDelivery!({ db: { get } }, { deliveryId: DELIVERY_ID }),
    ).rejects.toThrow(/already delivered/);
  });

  it('reuses the row so the audit trail stays one line per intended message', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    const patch = jest.fn().mockResolvedValue(undefined);
    const runAfter = jest.fn().mockResolvedValue(undefined);
    const get = jest
      .fn()
      .mockResolvedValueOnce(requester('admin'))
      .mockResolvedValueOnce(deliveryRow({ status: 'failed', error: 'Resend 422' }));
    const ctx = { db: { get, patch }, scheduler: { runAfter } };

    const result = await handlers.retryDelivery!(ctx, { deliveryId: DELIVERY_ID });

    expect(patch).toHaveBeenCalledWith(
      DELIVERY_ID,
      expect.objectContaining({ status: 'pending', error: undefined }),
    );
    expect(runAfter).toHaveBeenCalledWith(0, mockInternal.emails.deliverEmail, {
      deliveryId: DELIVERY_ID,
    });
    expect(result).toEqual({ success: true });
  });

  it('lets a superadmin retry another organisation’s delivery', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'u1' });
    mockIsSuperadmin.mockReturnValue(true);
    const get = jest
      .fn()
      .mockResolvedValueOnce(requester('admin'))
      .mockResolvedValueOnce(deliveryRow({ organizationId: 'org-other' }));
    const ctx = {
      db: { get, patch: jest.fn() },
      scheduler: { runAfter: jest.fn() },
    };

    await expect(handlers.retryDelivery!(ctx, { deliveryId: DELIVERY_ID })).resolves.toEqual({
      success: true,
    });
  });
});
