/**
 * Coverage for convex/timeTracking.ts — check in/out, attendance reads and
 * admin overviews.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  query: ({ handler, args }: any) => ({ handler, args }),
  mutation: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
  internalQuery: ({ handler, args }: any) => ({ handler, args }),
}));

jest.mock('../../convex/lib/getAuthCaller', () => ({ getAuthCaller: jest.fn() }));
jest.mock('../../convex/lib/auth', () => ({ isSuperadmin: jest.fn(() => false) }));
jest.mock('../../convex/lib/userProfile', () => ({ getProfile: jest.fn(async () => null) }));
jest.mock('../../convex/lib/points', () => ({
  creditBalance: jest.fn(async () => undefined),
  resolveRecognitionSettings: jest.fn(async () => ({ attendanceReward: 0 })),
}));
jest.mock('../../convex/lib/capabilities', () => ({
  hasCapability: jest.fn(() => true),
  hasOrgWideReach: jest.fn(() => true),
}));
jest.mock('../../convex/lib/entitlements', () => ({
  assertModuleAccess: jest.fn(async () => undefined),
}));
jest.mock('../../convex/lib/reportingLine', () => ({
  isAncestorOf: jest.fn(async () => true),
  getSubordinateIds: jest.fn(async () => []),
}));
jest.mock('../../convex/lib/rbac', () => ({ canAccessUser: jest.fn(async () => true) }));
jest.mock('../../convex/lib/systemAccounts', () => ({
  isSystemAccountEmail: jest.fn(() => false),
}));

const getAuthCaller = jest.requireMock('../../convex/lib/getAuthCaller').getAuthCaller as jest.Mock;
const isSuperadmin = jest.requireMock('../../convex/lib/auth').isSuperadmin as jest.Mock;
const capabilities = jest.requireMock('../../convex/lib/capabilities') as Record<string, jest.Mock>;
const reportingLine = jest.requireMock('../../convex/lib/reportingLine') as Record<
  string,
  jest.Mock
>;
const rbac = jest.requireMock('../../convex/lib/rbac') as Record<string, jest.Mock>;
const points = jest.requireMock('../../convex/lib/points') as Record<string, jest.Mock>;
const systemAccounts = jest.requireMock('../../convex/lib/systemAccounts') as Record<
  string,
  jest.Mock
>;

type Handler = (ctx: any, args: any) => Promise<any>;
const handlers: Record<string, Handler> = {};
{
  const mod = require('../../convex/timeTracking');
  for (const [name, def] of Object.entries(mod)) {
    if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
      handlers[name] = (def as any).handler;
    }
  }
}

const ORG = 'org1';
const CALLER_ID = 'caller1';
const OTHER_ID = 'other1';

const NOW = new Date('2026-03-15T10:00:00Z');
const TODAY = '2026-03-15';

function callerDoc(overrides: Record<string, unknown> = {}) {
  return { _id: CALLER_ID, name: 'Caller', role: 'employee', organizationId: ORG, ...overrides };
}

function makeCtx(opts: { docs?: Record<string, unknown>; tables?: Record<string, any[]> } = {}) {
  const docs = opts.docs ?? {};
  const tables = opts.tables ?? {};
  const inserts: Array<[string, any]> = [];
  const patches: Array<[string, any]> = [];
  const get = jest.fn(async (id: string) => docs[id] ?? null);
  const insert = jest.fn(async (table: string, doc: any) => {
    inserts.push([table, doc]);
    return `${table}_new`;
  });
  const patch = jest.fn(async (id: string, fields: any) => {
    patches.push([id, fields]);
  });

  const query = jest.fn((table: string) => {
    const rows = tables[table] ?? [];
    const filters: Record<string, unknown> = {};
    const makeQ = (): any =>
      new Proxy(
        {},
        {
          get: (_t, prop) => {
            if (prop === 'field') return (name: string) => name;
            if (prop === 'eq') {
              return (k: string, v: unknown) => {
                filters[k] = v;
                return makeQ();
              };
            }
            return (...args: unknown[]) => {
              void args;
              return makeQ();
            };
          },
        },
      );
    const matched = () =>
      rows.filter((r) =>
        Object.entries(filters).every(([k, v]) => {
          if (k === 'createdAt') return true;
          return r[k] === v;
        }),
      );
    const chain: any = {
      withIndex: (_n: string, cb?: (q: unknown) => unknown) => {
        if (cb) cb(makeQ());
        return chain;
      },
      filter: (cb?: (q: unknown) => unknown) => {
        if (cb) cb(makeQ());
        return chain;
      },
      order: () => chain,
      take: jest.fn(async (n: number) => matched().slice(0, n)),
      collect: jest.fn(async () => matched()),
      first: jest.fn(async () => matched()[0] ?? null),
      unique: jest.fn(async () => matched()[0] ?? null),
    };
    return chain;
  });

  return {
    ctx: { db: { get, insert, patch, query } },
    get,
    insert,
    patch,
    query,
    inserts,
    patches,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  jest.clearAllMocks();
  getAuthCaller.mockResolvedValue(callerDoc());
  isSuperadmin.mockReturnValue(false);
  capabilities.hasCapability.mockReturnValue(true);
  capabilities.hasOrgWideReach.mockReturnValue(true);
  reportingLine.isAncestorOf.mockResolvedValue(true);
  reportingLine.getSubordinateIds.mockResolvedValue([]);
  rbac.canAccessUser.mockResolvedValue(true);
  points.resolveRecognitionSettings.mockResolvedValue({ attendanceReward: 0 });
  systemAccounts.isSystemAccountEmail.mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('checkIn', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.checkIn(ctx, {})).rejects.toThrow('Not authenticated');
  });

  it('creates a new record, late and with the schedule timestamps', async () => {
    const { ctx, insert } = makeCtx({
      docs: { [CALLER_ID]: callerDoc() },
    });

    const id = await handlers.checkIn(ctx, {});

    expect(id).toBe('timeTracking_new');
    expect(insert).toHaveBeenCalledWith(
      'timeTracking',
      expect.objectContaining({
        userId: CALLER_ID,
        date: TODAY,
        isLate: true,
        status: 'checked_in',
      }),
    );
  });

  it('patches an existing non-checked-in record', async () => {
    const { ctx, patch } = makeCtx({
      docs: { [CALLER_ID]: callerDoc() },
      tables: { timeTracking: [{ _id: 'tt1', userId: CALLER_ID, date: TODAY, status: 'absent' }] },
    });

    const id = await handlers.checkIn(ctx, {});

    expect(id).toBe('tt1');
    expect(patch).toHaveBeenCalledWith('tt1', expect.objectContaining({ status: 'checked_in' }));
  });

  it('refuses a double check-in', async () => {
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc() },
      tables: {
        timeTracking: [{ _id: 'tt1', userId: CALLER_ID, date: TODAY, status: 'checked_in' }],
      },
    });

    await expect(handlers.checkIn(ctx, {})).rejects.toThrow('Already checked in');
  });

  it('uses a custom work schedule when present', async () => {
    const { ctx, insert } = makeCtx({
      docs: { [CALLER_ID]: callerDoc() },
      tables: {
        workSchedule: [{ _id: 'ws', userId: CALLER_ID, startTime: '08:00', endTime: '17:00' }],
      },
    });

    await handlers.checkIn(ctx, {});

    const inserted = insert.mock.calls[0][1] as any;
    expect(inserted.scheduledStartTime).toBe(Date.UTC(2026, 2, 15) - 4 * 3600_000 + 8 * 3600_000);
  });

  it('credits attendance points once per day', async () => {
    points.resolveRecognitionSettings.mockResolvedValue({ attendanceReward: 10 });
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc() },
    });

    await handlers.checkIn(ctx, {});

    expect(points.creditBalance).toHaveBeenCalled();
  });

  it('does not double-credit when points already exist today', async () => {
    points.resolveRecognitionSettings.mockResolvedValue({ attendanceReward: 10 });
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc() },
      tables: {
        pointTransactions: [
          { _id: 'pt1', organizationId: ORG, userId: CALLER_ID, type: 'earned_attendance' },
        ],
      },
    });

    await handlers.checkIn(ctx, {});
    expect(points.creditBalance).not.toHaveBeenCalled();
  });

  it('records for another user with attendance.manage', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'admin' }));
    const { ctx, insert } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc({ role: 'admin' }),
        [OTHER_ID]: callerDoc({ _id: OTHER_ID, name: 'Other' }),
      },
    });

    await handlers.checkIn(ctx, { userId: OTHER_ID });
    expect(insert).toHaveBeenCalledWith(
      'timeTracking',
      expect.objectContaining({ userId: OTHER_ID }),
    );
  });

  it('rejects a cross-organization correction', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'admin' }));
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc({ role: 'admin' }),
        [OTHER_ID]: callerDoc({ _id: OTHER_ID, organizationId: 'other' }),
      },
    });

    await expect(handlers.checkIn(ctx, { userId: OTHER_ID })).rejects.toThrow('cross-organization');
  });

  it('rejects a user who lacks attendance.manage', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'employee' }));
    capabilities.hasCapability.mockReturnValue(false);
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), [OTHER_ID]: callerDoc({ _id: OTHER_ID }) },
    });

    await expect(handlers.checkIn(ctx, { userId: OTHER_ID })).rejects.toThrow(
      'your own attendance',
    );
  });

  it('rejects a manager outside the reporting line', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'supervisor' }));
    capabilities.hasOrgWideReach.mockReturnValue(false);
    reportingLine.isAncestorOf.mockResolvedValue(false);
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc({ role: 'supervisor' }),
        [OTHER_ID]: callerDoc({ _id: OTHER_ID }),
      },
    });

    await expect(handlers.checkIn(ctx, { userId: OTHER_ID })).rejects.toThrow('reporting line');
  });

  it('rejects a missing target user', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'admin' }));
    const { ctx } = makeCtx({ docs: { [CALLER_ID]: callerDoc({ role: 'admin' }) } });
    await expect(handlers.checkIn(ctx, { userId: OTHER_ID })).rejects.toThrow('User not found');
  });
});

describe('checkOut', () => {
  function checkoutCtx(extra: Record<string, unknown> = {}, tables: Record<string, any[]> = {}) {
    return makeCtx({
      docs: { [CALLER_ID]: callerDoc(), ...extra },
      tables: {
        timeTracking: [
          {
            _id: 'tt1',
            userId: CALLER_ID,
            date: TODAY,
            checkInTime: NOW.getTime() - 8 * 3600_000,
            status: 'checked_in',
          },
        ],
        ...tables,
      },
    });
  }

  it('throws without a check-in record', async () => {
    const { ctx } = makeCtx({ docs: { [CALLER_ID]: callerDoc() } });
    await expect(handlers.checkOut(ctx, {})).rejects.toThrow('No check-in record');
  });

  it('throws when already checked out', async () => {
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc() },
      tables: {
        timeTracking: [{ _id: 'tt1', userId: CALLER_ID, date: TODAY, status: 'checked_out' }],
      },
    });
    await expect(handlers.checkOut(ctx, {})).rejects.toThrow('Already checked out');
  });

  it('closes the day and computes worked minutes', async () => {
    const { ctx, patch } = checkoutCtx();
    await handlers.checkOut(ctx, { notes: 'done' });
    expect(patch).toHaveBeenCalledWith(
      'tt1',
      expect.objectContaining({ status: 'checked_out', totalWorkedMinutes: 480, notes: 'done' }),
    );
  });

  it('flags an early leave', async () => {
    const { ctx, patch } = checkoutCtx(
      {},
      {
        workSchedule: [{ _id: 'ws', userId: CALLER_ID, startTime: '09:00', endTime: '20:00' }],
      },
    );
    await handlers.checkOut(ctx, {});
    expect(patch).toHaveBeenCalledWith(
      'tt1',
      expect.objectContaining({ isEarlyLeave: true, earlyLeaveMinutes: expect.any(Number) }),
    );
  });

  it('links an approved overtime request', async () => {
    const { ctx, patch } = checkoutCtx(
      {},
      {
        overtimeRequests: [
          { _id: 'ot1', userId: CALLER_ID, date: TODAY, status: 'approved', endTime: '22:00' },
        ],
      },
    );
    await handlers.checkOut(ctx, {});
    expect(patch).toHaveBeenCalledWith('ot1', { approvedTimeTrackingId: 'tt1' });
  });

  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.checkOut(ctx, {})).rejects.toThrow('Not authenticated');
  });
});

describe('attendance reads', () => {
  it('getTodayStatus returns null when not readable', async () => {
    rbac.canAccessUser.mockResolvedValue(false);
    const { ctx } = makeCtx();
    await expect(handlers.getTodayStatus(ctx, { userId: 'u1' })).resolves.toBeNull();
  });

  it('getTodayStatus returns the record', async () => {
    const { ctx } = makeCtx({
      tables: {
        timeTracking: [{ _id: 'tt1', userId: CALLER_ID, date: TODAY, status: 'checked_in' }],
      },
    });
    const result = await handlers.getTodayStatus(ctx, { userId: CALLER_ID });
    expect(result).toMatchObject({ _id: 'tt1' });
  });

  it('getUserHistory returns [] when not readable', async () => {
    rbac.canAccessUser.mockResolvedValue(false);
    const { ctx } = makeCtx();
    await expect(handlers.getUserHistory(ctx, { userId: 'u1' })).resolves.toEqual([]);
  });

  it('getUserHistory returns records', async () => {
    const { ctx } = makeCtx({ tables: { timeTracking: [{ _id: 'tt1', userId: CALLER_ID }] } });
    const result = await handlers.getUserHistory(ctx, { userId: CALLER_ID, limit: 5 });
    expect(result).toHaveLength(1);
  });

  it('getRecentAttendance respects the default limit', async () => {
    const { ctx } = makeCtx({ tables: { timeTracking: [{ _id: 'tt1', userId: CALLER_ID }] } });
    const result = await handlers.getRecentAttendance(ctx, { userId: CALLER_ID });
    expect(result).toHaveLength(1);
  });

  it('getRecentAttendance returns [] when not readable', async () => {
    rbac.canAccessUser.mockResolvedValue(false);
    const { ctx } = makeCtx();
    await expect(handlers.getRecentAttendance(ctx, { userId: 'u1' })).resolves.toEqual([]);
  });
});

describe('getCurrentlyAtWork', () => {
  it('returns [] without a scope', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'employee' }));
    const { ctx } = makeCtx();
    await expect(handlers.getCurrentlyAtWork(ctx, { adminId: CALLER_ID })).resolves.toEqual([]);
  });

  it('returns checked-in users', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'admin' }));
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc() },
      tables: {
        timeTracking: [
          { _id: 'tt1', userId: CALLER_ID, date: TODAY, status: 'checked_in' },
          { _id: 'tt2', userId: 'e2', date: TODAY, status: 'checked_out' },
        ],
      },
    });

    const result = await handlers.getCurrentlyAtWork(ctx, { adminId: CALLER_ID });
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('tt1');
  });

  it('skips superadmins and cross-org users', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'admin' }));
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc(),
        sa: callerDoc({ _id: 'sa', role: 'superadmin' }),
        xo: callerDoc({ _id: 'xo', organizationId: 'other' }),
      },
      tables: {
        timeTracking: [
          { _id: 'tt1', userId: CALLER_ID, date: TODAY, status: 'checked_in' },
          { _id: 'tt2', userId: 'sa', date: TODAY, status: 'checked_in' },
          { _id: 'tt3', userId: 'xo', date: TODAY, status: 'checked_in' },
        ],
      },
    });

    const result = await handlers.getCurrentlyAtWork(ctx, { adminId: CALLER_ID });
    expect(result.map((r: any) => r._id)).toEqual(['tt1']);
  });

  it('limits a supervisor to their subtree', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'supervisor' }));
    reportingLine.getSubordinateIds.mockResolvedValue([CALLER_ID]);
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc({ role: 'supervisor' }),
        e2: callerDoc({ _id: 'e2' }),
      },
      tables: {
        timeTracking: [
          { _id: 'tt1', userId: CALLER_ID, date: TODAY, status: 'checked_in' },
          { _id: 'tt2', userId: 'e2', date: TODAY, status: 'checked_in' },
        ],
      },
    });

    const result = await handlers.getCurrentlyAtWork(ctx, { adminId: CALLER_ID });
    expect(result.map((r: any) => r._id)).toEqual(['tt1']);
  });
});

describe('getTodayAllAttendance', () => {
  it('returns [] without a scope', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'employee' }));
    const { ctx } = makeCtx();
    await expect(handlers.getTodayAllAttendance(ctx, { adminId: CALLER_ID })).resolves.toEqual([]);
  });

  it('sorts checked-in before checked-out', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'admin' }));
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), e2: callerDoc({ _id: 'e2' }) },
      tables: {
        timeTracking: [
          { _id: 'out', userId: 'e2', date: TODAY, status: 'checked_out' },
          { _id: 'in', userId: CALLER_ID, date: TODAY, status: 'checked_in' },
        ],
      },
    });

    const result = await handlers.getTodayAllAttendance(ctx, { adminId: CALLER_ID });
    expect(result.map((r: any) => r._id)).toEqual(['in', 'out']);
  });
});

describe('getTodayAttendanceSummary', () => {
  it('returns zeroes without a scope', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'employee' }));
    const { ctx } = makeCtx();
    const result = await handlers.getTodayAttendanceSummary(ctx, { adminId: CALLER_ID });
    expect(result).toMatchObject({ totalActive: 0, attendanceRate: '0' });
  });

  it('counts active employees and attendance', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'admin' }));
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc() },
      tables: {
        users: [
          callerDoc({ isActive: true }),
          callerDoc({ _id: 'e2', email: 'e2@x.com', isActive: true }),
          callerDoc({ _id: 'sa', role: 'superadmin', isActive: true }),
          callerDoc({ _id: 'bot', email: 'bot@system.local', isActive: true }),
        ],
        timeTracking: [
          { _id: 'tt1', userId: CALLER_ID, date: TODAY, status: 'checked_in', isLate: true },
          { _id: 'tt2', userId: 'e2', date: TODAY, status: 'checked_out', isEarlyLeave: true },
        ],
      },
    });
    systemAccounts.isSystemAccountEmail.mockImplementation((e: string) => e === 'bot@system.local');

    const result = await handlers.getTodayAttendanceSummary(ctx, { adminId: CALLER_ID });

    expect(result).toMatchObject({
      totalActive: 2,
      checkedIn: 1,
      checkedOut: 1,
      late: 1,
      earlyLeave: 1,
      absent: 0,
      attendanceRate: '100.0',
    });
  });
});

describe('getMonthlyStats', () => {
  it('returns zeroed stats when not readable', async () => {
    rbac.canAccessUser.mockResolvedValue(false);
    const { ctx } = makeCtx();
    const result = await handlers.getMonthlyStats(ctx, { userId: 'u1', month: '2026-03' });
    expect(result).toMatchObject({ totalDays: 0, punctualityRate: '100' });
  });

  it('aggregates the month', async () => {
    const { ctx } = makeCtx({
      tables: {
        timeTracking: [
          {
            _id: 'a',
            userId: CALLER_ID,
            date: '2026-03-01',
            isLate: true,
            totalWorkedMinutes: 480,
            overtimeMinutes: 60,
          },
          {
            _id: 'b',
            userId: CALLER_ID,
            date: '2026-03-02',
            isEarlyLeave: true,
            totalWorkedMinutes: 420,
          },
          { _id: 'c', userId: CALLER_ID, date: '2026-02-10', totalWorkedMinutes: 100 },
        ],
      },
    });

    const result = await handlers.getMonthlyStats(ctx, { userId: CALLER_ID, month: '2026-03' });

    expect(result).toMatchObject({
      totalDays: 2,
      lateDays: 1,
      earlyLeaveDays: 1,
      totalWorkedHours: '15.0',
      totalOvertimeHours: '1.0',
    });
  });

  it('handles an empty month', async () => {
    const { ctx } = makeCtx();
    const result = await handlers.getMonthlyStats(ctx, { userId: CALLER_ID, month: '2026-03' });
    expect(result).toMatchObject({ totalDays: 0, averageWorkHours: '0' });
  });
});

describe('getAllEmployeesAttendanceOverview', () => {
  it('returns [] without a scope', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'employee' }));
    const { ctx } = makeCtx();
    await expect(
      handlers.getAllEmployeesAttendanceOverview(ctx, { adminId: CALLER_ID, month: '2026-03' }),
    ).resolves.toEqual([]);
  });

  it('summarizes employees for the month', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'admin' }));
    const { ctx } = makeCtx({
      docs: { sup1: { _id: 'sup1', name: 'Sup' } },
      tables: {
        users: [
          callerDoc({ role: 'employee', isActive: true }),
          callerDoc({ _id: 'e2', role: 'admin', email: 'a@x.com', isActive: true }),
        ],
        timeTracking: [
          {
            _id: 'tt1',
            userId: CALLER_ID,
            date: '2026-03-01',
            checkInTime: 5,
            isLate: true,
            totalWorkedMinutes: 480,
          },
          { _id: 'tt2', userId: CALLER_ID, date: '2026-03-02', checkInTime: 6, status: 'absent' },
        ],
      },
    });

    const result = await handlers.getAllEmployeesAttendanceOverview(ctx, {
      adminId: CALLER_ID,
      month: '2026-03',
    });

    expect(result).toHaveLength(1);
    expect(result[0].stats).toMatchObject({ totalDays: 2, lateDays: 1, absentDays: 1 });
    expect(result[0].lastRecord._id).toBe('tt2');
  });
});

describe('getEmployeeAttendanceHistory', () => {
  it('returns [] when not readable', async () => {
    rbac.canAccessUser.mockResolvedValue(false);
    const { ctx } = makeCtx();
    await expect(
      handlers.getEmployeeAttendanceHistory(ctx, { userId: 'u1', month: '2026-03' }),
    ).resolves.toEqual([]);
  });

  it('filters and sorts history', async () => {
    const { ctx } = makeCtx({
      tables: {
        timeTracking: [
          { _id: 'a', userId: CALLER_ID, date: '2026-03-01' },
          { _id: 'b', userId: CALLER_ID, date: '2026-03-05' },
          { _id: 'c', userId: CALLER_ID, date: '2026-02-01' },
        ],
      },
    });

    const result = await handlers.getEmployeeAttendanceHistory(ctx, {
      userId: CALLER_ID,
      month: '2026-03',
    });
    expect(result.map((r: any) => r._id)).toEqual(['b', 'a']);
  });
});

describe('markAbsent', () => {
  it('refuses recording for yourself', async () => {
    const { ctx } = makeCtx({ docs: { [CALLER_ID]: callerDoc() } });
    await expect(
      handlers.markAbsent(ctx, { userId: CALLER_ID, date: '2026-03-01' }),
    ).rejects.toThrow('cannot record this for yourself');
  });

  it('refuses a duplicate record', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'admin' }));
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc({ role: 'admin' }), [OTHER_ID]: callerDoc({ _id: OTHER_ID }) },
      tables: { timeTracking: [{ _id: 'tt1', userId: OTHER_ID, date: '2026-03-01' }] },
    });

    await expect(
      handlers.markAbsent(ctx, { userId: OTHER_ID, date: '2026-03-01' }),
    ).rejects.toThrow('already exists');
  });

  it('creates an absent record', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'admin' }));
    const { ctx, insert } = makeCtx({
      docs: { [CALLER_ID]: callerDoc({ role: 'admin' }), [OTHER_ID]: callerDoc({ _id: OTHER_ID }) },
    });

    const id = await handlers.markAbsent(ctx, {
      userId: OTHER_ID,
      date: '2026-03-01',
      notes: 'sick',
    });

    expect(id).toBe('timeTracking_new');
    expect(insert).toHaveBeenCalledWith(
      'timeTracking',
      expect.objectContaining({ userId: OTHER_ID, status: 'absent', notes: 'sick' }),
    );
  });

  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(
      handlers.markAbsent(ctx, { userId: OTHER_ID, date: '2026-03-01' }),
    ).rejects.toThrow('Not authenticated');
  });
});
