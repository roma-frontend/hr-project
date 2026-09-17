/**
 * `occurredAt` on checkIn/checkOut — the offline-punch contract.
 *
 * The mobile quick-action bar queues a punch when the phone has no connection
 * and replays it later. Without a server-side timestamp the punch landed at the
 * moment it synced, so a 09:00 arrival recorded in a dead zone was stored as a
 * late check-in and fed payroll the wrong overtime. These tests pin the three
 * properties that make the replay safe:
 *   1. the record carries the time the punch was pressed,
 *   2. the day it belongs to is derived from that time (a punch queued before
 *      midnight is not filed under the next day),
 *   3. the client cannot backdate arbitrarily or write into the future.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  mutation: ({ handler, args }: any) => ({ handler, args }),
  query: ({ handler, args }: any) => ({ handler, args }),
}));
// Self-service punch: the caller is the record's owner, so no capability check
// is involved. The implementation lives in the factory because
// `jest.isolateModules` re-creates the mock for each load.
jest.mock('../../convex/lib/getAuthCaller', () => ({
  getAuthCaller: jest.fn(async () => ({
    _id: 'user_1',
    role: 'employee',
    organizationId: 'org_1',
  })),
}));
jest.mock('../../convex/lib/auth', () => ({ isSuperadmin: jest.fn(() => false) }));
jest.mock('../../convex/lib/userProfile', () => ({ getProfile: jest.fn() }));
jest.mock('../../convex/lib/entitlements', () => ({ assertModuleAccess: jest.fn() }));
jest.mock('../../convex/lib/capabilities', () => ({
  hasCapability: jest.fn(() => false),
  hasOrgWideReach: jest.fn(() => false),
}));
jest.mock('../../convex/lib/reportingLine', () => ({
  isAncestorOf: jest.fn(() => false),
  getSubordinateIds: jest.fn(() => []),
}));
jest.mock('../../convex/lib/rbac', () => ({ canAccessUser: jest.fn(() => true) }));
jest.mock('../../convex/lib/points', () => ({
  creditBalance: jest.fn(),
  resolveRecognitionSettings: jest.fn(async () => ({ attendanceReward: 0 })),
}));
jest.mock('../../convex/lib/systemAccounts', () => ({
  isSystemAccountEmail: jest.fn(() => false),
}));

let handlers: Record<string, any> = {};

beforeEach(() => {
  jest.clearAllMocks();
  jest.isolateModules(() => {
    const mod = require('../../convex/timeTracking');
    for (const [name, def] of Object.entries(mod)) {
      if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
        handlers[name] = (def as any).handler;
      }
    }
  });
});

afterEach(() => {
  jest.useRealTimers();
});

function makeCtx({ record = null, schedule = null }: { record?: any; schedule?: any } = {}) {
  const insert = jest.fn().mockResolvedValue('new_id');
  const patch = jest.fn().mockResolvedValue(undefined);
  const db: any = {
    get: jest.fn().mockResolvedValue(undefined),
    insert,
    patch,
    query: jest.fn((table: string) => ({
      withIndex: jest.fn(() => ({
        first: jest.fn().mockResolvedValue(table === 'timeTracking' ? record : schedule),
        filter: jest.fn(() => ({ first: jest.fn().mockResolvedValue(null) })),
      })),
    })),
  };
  return { ctx: { db, auth: { getUserIdentity: jest.fn() } }, insert, patch, db };
}

/** Armenia is UTC+4; the date a punch belongs to is the local one. */
const armeniaDate = (timestamp: number) =>
  new Date(timestamp + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('timeTracking.checkIn — offline punch timestamp', () => {
  it('stores the time the punch was pressed, not the sync time', async () => {
    const pressedAt = Date.now() - 45 * 60 * 1000;
    const { ctx, insert } = makeCtx();

    await handlers.checkIn(ctx, { userId: 'user_1', occurredAt: pressedAt });

    const record = insert.mock.calls[0][1];
    expect(record.checkInTime).toBe(pressedAt);
    expect(record.date).toBe(armeniaDate(pressedAt));
    expect(record.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('files a punch queued before midnight under the earlier day', async () => {
    // 2026-09-17 01:00 UTC = 05:00 in Yerevan; the punch happened at
    // 2026-09-16 19:50 UTC = 23:50 on the 16th, local time.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-17T01:00:00Z'));
    const pressedAt = new Date('2026-09-16T19:50:00Z').getTime();
    const { ctx, insert } = makeCtx();

    await handlers.checkIn(ctx, { userId: 'user_1', occurredAt: pressedAt });

    const record = insert.mock.calls[0][1];
    expect(record.date).toBe('2026-09-16');
    expect(record.checkInTime).toBe(pressedAt);
  });

  it('leaves today’s behaviour untouched when no timestamp is given', async () => {
    const { ctx, insert } = makeCtx();
    const before = Date.now();

    await handlers.checkIn(ctx, { userId: 'user_1' });

    const record = insert.mock.calls[0][1];
    expect(record.checkInTime).toBeGreaterThanOrEqual(before);
    expect(record.date).toBe(armeniaDate(record.checkInTime));
  });

  it('rejects a punch dated into the future', async () => {
    const { ctx, insert } = makeCtx();

    await expect(
      handlers.checkIn(ctx, { userId: 'user_1', occurredAt: Date.now() + 60 * 60 * 1000 }),
    ).rejects.toThrow('future');
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a punch older than the replay window', async () => {
    const { ctx, insert } = makeCtx();

    await expect(
      handlers.checkIn(ctx, { userId: 'user_1', occurredAt: Date.now() - 72 * 60 * 60 * 1000 }),
    ).rejects.toThrow('too old');
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric timestamp', async () => {
    const { ctx } = makeCtx();

    await expect(
      handlers.checkIn(ctx, { userId: 'user_1', occurredAt: Number.NaN }),
    ).rejects.toThrow('Invalid attendance timestamp');
  });
});

describe('timeTracking.checkOut — offline punch timestamp', () => {
  it('records the replayed punch time and worked minutes from it', async () => {
    const pressedAt = Date.now() - 5 * 60 * 1000;
    const checkInTime = pressedAt - 8 * 60 * 60 * 1000;
    const { ctx, patch } = makeCtx({
      record: { _id: 'rec_1', checkInTime, status: 'checked_in' },
    });

    await handlers.checkOut(ctx, { userId: 'user_1', occurredAt: pressedAt });

    const update = patch.mock.calls.at(-1)?.[1];
    expect(update.checkOutTime).toBe(pressedAt);
    expect(update.status).toBe('checked_out');
    expect(update.totalWorkedMinutes).toBe(480);
  });

  it('refuses a replay that would run backwards through the shift', async () => {
    const checkInTime = Date.now() - 60 * 60 * 1000;
    const { ctx } = makeCtx({
      record: { _id: 'rec_1', checkInTime, status: 'checked_in' },
    });

    await expect(
      handlers.checkOut(ctx, { userId: 'user_1', occurredAt: checkInTime - 30 * 60 * 1000 }),
    ).rejects.toThrow('earlier than check-in');
  });

  it('ignores a timestamp on a day with no check-in', async () => {
    const { ctx } = makeCtx({ record: null });

    await expect(
      handlers.checkOut(ctx, { userId: 'user_1', occurredAt: Date.now() - 60 * 1000 }),
    ).rejects.toThrow('No check-in record');
  });
});
