/**
 * Deep coverage for convex/users/mutations.ts — the create/update/delete
 * handlers and their department/position, travel-allowance, probation and
 * presence branches.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  mutation: ({ handler, args }: any) => ({ handler, args }),
  query: ({ handler, args }: any) => ({ handler, args }),
}));

jest.mock('../../convex/lib/getAuthCaller', () => ({ getAuthCaller: jest.fn() }));
jest.mock('../../convex/lib/auth', () => ({
  isSuperadmin: jest.fn(() => false),
  SUPERADMIN_EMAIL: 'boss@example.com',
}));
jest.mock('../../convex/lib/notify', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../convex/lib/userProfile', () => ({
  patchProfile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../convex/lib/travelAllowance', () => ({
  resolveTravelAllowanceForUser: jest.fn().mockResolvedValue(0),
  validateTravelAllowanceOverride: jest.fn(),
}));
jest.mock('../../convex/lib/rbac', () => ({
  requireRole: jest.fn().mockResolvedValue(undefined),
  requireOrgAdmin: jest.fn().mockResolvedValue(undefined),
  requireUser: jest.fn(),
}));
jest.mock('../../convex/lib/reportingLine', () => ({
  assertAssignable: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../convex/lib/leaveBalances', () => ({
  getStartingLeaveBalances: jest.fn().mockResolvedValue({ paid: 0, sick: 0, family: 0 }),
}));
jest.mock('../../convex/lib/orgUnits', () => ({
  resolveDepartmentByName: jest.fn().mockResolvedValue({}),
  resolvePositionByTitle: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../convex/lib/entitlements', () => ({
  getOrgEntitlements: jest.fn().mockResolvedValue({ source: 'defaults' }),
}));
jest.mock('../../convex/settings', () => ({
  getOrCreateSettings: jest.fn().mockResolvedValue({ _id: 'settings-1' }),
}));

const rbac = jest.requireMock('../../convex/lib/rbac') as Record<string, jest.Mock>;
const auth = jest.requireMock('../../convex/lib/auth') as Record<string, jest.Mock>;
const travel = jest.requireMock('../../convex/lib/travelAllowance') as Record<string, jest.Mock>;
const orgUnits = jest.requireMock('../../convex/lib/orgUnits') as Record<string, jest.Mock>;
const entitlements = jest.requireMock('../../convex/lib/entitlements') as Record<string, jest.Mock>;
const settingsMod = jest.requireMock('../../convex/settings') as Record<string, jest.Mock>;
const getAuthCaller = jest.requireMock('../../convex/lib/getAuthCaller').getAuthCaller as jest.Mock;

type Handler = (ctx: any, args: any) => Promise<unknown>;
const handlers: Record<string, Handler> = {};

// Required once: `jest.isolateModules` would give the SUT a fresh copy of each
// mocked dependency, so a `requireMock` from this file would observe a *different*
// `patchProfile` mock than the one the handler calls.
{
  const mod = require('../../convex/users/mutations');
  for (const [name, def] of Object.entries(mod)) {
    if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
      handlers[name] = (def as any).handler;
    }
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  rbac.requireUser.mockResolvedValue(adminDoc());
  rbac.requireOrgAdmin.mockResolvedValue(undefined);
  rbac.requireRole.mockResolvedValue(undefined);
  auth.isSuperadmin.mockReturnValue(false);
  travel.resolveTravelAllowanceForUser.mockResolvedValue(0);
  travel.validateTravelAllowanceOverride.mockReturnValue(undefined);
  entitlements.getOrgEntitlements.mockResolvedValue({ source: 'defaults' });
  orgUnits.resolveDepartmentByName.mockResolvedValue({});
  orgUnits.resolvePositionByTitle.mockResolvedValue({});
  settingsMod.getOrCreateSettings.mockResolvedValue({ _id: 'settings-1' });
});

const ORG = 'org1';
const ADMIN_ID = 'admin1';
const USER_ID = 'user1';

function userDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: USER_ID,
    name: 'Anna',
    email: 'anna@example.com',
    role: 'employee',
    organizationId: ORG,
    isActive: true,
    isApproved: true,
    supervisorId: ADMIN_ID,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function adminDoc(overrides: Record<string, unknown> = {}) {
  return userDoc({
    _id: ADMIN_ID,
    name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
    ...overrides,
  });
}

type CtxOptions = {
  docs?: Record<string, unknown>;
  indexResults?: Record<string, Record<string, unknown>>;
  insertId?: string;
};

function makeCtx(opts: CtxOptions = {}) {
  const docs = opts.docs ?? {};
  const indexResults = opts.indexResults ?? {};
  const get = jest.fn(async (id: string) => docs[id] ?? null);
  const insert = jest.fn(async () => opts.insertId ?? 'new_id');
  const patch = jest.fn(async () => undefined);
  const remove = jest.fn(async () => undefined);
  const scheduler = { runAfter: jest.fn(async () => undefined) };

  // A chainable stand-in for Convex's `q`, so index/filter callbacks actually
  // execute (their bodies are part of the coverage denominator).
  const qbuilder: any = new Proxy(
    {},
    {
      get: () => () => qbuilder,
    },
  );

  const withIndex = jest.fn((name: string, cb?: (q: unknown) => unknown) => {
    if (typeof cb === 'function') cb(qbuilder);
    const res = indexResults[name] ?? {};
    const chain: any = {
      unique: jest.fn(async () => res.unique ?? null),
      first: jest.fn(async () => res.first ?? null),
      take: jest.fn(async () => res.take ?? []),
      collect: jest.fn(async () => res.collect ?? []),
      order: () => ({
        take: jest.fn(async () => res.take ?? []),
        first: jest.fn(async () => res.first ?? null),
      }),
      filter: (cb?: (q: unknown) => unknown) => {
        if (typeof cb === 'function') cb(qbuilder);
        return { first: jest.fn(async () => res.first ?? null) };
      },
    };
    return chain;
  });
  const query = jest.fn(() => ({
    withIndex,
    first: jest.fn(async () => null),
    take: jest.fn(async () => []),
    collect: jest.fn(async () => []),
    order: () => ({ take: jest.fn(async () => []), first: jest.fn(async () => null) }),
    filter: () => ({ first: jest.fn(async () => null) }),
  }));

  return {
    ctx: { db: { get, insert, patch, delete: remove, query }, scheduler },
    get,
    insert,
    patch,
    remove,
    query,
    withIndex,
    scheduler,
    indexResults,
  };
}

const baseOrgDoc = { _id: ORG, name: 'Acme', employeeLimit: 100 };

describe('createUser', () => {
  const baseArgs = {
    adminId: ADMIN_ID,
    name: 'New Hire',
    email: 'New.Hire@Example.com',
    passwordHash: 'hash',
    role: 'employee',
    employeeType: 'staff',
  };

  it('creates a user with the full happy path', async () => {
    const { ctx, insert, scheduler, indexResults } = makeCtx({
      docs: { [ORG]: baseOrgDoc, [ADMIN_ID]: adminDoc() },
      indexResults: {
        by_email: { unique: null },
        by_org_active: { take: [] },
        by_org_role: { take: [adminDoc()] },
      },
      insertId: 'u-new',
    });

    const result = await handlers.createUser(ctx, { ...baseArgs, organizationId: ORG });

    expect(result).toBe('u-new');
    expect(insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        email: 'new.hire@example.com',
        organizationId: ORG,
        isActive: true,
      }),
    );
    expect(scheduler.runAfter).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'user_created' }),
    );
  });

  it('rejects a duplicate email', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: baseOrgDoc },
      indexResults: { by_email: { unique: userDoc() } },
    });
    await expect(handlers.createUser(ctx, { ...baseArgs, organizationId: ORG })).rejects.toThrow(
      'already exists',
    );
  });

  it('requires a superadmin to name an organization', async () => {
    auth.isSuperadmin.mockReturnValue(true);
    rbac.requireUser.mockResolvedValue(adminDoc({ role: 'superadmin', organizationId: undefined }));
    const { ctx } = makeCtx({
      docs: { [ADMIN_ID]: adminDoc({ role: 'superadmin', organizationId: undefined }) },
      indexResults: { by_email: { unique: null } },
    });

    await expect(handlers.createUser(ctx, baseArgs)).rejects.toThrow(
      'must specify an organization',
    );
  });

  it('requires an admin to belong to an organization', async () => {
    rbac.requireUser.mockResolvedValue(adminDoc({ organizationId: undefined }));
    const { ctx } = makeCtx({ indexResults: { by_email: { unique: null } } });

    await expect(handlers.createUser(ctx, baseArgs)).rejects.toThrow(
      'Admin must belong to an organization',
    );
  });

  it('throws when the organization does not exist', async () => {
    const { ctx } = makeCtx({
      docs: { [ADMIN_ID]: adminDoc() },
      indexResults: { by_email: { unique: null } },
    });
    await expect(handlers.createUser(ctx, { ...baseArgs, organizationId: ORG })).rejects.toThrow(
      'Organization not found',
    );
  });

  it('enforces the seat limit from the billing entitlement', async () => {
    entitlements.getOrgEntitlements.mockResolvedValue({
      source: 'billing',
      moduleMap: { employees: { limits: { seats: 1 } } },
    });
    const { ctx } = makeCtx({
      docs: { [ORG]: baseOrgDoc },
      indexResults: {
        by_email: { unique: null },
        by_org_active: { take: [userDoc()] },
      },
    });

    await expect(handlers.createUser(ctx, { ...baseArgs, organizationId: ORG })).rejects.toThrow(
      'Employee limit reached',
    );
  });

  it('falls back to organization.employeeLimit when billing has no seats', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: { ...baseOrgDoc, employeeLimit: 1 } },
      indexResults: {
        by_email: { unique: null },
        by_org_active: { take: [userDoc()] },
        by_org_role: { take: [] },
      },
    });

    await expect(handlers.createUser(ctx, { ...baseArgs, organizationId: ORG })).rejects.toThrow(
      'Employee limit reached',
    );
  });

  it('rejects an invalid travel allowance override', async () => {
    travel.validateTravelAllowanceOverride.mockImplementation(() => {
      throw new Error('allowance too low');
    });
    const { ctx } = makeCtx({
      docs: { [ORG]: baseOrgDoc },
      indexResults: { by_email: { unique: null }, by_org_active: { take: [] } },
    });

    await expect(
      handlers.createUser(ctx, { ...baseArgs, organizationId: ORG, travelAllowance: 5 }),
    ).rejects.toThrow('allowance too low');
  });

  it('persists salary and passport into an employee profile', async () => {
    const { ctx, insert } = makeCtx({
      docs: { [ORG]: baseOrgDoc, [ADMIN_ID]: adminDoc() },
      indexResults: {
        by_email: { unique: null },
        by_org_active: { take: [] },
        by_org_role: { take: [] },
      },
    });

    await handlers.createUser(ctx, {
      ...baseArgs,
      organizationId: ORG,
      baseSalary: 1000,
      passportNumber: 'AB123',
    });

    expect(insert).toHaveBeenCalledWith(
      'employeeProfiles',
      expect.objectContaining({ baseSalary: 1000, passportNumber: 'AB123' }),
    );
  });

  it('resolves a department by id and denormalizes its name', async () => {
    const { ctx, insert } = makeCtx({
      docs: {
        [ORG]: baseOrgDoc,
        dept1: { _id: 'dept1', name: 'Engineering', organizationId: ORG },
      },
      indexResults: {
        by_email: { unique: null },
        by_org_active: { take: [] },
        by_org_role: { take: [] },
      },
    });

    await handlers.createUser(ctx, { ...baseArgs, organizationId: ORG, departmentId: 'dept1' });

    expect(insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({ department: 'Engineering', departmentId: 'dept1' }),
    );
  });

  it('throws when the department id belongs to another org', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: baseOrgDoc, dept1: { _id: 'dept1', name: 'X', organizationId: 'other' } },
      indexResults: { by_email: { unique: null }, by_org_active: { take: [] } },
    });
    await expect(
      handlers.createUser(ctx, { ...baseArgs, organizationId: ORG, departmentId: 'dept1' }),
    ).rejects.toThrow('different organization');
  });

  it('throws when the department id is missing', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: baseOrgDoc },
      indexResults: { by_email: { unique: null }, by_org_active: { take: [] } },
    });
    await expect(
      handlers.createUser(ctx, { ...baseArgs, organizationId: ORG, departmentId: 'missing' }),
    ).rejects.toThrow('Department not found');
  });

  it('links a free-text department to a real record', async () => {
    orgUnits.resolveDepartmentByName.mockResolvedValue({
      name: 'Engineering',
      departmentId: 'dept9',
    });
    const { ctx, insert } = makeCtx({
      docs: { [ORG]: baseOrgDoc },
      indexResults: {
        by_email: { unique: null },
        by_org_active: { take: [] },
        by_org_role: { take: [] },
      },
    });

    await handlers.createUser(ctx, { ...baseArgs, organizationId: ORG, department: 'Eng' });

    expect(insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({ department: 'Engineering', departmentId: 'dept9' }),
    );
  });

  it('resolves a position by id and by free text', async () => {
    orgUnits.resolvePositionByTitle.mockResolvedValue({ title: 'Senior', positionId: 'pos9' });
    const { ctx, insert } = makeCtx({
      docs: { [ORG]: baseOrgDoc, pos1: { _id: 'pos1', title: 'Engineer', organizationId: ORG } },
      indexResults: {
        by_email: { unique: null },
        by_org_active: { take: [] },
        by_org_role: { take: [] },
      },
    });

    await handlers.createUser(ctx, { ...baseArgs, organizationId: ORG, positionId: 'pos1' });
    expect(insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({ position: 'Engineer', positionId: 'pos1' }),
    );

    await handlers.createUser(ctx, { ...baseArgs, organizationId: ORG, position: 'Sr' });
    expect(insert).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({ position: 'Senior', positionId: 'pos9' }),
    );
  });

  it('throws for a position id from another org', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: baseOrgDoc, pos1: { _id: 'pos1', title: 'X', organizationId: 'other' } },
      indexResults: { by_email: { unique: null }, by_org_active: { take: [] } },
    });
    await expect(
      handlers.createUser(ctx, { ...baseArgs, organizationId: ORG, positionId: 'pos1' }),
    ).rejects.toThrow('Position belongs to a different organization');
  });

  it('throws for a missing position id', async () => {
    const { ctx } = makeCtx({
      docs: { [ORG]: baseOrgDoc },
      indexResults: { by_email: { unique: null }, by_org_active: { take: [] } },
    });
    await expect(
      handlers.createUser(ctx, { ...baseArgs, organizationId: ORG, positionId: 'missing' }),
    ).rejects.toThrow('Position not found');
  });
});

describe('updateUser', () => {
  it('throws when the user does not exist', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: 'missing' }),
    ).rejects.toThrow('User not found');
  });

  it('updates a user and syncs an existing profile', async () => {
    const { ctx, patch, insert } = makeCtx({
      docs: { [USER_ID]: userDoc() },
      indexResults: { by_user: { first: { _id: 'profile1' } } },
    });

    await handlers.updateUser(ctx, {
      adminId: ADMIN_ID,
      userId: USER_ID,
      name: 'Renamed',
      phone: '555',
    });

    expect(patch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ name: 'Renamed', phone: '555' }),
    );
    expect(patch).toHaveBeenCalledWith('profile1', expect.objectContaining({ phone: '555' }));
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'user_updated' }),
    );
  });

  it('clears a travel-allowance override on null', async () => {
    const { ctx, patch } = makeCtx({
      docs: { [USER_ID]: userDoc({ travelAllowanceOverride: 100 }) },
      indexResults: { by_user: { first: null } },
    });

    await handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: USER_ID, travelAllowance: null });

    expect(patch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ travelAllowanceOverride: undefined }),
    );
  });

  it('stores a valid travel-allowance override', async () => {
    const { ctx, patch } = makeCtx({
      docs: { [USER_ID]: userDoc() },
      indexResults: { by_user: { first: null } },
    });

    await handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: USER_ID, travelAllowance: 250 });

    expect(patch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ travelAllowanceOverride: 250 }),
    );
  });

  it('rejects an invalid travel-allowance override', async () => {
    travel.validateTravelAllowanceOverride.mockImplementation(() => {
      throw new Error('too small');
    });
    const { ctx } = makeCtx({ docs: { [USER_ID]: userDoc() } });

    await expect(
      handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: USER_ID, travelAllowance: 1 }),
    ).rejects.toThrow('too small');
  });

  it('validates a new supervisor exists, matches org and is active', async () => {
    const { ctx } = makeCtx({ docs: { [USER_ID]: userDoc(), sup: null } });
    await expect(
      handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: USER_ID, supervisorId: 'sup' }),
    ).rejects.toThrow('Supervisor not found');
  });

  it('rejects a supervisor from another organization', async () => {
    const { ctx } = makeCtx({
      docs: { [USER_ID]: userDoc(), sup: userDoc({ _id: 'sup', organizationId: 'other' }) },
    });
    await expect(
      handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: USER_ID, supervisorId: 'sup' }),
    ).rejects.toThrow('same organization');
  });

  it('rejects an inactive supervisor', async () => {
    const { ctx } = makeCtx({
      docs: { [USER_ID]: userDoc(), sup: userDoc({ _id: 'sup', isActive: false }) },
    });
    await expect(
      handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: USER_ID, supervisorId: 'sup' }),
    ).rejects.toThrow('inactive');
  });

  it('validates and assigns an active supervisor in the same org', async () => {
    const assertAssignable = (
      jest.requireMock('../../convex/lib/reportingLine') as Record<string, jest.Mock>
    ).assertAssignable;
    const { ctx } = makeCtx({
      docs: { [USER_ID]: userDoc(), sup: userDoc({ _id: 'sup', isActive: true }) },
      indexResults: { by_user: { first: null } },
    });

    await handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: USER_ID, supervisorId: 'sup' });

    expect(assertAssignable).toHaveBeenCalledWith(ctx, USER_ID, 'sup');
  });

  it('syncs leave balances onto the profile', async () => {
    const { ctx, patch } = makeCtx({
      docs: { [USER_ID]: userDoc() },
      indexResults: { by_user: { first: { _id: 'profile1' } } },
    });

    await handlers.updateUser(ctx, {
      adminId: ADMIN_ID,
      userId: USER_ID,
      paidLeaveBalance: 10,
      sickLeaveBalance: 5,
      familyLeaveBalance: 3,
    });

    expect(patch).toHaveBeenCalledWith(
      'profile1',
      expect.objectContaining({ paidLeaveBalance: 10, sickLeaveBalance: 5, familyLeaveBalance: 3 }),
    );
  });

  it('recalculates probation when the hire date changes', async () => {
    const { ctx, patch } = makeCtx({
      docs: { [USER_ID]: userDoc({ createdAt: 1000 }) },
      indexResults: {
        by_user: { first: null },
        by_employee: { first: { _id: 'prob1', endDate: 5 } },
      },
    });

    await handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: USER_ID, createdAt: 2 });

    expect(patch).toHaveBeenCalledWith('prob1', expect.objectContaining({ status: 'passed' }));
  });

  it('extends an active probation when the new window is still open', async () => {
    const recent = Date.now() - 86400000; // one day in, 89 left
    const { ctx, patch } = makeCtx({
      docs: { [USER_ID]: userDoc({ createdAt: 1000 }) },
      indexResults: {
        by_user: { first: null },
        by_employee: { first: { _id: 'prob1', endDate: 5 } },
      },
    });

    await handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: USER_ID, createdAt: recent });

    expect(patch).toHaveBeenCalledWith(
      'prob1',
      expect.objectContaining({ endDate: expect.any(Number) }),
    );
  });

  it('starts a probation when none exists and the window is open', async () => {
    const recent = Date.now() - 86400000;
    const { ctx, insert, get } = makeCtx({
      docs: { [USER_ID]: userDoc({ createdAt: 1000 }) },
      indexResults: {
        by_user: { first: null },
        by_employee: { first: null },
      },
    });
    get.mockResolvedValue(userDoc()); // employee lookup in the probation helper

    await handlers.updateUser(ctx, { adminId: ADMIN_ID, userId: USER_ID, createdAt: recent });

    expect(insert).toHaveBeenCalledWith(
      'probationPeriods',
      expect.objectContaining({ employeeId: USER_ID, status: 'active' }),
    );
  });
});

describe('deleteUser protection branches', () => {
  it('blocks a non-superadmin from deactivating a superadmin', async () => {
    const { ctx } = makeCtx({ docs: { [USER_ID]: userDoc({ role: 'superadmin' }) } });
    await expect(handlers.deleteUser(ctx, { adminId: ADMIN_ID, userId: USER_ID })).rejects.toThrow(
      'Only superadmin can deactivate superadmin',
    );
  });

  it('blocks an admin from deleting their own account', async () => {
    auth.isSuperadmin.mockReturnValue(true);
    rbac.requireUser.mockResolvedValue(adminDoc({ email: 'me@example.com', role: 'admin' }));
    const { ctx } = makeCtx({
      docs: { [USER_ID]: userDoc({ role: 'admin', email: 'ME@example.com' }) },
    });
    await expect(handlers.deleteUser(ctx, { adminId: ADMIN_ID, userId: USER_ID })).rejects.toThrow(
      'Cannot delete your own admin account',
    );
  });
});

describe('hardDeleteUser', () => {
  it('requires the superadmin role', async () => {
    rbac.requireRole.mockRejectedValue(new Error('forbidden'));
    const { ctx } = makeCtx();
    await expect(
      handlers.hardDeleteUser(ctx, { adminId: ADMIN_ID, userId: USER_ID }),
    ).rejects.toThrow('forbidden');
  });

  it('throws when the user does not exist', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.hardDeleteUser(ctx, { adminId: ADMIN_ID, userId: 'missing' }),
    ).rejects.toThrow('User not found');
  });

  it('hard deletes the user and writes an audit log', async () => {
    const { ctx, remove, insert } = makeCtx({ docs: { [USER_ID]: userDoc() } });
    await handlers.hardDeleteUser(ctx, { adminId: ADMIN_ID, userId: USER_ID });

    expect(remove).toHaveBeenCalledWith(USER_ID);
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'user_hard_deleted' }),
    );
  });
});

describe('approveUser', () => {
  it('approves a pending user and notifies them', async () => {
    const { ctx, patch, insert, scheduler } = makeCtx({
      docs: {
        [USER_ID]: userDoc({ isApproved: false }),
        [ADMIN_ID]: adminDoc(),
        [ORG]: baseOrgDoc,
      },
    });

    const result = await handlers.approveUser(ctx, { adminId: ADMIN_ID, userId: USER_ID });

    expect(result).toBe(USER_ID);
    expect(patch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ isApproved: true, approvedBy: ADMIN_ID }),
    );
    expect(scheduler.runAfter).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'user_approved' }),
    );
  });

  it('rejects an already-approved user', async () => {
    const { ctx } = makeCtx({ docs: { [USER_ID]: userDoc({ isApproved: true }) } });
    await expect(handlers.approveUser(ctx, { adminId: ADMIN_ID, userId: USER_ID })).rejects.toThrow(
      'already approved',
    );
  });

  it('handles a user with no organization', async () => {
    const { ctx } = makeCtx({
      docs: { [USER_ID]: userDoc({ isApproved: false, organizationId: undefined }) },
    });
    await handlers.approveUser(ctx, { adminId: ADMIN_ID, userId: USER_ID });
    expect(ctx.db.patch).toHaveBeenCalled();
  });
});

describe('updateOwnProfile', () => {
  it('syncs localization fields into the settings row', async () => {
    const { ctx, patch } = makeCtx({ docs: { [USER_ID]: userDoc() } });

    await handlers.updateOwnProfile(ctx, {
      userId: USER_ID,
      language: 'ru',
      timezone: 'Asia/Yerevan',
    });

    expect(settingsMod.getOrCreateSettings).toHaveBeenCalledWith(ctx, USER_ID);
    expect(patch).toHaveBeenCalledWith(
      'settings-1',
      expect.objectContaining({ language: 'ru', timezone: 'Asia/Yerevan' }),
    );
  });

  it('does not touch settings without localization fields', async () => {
    const { ctx } = makeCtx({ docs: { [USER_ID]: userDoc() } });
    await handlers.updateOwnProfile(ctx, { userId: USER_ID, name: 'N' });
    expect(settingsMod.getOrCreateSettings).not.toHaveBeenCalled();
  });
});

describe('presence and avatar', () => {
  it('updates presence status and dual-writes the profile', async () => {
    const patchProfile = jest.requireMock('../../convex/lib/userProfile').patchProfile as jest.Mock;
    const { ctx, patch, insert } = makeCtx({ docs: { [USER_ID]: userDoc() } });

    const result = await handlers.updatePresenceStatus(ctx, {
      userId: USER_ID,
      presenceStatus: 'busy',
    });

    expect(result).toEqual({ success: true, newStatus: 'busy' });
    expect(patch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ presenceStatus: 'busy' }),
    );
    expect(patchProfile).toHaveBeenCalledWith(ctx, USER_ID, { presenceStatus: 'busy' });
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'presence_status_updated' }),
    );
  });

  it('updates the avatar even when the user row is absent', async () => {
    const patchProfile = jest.requireMock('../../convex/lib/userProfile').patchProfile as jest.Mock;
    const { ctx } = makeCtx();
    const result = await handlers.updateAvatar(ctx, { userId: USER_ID, avatarUrl: 'a.png' });

    expect(result).toBe(USER_ID);
    expect(patchProfile).toHaveBeenCalledWith(ctx, USER_ID, { avatarUrl: 'a.png' });
  });

  it('deletes the avatar', async () => {
    const { ctx, patch } = makeCtx({ docs: { [USER_ID]: userDoc() } });
    await handlers.deleteAvatar(ctx, { userId: USER_ID });
    expect(patch).toHaveBeenCalledWith(USER_ID, { avatarUrl: undefined });
  });

  it('sets in-call status only when not already in a call', async () => {
    const { ctx, patch, insert } = makeCtx({
      docs: { [USER_ID]: userDoc({ presenceStatus: 'available' }) },
    });
    await handlers.setInCallStatus(ctx, { userId: USER_ID });
    expect(patch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ presenceStatus: 'in_call' }),
    );
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'status_set_in_call' }),
    );
  });

  it('does not rewrite the in-call status when already in a call', async () => {
    const { ctx, patch } = makeCtx({ docs: { [USER_ID]: userDoc({ presenceStatus: 'in_call' }) } });
    await handlers.setInCallStatus(ctx, { userId: USER_ID });
    expect(patch).not.toHaveBeenCalled();
  });

  it('resets from in-call to available', async () => {
    const { ctx, patch, insert } = makeCtx({
      docs: { [USER_ID]: userDoc({ presenceStatus: 'in_call' }) },
    });
    await handlers.resetFromCallStatus(ctx, { userId: USER_ID });
    expect(patch).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ presenceStatus: 'available' }),
    );
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'status_reset_from_call' }),
    );
  });

  it('does not reset when not in a call', async () => {
    const { ctx, patch } = makeCtx({ docs: { [USER_ID]: userDoc({ presenceStatus: 'busy' }) } });
    await handlers.resetFromCallStatus(ctx, { userId: USER_ID });
    expect(patch).not.toHaveBeenCalled();
  });

  it('updates the chat background', async () => {
    const { ctx, patch } = makeCtx();
    const result = await handlers.updateChatBackground(ctx, {
      userId: USER_ID,
      backgroundId: 'sunset',
    });
    expect(result).toEqual({ success: true });
    expect(patch).toHaveBeenCalledWith(USER_ID, { chatBackground: 'sunset' });
  });
});

describe('secureDeleteUser', () => {
  it('throws when not authenticated', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.secureDeleteUser(ctx, { userId: USER_ID })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the user does not exist', async () => {
    getAuthCaller.mockResolvedValue(adminDoc());
    const { ctx } = makeCtx();
    await expect(handlers.secureDeleteUser(ctx, { userId: 'missing' })).rejects.toThrow(
      'User not found',
    );
  });

  it('blocks a cross-organization delete', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx({ docs: { [USER_ID]: userDoc() } });
    await expect(handlers.secureDeleteUser(ctx, { userId: USER_ID })).rejects.toThrow(
      'cross-organization',
    );
  });

  it('blocks deactivating a superadmin as an admin', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ role: 'admin', _id: 'admin1' }));
    const { ctx } = makeCtx({ docs: { [USER_ID]: userDoc({ role: 'superadmin' }) } });
    await expect(handlers.secureDeleteUser(ctx, { userId: USER_ID })).rejects.toThrow('superadmin');
  });

  it('blocks an admin deactivating another admin', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ role: 'admin', _id: 'caller' }));
    const { ctx } = makeCtx({ docs: { [USER_ID]: userDoc({ role: 'admin' }) } });
    await expect(handlers.secureDeleteUser(ctx, { userId: USER_ID })).rejects.toThrow(
      'Only superadmin can deactivate admin',
    );
  });

  it('blocks deleting your own account', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ role: 'employee', _id: USER_ID }));
    const { ctx } = makeCtx({ docs: { [USER_ID]: userDoc({ role: 'employee' }) } });
    await expect(handlers.secureDeleteUser(ctx, { userId: USER_ID })).rejects.toThrow(
      'Cannot delete your own account',
    );
  });

  it('deactivates a regular employee', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ role: 'admin', _id: 'caller' }));
    const { ctx, patch, insert } = makeCtx({ docs: { [USER_ID]: userDoc({ role: 'employee' }) } });

    const result = await handlers.secureDeleteUser(ctx, { userId: USER_ID });

    expect(result).toBe(USER_ID);
    expect(patch).toHaveBeenCalledWith(USER_ID, { isActive: false });
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'user_deleted' }),
    );
  });
});
