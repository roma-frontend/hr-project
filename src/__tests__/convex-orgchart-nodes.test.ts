/**
 * Tests for convex/orgchart.ts — tree reads, node CRUD, re-parenting and
 * layout persistence.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  query: ({ handler, args }: any) => ({ handler, args }),
  mutation: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
  internalQuery: ({ handler, args }: any) => ({ handler, args }),
}));

jest.mock('../../convex/lib/getAuthCaller', () => ({ getAuthCaller: jest.fn() }));
jest.mock('../../convex/lib/auth', () => ({ isSuperadmin: jest.fn(() => false) }));
jest.mock('../../convex/lib/userProfile', () => ({ getProfile: jest.fn(async () => null) }));
jest.mock('../../convex/lib/entitlements', () => ({
  assertModuleAccess: jest.fn(async () => undefined),
}));
jest.mock('../../convex/lib/capabilities', () => ({
  requireCapability: jest.fn(async () => undefined),
}));
jest.mock('../../convex/lib/reportingLine', () => ({
  assertAssignable: jest.fn(async () => undefined),
  getOrgHeadId: jest.fn(async () => null),
  resolveSupervisorId: jest.fn(async () => null),
  writeSupervisorId: jest.fn(async () => undefined),
}));

const getAuthCaller = jest.requireMock('../../convex/lib/getAuthCaller').getAuthCaller as jest.Mock;
const isSuperadmin = jest.requireMock('../../convex/lib/auth').isSuperadmin as jest.Mock;
const reportingLine = jest.requireMock('../../convex/lib/reportingLine') as Record<
  string,
  jest.Mock
>;

type Handler = (ctx: any, args: any) => Promise<any>;
const handlers: Record<string, Handler> = {};
{
  const mod = require('../../convex/orgchart');
  for (const [name, def] of Object.entries(mod)) {
    if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
      handlers[name] = (def as any).handler;
    }
  }
}

const ORG = 'org1';
const CALLER_ID = 'caller1';

function adminDoc(overrides: Record<string, unknown> = {}) {
  return { _id: CALLER_ID, name: 'Admin', role: 'admin', organizationId: ORG, ...overrides };
}

function nodeDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'n1',
    organizationId: ORG,
    parentId: undefined,
    userId: undefined,
    name: 'Node',
    type: 'department',
    order: 0,
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeCtx(opts: { docs?: Record<string, unknown>; tables?: Record<string, any[]> } = {}) {
  const docs = opts.docs ?? {};
  const tables = opts.tables ?? {};
  const inserts: Array<[string, any]> = [];
  const patches: Array<[string, any]> = [];
  const deletes: string[] = [];

  const get = jest.fn(async (id: string) => docs[id] ?? null);
  const insert = jest.fn(async (table: string, doc: any) => {
    inserts.push([table, doc]);
    return `${table}_new`;
  });
  const patch = jest.fn(async (id: string, fields: any) => {
    patches.push([id, fields]);
  });
  const remove = jest.fn(async (id: string) => {
    deletes.push(id);
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
            if (prop === 'neq' || prop === 'and')
              return (...args: unknown[]) => {
                void args;
                return makeQ();
              };
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
      unique: jest.fn(async () => matched()[0] ?? null),
    };
    return chain;
  });

  return {
    ctx: { db: { get, insert, patch, delete: remove, query } },
    get,
    insert,
    patch,
    remove,
    query,
    inserts,
    patches,
    deletes,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getAuthCaller.mockResolvedValue(adminDoc());
  isSuperadmin.mockReturnValue(false);
  reportingLine.assertAssignable.mockResolvedValue(undefined);
  reportingLine.writeSupervisorId.mockResolvedValue(undefined);
});

// ── getOrgChart / tree ───────────────────────────────────────────────────────

describe('getOrgChart', () => {
  it('returns [] without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.getOrgChart(ctx, { organizationId: ORG })).resolves.toEqual([]);
  });

  it('throws for a cross-organization caller', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    await expect(handlers.getOrgChart(ctx, { organizationId: ORG })).rejects.toThrow(
      'Access denied',
    );
  });

  it('enriches person nodes with user data', async () => {
    const { ctx } = makeCtx({
      docs: { u1: { _id: 'u1', name: 'Jane', email: 'j@x.com', department: 'Eng' } },
      tables: {
        orgChartNodes: [
          nodeDoc({ userId: 'u1', type: 'person' }),
          nodeDoc({ _id: 'n2', type: 'group' }),
        ],
        users: [
          {
            _id: 'u1',
            name: 'Jane',
            email: 'j@x.com',
            isActive: true,
            organizationId: ORG,
            department: 'Eng',
          },
        ],
      },
    });

    const result = await handlers.getOrgChart(ctx, { organizationId: ORG });

    expect(result[0].user).toMatchObject({ _id: 'u1', name: 'Jane', department: 'Eng' });
    expect(result[1].user).toBeNull();
  });
});

describe('getOrgChartTree', () => {
  it('returns [] without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.getOrgChartTree(ctx, { organizationId: ORG })).resolves.toEqual([]);
  });

  it('throws for a cross-organization caller', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    await expect(handlers.getOrgChartTree(ctx, { organizationId: ORG })).rejects.toThrow(
      'Access denied',
    );
  });

  it('builds and orders the tree, promoting orphans to roots', async () => {
    const { ctx } = makeCtx({
      tables: {
        orgChartNodes: [
          nodeDoc({ _id: 'root', order: 1 }),
          nodeDoc({ _id: 'root2', order: 0 }),
          nodeDoc({ _id: 'child', parentId: 'root', order: 1 }),
          nodeDoc({ _id: 'child2', parentId: 'root', order: 0 }),
          nodeDoc({ _id: 'orphan', parentId: 'missing' }),
        ],
      },
    });

    const roots = await handlers.getOrgChartTree(ctx, { organizationId: ORG });

    expect(roots.map((r: any) => r._id)).toEqual(['root2', 'orphan', 'root']);
    const root = roots.find((r: any) => r._id === 'root');
    expect(root.children.map((c: any) => c._id)).toEqual(['child2', 'child']);
  });
});

// ── createNode ───────────────────────────────────────────────────────────────

describe('createNode', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(
      handlers.createNode(ctx, { organizationId: ORG, name: 'X', type: 'group' }),
    ).rejects.toThrow('Not authenticated');
  });

  it('rejects a non-admin caller', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ role: 'employee' }));
    const { ctx } = makeCtx();
    await expect(
      handlers.createNode(ctx, { organizationId: ORG, name: 'X', type: 'group' }),
    ).rejects.toThrow('Access denied');
  });

  it('rejects an admin from another organization', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    await expect(
      handlers.createNode(ctx, { organizationId: ORG, name: 'X', type: 'group' }),
    ).rejects.toThrow('Access denied');
  });

  it('creates a manual node with the default order', async () => {
    const { ctx, insert } = makeCtx();
    const id = await handlers.createNode(ctx, { organizationId: ORG, name: 'Team', type: 'group' });
    expect(id).toBe('orgChartNodes_new');
    expect(insert).toHaveBeenCalledWith(
      'orgChartNodes',
      expect.objectContaining({ name: 'Team', source: 'manual', order: 0 }),
    );
  });
});

// ── updateNode ───────────────────────────────────────────────────────────────

describe('updateNode', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.updateNode(ctx, { nodeId: 'n1' })).rejects.toThrow('Not authenticated');
  });

  it('rejects a non-admin caller', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ role: 'employee' }));
    const { ctx } = makeCtx();
    await expect(handlers.updateNode(ctx, { nodeId: 'n1' })).rejects.toThrow('Access denied');
  });

  it('throws when the node is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.updateNode(ctx, { nodeId: 'missing' })).rejects.toThrow('Node not found');
  });

  it('throws for a node in another organization', async () => {
    const { ctx } = makeCtx({ docs: { n1: nodeDoc({ organizationId: 'other' }) } });
    await expect(handlers.updateNode(ctx, { nodeId: 'n1', name: 'New' })).rejects.toThrow(
      'Access denied',
    );
  });

  it('patches the editable fields', async () => {
    const { ctx, patch } = makeCtx({ docs: { n1: nodeDoc() } });
    const result = await handlers.updateNode(ctx, {
      nodeId: 'n1',
      name: 'Renamed',
      title: 'Lead',
      order: 5,
      userId: 'u1',
    });

    expect(result).toEqual({ success: true, reassignedManager: false });
    expect(patch).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({ name: 'Renamed', title: 'Lead', order: 5, userId: 'u1' }),
    );
  });

  it('re-parents and reports a manager reassignment', async () => {
    const { ctx } = makeCtx({
      docs: {
        n1: nodeDoc({ type: 'person', userId: 'u1' }),
        n2: nodeDoc({ _id: 'n2', type: 'person', userId: 'mgr' }),
        mgr: { _id: 'mgr', organizationId: ORG, isActive: true },
      },
    });

    const result = await handlers.updateNode(ctx, { nodeId: 'n1', parentId: 'n2' });

    expect(result.reassignedManager).toBe(true);
    expect(reportingLine.writeSupervisorId).toHaveBeenCalledWith(ctx, 'u1', 'mgr');
  });

  it('marks a manual re-parent when moving a person under a box', async () => {
    const { ctx, patch } = makeCtx({
      docs: {
        n1: nodeDoc({ type: 'person', userId: 'u1' }),
        box: nodeDoc({ _id: 'box', type: 'department' }),
      },
    });

    const result = await handlers.updateNode(ctx, { nodeId: 'n1', parentId: 'box' });

    expect(result.reassignedManager).toBe(false);
    expect(patch).toHaveBeenCalledWith('n1', expect.objectContaining({ source: 'manual' }));
  });
});

// ── deleteNode ───────────────────────────────────────────────────────────────

describe('deleteNode', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.deleteNode(ctx, { nodeId: 'n1' })).rejects.toThrow('Not authenticated');
  });

  it('rejects a non-admin caller', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ role: 'employee' }));
    const { ctx } = makeCtx();
    await expect(handlers.deleteNode(ctx, { nodeId: 'n1' })).rejects.toThrow('Access denied');
  });

  it('throws when the node is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.deleteNode(ctx, { nodeId: 'missing' })).rejects.toThrow('Node not found');
  });

  it('deletes children and the node itself', async () => {
    const { ctx, remove, deletes } = makeCtx({
      docs: { n1: nodeDoc() },
      tables: {
        orgChartNodes: [
          nodeDoc({ _id: 'c1', parentId: 'n1' }),
          nodeDoc({ _id: 'c2', parentId: 'n1' }),
        ],
      },
    });

    const result = await handlers.deleteNode(ctx, { nodeId: 'n1' });

    expect(result).toEqual({ success: true });
    expect(remove).toHaveBeenCalledWith('n1');
    expect(deletes).toEqual(expect.arrayContaining(['c1', 'c2', 'n1']));
  });
});

// ── moveNode ─────────────────────────────────────────────────────────────────

describe('moveNode', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.moveNode(ctx, { nodeId: 'n1' })).rejects.toThrow('Not authenticated');
  });

  it('rejects a non-admin caller', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ role: 'employee' }));
    const { ctx } = makeCtx();
    await expect(handlers.moveNode(ctx, { nodeId: 'n1' })).rejects.toThrow('Access denied');
  });

  it('throws when the node is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.moveNode(ctx, { nodeId: 'missing' })).rejects.toThrow('Node not found');
  });

  it('throws when the new parent is missing', async () => {
    const { ctx } = makeCtx({ docs: { n1: nodeDoc() } });
    await expect(handlers.moveNode(ctx, { nodeId: 'n1', newParentId: 'ghost' })).rejects.toThrow(
      'New parent not found',
    );
  });

  it('refuses moving a node under its own descendant', async () => {
    const { ctx } = makeCtx({
      docs: { n1: nodeDoc(), child: nodeDoc({ _id: 'child' }) },
      tables: {
        orgChartNodes: [nodeDoc({ _id: 'child', parentId: 'n1' })],
      },
    });

    await expect(handlers.moveNode(ctx, { nodeId: 'n1', newParentId: 'child' })).rejects.toThrow(
      'own descendant',
    );
  });

  it('moves a person and writes the reporting line', async () => {
    const { ctx } = makeCtx({
      docs: {
        n1: nodeDoc({ type: 'person', userId: 'u1' }),
        mgr: nodeDoc({ _id: 'mgr', type: 'person', userId: 'boss' }),
        boss: { _id: 'boss', organizationId: ORG, isActive: true },
      },
    });

    const result = await handlers.moveNode(ctx, { nodeId: 'n1', newParentId: 'mgr' });

    expect(result).toEqual({ success: true, reassignedManager: true });
    expect(reportingLine.writeSupervisorId).toHaveBeenCalledWith(ctx, 'u1', 'boss');
  });

  it('moves a node to the root', async () => {
    const { ctx } = makeCtx({ docs: { n1: nodeDoc() } });
    const result = await handlers.moveNode(ctx, { nodeId: 'n1' });
    expect(result).toEqual({ success: true, reassignedManager: false });
  });
});

// ── saveLayout / getLayouts ──────────────────────────────────────────────────

describe('saveLayout', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.saveLayout(ctx, { organizationId: ORG, layoutData: {} })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('rejects a cross-organization caller', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    await expect(handlers.saveLayout(ctx, { organizationId: ORG, layoutData: {} })).rejects.toThrow(
      'Access denied',
    );
  });

  it('inserts a layout', async () => {
    const { ctx, insert } = makeCtx();
    const id = await handlers.saveLayout(ctx, {
      organizationId: ORG,
      layoutData: { x: 1 },
      name: 'L',
    });
    expect(id).toBe('orgChartLayouts_new');
    expect(insert).toHaveBeenCalledWith(
      'orgChartLayouts',
      expect.objectContaining({ layoutData: { x: 1 }, name: 'L' }),
    );
  });

  it('unsets previous defaults when saving a new default', async () => {
    const { ctx, patch } = makeCtx({
      tables: { orgChartLayouts: [nodeDoc({ _id: 'old', isDefault: true, userId: CALLER_ID })] },
    });

    await handlers.saveLayout(ctx, { organizationId: ORG, layoutData: {}, isDefault: true });

    expect(patch).toHaveBeenCalledWith('old', { isDefault: false });
  });
});

describe('getLayouts', () => {
  it('returns [] without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.getLayouts(ctx, { organizationId: ORG })).resolves.toEqual([]);
  });

  it('throws for a cross-organization caller', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    await expect(handlers.getLayouts(ctx, { organizationId: ORG })).rejects.toThrow(
      'Access denied',
    );
  });

  it('returns the caller layouts', async () => {
    const { ctx } = makeCtx({
      tables: { orgChartLayouts: [nodeDoc({ _id: 'l1', userId: CALLER_ID })] },
    });
    const result = await handlers.getLayouts(ctx, { organizationId: ORG });
    expect(result).toHaveLength(1);
  });
});

// ── debugOrgChart ────────────────────────────────────────────────────────────

describe('debugOrgChart', () => {
  it('returns [] without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.debugOrgChart(ctx, { organizationId: ORG })).resolves.toEqual([]);
  });

  it('rejects a non-admin caller', async () => {
    getAuthCaller.mockResolvedValue(adminDoc({ role: 'employee' }));
    const { ctx } = makeCtx();
    await expect(handlers.debugOrgChart(ctx, { organizationId: ORG })).rejects.toThrow(
      'Access denied',
    );
  });

  it('dumps the flat nodes and a nested tree', async () => {
    const { ctx } = makeCtx({
      docs: { u1: { _id: 'u1', department: 'Eng' } },
      tables: {
        orgChartNodes: [
          nodeDoc({ _id: 'root' }),
          nodeDoc({ _id: 'child', parentId: 'root', userId: 'u1', type: 'person' }),
          nodeDoc({ _id: 'orphan', parentId: 'missing' }),
        ],
        users: [{ _id: 'u1', name: 'Jane', department: 'Eng', organizationId: ORG }],
      },
    });

    const result = await handlers.debugOrgChart(ctx, { organizationId: ORG });

    expect(result.totalNodes).toBe(3);
    expect(result.flatNodes).toHaveLength(3);
    expect(result.tree.map((r: any) => r._id)).toEqual(['root', 'orphan']);
    expect(result.tree[0].children[0]).toMatchObject({ _id: 'child', userDepartment: 'Eng' });
  });
});
