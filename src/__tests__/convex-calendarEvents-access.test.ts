/**
 * Tests for the calendar-access control surface in convex/calendarEvents.ts:
 * getMyAccessState, request/respond/revoke, rememberCalendarView and the two
 * viewer/request listings.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  query: ({ handler, args }: any) => ({ handler, args }),
  mutation: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
  internalQuery: ({ handler, args }: any) => ({ handler, args }),
  action: ({ handler, args }: any) => ({ handler, args }),
  internalAction: ({ handler, args }: any) => ({ handler, args }),
}));

jest.mock('../../convex/lib/getAuthCaller', () => ({ getAuthCaller: jest.fn() }));
jest.mock('../../convex/lib/auth', () => ({ isSuperadmin: jest.fn(() => false) }));
jest.mock('../../convex/lib/entitlements', () => ({
  assertModuleAccess: jest.fn(async () => undefined),
}));
jest.mock('../../convex/lib/notify', () => ({ notify: jest.fn(async () => undefined) }));
jest.mock('../../convex/meetingRooms', () => ({
  reserveRoom: jest.fn(),
  cancelRoomBooking: jest.fn(),
}));

const getAuthCaller = jest.requireMock('../../convex/lib/getAuthCaller').getAuthCaller as jest.Mock;
const isSuperadmin = jest.requireMock('../../convex/lib/auth').isSuperadmin as jest.Mock;
const notify = jest.requireMock('../../convex/lib/notify').notify as jest.Mock;

type Handler = (ctx: any, args: any) => Promise<any>;
const handlers: Record<string, Handler> = {};
{
  const mod = require('../../convex/calendarEvents');
  for (const [name, def] of Object.entries(mod)) {
    if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
      handlers[name] = (def as any).handler;
    }
  }
}

const ORG = 'org1';
const CALLER_ID = 'caller1';

function userDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: CALLER_ID,
    name: 'Caller',
    role: 'employee',
    organizationId: ORG,
    ...overrides,
  };
}

function grantDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'g1',
    organizationId: ORG,
    ownerId: 'owner1',
    viewerId: CALLER_ID,
    accessLevel: 'full',
    scope: 'person',
    status: 'approved',
    isActive: true,
    requestedAt: 1,
    grantedAt: 2,
    ...overrides,
  };
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
    const matched = () => rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
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
  jest.clearAllMocks();
  getAuthCaller.mockResolvedValue(userDoc());
  isSuperadmin.mockReturnValue(false);
});

// ── getMyAccessState ─────────────────────────────────────────────────────────

describe('getMyAccessState', () => {
  it('returns "none" for an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.getMyAccessState(ctx, { organizationId: ORG })).resolves.toEqual({
      organization: 'none',
      people: [],
      lastView: { type: 'mine' },
    });
  });

  it('returns "none" for a caller from another organization', async () => {
    getAuthCaller.mockResolvedValue(userDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.organization).toBe('none');
  });

  it('grants implied organization access to an admin', async () => {
    getAuthCaller.mockResolvedValue(userDoc({ role: 'admin' }));
    const { ctx } = makeCtx({ docs: { [ORG]: { _id: ORG } } });
    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.organization).toBe('approved');
  });

  it('grants implied organization access to the org head', async () => {
    const { ctx } = makeCtx({ docs: { [ORG]: { _id: ORG, headUserId: CALLER_ID } } });
    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.organization).toBe('approved');
  });

  it('reports an approved organization grant for a plain member', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: { _id: ORG } },
      tables: { calendarAccess: [grantDoc({ scope: 'organization' })] },
    });
    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.organization).toBe('approved');
  });

  it('reports a pending organization request', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: { _id: ORG } },
      tables: {
        calendarAccess: [grantDoc({ scope: 'organization', status: 'pending', isActive: false })],
      },
    });
    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.organization).toBe('pending');
  });

  it('lists people grants with owner details', async () => {
    const { ctx } = makeCtx({
      docs: {
        [ORG]: { _id: ORG },
        owner1: { _id: 'owner1', name: 'Owner', position: 'Lead', department: 'Eng' },
      },
      tables: { calendarAccess: [grantDoc()] },
    });

    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });

    expect(result.people).toEqual([
      expect.objectContaining({ userId: 'owner1', name: 'Owner', status: 'approved' }),
    ]);
  });

  it('falls back to "Employee" when the owner is missing', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: { _id: ORG } },
      tables: { calendarAccess: [grantDoc()] },
    });
    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.people[0].name).toBe('Employee');
  });

  it('drops expired grants', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: { _id: ORG } },
      tables: { calendarAccess: [grantDoc({ expiresAt: 1 })] },
    });
    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.people).toEqual([]);
  });

  it('returns the stored person view when access is still approved', async () => {
    const { ctx } = makeCtx({
      docs: {
        [ORG]: { _id: ORG },
        owner1: { _id: 'owner1', name: 'Owner' },
      },
      tables: {
        calendarAccess: [grantDoc()],
        userPreferences: [
          {
            _id: 'pref1',
            userId: CALLER_ID,
            key: 'calendar_last_view',
            value: { type: 'person', userId: 'owner1' },
          },
        ],
      },
    });

    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.lastView).toEqual({ type: 'person', userId: 'owner1' });
  });

  it('falls back to "mine" when the stored person lost access', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: { _id: ORG } },
      tables: {
        calendarAccess: [],
        userPreferences: [
          {
            _id: 'pref1',
            userId: CALLER_ID,
            key: 'calendar_last_view',
            value: { type: 'person', userId: 'owner1' },
          },
        ],
      },
    });

    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.lastView).toEqual({ type: 'mine' });
  });

  it('returns the stored organization view when approved', async () => {
    getAuthCaller.mockResolvedValue(userDoc({ role: 'admin' }));
    const { ctx } = makeCtx({
      docs: { [ORG]: { _id: ORG } },
      tables: {
        userPreferences: [
          {
            _id: 'pref1',
            userId: CALLER_ID,
            key: 'calendar_last_view',
            value: { type: 'organization' },
          },
        ],
      },
    });

    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.lastView).toEqual({ type: 'organization' });
  });

  it('ignores a malformed stored view', async () => {
    getAuthCaller.mockResolvedValue(userDoc({ role: 'admin' }));
    const { ctx } = makeCtx({
      docs: { [ORG]: { _id: ORG } },
      tables: {
        userPreferences: [
          { _id: 'pref1', userId: CALLER_ID, key: 'calendar_last_view', value: { type: 'bogus' } },
        ],
      },
    });

    const result = await handlers.getMyAccessState(ctx, { organizationId: ORG });
    expect(result.lastView).toEqual({ type: 'mine' });
  });
});

// ── listPendingCalendarAccessRequests ────────────────────────────────────────

describe('listPendingCalendarAccessRequests', () => {
  it('returns [] without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(
      handlers.listPendingCalendarAccessRequests(ctx, { organizationId: ORG }),
    ).resolves.toEqual([]);
  });

  it('returns the caller-owned pending requests with requester names', async () => {
    const { ctx } = makeCtx({
      docs: { requester1: { _id: 'requester1', name: 'Rita' } },
      tables: {
        calendarAccess: [
          grantDoc({ _id: 'g1', ownerId: CALLER_ID, viewerId: 'requester1', status: 'pending' }),
        ],
      },
    });

    const result = await handlers.listPendingCalendarAccessRequests(ctx, { organizationId: ORG });

    expect(result).toEqual([
      expect.objectContaining({ _id: 'g1', requesterId: 'requester1', requesterName: 'Rita' }),
    ]);
  });

  it('falls back to "Employee" for a missing requester', async () => {
    const { ctx } = makeCtx({
      tables: {
        calendarAccess: [
          grantDoc({ _id: 'g1', ownerId: CALLER_ID, viewerId: 'ghost', status: 'pending' }),
        ],
      },
    });

    const result = await handlers.listPendingCalendarAccessRequests(ctx, { organizationId: ORG });
    expect(result[0].requesterName).toBe('Employee');
  });
});

// ── requestCalendarAccess ────────────────────────────────────────────────────

describe('requestCalendarAccess', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(
      handlers.requestCalendarAccess(ctx, {
        organizationId: ORG,
        scope: 'person',
        targetUserId: 'o',
      }),
    ).rejects.toThrow('Not authenticated');
  });

  it('rejects a cross-organization request', async () => {
    getAuthCaller.mockResolvedValue(userDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    await expect(
      handlers.requestCalendarAccess(ctx, {
        organizationId: ORG,
        scope: 'person',
        targetUserId: 'o',
      }),
    ).rejects.toThrow('different organization');
  });

  it('throws when the organization is missing', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.requestCalendarAccess(ctx, { organizationId: ORG, scope: 'organization' }),
    ).rejects.toThrow('Organization not found');
  });

  it('throws when no approver is configured', async () => {
    const { ctx } = makeCtx({ docs: { [ORG]: { _id: ORG } } });
    await expect(
      handlers.requestCalendarAccess(ctx, { organizationId: ORG, scope: 'person' }),
    ).rejects.toThrow('No approver is configured');
  });

  it('throws when the caller already owns the calendar', async () => {
    const { ctx } = makeCtx({ docs: { [ORG]: { _id: ORG } } });
    await expect(
      handlers.requestCalendarAccess(ctx, {
        organizationId: ORG,
        scope: 'person',
        targetUserId: CALLER_ID,
      }),
    ).rejects.toThrow('already own');
  });

  it('throws when the approver is in another organization', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: { _id: ORG }, owner1: { _id: 'owner1', organizationId: 'other' } },
    });
    await expect(
      handlers.requestCalendarAccess(ctx, {
        organizationId: ORG,
        scope: 'person',
        targetUserId: 'owner1',
      }),
    ).rejects.toThrow('does not belong');
  });

  it('short-circuits when an active grant already exists', async () => {
    const { ctx, patch, insert } = makeCtx({
      docs: { [ORG]: { _id: ORG }, owner1: { _id: 'owner1', organizationId: ORG } },
      tables: { calendarAccess: [grantDoc({ isActive: true })] },
    });

    const result = await handlers.requestCalendarAccess(ctx, {
      organizationId: ORG,
      scope: 'person',
      targetUserId: 'owner1',
    });

    expect(result).toEqual({ status: 'approved' });
    expect(patch).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('re-opens an existing inactive grant', async () => {
    const { ctx, patch, insert } = makeCtx({
      docs: { [ORG]: { _id: ORG }, owner1: { _id: 'owner1', organizationId: ORG } },
      tables: { calendarAccess: [grantDoc({ isActive: false, status: 'rejected' })] },
    });

    const result = await handlers.requestCalendarAccess(ctx, {
      organizationId: ORG,
      scope: 'person',
      targetUserId: 'owner1',
    });

    expect(result).toEqual({ status: 'pending' });
    expect(patch).toHaveBeenCalledWith('g1', expect.objectContaining({ status: 'pending' }));
    expect(notify).toHaveBeenCalled();
  });

  it('inserts a new pending request', async () => {
    const { ctx, insert } = makeCtx({
      docs: { [ORG]: { _id: ORG }, owner1: { _id: 'owner1', organizationId: ORG } },
    });

    const result = await handlers.requestCalendarAccess(ctx, {
      organizationId: ORG,
      scope: 'person',
      targetUserId: 'owner1',
    });

    expect(result).toEqual({ status: 'pending' });
    expect(insert).toHaveBeenCalledWith(
      'calendarAccess',
      expect.objectContaining({ ownerId: 'owner1', viewerId: CALLER_ID, status: 'pending' }),
    );
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'owner1' }),
    );
  });

  it('uses the organization head as the approver for org scope', async () => {
    const { ctx, insert } = makeCtx({
      docs: {
        [ORG]: { _id: ORG, headUserId: 'head1' },
        head1: { _id: 'head1', organizationId: ORG },
      },
    });

    await handlers.requestCalendarAccess(ctx, { organizationId: ORG, scope: 'organization' });

    expect(insert).toHaveBeenCalledWith(
      'calendarAccess',
      expect.objectContaining({ ownerId: 'head1', scope: 'organization' }),
    );
  });
});

// ── respondToCalendarAccess ──────────────────────────────────────────────────

describe('respondToCalendarAccess', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(
      handlers.respondToCalendarAccess(ctx, { accessId: 'g1', approved: true }),
    ).rejects.toThrow('Not authenticated');
  });

  it('throws when the request is missing', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.respondToCalendarAccess(ctx, { accessId: 'missing', approved: true }),
    ).rejects.toThrow('Access request not found');
  });

  it('throws when the request is not pending', async () => {
    const { ctx } = makeCtx({
      docs: { g1: grantDoc({ status: 'approved', ownerId: CALLER_ID }) },
    });
    await expect(
      handlers.respondToCalendarAccess(ctx, { accessId: 'g1', approved: true }),
    ).rejects.toThrow('not found');
  });

  it('throws when the caller is not the owner', async () => {
    const { ctx } = makeCtx({
      docs: { g1: grantDoc({ status: 'pending', ownerId: 'someone-else' }) },
    });
    await expect(
      handlers.respondToCalendarAccess(ctx, { accessId: 'g1', approved: true }),
    ).rejects.toThrow('owner can respond');
  });

  it('approves a request and notifies the viewer', async () => {
    const { ctx, patch } = makeCtx({
      docs: { g1: grantDoc({ status: 'pending', ownerId: CALLER_ID }) },
    });

    const result = await handlers.respondToCalendarAccess(ctx, { accessId: 'g1', approved: true });

    expect(result).toEqual({ success: true });
    expect(patch).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ status: 'approved', isActive: true }),
    );
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ messageKey: 'notifications.messages.calendarAccessGranted' }),
    );
  });

  it('rejects a request and notifies the viewer', async () => {
    const { ctx, patch } = makeCtx({
      docs: { g1: grantDoc({ status: 'pending', ownerId: CALLER_ID }) },
    });

    const result = await handlers.respondToCalendarAccess(ctx, { accessId: 'g1', approved: false });

    expect(result).toEqual({ success: true });
    expect(patch).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ status: 'rejected', isActive: false }),
    );
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ messageKey: 'notifications.messages.calendarAccessRejected' }),
    );
  });
});

// ── rememberCalendarView ─────────────────────────────────────────────────────

describe('rememberCalendarView', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(
      handlers.rememberCalendarView(ctx, { organizationId: ORG, view: 'mine' }),
    ).rejects.toThrow('Not authenticated');
  });

  it('rejects a cross-organization write', async () => {
    getAuthCaller.mockResolvedValue(userDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    await expect(
      handlers.rememberCalendarView(ctx, { organizationId: ORG, view: 'mine' }),
    ).rejects.toThrow('different organization');
  });

  it('inserts a preference for the "mine" view', async () => {
    const { ctx, insert } = makeCtx();
    await handlers.rememberCalendarView(ctx, { organizationId: ORG, view: 'mine' });
    expect(insert).toHaveBeenCalledWith(
      'userPreferences',
      expect.objectContaining({ key: 'calendar_last_view', value: { type: 'mine' } }),
    );
  });

  it('updates an existing preference row', async () => {
    const { ctx, patch } = makeCtx({
      tables: {
        userPreferences: [{ _id: 'pref1', userId: CALLER_ID, key: 'calendar_last_view' }],
      },
    });
    await handlers.rememberCalendarView(ctx, { organizationId: ORG, view: 'mine' });
    expect(patch).toHaveBeenCalledWith(
      'pref1',
      expect.objectContaining({ value: { type: 'mine' } }),
    );
  });

  it('throws when remembering a person without a usable grant', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.rememberCalendarView(ctx, {
        organizationId: ORG,
        view: 'person',
        targetUserId: 'owner1',
      }),
    ).rejects.toThrow('No access to this calendar');
  });

  it('records a person view and stamps the grant', async () => {
    const { ctx, patch } = makeCtx({
      tables: { calendarAccess: [grantDoc()] },
    });

    await handlers.rememberCalendarView(ctx, {
      organizationId: ORG,
      view: 'person',
      targetUserId: 'owner1',
    });

    expect(patch).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ lastViewedAt: expect.any(Number) }),
    );
    expect(ctx.db.insert).toHaveBeenCalledWith(
      'userPreferences',
      expect.objectContaining({ value: { type: 'person', userId: 'owner1' } }),
    );
  });

  it('records an organization view for an implied viewer', async () => {
    const { ctx, insert } = makeCtx({ docs: { [ORG]: { _id: ORG, headUserId: CALLER_ID } } });
    await handlers.rememberCalendarView(ctx, { organizationId: ORG, view: 'organization' });
    expect(insert).toHaveBeenCalledWith(
      'userPreferences',
      expect.objectContaining({ value: { type: 'organization' } }),
    );
  });

  it('throws when a plain member has no organization grant', async () => {
    const { ctx } = makeCtx({ docs: { [ORG]: { _id: ORG } } });
    await expect(
      handlers.rememberCalendarView(ctx, { organizationId: ORG, view: 'organization' }),
    ).rejects.toThrow('organization calendar');
  });

  it('records an organization view when a usable grant exists', async () => {
    const { ctx, patch } = makeCtx({
      docs: { [ORG]: { _id: ORG } },
      tables: { calendarAccess: [grantDoc({ scope: 'organization' })] },
    });

    await handlers.rememberCalendarView(ctx, { organizationId: ORG, view: 'organization' });

    expect(patch).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ lastViewedAt: expect.any(Number) }),
    );
  });
});

// ── listMyCalendarViewers ────────────────────────────────────────────────────

describe('listMyCalendarViewers', () => {
  it('returns [] without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.listMyCalendarViewers(ctx, { organizationId: ORG })).resolves.toEqual([]);
  });

  it('lists usable grants on the caller-owned calendar, newest first', async () => {
    const { ctx } = makeCtx({
      docs: {
        v1: { _id: 'v1', name: 'V One', position: 'Dev' },
        v2: { _id: 'v2', name: 'V Two' },
      },
      tables: {
        calendarAccess: [
          grantDoc({ _id: 'g1', ownerId: CALLER_ID, viewerId: 'v1', grantedAt: 10 }),
          grantDoc({ _id: 'g2', ownerId: CALLER_ID, viewerId: 'v2', grantedAt: 20 }),
        ],
      },
    });

    const result = await handlers.listMyCalendarViewers(ctx, { organizationId: ORG });

    expect(result.map((v: any) => v._id)).toEqual(['g2', 'g1']);
    expect(result[1]).toMatchObject({ viewerName: 'V One', viewerPosition: 'Dev' });
  });

  it('drops grants that are not usable', async () => {
    const { ctx } = makeCtx({
      tables: { calendarAccess: [grantDoc({ ownerId: CALLER_ID, isActive: false })] },
    });
    const result = await handlers.listMyCalendarViewers(ctx, { organizationId: ORG });
    expect(result).toEqual([]);
  });
});

// ── revokeCalendarAccess ─────────────────────────────────────────────────────

describe('revokeCalendarAccess', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.revokeCalendarAccess(ctx, { accessId: 'g1' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('is a no-op for a missing grant', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.revokeCalendarAccess(ctx, { accessId: 'missing' })).resolves.toEqual({
      success: true,
    });
  });

  it('throws when the caller is not the owner', async () => {
    const { ctx } = makeCtx({ docs: { g1: grantDoc({ ownerId: 'someone-else' }) } });
    await expect(handlers.revokeCalendarAccess(ctx, { accessId: 'g1' })).rejects.toThrow(
      'owner can revoke',
    );
  });

  it('revokes the grant and notifies the viewer', async () => {
    const { ctx, patch } = makeCtx({ docs: { g1: grantDoc({ ownerId: CALLER_ID }) } });

    const result = await handlers.revokeCalendarAccess(ctx, { accessId: 'g1' });

    expect(result).toEqual({ success: true });
    expect(patch).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ isActive: false, status: 'rejected' }),
    );
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ messageKey: 'notifications.messages.calendarAccessRevoked' }),
    );
  });
});
