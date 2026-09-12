/**
 * Deep coverage tests for the SCIM provisioning module (convex/scim/main.ts).
 *
 * The Convex function wrappers are unwrapped to their handlers and run
 * against a mock ctx (same pattern as webhookDeliveryEngine.test.ts).
 * crypto.subtle is available in Node 20+ natively.
 *
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  mutation: ({ handler, args }: any) => ({ handler, args }),
  query: ({ handler, args }: any) => ({ handler, args }),
  action: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
  internalQuery: ({ handler, args }: any) => ({ handler, args }),
  internalAction: ({ handler, args }: any) => ({ handler, args }),
}));

jest.mock('../../convex/_generated/api', () => ({ internal: {}, api: {} }));

const mockGetAuthCaller = jest.fn();
jest.mock('../../convex/lib/getAuthCaller', () => ({
  getAuthCaller: (...a: unknown[]) => mockGetAuthCaller(...a),
}));

jest.mock('../../convex/lib/travelAllowance', () => ({
  resolveTravelAllowanceForOrg: jest.fn(async () => 0),
}));

jest.mock('../../convex/lib/leaveBalances', () => ({
  getStartingLeaveBalances: jest.fn(async () => ({
    paidLeaveBalance: 20,
    sickLeaveBalance: 10,
    familyLeaveBalance: 5,
  })),
}));

jest.mock('../../convex/lib/notify', () => ({ notify: jest.fn(async () => undefined) }));

type Row = Record<string, any>;

/** Minimal Convex-db mock with working index filters on the tables we touch. */
function makeDb(extraTables: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    users: [],
    scimTokens: [],
    auditLogs: [],
    organizations: [],
    notifications: [],
    ...extraTables,
  };
  let nextId = 100;
  const db = {
    get: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const row = rows.find((r) => r._id === id);
        if (row) return { ...row };
      }
      return null;
    },
    insert: async (table: string, doc: Row) => {
      const id = `${table.slice(0, 3)}_${nextId++}`;
      (tables[table] ??= []).push({ _id: id, ...doc });
      return id;
    },
    patch: async (id: string, patch: Row) => {
      for (const rows of Object.values(tables)) {
        const row = rows.find((r) => r._id === id);
        if (row) {
          Object.assign(row, patch);
          // undefined assignment in Convex clears the field.
          for (const [k, v] of Object.entries(patch)) if (v === undefined) delete row[k];
          return;
        }
      }
    },
    delete: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const i = rows.findIndex((r) => r._id === id);
        if (i >= 0) rows.splice(i, 1);
      }
    },
    query: (table: string) => {
      const rows = tables[table] ?? [];
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
        unique: async () => {
          const filtered = rows.filter((r) =>
            Object.entries(chain.__filters ?? {}).every(([k, v]) => r[k] === v),
          );
          return filtered[0] ? { ...filtered[0] } : null;
        },
        order: () => chain,
        collect: async () =>
          rows
            .filter((r) => Object.entries(chain.__filters ?? {}).every(([k, v]) => r[k] === v))
            .map((r) => ({ ...r })),
        take: async (n: number) =>
          rows
            .filter((r) => Object.entries(chain.__filters ?? {}).every(([k, v]) => r[k] === v))
            .slice(0, n)
            .map((r) => ({ ...r })),
        first: async () => {
          const filtered = rows.filter((r) =>
            Object.entries(chain.__filters ?? {}).every(([k, v]) => r[k] === v),
          );
          return filtered[0] ? { ...filtered[0] } : null;
        },
      };
      return chain;
    },
  };
  return { db, tables };
}

const ORG = {
  _id: 'org1',
  name: 'Acme',
  isActive: true,
  employeeLimit: 100,
  slug: 'acme',
  plan: 'pro',
};

function baseUser(over: Row = {}): Row {
  return {
    _id: 'u1',
    organizationId: 'org1',
    name: 'Alice Smith',
    email: 'alice@acme.com',
    passwordHash: '',
    role: 'employee',
    employeeType: 'staff',
    isActive: true,
    isApproved: true,
    externalId: 'idp-1',
    externalSource: 'scim',
    createdAt: 1_700_000_000_000,
    ...over,
  };
}

describe('SCIM admin token CRUD', () => {
  let mod: any;
  const admin = { _id: 'a1', role: 'admin', organizationId: 'org1' };
  const employee = { _id: 'e1', role: 'employee', organizationId: 'org1' };

  beforeAll(async () => {
    mod = await import('../../convex/scim/main');
  });

  beforeEach(() => {
    mockGetAuthCaller.mockReset();
  });

  it('createToken returns the raw value once and stores only a sha-256 hash', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx: any = makeDb();
    const res = await mod.createToken.handler(ctx, { label: 'Azure AD' });

    expect(res.token).toMatch(/^scim_[0-9a-f]{64}$/);
    const row = ctx.tables.scimTokens[0];
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.tokenHash).not.toBe(res.token);
    expect(row.label).toBe('Azure AD');
    expect(row.enabled).toBe(true);
  });

  it('createToken rejects employees', async () => {
    mockGetAuthCaller.mockResolvedValue(employee);
    const ctx: any = makeDb();
    await expect(mod.createToken.handler(ctx, {})).rejects.toThrow(/organization admins/);
  });

  it('listTokens is org-scoped', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx: any = makeDb();
    ctx.tables.scimTokens.push(
      { _id: 't1', organizationId: 'org1', tokenHash: 'h1', enabled: true, createdAt: 1 },
      { _id: 't2', organizationId: 'org2', tokenHash: 'h2', enabled: true, createdAt: 2 },
    );
    const listed = await mod.listTokens.handler(ctx, {});
    expect(listed).toHaveLength(1);
    expect(listed[0]._id).toBe('t1');
  });

  it('updateToken and deleteToken refuse cross-org rows', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx: any = makeDb();
    ctx.tables.scimTokens.push({
      _id: 'tX',
      organizationId: 'org2',
      tokenHash: 'h',
      enabled: true,
    });
    await expect(mod.updateToken.handler(ctx, { tokenId: 'tX', enabled: false })).rejects.toThrow(
      'SCIM token not found',
    );
    await expect(mod.deleteToken.handler(ctx, { tokenId: 'tX' })).rejects.toThrow(
      'SCIM token not found',
    );
  });

  it('authenticateToken resolves enabled tokens and rejects disabled/unknown', async () => {
    const ctx: any = makeDb();
    ctx.tables.scimTokens.push(
      { _id: 't1', organizationId: 'org1', tokenHash: 'hash-ok', enabled: true },
      { _id: 't2', organizationId: 'org1', tokenHash: 'hash-off', enabled: false },
    );
    expect(await mod.authenticateToken.handler(ctx, { tokenHash: 'hash-ok' })).toMatchObject({
      organizationId: 'org1',
    });
    expect(await mod.authenticateToken.handler(ctx, { tokenHash: 'hash-off' })).toBeNull();
    expect(await mod.authenticateToken.handler(ctx, { tokenHash: 'nope' })).toBeNull();
  });
});

describe('SCIM provisioning semantics', () => {
  let mod: any;

  beforeAll(async () => {
    mod = await import('../../convex/scim/main');
  });

  beforeEach(() => {
    mockGetAuthCaller.mockReset();
  });

  it('createUser provisions an employee with the scim external-identity pair', async () => {
    const ctx: any = makeDb({ organizations: [ORG] });
    const res = await mod.createUser.handler(ctx, {
      organizationId: 'org1',
      userName: 'bob@acme.com',
      name: 'Bob Doe',
      active: true,
      department: 'Engineering',
      position: 'Backend Developer',
    });

    expect(res.conflict).toBe(false);
    expect(res.scimUser).toMatchObject({
      userName: 'bob@acme.com',
      active: true,
      department: 'Engineering',
      title: 'Backend Developer',
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    });
    const user = ctx.tables.users[0];
    expect(user.role).toBe('employee'); // SCIM never mints admins
    expect(user.passwordHash).toBe(''); // no credentials — SSO/idP owns login
    expect(user.isApproved).toBe(true);
    expect(user.externalSource).toBe('scim');
    expect(user.externalId).toBe('bob@acme.com');
    // The SCIM resource id is our platform user id — stable for later GET/PUT/PATCH.
    expect(res.scimUser.id).toBe(user._id);
    expect(ctx.tables.auditLogs.some((a: Row) => a.action === 'scim_user_created')).toBe(true);
  });

  it('createUser returns conflict on duplicate email (409 path)', async () => {
    const ctx: any = makeDb({ organizations: [ORG], users: [baseUser()] });
    const res = await mod.createUser.handler(ctx, {
      organizationId: 'org1',
      userName: 'alice@acme.com',
      name: 'Duplicate',
      active: true,
    });
    expect(res.conflict).toBe(true);
    expect(ctx.tables.users).toHaveLength(1);
  });

  it('createUser respects the org seat limit', async () => {
    const ctx: any = makeDb({
      organizations: [{ ...ORG, employeeLimit: 1 }],
      users: [baseUser()],
    });
    const res = await mod.createUser.handler(ctx, {
      organizationId: 'org1',
      userName: 'over@acme.com',
      name: 'Overflow',
      active: true,
    });
    expect(res.seatLimit).toBe(true);
    expect(ctx.tables.users).toHaveLength(1);
  });

  it('createUser links the manager by externalId within the org', async () => {
    const ctx: any = makeDb({
      organizations: [ORG],
      users: [baseUser({ _id: 'mgr1', externalId: 'idp-mgr' })],
    });
    const res = await mod.createUser.handler(ctx, {
      organizationId: 'org1',
      userName: 'kid@acme.com',
      name: 'Report',
      active: true,
      managerExternalId: 'idp-mgr',
    });
    const kid = ctx.tables.users.find((u: Row) => u.email === 'kid@acme.com');
    expect(kid.supervisorId).toBe('mgr1');
    void res;
  });

  it('listUsers paginates 1-based and filters by email', async () => {
    const ctx: any = makeDb({
      users: [
        baseUser({ _id: 'u1', createdAt: 1 }),
        baseUser({ _id: 'u2', email: 'bob@acme.com', externalId: 'idp-2', createdAt: 2 }),
        baseUser({ _id: 'u3', email: 'carol@acme.com', externalId: 'idp-3', createdAt: 3 }),
      ],
    });
    const page1 = await mod.listUsers.handler(ctx, {
      organizationId: 'org1',
      startIndex: 1,
      count: 2,
    });
    expect(page1.totalResults).toBe(3);
    expect(page1.resources.map((r: any) => r.id)).toStrictEqual(['u1', 'u2']);

    const page2 = await mod.listUsers.handler(ctx, {
      organizationId: 'org1',
      startIndex: 3,
      count: 2,
    });
    expect(page2.resources.map((r: any) => r.id)).toStrictEqual(['u3']);

    const filtered = await mod.listUsers.handler(ctx, {
      organizationId: 'org1',
      startIndex: 1,
      count: 100,
      emailEq: 'carol@acme.com',
    });
    expect(filtered.totalResults).toBe(1);
    expect(filtered.resources[0].id).toBe('u3');
  });

  it('updateUser replaces mutable attributes but never roles/balances', async () => {
    const ctx: any = makeDb({ users: [baseUser({ paidLeaveBalance: 42 })] });
    const res = await mod.updateUser.handler(ctx, {
      organizationId: 'org1',
      userId: 'u1',
      name: 'Alice T. Smith',
      department: 'People',
      position: 'HR Lead',
    });
    expect(res.notFound).toBe(false);
    const user = ctx.tables.users[0];
    expect(user.name).toBe('Alice T. Smith');
    expect(user.department).toBe('People');
    expect(user.position).toBe('HR Lead');
    expect(user.role).toBe('employee');
    expect(user.paidLeaveBalance).toBe(42);
  });

  it('updateUser deactivates and reactivates', async () => {
    const ctx: any = makeDb({ users: [baseUser()] });
    await mod.updateUser.handler(ctx, { organizationId: 'org1', userId: 'u1', active: false });
    expect(ctx.tables.users[0].isActive).toBe(false);
    await mod.updateUser.handler(ctx, { organizationId: 'org1', userId: 'u1', active: true });
    expect(ctx.tables.users[0].isActive).toBe(true);
  });

  it('refuses to deactivate the last active admin', async () => {
    const ctx: any = makeDb({
      users: [baseUser({ _id: 'admin1', role: 'admin', externalId: 'idp-a' })],
    });
    const res = await mod.updateUser.handler(ctx, {
      organizationId: 'org1',
      userId: 'admin1',
      active: false,
    });
    expect(res.lastAdmin).toBe(true);
    expect(ctx.tables.users[0].isActive).toBe(true); // untouched
  });

  it('allows deactivating an admin when another active admin remains', async () => {
    const ctx: any = makeDb({
      users: [
        baseUser({ _id: 'admin1', role: 'admin', externalId: 'idp-a' }),
        baseUser({ _id: 'admin2', role: 'admin', email: 'b@acme.com', externalId: 'idp-b' }),
      ],
    });
    const res = await mod.updateUser.handler(ctx, {
      organizationId: 'org1',
      userId: 'admin1',
      active: false,
    });
    expect(res.lastAdmin).toBe(false);
    expect(ctx.tables.users.find((u: Row) => u._id === 'admin1').isActive).toBe(false);
  });

  it('deleteUser deactivates and strips the scim link (soft delete)', async () => {
    const ctx: any = makeDb({ users: [baseUser()] });
    const res = await mod.deleteUser.handler(ctx, { organizationId: 'org1', userId: 'u1' });
    expect(res.notFound).toBe(false);
    const user = ctx.tables.users[0];
    expect(user.isActive).toBe(false);
    expect(user.externalId).toBeUndefined();
    expect(user.externalSource).toBeUndefined();
    // The row survives — payroll history intact.
    expect(user.email).toBe('alice@acme.com');
  });

  it('cross-org access is refused everywhere', async () => {
    const ctx: any = makeDb({ users: [baseUser()] });
    const org2 = { organizationId: 'org2' };
    await expect(
      mod.updateUser.handler(ctx, { ...org2, userId: 'u1', name: 'X' }),
    ).resolves.toMatchObject({ notFound: true });
    await expect(mod.deleteUser.handler(ctx, { ...org2, userId: 'u1' })).resolves.toMatchObject({
      notFound: true,
    });
    await expect(mod.getUser.handler(ctx, { ...org2, userId: 'u1' })).resolves.toBeNull();
  });
});
