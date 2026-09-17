/**
 * `payments.createLocalPayment` — the order total.
 *
 * Local rails (Idram / ArCa) are billed per seat like Stripe, and this mutation
 * used to record a flat $29 / $79 / $199 for every order. A 50-seat Pro customer
 * was therefore stored as a $79 order: wrong revenue, wrong reconciliation, and
 * a wrong figure for whatever the webhook later activates. These tests pin the
 * per-seat arithmetic at the volume brackets, and the seat default.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  mutation: ({ handler, args }: any) => ({ handler, args }),
  query: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
  internalQuery: ({ handler, args }: any) => ({ handler, args }),
}));

jest.mock('../../convex/lib/getAuthCaller', () => ({
  getAuthCaller: jest.fn(async () => ({
    _id: 'admin_1',
    role: 'admin',
    organizationId: 'org_1',
  })),
}));
jest.mock('../../convex/lib/rbac', () => ({
  requireOrgAdmin: jest.fn(async () => undefined),
}));
jest.mock('../../convex/lib/auth', () => ({ isSuperadmin: jest.fn(() => false) }));
jest.mock('../../convex/lib/notify', () => ({ notify: jest.fn() }));

let handlers: Record<string, any> = {};

beforeEach(() => {
  jest.clearAllMocks();
  jest.isolateModules(() => {
    const mod = require('../../convex/payments');
    for (const [name, def] of Object.entries(mod)) {
      if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
        handlers[name] = (def as any).handler;
      }
    }
  });
});

function makeCtx(
  config: Record<string, unknown> | null = {
    isEnabled: true,
    merchantId: 'm_1',
    // Acquiring providers refuse to build a handshake without an explicit host.
    apiUrl: 'https://psp.example/api',
  },
) {
  const insert = jest.fn().mockResolvedValue('pay_1');
  const db: any = {
    get: jest.fn().mockResolvedValue(undefined),
    patch: jest.fn().mockResolvedValue(undefined),
    insert,
    query: jest.fn(() => ({
      filter: jest.fn(() => ({ first: jest.fn().mockResolvedValue(config) })),
    })),
  };
  return { ctx: { db, auth: {} }, insert };
}

const baseOrder = {
  provider: 'ameriabank' as const,
  amountAmd: 100_000,
  origin: 'https://app.example',
};

async function placeOrder(overrides: Record<string, unknown>) {
  const { ctx, insert } = makeCtx();
  await handlers.createLocalPayment(ctx, {
    plan: 'professional',
    ...baseOrder,
    ...overrides,
  });
  return insert.mock.calls[0][1];
}

describe('createLocalPayment — per-seat order total', () => {
  it('charges the entry bracket when the order starts at the plan minimum', async () => {
    const row = await placeOrder({ plan: 'professional', seats: 10 });
    expect(row.seats).toBe(10);
    expect(row.amountUsd).toBe(80); // 10 × $8
  });

  it('moves the whole team to the volume bracket it reaches', async () => {
    // 50 seats is the 50+ bracket: $7/seat, not the entry $8/seat.
    const row = await placeOrder({ plan: 'professional', seats: 50 });
    expect(row.amountUsd).toBe(350);
  });

  it('handles the fractional starter bracket', async () => {
    expect((await placeOrder({ plan: 'starter', seats: 5 })).amountUsd).toBe(20); // 5 × $4
    expect((await placeOrder({ plan: 'starter', seats: 15 })).amountUsd).toBe(52.5); // 15 × $3.50
  });

  it('multiplies by the months purchased', async () => {
    const row = await placeOrder({ plan: 'professional', seats: 10, months: 3 });
    expect(row.months).toBe(3);
    expect(row.amountUsd).toBe(240);
  });

  it('defaults to the plan’s minimum billable team when seats are omitted', async () => {
    expect((await placeOrder({ plan: 'starter' })).seats).toBe(5);
    expect((await placeOrder({ plan: 'professional' })).amountUsd).toBe(80);
    expect((await placeOrder({ plan: 'enterprise' })).seats).toBe(100);
  });

  it('never records a free order for an unseated row', async () => {
    const row = await placeOrder({ plan: 'professional', seats: 0 });
    expect(row.seats).toBe(1);
    expect(row.amountUsd).toBeGreaterThan(0);
  });

  it('returns the same total it stored', async () => {
    const { ctx } = makeCtx();
    const result = await handlers.createLocalPayment(ctx, {
      plan: 'professional',
      seats: 50,
      ...baseOrder,
    });
    expect(result.amountUsd).toBe(350);
    expect(result.amountAmd).toBe(100_000);
    expect(result.handshake).toBeTruthy();
    // The PSP description carries the seats so the rails can reconcile. The
    // handshake puts it in a query string, where a space may be '+' — hence the
    // tolerant pattern rather than an exact string.
    expect(JSON.stringify(result.handshake)).toMatch(/50\+?seat/);
  });

  it('refuses an AMD-less order instead of guessing an exchange rate', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.createLocalPayment(ctx, {
        plan: 'professional',
        seats: 10,
        provider: 'ameriabank',
        origin: 'https://app.example',
      }),
    ).rejects.toThrow('amountAmd');
  });

  it('refuses a provider the superadmin has not configured', async () => {
    const { ctx } = makeCtx(null);
    await expect(
      handlers.createLocalPayment(ctx, { plan: 'starter', seats: 5, ...baseOrder }),
    ).rejects.toThrow('not configured');
  });
});
