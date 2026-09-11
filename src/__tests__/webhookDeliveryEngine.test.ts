/**
 * Deep coverage tests for the webhook delivery engine (convex/webhooks/main.ts).
 *
 * The Convex function wrappers are unwrapped to their handlers and run against
 * a mock ctx (same pattern as convex-operatorTools-deep.test.ts). fetch is
 * mocked to exercise success, HTTP-failure and network-failure paths including
 * retry scheduling and endpoint auto-disable.
 *
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  mutation: ({ handler, args }: any) => ({ handler, args }),
  query: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
  internalQuery: ({ handler, args }: any) => ({ handler, args }),
  internalAction: ({ handler, args }: any) => ({ handler, args }),
}));

jest.mock('../../convex/_generated/api', () => ({
  internal: { webhooks: { main: {} } },
  api: {},
}));

const mockGetAuthCaller = jest.fn();
jest.mock('../../convex/lib/getAuthCaller', () => ({
  getAuthCaller: (...a: unknown[]) => mockGetAuthCaller(...a),
}));

type Row = Record<string, any>;

/**
 * Minimal Convex-db mock: get/insert/patch/delete + indexed queries whose
 * `eq` filters are actually applied to the in-memory rows.
 */
function makeDb() {
  const tables: Record<string, Row[]> = {
    webhookEndpoints: [],
    webhookDeliveries: [],
  };
  let nextId = 100;

  const db = {
    get: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const row = rows.find((r) => r._id === id);
        if (row) return row;
      }
      return null;
    },
    insert: async (table: string, doc: Row) => {
      const id = `${table.slice(0, 3)}_${nextId++}`;
      (tables[table] ??= []).push({ _id: id, ...doc });
      return id;
    },
    patch: async (id: string, patch: Row) => {
      const row = await db.get(id);
      if (row) Object.assign(row, patch);
    },
    delete: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const i = rows.findIndex((r) => r._id === id);
        if (i >= 0) rows.splice(i, 1);
      }
    },
    query: (table: string) => {
      const rows = tables[table] ?? [];
      const apply = (row: Row, filters: Record<string, unknown>) =>
        Object.entries(filters).every(([k, v]) => row[k] === v);
      const chain: any = {
        withIndex: (_name: string, cb?: any) => {
          const filters: Record<string, unknown> = {};
          if (cb) {
            const cap: any = {
              eq: (k: string, v: unknown) => {
                filters[k] = v;
                return cap;
              },
            };
            cb(cap);
          }
          chain.__filters = filters;
          return chain;
        },
        order: () => chain,
        collect: async () =>
          rows.filter((r) => apply(r, chain.__filters ?? {})).map((r) => ({ ...r })),
        take: async (n: number) =>
          rows
            .filter((r) => apply(r, chain.__filters ?? {}))
            .slice(0, n)
            .map((r) => ({ ...r })),
        first: async () => rows.filter((r) => apply(r, chain.__filters ?? {}))[0] ?? null,
      };
      return chain;
    },
  };
  return { db, tables };
}

function makeCtx() {
  const { db, tables } = makeDb();
  const scheduled: Row[] = [];
  const ctx: any = {
    db,
    scheduler: { runAfter: async (_d: number, fn: any, args: any) => scheduled.push({ fn, args }) },
    runQuery: async () => {
      throw new Error('runQuery must be wired per-test');
    },
    runMutation: async () => undefined,
    __tables: tables,
    __scheduled: scheduled,
  };
  return ctx;
}

describe('webhook admin CRUD (auth + org scoping)', () => {
  let mod: any;

  beforeAll(async () => {
    mod = await import('../../convex/webhooks/main');
  });

  const admin = { _id: 'u1', role: 'admin', organizationId: 'org1' };
  const employee = { _id: 'u2', role: 'employee', organizationId: 'org1' };

  beforeEach(() => {
    mockGetAuthCaller.mockReset();
  });

  it('createEndpoint rejects non-https URLs', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx = makeCtx();
    await expect(
      mod.createEndpoint.handler(ctx, { url: 'http://insecure.com/hook', events: [] }),
    ).rejects.toThrow(/https/);
  });

  it('createEndpoint rejects employees', async () => {
    mockGetAuthCaller.mockResolvedValue(employee);
    const ctx = makeCtx();
    await expect(
      mod.createEndpoint.handler(ctx, { url: 'https://ok.com/hook', events: [] }),
    ).rejects.toThrow(/organization admins/);
  });

  it('createEndpoint stores a secret; listEndpoints never returns it', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx = makeCtx();
    await mod.createEndpoint.handler(ctx, { url: 'https://ok.com/hook', events: [], label: 'x' });

    const listed = await mod.listEndpoints.handler(ctx, {});
    expect(listed).toHaveLength(1);
    expect(listed[0].secret).toBeUndefined();
    expect(String(listed[0].secretHint)).toMatch(/•/);
    expect(ctx.__tables.webhookEndpoints[0].secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('invalid event subscriptions are normalized away', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx = makeCtx();
    await mod.createEndpoint.handler(ctx, {
      url: 'https://ok.com/hook',
      events: ['leave.approved', 'bogus.event', 'leave.approved'],
    });
    expect(ctx.__tables.webhookEndpoints[0].events).toStrictEqual(['leave.approved']);
  });

  it('updateEndpoint and deleteEndpoint refuse cross-org access', async () => {
    mockGetAuthCaller.mockResolvedValue({ ...admin, organizationId: 'org1' });
    const ctx = makeCtx();
    ctx.__tables.webhookEndpoints.push({
      _id: 'e_other',
      organizationId: 'org2',
      url: 'https://x.com',
      secret: 's',
      enabled: true,
      events: [],
    });
    await expect(
      mod.updateEndpoint.handler(ctx, { endpointId: 'e_other', enabled: false }),
    ).rejects.toThrow('Webhook endpoint not found');
    await expect(mod.deleteEndpoint.handler(ctx, { endpointId: 'e_other' })).rejects.toThrow(
      'Webhook endpoint not found',
    );
  });

  it('re-enabling resets consecutiveFailures', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx = makeCtx();
    ctx.__tables.webhookEndpoints.push({
      _id: 'e1',
      organizationId: 'org1',
      url: 'https://x.com',
      secret: 's',
      enabled: false,
      events: [],
      consecutiveFailures: 21,
      lastStatus: 'failed',
    });
    await mod.updateEndpoint.handler(ctx, { endpointId: 'e1', enabled: true });
    expect(ctx.__tables.webhookEndpoints[0].consecutiveFailures).toBe(0);
    expect(ctx.__tables.webhookEndpoints[0].enabled).toBe(true);
  });

  it('rotateSecret returns the new secret exactly once', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx = makeCtx();
    ctx.__tables.webhookEndpoints.push({
      _id: 'e1',
      organizationId: 'org1',
      url: 'https://x.com',
      secret: 'old',
      enabled: true,
      events: [],
    });
    const res = await mod.rotateSecret.handler(ctx, { endpointId: 'e1' });
    expect(res.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(ctx.__tables.webhookEndpoints[0].secret).toBe(res.secret);
  });
});

describe('emitEvent fan-out', () => {
  let mod: any;

  beforeAll(async () => {
    mod = await import('../../convex/webhooks/main');
  });

  it('only queues to matching, enabled endpoints and schedules the worker', async () => {
    const ctx = makeCtx();
    for (const e of [
      {
        _id: 'e_all',
        organizationId: 'org1',
        enabled: true,
        events: [],
        secret: 's',
        url: 'https://a.com',
      },
      {
        _id: 'e_leave',
        organizationId: 'org1',
        enabled: true,
        events: ['leave.approved'],
        secret: 's',
        url: 'https://b.com',
      },
      {
        _id: 'e_other_event',
        organizationId: 'org1',
        enabled: true,
        events: ['expense.submitted'],
        secret: 's',
        url: 'https://c.com',
      },
      {
        _id: 'e_disabled',
        organizationId: 'org1',
        enabled: false,
        events: [],
        secret: 's',
        url: 'https://d.com',
      },
      {
        _id: 'e_other_org',
        organizationId: 'org2',
        enabled: true,
        events: [],
        secret: 's',
        url: 'https://e.com',
      },
    ]) {
      ctx.__tables.webhookEndpoints.push(e);
    }
    const res = await mod.emitEvent.handler(ctx, {
      eventType: 'leave.approved',
      organizationId: 'org1',
      data: { leaveId: 'l1' },
    });
    expect(res.queued).toBe(2);
    expect(ctx.__tables.webhookDeliveries).toHaveLength(2);
    expect(ctx.__scheduled).toHaveLength(1);
    for (const d of ctx.__tables.webhookDeliveries) {
      const p = JSON.parse(d.payload);
      expect(p.event).toBe('leave.approved');
      expect(p.deliveryId).not.toBe('pending'); // rebuilt with the real id
      expect(p.data).toEqual({ leaveId: 'l1' });
    }
  });

  it('queues nothing when no endpoint matches', async () => {
    const ctx = makeCtx();
    const res = await mod.emitEvent.handler(ctx, {
      eventType: 'leave.approved',
      organizationId: 'org1',
      data: {},
    });
    expect(res.queued).toBe(0);
    expect(ctx.__scheduled).toHaveLength(0);
  });
});

describe('deliverPending worker', () => {
  let mod: any;
  let runQuerySpy: jest.Mock;
  let runMutationSpy: jest.Mock;
  let fetchMock: jest.Mock;

  const endpoint = {
    _id: 'e1',
    organizationId: 'org1',
    url: 'https://consumer.example/hook',
    secret: 'topsecret',
    enabled: true,
    events: [],
    consecutiveFailures: 0,
  };
  const delivery = {
    _id: 'd1',
    organizationId: 'org1',
    endpointId: 'e1',
    eventType: 'leave.approved',
    status: 'pending',
    attempt: 0,
    payload: JSON.stringify({ event: 'leave.approved' }),
    createdAt: 1,
  };

  beforeAll(async () => {
    mod = await import('../../convex/webhooks/main');
  });

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    runQuerySpy = jest.fn();
    runMutationSpy = jest.fn().mockResolvedValue(undefined);
  });

  function wire(args: {
    endpoint?: Row | null;
    deliveries?: Row[];
    fetchResponse?: any;
    fetchError?: Error;
  }) {
    runQuerySpy.mockImplementation(async (_fn: any, a: any) => {
      if (a && a.endpointId)
        return args.endpoint === undefined
          ? { url: endpoint.url, secret: endpoint.secret, enabled: true }
          : args.endpoint;
      return args.deliveries ?? [{ ...delivery }];
    });
    if (args.fetchError) fetchMock.mockRejectedValue(args.fetchError);
    else fetchMock.mockResolvedValue(args.fetchResponse ?? { ok: true, status: 200 });
    const ctx = makeCtx();
    ctx.runQuery = runQuerySpy;
    ctx.runMutation = runMutationSpy;
    return ctx;
  }

  it('POSTs a signed request and records success + endpoint health', async () => {
    const ctx = wire({});
    await mod.deliverPending.handler(ctx, {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://consumer.example/hook');
    expect(init.method).toBe('POST');
    expect(init.headers['x-webhook-signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(init.headers['x-webhook-timestamp']).toMatch(/^\d+$/);
    expect(init.headers['x-webhook-event']).toBe('leave.approved');
    expect(init.body).toBe(delivery.payload);

    const outcome = runMutationSpy.mock.calls
      .map((c: any[]) => c[1])
      .find((a: any) => a?.deliveryId === 'd1')?.outcome;
    expect(outcome.status).toBe('success');
    expect(outcome.attempt).toBe(1);
    const health = runMutationSpy.mock.calls
      .map((c: any[]) => c[1])
      .find((a: any) => a?.endpointId === 'e1');
    expect(health.ok).toBe(true);
  });

  it('schedules a retry with backoff on HTTP failure and bumps endpoint failures', async () => {
    const ctx = wire({ fetchResponse: { ok: false, status: 500 } });
    await mod.deliverPending.handler(ctx, {});

    const outcome = runMutationSpy.mock.calls
      .map((c: any[]) => c[1])
      .find((a: any) => a?.deliveryId === 'd1')?.outcome;
    expect(outcome.status).toBe('pending');
    expect(outcome.error).toBe('HTTP 500');
    expect(outcome.nextAttemptAt).toBeGreaterThan(Date.now());
    const health = runMutationSpy.mock.calls
      .map((c: any[]) => c[1])
      .find((a: any) => a?.endpointId === 'e1');
    expect(health.ok).toBe(false);
  });

  it('marks the delivery dead after the final retry', async () => {
    // RETRY_DELAYS_MS = [0, 1m, 5m, 30m, 2h] → attempt 4 is the last one.
    const ctx = wire({
      deliveries: [{ ...delivery, attempt: 4 }],
      fetchError: new Error('DNS gone'),
    });
    await mod.deliverPending.handler(ctx, {});

    const outcome = runMutationSpy.mock.calls
      .map((c: any[]) => c[1])
      .find((a: any) => a?.deliveryId === 'd1')?.outcome;
    expect(outcome.status).toBe('dead');
    expect(outcome.nextAttemptAt).toBeUndefined();
  });

  it('dead-letters immediately when the endpoint is gone or disabled', async () => {
    const ctx = wire({ endpoint: null });
    await mod.deliverPending.handler(ctx, {});

    const outcome = runMutationSpy.mock.calls
      .map((c: any[]) => c[1])
      .find((a: any) => a?.deliveryId === 'd1')?.outcome;
    expect(outcome.status).toBe('dead');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('worker self-reschedules when the batch is full', async () => {
    const batch = Array.from({ length: 20 }, (_, i) => ({ ...delivery, _id: `d${i}` }));
    const ctx = wire({ deliveries: batch });
    await mod.deliverPending.handler(ctx, {});
    expect(ctx.__scheduled).toHaveLength(1); // re-run queued
  });
});
