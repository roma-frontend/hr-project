/**
 * Deep coverage for the mutation surface of convex/tasks.ts:
 * bulk edit/delete, manual ordering, subtasks, co-assignees, watchers, status,
 * custom-field writes, restore and the comment-count backfill.
 *
 * Convex's `q`/index plumbing is mocked with a small in-memory query builder so
 * the handlers can be driven directly with `ctx` + args.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  mutation: ({ handler, args }: any) => ({ handler, args }),
  query: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
  internalQuery: ({ handler, args }: any) => ({ handler, args }),
  httpAction: (h: any) => h,
}));

jest.mock('../../convex/lib/getAuthCaller', () => ({ getAuthCaller: jest.fn() }));
jest.mock('../../convex/lib/auth', () => ({ isSuperadmin: jest.fn(() => false) }));
jest.mock('../../convex/lib/userProfile', () => ({ getProfile: jest.fn(async () => null) }));
jest.mock('../../convex/lib/notify', () => ({ notify: jest.fn(async () => undefined) }));
jest.mock('../../convex/lib/entitlements', () => ({
  assertModuleAccess: jest.fn(async () => undefined),
}));
jest.mock('../../convex/lib/reportingLine', () => ({
  getSubordinateIds: jest.fn(async () => []),
  resolveSupervisorId: jest.fn(async () => null),
}));
jest.mock('../../convex/lib/points', () => ({
  creditBalance: jest.fn(async () => undefined),
  resolveRecognitionSettings: jest.fn(async () => ({ attendanceReward: 0 })),
}));
jest.mock('../../convex/lib/systemAccounts', () => ({
  isSystemAccountEmail: jest.fn(() => false),
}));

const getAuthCaller = jest.requireMock('../../convex/lib/getAuthCaller').getAuthCaller as jest.Mock;
const reportingLine = jest.requireMock('../../convex/lib/reportingLine') as Record<
  string,
  jest.Mock
>;
const notify = jest.requireMock('../../convex/lib/notify').notify as jest.Mock;

type Handler = (ctx: any, args: any) => Promise<unknown>;
const handlers: Record<string, Handler> = {};
{
  const mod = require('../../convex/tasks');
  for (const [name, def] of Object.entries(mod)) {
    if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
      handlers[name] = (def as any).handler;
    }
  }
}

const ORG = 'org1';
const CALLER_ID = 'caller1';

function callerDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: CALLER_ID,
    name: 'Admin',
    email: 'caller@example.com',
    role: 'admin',
    organizationId: ORG,
    ...overrides,
  };
}

function taskDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'task1',
    title: 'Task',
    assignedTo: 'worker1',
    assignedBy: CALLER_ID,
    organizationId: ORG,
    status: 'pending',
    statusKey: 'pending',
    priority: 'medium',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

/**
 * In-memory stand-in for `ctx.db`. Rows are filtered by the `eq` constraints
 * captured from `withIndex`/`filter` callbacks; `.unique()`, `.first()`,
 * `.take()`, `.paginate()` and `order()` complete the read chain.
 */
function makeCtx(
  opts: {
    docs?: Record<string, unknown>;
    tables?: Record<string, any[]>;
  } = {},
) {
  const docs = opts.docs ?? {};
  const baseTables = opts.tables ?? {};
  const inserts: Array<[string, any]> = [];
  const patches: Array<[string, any]> = [];
  const deletes: string[] = [];

  const get = jest.fn(async (id: string) => docs[id] ?? null);
  const normalizeId = jest.fn((_table: string, id: string) =>
    /^[A-Za-z0-9_-]+$/.test(id) ? id : null,
  );
  const insert = jest.fn(async (table: string, doc: any) => {
    inserts.push([table, doc]);
    return `${table}_new_${inserts.length}`;
  });
  const patch = jest.fn(async (id: string, fields: any) => {
    patches.push([id, fields]);
  });
  const remove = jest.fn(async (id: string) => {
    deletes.push(id);
  });

  const query = jest.fn((table: string) => {
    const rows = baseTables[table] ?? [];
    const filters: Record<string, unknown> = {};
    const makeQ = (): any =>
      new Proxy(
        {},
        {
          get: (_t, prop) => {
            if (prop === 'field') return (name: string) => name;
            if (prop === 'eq') {
              return (k: string, value: unknown) => {
                filters[k] = value;
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
      withIndex: (_name: string, cb?: (q: unknown) => unknown) => {
        if (typeof cb === 'function') cb(makeQ());
        return chain;
      },
      filter: (cb?: (q: unknown) => unknown) => {
        if (typeof cb === 'function') cb(makeQ());
        return chain;
      },
      order: () => chain,
      take: jest.fn(async (n: number) => matched().slice(0, n)),
      collect: jest.fn(async () => matched()),
      first: jest.fn(async () => matched()[0] ?? null),
      unique: jest.fn(async () => matched()[0] ?? null),
      paginate: jest.fn(async () => ({
        page: matched(),
        isDone: true,
        continueCursor: '',
      })),
    };
    return chain;
  });

  return {
    ctx: {
      db: { get, insert, patch, delete: remove, normalizeId, query },
      scheduler: { runAfter: jest.fn(async () => undefined) },
    },
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
  getAuthCaller.mockResolvedValue(callerDoc());
  reportingLine.getSubordinateIds.mockResolvedValue([]);
  reportingLine.resolveSupervisorId.mockResolvedValue(null);
  (jest.requireMock('../../convex/lib/auth').isSuperadmin as jest.Mock).mockReturnValue(false);
});

// ── bulkUpdateTasks ──────────────────────────────────────────────────────────

describe('bulkUpdateTasks', () => {
  const bulk = (ctx: any, taskIds: string[], patch: any) =>
    handlers.bulkUpdateTasks(ctx, { taskIds, patch });

  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(bulk(ctx, ['t1'], { priority: 'high' })).rejects.toThrow('Not authenticated');
  });

  it('returns zeroes for an empty selection', async () => {
    const { ctx } = makeCtx();
    await expect(bulk(ctx, [], { priority: 'high' })).resolves.toEqual({ updated: 0, skipped: 0 });
  });

  it('refuses more than the bulk cap', async () => {
    const { ctx } = makeCtx();
    const ids = Array.from({ length: 501 }, (_, i) => `t${i}`);
    await expect(bulk(ctx, ids, { priority: 'high' })).rejects.toThrow('at most');
  });

  it('rejects an unknown assignee', async () => {
    const { ctx } = makeCtx({ docs: { [CALLER_ID]: callerDoc() } });
    await expect(bulk(ctx, ['t1'], { assignedTo: 'ghost' })).rejects.toThrow('Assignee not found');
  });

  it('rejects a cross-organization assignee', async () => {
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), u2: { _id: 'u2', organizationId: 'other' } },
    });
    await expect(bulk(ctx, ['t1'], { assignedTo: 'u2' })).rejects.toThrow('cross-organization');
  });

  it('rejects a supervisor assigning outside their team', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'supervisor' }));
    reportingLine.getSubordinateIds.mockResolvedValue(['other']);
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc({ role: 'supervisor' }),
        u2: { _id: 'u2', organizationId: ORG },
      },
    });
    await expect(bulk(ctx, ['t1'], { assignedTo: 'u2' })).rejects.toThrow('in your team');
  });

  it('rejects an unknown project', async () => {
    const { ctx } = makeCtx({ docs: { [CALLER_ID]: callerDoc() } });
    await expect(bulk(ctx, ['t1'], { projectId: 'ghost' })).rejects.toThrow(
      'Linked project not found',
    );
  });

  it('rejects a project from another organization', async () => {
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), p2: { _id: 'p2', organizationId: 'other' } },
    });
    await expect(bulk(ctx, ['t1'], { projectId: 'p2' })).rejects.toThrow(
      'does not belong to your organization',
    );
  });

  it('applies a status key, priority, deadline and project changes', async () => {
    const { ctx, patches, inserts } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), task1: taskDoc(), p1: { _id: 'p1', organizationId: ORG } },
    });

    const result = await bulk(ctx, ['task1'], {
      statusKey: 'completed',
      priority: 'urgent',
      deadline: null,
      projectId: 'p1',
      archived: true,
    });

    expect(result).toEqual({ updated: 1, skipped: 0 });
    expect(patches[0][1]).toMatchObject({
      statusKey: 'completed',
      status: 'completed',
      priority: 'urgent',
      deadline: undefined,
      projectId: 'p1',
      archivedAt: expect.any(Number),
    });
    expect(inserts.some(([t, d]) => t === 'auditLogs' && d.action === 'tasks_bulk_updated')).toBe(
      true,
    );
  });

  it('drops the custom key when setting a canonical status', async () => {
    const { ctx, patches } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), task1: taskDoc({ statusKey: 'custom' }) },
    });

    await bulk(ctx, ['task1'], { status: 'review' });

    expect(patches[0][1]).toMatchObject({ status: 'review', statusKey: undefined });
  });

  it('skips rows whose board lacks the requested status, missing rows and refused rows', async () => {
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), task1: taskDoc(), task2: null },
    });

    const result = await bulk(ctx, ['task1', 'task2', 'missing'], { statusKey: 'nope' });

    expect(result).toEqual({ updated: 0, skipped: 3 });
  });

  it('skips a task the caller may not write', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'employee', _id: CALLER_ID }));
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc({ role: 'employee', _id: CALLER_ID }),
        task1: taskDoc({ assignedTo: 'someone-else', assignedBy: 'someone-else' }),
      },
    });

    const result = await bulk(ctx, ['task1'], { priority: 'high' });
    expect(result).toEqual({ updated: 0, skipped: 1 });
  });

  it('merges tag additions and removals', async () => {
    const { ctx, patches } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), task1: taskDoc({ tags: ['alpha', 'beta'] }) },
    });

    await bulk(ctx, ['task1'], { addTags: ['gamma', 'beta'], removeTags: ['alpha'] });

    expect(patches[0][1].tags).toEqual(['beta', 'gamma']);
  });

  it('notifies a new assignee once for the whole batch', async () => {
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc(),
        u2: { _id: 'u2', organizationId: ORG },
        task1: taskDoc({ assignedTo: 'worker1' }),
        task2: taskDoc({ _id: 'task2', assignedTo: 'worker2' }),
      },
    });

    await bulk(ctx, ['task1', 'task2'], { assignedTo: 'u2' });

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'u2',
        messageKey: 'notifications.messages.tasksAssignedBulk',
      }),
    );
  });
});

// ── bulkDeleteTasks ──────────────────────────────────────────────────────────

describe('bulkDeleteTasks', () => {
  it('returns zeroes for an empty selection', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.bulkDeleteTasks(ctx, { taskIds: [] })).resolves.toEqual({
      deleted: 0,
      skipped: 0,
      subtasksDeleted: 0,
    });
  });

  it('refuses more than the bulk cap', async () => {
    const { ctx } = makeCtx();
    const ids = Array.from({ length: 501 }, (_, i) => `t${i}`);
    await expect(handlers.bulkDeleteTasks(ctx, { taskIds: ids })).rejects.toThrow('at most');
  });

  it('soft-deletes a parent and its subtasks', async () => {
    const { ctx, patches, inserts } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), task1: taskDoc() },
      tables: {
        tasks: [
          { _id: 'sub1', parentTaskId: 'task1', organizationId: ORG, title: 'Sub', createdAt: 1 },
        ],
      },
    });

    const result = await handlers.bulkDeleteTasks(ctx, { taskIds: ['task1'] });

    expect(result).toEqual({ deleted: 1, skipped: 0, subtasksDeleted: 1 });
    expect(patches.some(([id, f]) => id === 'sub1' && f.deletedAt !== undefined)).toBe(true);
    expect(patches.some(([id, f]) => id === 'task1' && f.deletedAt !== undefined)).toBe(true);
    expect(inserts.some(([t, d]) => t === 'auditLogs' && d.action === 'tasks_bulk_deleted')).toBe(
      true,
    );
  });

  it('does not look up children for a subtask', async () => {
    const { ctx, query } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), sub1: taskDoc({ _id: 'sub1', parentTaskId: 'parent' }) },
    });

    await handlers.bulkDeleteTasks(ctx, { taskIds: ['sub1'] });

    expect(query).not.toHaveBeenCalled();
  });

  it('skips missing and refused rows', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'employee' }));
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc({ role: 'employee' }),
        t1: taskDoc({ assignedTo: 'other', assignedBy: 'other' }),
      },
    });
    const result = await handlers.bulkDeleteTasks(ctx, { taskIds: ['t1', 'missing'] });
    expect(result).toEqual({ deleted: 0, skipped: 2, subtasksDeleted: 0 });
  });
});

// ── reorderTask ──────────────────────────────────────────────────────────────

describe('reorderTask', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.reorderTask(ctx, { taskId: 'task1' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the task does not exist', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.reorderTask(ctx, { taskId: 'missing' })).rejects.toThrow(
      'Task not found',
    );
  });

  it('appends when no neighbours are given', async () => {
    const { ctx, patches } = makeCtx({ docs: { [CALLER_ID]: callerDoc(), task1: taskDoc() } });
    const result = await handlers.reorderTask(ctx, { taskId: 'task1' });
    expect(result.orderKey).toBeTruthy();
    expect(patches[0][1]).toMatchObject({ orderKey: result.orderKey });
  });

  it('rejects a missing neighbour', async () => {
    const { ctx } = makeCtx({ docs: { [CALLER_ID]: callerDoc(), task1: taskDoc() } });
    await expect(handlers.reorderTask(ctx, { taskId: 'task1', beforeId: 'ghost' })).rejects.toThrow(
      'refresh and try again',
    );
  });

  it('rejects a neighbour from another list', async () => {
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc(),
        task1: taskDoc({ projectId: 'p1' }),
        other: taskDoc({ _id: 'other', projectId: 'p2' }),
      },
    });
    await expect(handlers.reorderTask(ctx, { taskId: 'task1', beforeId: 'other' })).rejects.toThrow(
      'within one list',
    );
  });

  it('repairs equal neighbour keys before placing the row', async () => {
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc(),
        task1: taskDoc({ projectId: 'p1', createdAt: 3 }),
        n1: taskDoc({ _id: 'n1', projectId: 'p1', orderKey: 'a1', createdAt: 1 }),
        n2: taskDoc({ _id: 'n2', projectId: 'p1', orderKey: 'a1', createdAt: 2 }),
      },
      tables: {
        tasks: [
          { _id: 'n1', projectId: 'p1', orderKey: 'a1', createdAt: 1 },
          { _id: 'n2', projectId: 'p1', orderKey: 'a1', createdAt: 2 },
          { _id: 'task1', projectId: 'p1', createdAt: 3 },
        ],
      },
    });

    const result = await handlers.reorderTask(ctx, {
      taskId: 'task1',
      beforeId: 'n1',
      afterId: 'n2',
    });

    expect(result.orderKey).toBeTruthy();
  });

  it('ignores a neighbour equal to the task itself', async () => {
    const { ctx } = makeCtx({ docs: { [CALLER_ID]: callerDoc(), task1: taskDoc() } });
    const result = await handlers.reorderTask(ctx, { taskId: 'task1', beforeId: 'task1' });
    expect(result.orderKey).toBeTruthy();
  });
});

// ── createSubtask / listSubtasks ─────────────────────────────────────────────

describe('createSubtask', () => {
  const baseArgs = { parentTaskId: 'parent', title: 'Child' };

  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.createSubtask(ctx, baseArgs)).rejects.toThrow('Not authenticated');
  });

  it('throws when the parent does not exist', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.createSubtask(ctx, baseArgs)).rejects.toThrow('Task not found');
  });

  it('refuses to nest a subtask under a subtask', async () => {
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), parent: taskDoc({ _id: 'parent', parentTaskId: 'grand' }) },
    });
    await expect(handlers.createSubtask(ctx, baseArgs)).rejects.toThrow('cannot have subtasks');
  });

  it('requires a non-empty title', async () => {
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), parent: taskDoc({ _id: 'parent' }) },
    });
    await expect(handlers.createSubtask(ctx, { ...baseArgs, title: '   ' })).rejects.toThrow(
      'needs a title',
    );
  });

  it('rejects a missing assignee', async () => {
    const { ctx } = makeCtx({
      docs: { [CALLER_ID]: callerDoc(), parent: taskDoc({ _id: 'parent', assignedTo: 'ghost' }) },
    });
    await expect(handlers.createSubtask(ctx, baseArgs)).rejects.toThrow('Assignee not found');
  });

  it('rejects a cross-organization assignee', async () => {
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc(),
        parent: taskDoc({ _id: 'parent' }),
        worker1: { _id: 'worker1', organizationId: 'other', role: 'employee' },
      },
    });
    await expect(handlers.createSubtask(ctx, baseArgs)).rejects.toThrow('cross-organization');
  });

  it('lets an employee only assign to themselves', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'employee', _id: 'emp1' }));
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc({ role: 'employee', _id: 'emp1' }),
        parent: taskDoc({ _id: 'parent', assignedTo: 'emp1', assignedBy: 'emp1' }),
        worker1: { _id: 'worker1', organizationId: ORG, role: 'employee' },
      },
    });
    await expect(
      handlers.createSubtask(ctx, { ...baseArgs, assignedTo: 'worker1' }),
    ).rejects.toThrow('assigned to themselves');
  });

  it('lets a supervisor assign within their team only', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'supervisor', _id: 'sup1' }));
    reportingLine.getSubordinateIds.mockResolvedValue(['other']);
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc({ role: 'supervisor', _id: 'sup1' }),
        parent: taskDoc({ _id: 'parent', assignedTo: 'sup1', assignedBy: 'sup1' }),
        worker1: { _id: 'worker1', organizationId: ORG, role: 'employee' },
      },
    });
    await expect(
      handlers.createSubtask(ctx, { ...baseArgs, assignedTo: 'worker1' }),
    ).rejects.toThrow('in your team');
  });

  it('creates the subtask, notifies the assignee and audits it', async () => {
    const { ctx, insert, inserts } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc(),
        parent: taskDoc({ _id: 'parent', assignedTo: 'worker1' }),
        worker1: { _id: 'worker1', organizationId: ORG, role: 'employee' },
      },
    });

    const id = await handlers.createSubtask(ctx, baseArgs);

    expect(id).toBeTruthy();
    expect(insert).toHaveBeenCalledWith(
      'tasks',
      expect.objectContaining({ parentTaskId: 'parent', assignedTo: 'worker1' }),
    );
    expect(notify).toHaveBeenCalled();
    expect(inserts.some(([t, d]) => t === 'auditLogs' && d.action === 'task_created')).toBe(true);
  });

  it('rejects a status key that is not on the board', async () => {
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc(),
        parent: taskDoc({ _id: 'parent' }),
        worker1: { _id: 'worker1', organizationId: ORG, role: 'employee' },
      },
    });
    await expect(handlers.createSubtask(ctx, { ...baseArgs, statusKey: 'nope' })).rejects.toThrow(
      'not on this board',
    );
  });
});

describe('listSubtasks', () => {
  it('returns [] without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.listSubtasks(ctx, { parentTaskId: 'p' })).resolves.toEqual([]);
  });

  it('returns [] for a missing parent', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.listSubtasks(ctx, { parentTaskId: 'p' })).resolves.toEqual([]);
  });

  it('returns [] when the parent is in another organization', async () => {
    const { ctx } = makeCtx({
      docs: { parent: taskDoc({ _id: 'parent', organizationId: 'other' }) },
    });
    await expect(handlers.listSubtasks(ctx, { parentTaskId: 'parent' })).resolves.toEqual([]);
  });

  it('returns the enriched children', async () => {
    const { ctx } = makeCtx({
      docs: { parent: taskDoc({ _id: 'parent' }) },
      tables: {
        tasks: [
          {
            _id: 's1',
            parentTaskId: 'parent',
            organizationId: ORG,
            title: 'A',
            assignedTo: 'worker1',
            assignedBy: CALLER_ID,
            createdAt: 2,
          },
          {
            _id: 's2',
            parentTaskId: 'parent',
            organizationId: ORG,
            title: 'B',
            assignedTo: 'worker1',
            assignedBy: CALLER_ID,
            createdAt: 1,
          },
        ],
      },
    });

    const result = (await handlers.listSubtasks(ctx, { parentTaskId: 'parent' })) as any[];
    expect(result.map((t) => t.title)).toEqual(['B', 'A']);
  });
});

// ── setAssignees ─────────────────────────────────────────────────────────────

describe('setAssignees', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.setAssignees(ctx, { taskId: 't', assigneeIds: [] })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the task is missing', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.setAssignees(ctx, { taskId: 'missing', assigneeIds: [] }),
    ).rejects.toThrow('Task not found');
  });

  it('rejects more than the co-assignee cap', async () => {
    const { ctx } = makeCtx({ docs: { task1: taskDoc() } });
    const ids = Array.from({ length: 21 }, (_, i) => `u${i}`);
    await expect(handlers.setAssignees(ctx, { taskId: 'task1', assigneeIds: ids })).rejects.toThrow(
      'more people',
    );
  });

  it('returns early when the set is unchanged', async () => {
    const { ctx, patch } = makeCtx({
      docs: {
        task1: taskDoc({ assigneeIds: ['u2'] }),
        u2: { _id: 'u2', organizationId: ORG },
      },
    });

    const result = await handlers.setAssignees(ctx, { taskId: 'task1', assigneeIds: ['u2'] });
    expect(result.assigneeIds).toEqual(['u2']);
    expect(patch).not.toHaveBeenCalled();
  });

  it('adds a co-assignee, notifies them and audits', async () => {
    const { ctx, patch, inserts } = makeCtx({
      docs: {
        task1: taskDoc(),
        u2: { _id: 'u2', organizationId: ORG },
      },
    });

    const result = await handlers.setAssignees(ctx, { taskId: 'task1', assigneeIds: ['u2'] });

    expect(result.assigneeIds).toEqual(['u2']);
    expect(patch).toHaveBeenCalledWith('task1', expect.objectContaining({ assigneeIds: ['u2'] }));
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'u2' }),
    );
    expect(
      inserts.some(([t, d]) => t === 'auditLogs' && d.action === 'task_assignees_updated'),
    ).toBe(true);
  });

  it('drops the responsible person from the co-assignee list', async () => {
    const { ctx, patch } = makeCtx({
      docs: {
        task1: taskDoc({ assignedTo: 'worker1' }),
        worker1: { _id: 'worker1', organizationId: ORG },
        u2: { _id: 'u2', organizationId: ORG },
      },
    });

    await handlers.setAssignees(ctx, { taskId: 'task1', assigneeIds: ['worker1', 'u2'] });
    expect(patch).toHaveBeenCalledWith('task1', expect.objectContaining({ assigneeIds: ['u2'] }));
  });

  it('rejects a co-assignee from another organization', async () => {
    const { ctx } = makeCtx({
      docs: { task1: taskDoc(), u2: { _id: 'u2', organizationId: 'other' } },
    });
    await expect(
      handlers.setAssignees(ctx, { taskId: 'task1', assigneeIds: ['u2'] }),
    ).rejects.toThrow('outside this organization');
  });
});

// ── setWatching ──────────────────────────────────────────────────────────────

describe('setWatching', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.setWatching(ctx, { taskId: 't', watching: true })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the task is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.setWatching(ctx, { taskId: 'missing', watching: true })).rejects.toThrow(
      'Task not found',
    );
  });

  it('lets a user watch a task they can read', async () => {
    const { ctx, patch } = makeCtx({ docs: { task1: taskDoc() } });
    const result = await handlers.setWatching(ctx, { taskId: 'task1', watching: true });
    expect(result).toEqual({ watching: true, watcherIds: [CALLER_ID] });
    expect(patch).toHaveBeenCalledWith('task1', { watcherIds: [CALLER_ID] });
  });

  it('prevents watching a task in another organization', async () => {
    const { ctx } = makeCtx({ docs: { task1: taskDoc({ organizationId: 'other' }) } });
    await expect(handlers.setWatching(ctx, { taskId: 'task1', watching: true })).rejects.toThrow(
      'another organization',
    );
  });

  it('requires write rights to watch on behalf of someone else', async () => {
    getAuthCaller.mockResolvedValue(callerDoc({ role: 'employee', _id: 'emp1' }));
    const { ctx } = makeCtx({
      docs: {
        [CALLER_ID]: callerDoc({ role: 'employee', _id: 'emp1' }),
        task1: taskDoc({ assignedTo: 'other', assignedBy: 'other' }),
        u2: { _id: 'u2', organizationId: ORG },
      },
    });
    await expect(
      handlers.setWatching(ctx, { taskId: 'task1', watching: true, userId: 'u2' }),
    ).rejects.toThrow('own tasks');
  });

  it('adds a colleague as a watcher', async () => {
    const { ctx, patch } = makeCtx({
      docs: { task1: taskDoc(), u2: { _id: 'u2', organizationId: ORG } },
    });
    const result = await handlers.setWatching(ctx, {
      taskId: 'task1',
      watching: true,
      userId: 'u2',
    });
    expect(result.watcherIds).toEqual(['u2']);
    expect(patch).toHaveBeenCalledWith('task1', { watcherIds: ['u2'] });
  });

  it('is a no-op when the watch state already matches', async () => {
    const { ctx, patch } = makeCtx({
      docs: { task1: taskDoc({ watcherIds: [CALLER_ID] }) },
    });
    const result = await handlers.setWatching(ctx, { taskId: 'task1', watching: true });
    expect(result.watching).toBe(true);
    expect(patch).not.toHaveBeenCalled();
  });

  it('removes a watcher', async () => {
    const { ctx, patch } = makeCtx({
      docs: { task1: taskDoc({ watcherIds: [CALLER_ID, 'u2'] }) },
    });
    const result = await handlers.setWatching(ctx, { taskId: 'task1', watching: false });
    expect(result.watcherIds).toEqual(['u2']);
    expect(patch).toHaveBeenCalledWith('task1', { watcherIds: ['u2'] });
  });

  it('refuses to exceed the watcher cap', async () => {
    const { ctx } = makeCtx({
      docs: {
        task1: taskDoc({ watcherIds: Array.from({ length: 50 }, (_, i) => `w${i}`) }),
      },
    });
    await expect(handlers.setWatching(ctx, { taskId: 'task1', watching: true })).rejects.toThrow(
      'as many watchers',
    );
  });
});

// ── restoreTask ──────────────────────────────────────────────────────────────

describe('restoreTask', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.restoreTask(ctx, { taskId: 't' })).rejects.toThrow('Not authenticated');
  });

  it('throws when the task is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.restoreTask(ctx, { taskId: 'missing' })).rejects.toThrow(
      'Task not found',
    );
  });

  it('throws when the task is not deleted', async () => {
    const { ctx } = makeCtx({ docs: { task1: taskDoc() } });
    await expect(handlers.restoreTask(ctx, { taskId: 'task1' })).rejects.toThrow('not deleted');
  });

  it('restores a deleted task and audits it', async () => {
    const { ctx, patch, inserts } = makeCtx({
      docs: { task1: taskDoc({ deletedAt: 123 }) },
    });

    await handlers.restoreTask(ctx, { taskId: 'task1' });

    expect(patch).toHaveBeenCalledWith('task1', { deletedAt: undefined });
    expect(inserts.some(([t, d]) => t === 'auditLogs' && d.action === 'task_restored')).toBe(true);
  });
});

// ── setTaskStatus / updateTaskFields ─────────────────────────────────────────

describe('setTaskStatus', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(
      handlers.setTaskStatus(ctx, { taskId: 't', statusKey: 'pending' }),
    ).rejects.toThrow('Not authenticated');
  });

  it('throws when the task is missing', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.setTaskStatus(ctx, { taskId: 'missing', statusKey: 'pending' }),
    ).rejects.toThrow('Task not found');
  });

  it('rejects a status key that is not on the board', async () => {
    const { ctx } = makeCtx({ docs: { task1: taskDoc() } });
    await expect(
      handlers.setTaskStatus(ctx, { taskId: 'task1', statusKey: 'nope' }),
    ).rejects.toThrow('not on this board');
  });

  it('moves the task and notifies watchers', async () => {
    const { ctx, patch, inserts } = makeCtx({
      docs: {
        task1: taskDoc({ watcherIds: ['w1'], assignedTo: 'worker1' }),
      },
    });

    const result = await handlers.setTaskStatus(ctx, { taskId: 'task1', statusKey: 'completed' });

    expect(result).toEqual({ status: 'completed', statusKey: 'completed' });
    expect(patch).toHaveBeenCalledWith(
      'task1',
      expect.objectContaining({ status: 'completed', completedAt: expect.any(Number) }),
    );
    expect(notify).toHaveBeenCalled();
    expect(inserts.some(([t, d]) => t === 'auditLogs' && d.action === 'task_status_updated')).toBe(
      true,
    );
  });

  it('notifies the supervisor on a review handoff', async () => {
    reportingLine.resolveSupervisorId.mockResolvedValue('sup1');
    const { ctx } = makeCtx({
      docs: {
        task1: taskDoc({ assignedBy: 'emp0' }),
        [CALLER_ID]: callerDoc(),
        emp0: callerDoc({ _id: 'emp0', role: 'employee' }),
        sup1: { _id: 'sup1', organizationId: ORG, role: 'supervisor' },
      },
    });

    await handlers.setTaskStatus(ctx, { taskId: 'task1', statusKey: 'review' });

    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'sup1',
        messageKey: 'notifications.messages.taskSubmittedForReview',
      }),
    );
  });

  it('does not restate completedAt when already completed', async () => {
    const { ctx, patch } = makeCtx({
      docs: { task1: taskDoc({ status: 'completed', completedAt: 555 }) },
    });

    await handlers.setTaskStatus(ctx, { taskId: 'task1', statusKey: 'completed' });

    expect(patch).toHaveBeenCalledWith('task1', expect.objectContaining({ completedAt: 555 }));
  });
});

describe('updateTaskFields', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.updateTaskFields(ctx, { taskId: 't', values: {} })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the task is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.updateTaskFields(ctx, { taskId: 'missing', values: {} })).rejects.toThrow(
      'Task not found',
    );
  });

  it('validates and writes a custom field value', async () => {
    const { ctx, patch, inserts } = makeCtx({
      docs: { task1: taskDoc() },
      tables: {
        taskFields: [
          {
            _id: 'f1',
            name: 'Note',
            type: 'text',
            isActive: true,
            required: false,
            order: 0,
            organizationId: ORG,
          },
        ],
      },
    });

    const result = await handlers.updateTaskFields(ctx, { taskId: 'task1', values: { f1: 'hi' } });

    expect(result).toEqual({ f1: 'hi' });
    expect(patch).toHaveBeenCalledWith(
      'task1',
      expect.objectContaining({ customFields: { f1: 'hi' } }),
    );
    expect(inserts.some(([t, d]) => t === 'auditLogs' && d.action === 'task_fields_updated')).toBe(
      true,
    );
  });

  it('refuses to clear a touched required column', async () => {
    const { ctx } = makeCtx({
      docs: { task1: taskDoc() },
      tables: {
        taskFields: [
          {
            _id: 'f1',
            name: 'Priority',
            type: 'text',
            isActive: true,
            required: true,
            order: 0,
            organizationId: ORG,
          },
        ],
      },
    });

    await expect(
      handlers.updateTaskFields(ctx, { taskId: 'task1', values: { f1: '' } }),
    ).rejects.toThrow('required');
  });

  it('rejects an unknown column', async () => {
    const { ctx } = makeCtx({ docs: { task1: taskDoc() } });
    await expect(
      handlers.updateTaskFields(ctx, { taskId: 'task1', values: { nope: 'x' } }),
    ).rejects.toThrow('Unknown column');
  });
});

// ── backfillTaskCommentCounts ────────────────────────────────────────────────

describe('backfillTaskCommentCounts', () => {
  it('patches comment counts for the returned page', async () => {
    const { ctx, patch } = makeCtx({
      tables: {
        tasks: [
          { _id: 't1', title: 'A' },
          { _id: 't2', title: 'B' },
        ],
        taskComments: [{ _id: 'c1', taskId: 't1' }],
      },
    });

    const result = await handlers.backfillTaskCommentCounts(ctx, {});

    expect(result).toEqual({ done: true, cursor: '', patched: 2 });
    expect(patch).toHaveBeenCalledWith('t1', { commentCount: 1 });
    expect(patch).toHaveBeenCalledWith('t2', { commentCount: 0 });
  });
});
