/**
 * Coverage for convex/recurringTasks.ts — create/update/toggle/delete, the
 * materialization sweep, listings and comment threads.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  query: ({ handler, args }: any) => ({ handler, args }),
  mutation: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
}));

jest.mock('../../convex/lib/getAuthCaller', () => ({ getAuthCaller: jest.fn() }));
jest.mock('../../convex/lib/auth', () => ({ isSuperadmin: jest.fn(() => false) }));
jest.mock('../../convex/lib/reportingLine', () => ({
  getVisibleUserIds: jest.fn(async () => new Set<string>()),
}));
jest.mock('../../convex/lib/notify', () => ({ notify: jest.fn(async () => undefined) }));
jest.mock('../../convex/lib/sanitize', () => ({
  sanitizeTitle: jest.fn((s: string) => s.trim()),
  sanitizeText: jest.fn((s: string) => s.trim()),
}));
jest.mock('../../convex/lib/limits', () => ({ DEFAULT_LIST_CAP: 2000, SMALL_LIST_CAP: 500 }));
jest.mock('../../convex/lib/recurrence', () => ({
  validateRule: jest.fn(() => null),
  nextOccurrence: jest.fn(() => '2026-09-11'),
  occursOnDay: jest.fn(() => true),
}));
jest.mock('../../convex/lib/entitlements', () => ({
  assertModuleAccess: jest.fn(async () => undefined),
}));
jest.mock('../../convex/lib/taskConfig', () => ({
  MAX_ASSIGNEES: 20,
  assertRequiredFields: jest.fn(),
  assertUsersInOrg: jest.fn(async (_ctx: unknown, ids: unknown) => ids),
  buildCustomFieldsPatch: jest.fn(async (_ctx: unknown, { values }: any) => values),
  listFieldsFor: jest.fn(async () => []),
  readCustomFields: jest.fn((raw: unknown) => (raw && typeof raw === 'object' ? raw : {})),
  resolveStatusSet: jest.fn(async () => ({
    statuses: [
      { key: 'pending', type: 'todo', label: 'Pending' },
      { key: 'done', type: 'done', label: 'Done' },
    ],
    source: 'default',
  })),
}));
jest.mock('../../convex/lib/taskStatus', () => {
  const map: Record<string, string> = {
    todo: 'pending',
    active: 'in_progress',
    review: 'review',
    done: 'completed',
  };
  return {
    canonicalFor: jest.fn((key: string, statuses: any[]) => {
      const s = statuses.find((x) => x.key === key);
      return map[s?.type] ?? 'pending';
    }),
    firstOpenStatus: jest.fn(
      (statuses: any[]) => statuses.find((s) => s.type === 'todo') ?? statuses[0],
    ),
    STATUS_TYPE_TO_CANONICAL: map,
  };
});

const getAuthCaller = jest.requireMock('../../convex/lib/getAuthCaller').getAuthCaller as jest.Mock;
const isSuperadmin = jest.requireMock('../../convex/lib/auth').isSuperadmin as jest.Mock;
const reportingLine = jest.requireMock('../../convex/lib/reportingLine') as Record<
  string,
  jest.Mock
>;
const recurrence = jest.requireMock('../../convex/lib/recurrence') as Record<string, jest.Mock>;
const notify = jest.requireMock('../../convex/lib/notify').notify as jest.Mock;

type Handler = (ctx: any, args: any) => Promise<any>;
const handlers: Record<string, Handler> = {};
{
  const mod = require('../../convex/recurringTasks');
  for (const [name, def] of Object.entries(mod)) {
    if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
      handlers[name] = (def as any).handler;
    }
  }
}

const ORG = 'org1';
const CALLER_ID = 'caller1';
const ASSIGNEE_ID = 'assignee1';

function adminCaller(overrides: Record<string, unknown> = {}) {
  return { _id: CALLER_ID, name: 'Admin', role: 'admin', organizationId: ORG, ...overrides };
}

function seriesDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 's1',
    organizationId: ORG,
    title: 'Weekly report',
    assignedTo: ASSIGNEE_ID,
    assignedBy: CALLER_ID,
    priority: 'medium',
    frequency: 'weekly',
    daysOfWeek: [1],
    startDate: '2026-01-01',
    isActive: true,
    generatedCount: 0,
    status: 'pending',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeCtx(
  opts: {
    docs?: Record<string, unknown>;
    tables?: Record<string, any[]>;
  } = {},
) {
  const docs = opts.docs ?? {};
  const tables = opts.tables ?? {};
  const inserts: Array<[string, any]> = [];
  const patches: Array<[string, any]> = [];
  const deletes: string[] = [];
  let insertSeq = 0;

  const get = jest.fn(async (id: string) => docs[id] ?? null);
  const insert = jest.fn(async (table: string, doc: any) => {
    inserts.push([table, doc]);
    const id = (doc && doc._id) || `${table}_new_${++insertSeq}`;
    if (table === 'recurringTasks') docs[String(id)] = { ...doc, _id: id };
    return id;
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

const baseCreate = {
  title: 'Weekly report',
  assignedTo: ASSIGNEE_ID,
  priority: 'medium',
  frequency: 'weekly',
  daysOfWeek: [1],
  startDate: '2026-01-01',
};

beforeEach(() => {
  jest.clearAllMocks();
  getAuthCaller.mockResolvedValue(adminCaller());
  isSuperadmin.mockReturnValue(false);
  recurrence.validateRule.mockReturnValue(null);
  recurrence.nextOccurrence.mockReturnValue('2026-09-11');
  recurrence.occursOnDay.mockReturnValue(true);
  reportingLine.getVisibleUserIds.mockResolvedValue(new Set());
  notify.mockResolvedValue(undefined);
});

// ── createRecurringTask ──────────────────────────────────────────────────────

describe('createRecurringTask', () => {
  function createCtx(extra: Record<string, unknown> = {}) {
    return makeCtx({
      docs: {
        [ASSIGNEE_ID]: { _id: ASSIGNEE_ID, organizationId: ORG, isActive: true, name: 'A' },
        s1: seriesDoc(),
        ...extra,
      },
    });
  }

  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.createRecurringTask(ctx, baseCreate)).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('restricts an employee to themselves', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ role: 'employee' }));
    const { ctx } = makeCtx();
    await expect(handlers.createRecurringTask(ctx, baseCreate)).rejects.toThrow(
      'assigned to themselves',
    );
  });

  it('rejects a non-manager role', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ role: 'driver' }));
    const { ctx } = makeCtx();
    await expect(handlers.createRecurringTask(ctx, baseCreate)).rejects.toThrow(
      'Only an admin or supervisor',
    );
  });

  it('requires an organization', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ organizationId: undefined }));
    const { ctx } = makeCtx();
    await expect(handlers.createRecurringTask(ctx, baseCreate)).rejects.toThrow('organization');
  });

  it('rejects a missing assignee', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.createRecurringTask(ctx, baseCreate)).rejects.toThrow(
      'Assignee not found',
    );
  });

  it('rejects an assignee from another organization', async () => {
    const { ctx } = makeCtx({
      docs: { [ASSIGNEE_ID]: { _id: ASSIGNEE_ID, organizationId: 'other', isActive: true } },
    });
    await expect(handlers.createRecurringTask(ctx, baseCreate)).rejects.toThrow(
      'cross-organization',
    );
  });

  it('rejects a missing project', async () => {
    const { ctx } = createCtx();
    await expect(
      handlers.createRecurringTask(ctx, { ...baseCreate, projectId: 'p1' }),
    ).rejects.toThrow('Linked project not found');
  });

  it('rejects a project from another organization', async () => {
    const { ctx } = createCtx({ p1: { _id: 'p1', organizationId: 'other' } });
    await expect(
      handlers.createRecurringTask(ctx, { ...baseCreate, projectId: 'p1' }),
    ).rejects.toThrow('Project does not belong');
  });

  it('rejects a missing objective', async () => {
    const { ctx } = createCtx();
    await expect(
      handlers.createRecurringTask(ctx, { ...baseCreate, objectiveId: 'o1' }),
    ).rejects.toThrow('Linked objective not found');
  });

  it('rejects a missing key result', async () => {
    const { ctx } = createCtx({ o1: { _id: 'o1', organizationId: ORG } });
    await expect(
      handlers.createRecurringTask(ctx, { ...baseCreate, objectiveId: 'o1', keyResultId: 'k1' }),
    ).rejects.toThrow('Linked key result not found');
  });

  it('rejects a mismatched key result', async () => {
    const { ctx } = createCtx({
      o1: { _id: 'o1', organizationId: ORG },
      k1: { _id: 'k1', objectiveId: 'other' },
    });
    await expect(
      handlers.createRecurringTask(ctx, { ...baseCreate, objectiveId: 'o1', keyResultId: 'k1' }),
    ).rejects.toThrow('does not belong to the specified objective');
  });

  it('maps a rule error to its message', async () => {
    recurrence.validateRule.mockReturnValue('NO_WEEKDAYS');
    const { ctx } = createCtx();
    await expect(handlers.createRecurringTask(ctx, baseCreate)).rejects.toThrow('weekday');
  });

  it('rejects a negative deadline offset', async () => {
    const { ctx } = createCtx();
    await expect(
      handlers.createRecurringTask(ctx, { ...baseCreate, deadlineOffsetDays: -1 }),
    ).rejects.toThrow('deadline offset');
  });

  it('creates a series, materializes today and audits it', async () => {
    const { ctx, insert } = createCtx();
    const result = await handlers.createRecurringTask(ctx, baseCreate);

    expect(result.seriesId).toBeTruthy();
    expect(result.firstTaskId).toBeTruthy();
    expect(insert).toHaveBeenCalledWith(
      'recurringTasks',
      expect.objectContaining({ title: 'Weekly report' }),
    );
    expect(insert).toHaveBeenCalledWith(
      'tasks',
      expect.objectContaining({ recurringTaskId: expect.stringMatching(/^recurringTasks_new_/) }),
    );
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'recurring_task_created' }),
    );
    expect(notify).toHaveBeenCalled();
  });
});

describe('rule error messages', () => {
  const cases: Array<[string, RegExp]> = [
    ['INVALID_START_DATE', /start date/],
    ['INVALID_END_DATE', /end date/],
    ['END_BEFORE_START', /before the start/],
    ['NO_WEEKDAYS', /weekday/],
    ['INVALID_WEEKDAY', /Sunday/],
    ['DUPLICATE_WEEKDAY', /listed twice/],
    ['INVALID_DAY_OF_MONTH', /day of the month/],
    ['SOMETHING_ELSE', /cannot be used/],
  ];

  it.each(cases)('renders %s', async (code, pattern) => {
    recurrence.validateRule.mockReturnValue(code);
    const { ctx } = makeCtx({
      docs: { [ASSIGNEE_ID]: { _id: ASSIGNEE_ID, organizationId: ORG, isActive: true } },
    });
    await expect(handlers.createRecurringTask(ctx, baseCreate)).rejects.toThrow(pattern);
  });
});

// ── listRecurringTasks ───────────────────────────────────────────────────────

describe('listRecurringTasks', () => {
  it('returns [] without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.listRecurringTasks(ctx, {})).resolves.toEqual([]);
  });

  it('returns [] without an organization', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ organizationId: undefined }));
    const { ctx } = makeCtx();
    await expect(handlers.listRecurringTasks(ctx, {})).resolves.toEqual([]);
  });

  it('returns [] for a cross-organization caller', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ organizationId: 'other' }));
    const { ctx } = makeCtx();
    await expect(handlers.listRecurringTasks(ctx, { organizationId: ORG })).resolves.toEqual([]);
  });

  it('decorates the series for staff', async () => {
    const { ctx } = makeCtx({
      docs: { [ASSIGNEE_ID]: { _id: ASSIGNEE_ID, name: 'A', avatarUrl: 'a.png' } },
      tables: { recurringTasks: [seriesDoc()] },
    });

    const result = await handlers.listRecurringTasks(ctx, {});

    expect(result[0]).toMatchObject({ assignedToName: 'A', assignedToAvatar: 'a.png' });
  });

  it('filters non-staff to their visible subtree', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ role: 'employee' }));
    reportingLine.getVisibleUserIds.mockResolvedValue(new Set([ASSIGNEE_ID]));
    const { ctx } = makeCtx({
      tables: {
        recurringTasks: [
          seriesDoc({ _id: 'mine' }),
          seriesDoc({ _id: 'theirs', assignedTo: 'other', assignedBy: 'other' }),
        ],
      },
    });

    const result = await handlers.listRecurringTasks(ctx, {});
    expect(result.map((r: any) => r._id)).toEqual(['mine']);
  });

  it('matches a co-assignee in the subtree', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ role: 'employee' }));
    reportingLine.getVisibleUserIds.mockResolvedValue(new Set(['co1']));
    const { ctx } = makeCtx({
      tables: {
        recurringTasks: [
          seriesDoc({ _id: 'co', assignedTo: 'other', assignedBy: 'other', assigneeIds: ['co1'] }),
        ],
      },
    });

    const result = await handlers.listRecurringTasks(ctx, {});
    expect(result.map((r: any) => r._id)).toEqual(['co']);
  });

  it('hides inactive series unless includeInactive is set', async () => {
    const { ctx } = makeCtx({
      tables: { recurringTasks: [seriesDoc({ isActive: false })] },
    });

    await expect(handlers.listRecurringTasks(ctx, {})).resolves.toEqual([]);
    const all = await handlers.listRecurringTasks(ctx, { includeInactive: true });
    expect(all).toHaveLength(1);
    expect(all[0].nextOccurrence).toBeNull();
  });
});

describe('getRecurringTaskOccurrences', () => {
  it('returns [] without a caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.getRecurringTaskOccurrences(ctx, { seriesId: 's1' })).resolves.toEqual(
      [],
    );
  });

  it('returns [] when the series is missing', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.getRecurringTaskOccurrences(ctx, { seriesId: 'missing' }),
    ).resolves.toEqual([]);
  });

  it('returns [] for a cross-org caller', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ organizationId: 'other' }));
    const { ctx } = makeCtx({ docs: { s1: seriesDoc() } });
    await expect(handlers.getRecurringTaskOccurrences(ctx, { seriesId: 's1' })).resolves.toEqual(
      [],
    );
  });

  it('blocks a non-staff caller with no connection to the series', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ role: 'employee' }));
    reportingLine.getVisibleUserIds.mockResolvedValue(new Set(['stranger']));
    const { ctx } = makeCtx({ docs: { s1: seriesDoc() } });
    await expect(handlers.getRecurringTaskOccurrences(ctx, { seriesId: 's1' })).resolves.toEqual(
      [],
    );
  });

  it('returns the occurrences for staff', async () => {
    const { ctx } = makeCtx({
      docs: { s1: seriesDoc() },
      tables: { tasks: [{ _id: 't1', recurringTaskId: 's1' }] },
    });
    const result = await handlers.getRecurringTaskOccurrences(ctx, { seriesId: 's1' });
    expect(result).toHaveLength(1);
  });
});

// ── updateRecurringTask ──────────────────────────────────────────────────────

describe('updateRecurringTask', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.updateRecurringTask(ctx, { seriesId: 's1' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the series is missing', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.updateRecurringTask(ctx, { seriesId: 'missing' })).rejects.toThrow(
      'Recurring task not found',
    );
  });

  it('rejects a cross-organization caller', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ organizationId: 'other' }));
    const { ctx } = makeCtx({ docs: { s1: seriesDoc() } });
    await expect(handlers.updateRecurringTask(ctx, { seriesId: 's1' })).rejects.toThrow(
      'cross-organization',
    );
  });

  it('rejects a non-manager who does not own the series', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ role: 'employee', _id: 'other' }));
    const { ctx } = makeCtx({ docs: { s1: seriesDoc() } });
    await expect(handlers.updateRecurringTask(ctx, { seriesId: 's1' })).rejects.toThrow(
      'Only an admin or supervisor',
    );
  });

  it('rejects a new assignee in another organization', async () => {
    const { ctx } = makeCtx({
      docs: { s1: seriesDoc(), u2: { _id: 'u2', organizationId: 'other' } },
    });
    await expect(
      handlers.updateRecurringTask(ctx, { seriesId: 's1', assignedTo: 'u2' }),
    ).rejects.toThrow('cross-organization');
  });

  it('rejects a project in another organization', async () => {
    const { ctx } = makeCtx({
      docs: { s1: seriesDoc(), p1: { _id: 'p1', organizationId: 'other' } },
    });
    await expect(
      handlers.updateRecurringTask(ctx, { seriesId: 's1', projectId: 'p1' }),
    ).rejects.toThrow('Project does not belong');
  });

  it('rejects an objective in another organization', async () => {
    const { ctx } = makeCtx({
      docs: { s1: seriesDoc(), o1: { _id: 'o1', organizationId: 'other' } },
    });
    await expect(
      handlers.updateRecurringTask(ctx, { seriesId: 's1', objectiveId: 'o1' }),
    ).rejects.toThrow('Objective does not belong');
  });

  it('rejects a mismatched key result', async () => {
    const { ctx } = makeCtx({
      docs: {
        s1: seriesDoc(),
        o1: { _id: 'o1', organizationId: ORG },
        k1: { _id: 'k1', objectiveId: 'other' },
      },
    });
    await expect(
      handlers.updateRecurringTask(ctx, { seriesId: 's1', objectiveId: 'o1', keyResultId: 'k1' }),
    ).rejects.toThrow('Key result does not belong');
  });

  it('rejects an invalid merged rule', async () => {
    recurrence.validateRule.mockReturnValue('END_BEFORE_START');
    const { ctx } = makeCtx({ docs: { s1: seriesDoc() } });
    await expect(
      handlers.updateRecurringTask(ctx, { seriesId: 's1', endDate: '2027-01-01' }),
    ).rejects.toThrow('before the start');
  });

  it('patches the series and audits the change', async () => {
    const { ctx, patch, insert } = makeCtx({ docs: { s1: seriesDoc() } });
    const result = await handlers.updateRecurringTask(ctx, {
      seriesId: 's1',
      title: '  Renamed  ',
      priority: 'high',
      statusKey: 'done',
      assigneeIds: ['co1'],
    });

    expect(result).toEqual({ success: true });
    expect(patch).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ title: 'Renamed', priority: 'high' }),
    );
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'recurring_task_updated' }),
    );
  });

  it('keeps the original uploader for a surviving attachment', async () => {
    const { ctx, patch } = makeCtx({
      docs: {
        s1: seriesDoc({
          attachments: [
            { url: 'a.pdf', name: 'A', type: 'pdf', size: 1, uploadedBy: 'orig', uploadedAt: 5 },
          ],
        }),
      },
    });

    await handlers.updateRecurringTask(ctx, {
      seriesId: 's1',
      attachments: [
        { url: 'a.pdf', name: 'A', type: 'pdf', size: 1 },
        { url: 'b.pdf', name: 'B', type: 'pdf', size: 2 },
      ],
    });

    const patched = (patch.mock.calls.at(-1) as any)[1];
    expect(patched.attachments[0]).toMatchObject({ uploadedBy: 'orig', uploadedAt: 5 });
    expect(patched.attachments[1].uploadedBy).toBe(CALLER_ID);
  });

  it('switches weekly to monthly and clears the weekdays', async () => {
    const { ctx, patch } = makeCtx({ docs: { s1: seriesDoc() } });
    await handlers.updateRecurringTask(ctx, {
      seriesId: 's1',
      frequency: 'monthly',
      dayOfMonth: 5,
    });
    const patched = (patch.mock.calls.at(-1) as any)[1];
    expect(patched.daysOfWeek).toBeUndefined();
    expect(patched.dayOfMonth).toBe(5);
  });
});

// ── toggle / status / delete ─────────────────────────────────────────────────

describe('toggleRecurringTask', () => {
  it('pauses the series', async () => {
    const { ctx, patch, insert } = makeCtx({ docs: { s1: seriesDoc() } });
    const result = await handlers.toggleRecurringTask(ctx, { seriesId: 's1', isActive: false });
    expect(result).toEqual({ success: true, isActive: false });
    expect(patch).toHaveBeenCalledWith('s1', expect.objectContaining({ isActive: false }));
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'recurring_task_paused' }),
    );
  });

  it('resumes the series', async () => {
    const { ctx, insert } = makeCtx({ docs: { s1: seriesDoc({ isActive: false }) } });
    await handlers.toggleRecurringTask(ctx, { seriesId: 's1', isActive: true });
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'recurring_task_resumed' }),
    );
  });

  it('rejects a missing series', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.toggleRecurringTask(ctx, { seriesId: 'missing', isActive: true }),
    ).rejects.toThrow('Recurring task not found');
  });
});

describe('updateRecurringTaskStatus', () => {
  it('is a no-op when the status is unchanged', async () => {
    const { ctx, patch } = makeCtx({ docs: { s1: seriesDoc({ status: 'pending' }) } });
    const result = await handlers.updateRecurringTaskStatus(ctx, {
      seriesId: 's1',
      status: 'pending',
    });
    expect(result).toEqual({ success: true });
    expect(patch).not.toHaveBeenCalled();
  });

  it('updates the status and syncs the matching key', async () => {
    const { ctx, patch, insert } = makeCtx({ docs: { s1: seriesDoc({ status: 'pending' }) } });
    await handlers.updateRecurringTaskStatus(ctx, { seriesId: 's1', status: 'completed' });

    expect(patch).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ status: 'completed', statusKey: 'done' }),
    );
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'recurring_task_status_changed' }),
    );
  });

  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(
      handlers.updateRecurringTaskStatus(ctx, { seriesId: 's1', status: 'completed' }),
    ).rejects.toThrow('Not authenticated');
  });
});

describe('deleteRecurringTask', () => {
  it('detaches produced tasks and deletes the comments', async () => {
    const { ctx, patch, remove, insert } = makeCtx({
      docs: { s1: seriesDoc() },
      tables: {
        tasks: [{ _id: 't1', recurringTaskId: 's1' }],
        recurringTaskComments: [{ _id: 'c1', seriesId: 's1' }],
      },
    });

    const result = await handlers.deleteRecurringTask(ctx, { seriesId: 's1' });

    expect(result).toEqual({ success: true, detachedTasks: 1 });
    expect(patch).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ recurringTaskId: undefined }),
    );
    expect(remove).toHaveBeenCalledWith('c1');
    expect(remove).toHaveBeenCalledWith('s1');
    expect(insert).toHaveBeenCalledWith(
      'auditLogs',
      expect.objectContaining({ action: 'recurring_task_deleted' }),
    );
  });

  it('rejects a missing series', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.deleteRecurringTask(ctx, { seriesId: 'missing' })).rejects.toThrow(
      'Recurring task not found',
    );
  });
});

// ── materialization sweep ────────────────────────────────────────────────────

describe('generateDueRecurringTasks', () => {
  it('materializes a due series and reports the count', async () => {
    const { ctx, insert } = makeCtx({
      docs: { [ASSIGNEE_ID]: { _id: ASSIGNEE_ID, organizationId: ORG, isActive: true } },
      tables: { recurringTasks: [seriesDoc()] },
    });

    const result = await handlers.generateDueRecurringTasks(ctx, {});

    expect(result.generated).toBe(1);
    expect(insert).toHaveBeenCalledWith(
      'tasks',
      expect.objectContaining({ recurringTaskId: 's1' }),
    );
  });

  it('counts a throwing series as skipped without aborting', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctx } = makeCtx({
      tables: { recurringTasks: [seriesDoc()] },
    });

    recurrence.occursOnDay.mockImplementation(() => {
      throw new Error('bad rule');
    });

    const result = await handlers.generateDueRecurringTasks(ctx, {});

    expect(result.skipped).toBe(1);
    expect(result.generated).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('skips a paused series', async () => {
    const { ctx } = makeCtx({ tables: { recurringTasks: [seriesDoc({ isActive: false })] } });
    // by_active index would not return it, but materializeIfDue guards anyway.
    const result = await handlers.generateDueRecurringTasks(ctx, {});
    expect(result.skipped).toBe(0);
  });

  it('skips a series already generated today', async () => {
    const { orgDayKey } = require('../../convex/lib/orgDays');
    const { ctx } = makeCtx({
      tables: { recurringTasks: [seriesDoc({ lastGeneratedKey: orgDayKey() })] },
    });
    const result = await handlers.generateDueRecurringTasks(ctx, {});
    expect(result.generated).toBe(0);
  });

  it('skips a series whose assignee left', async () => {
    const { ctx } = makeCtx({
      docs: { [ASSIGNEE_ID]: { _id: ASSIGNEE_ID, organizationId: ORG, isActive: false } },
      tables: { recurringTasks: [seriesDoc()] },
    });
    const result = await handlers.generateDueRecurringTasks(ctx, {});
    expect(result.generated).toBe(0);
  });

  it('skips a series when the assignee moved organizations', async () => {
    const { ctx } = makeCtx({
      docs: { [ASSIGNEE_ID]: { _id: ASSIGNEE_ID, organizationId: 'other', isActive: true } },
      tables: { recurringTasks: [seriesDoc()] },
    });
    const result = await handlers.generateDueRecurringTasks(ctx, {});
    expect(result.generated).toBe(0);
  });

  it('applies deadline and start offsets and stamps templates', async () => {
    const { ctx, insert } = makeCtx({
      docs: { [ASSIGNEE_ID]: { _id: ASSIGNEE_ID, organizationId: ORG, isActive: true } },
      tables: {
        recurringTasks: [
          seriesDoc({
            deadlineOffsetDays: 2,
            startOffsetDays: 1,
            subtaskTemplates: [{ title: 'Step' }, { title: '  ' }],
            checklistTemplates: [{ title: 'Check' }, { title: '  ' }],
          }),
        ],
      },
    });

    await handlers.generateDueRecurringTasks(ctx, {});

    const taskInsert = insert.mock.calls.find(
      ([t, d]) => t === 'tasks' && d.recurringTaskId === 's1',
    );
    expect(taskInsert![1]).toMatchObject({
      deadline: expect.any(Number),
      startDate: expect.any(Number),
    });
    expect(insert).toHaveBeenCalledWith(
      'tasks',
      expect.objectContaining({ parentTaskId: expect.any(String), title: 'Step' }),
    );
    expect(insert).toHaveBeenCalledWith(
      'taskChecklistItems',
      expect.objectContaining({ title: 'Check' }),
    );
  });

  it('re-checks co-assignees and drops inactive ones', async () => {
    const { ctx, insert } = makeCtx({
      docs: {
        [ASSIGNEE_ID]: { _id: ASSIGNEE_ID, organizationId: ORG, isActive: true },
        co1: { _id: 'co1', organizationId: ORG, isActive: true },
        co2: { _id: 'co2', organizationId: ORG, isActive: false },
      },
      tables: { recurringTasks: [seriesDoc({ assigneeIds: [ASSIGNEE_ID, 'co1', 'co2'] })] },
    });

    await handlers.generateDueRecurringTasks(ctx, {});

    const taskInsert = insert.mock.calls.find(
      ([t, d]) => t === 'tasks' && d.recurringTaskId === 's1',
    );
    expect(taskInsert![1].assigneeIds).toEqual(['co1']);
  });

  it('falls back to the first open status when the stored key is gone', async () => {
    const { ctx, insert } = makeCtx({
      docs: { [ASSIGNEE_ID]: { _id: ASSIGNEE_ID, organizationId: ORG, isActive: true } },
      tables: { recurringTasks: [seriesDoc({ statusKey: 'deleted-key' })] },
    });

    await handlers.generateDueRecurringTasks(ctx, {});

    const taskInsert = insert.mock.calls.find(
      ([t, d]) => t === 'tasks' && d.recurringTaskId === 's1',
    );
    expect(taskInsert![1].statusKey).toBe('pending');
  });
});

// ── comments ─────────────────────────────────────────────────────────────────

describe('listRecurringTaskComments', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.listRecurringTaskComments(ctx, { seriesId: 's1' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('returns [] for a missing series', async () => {
    const { ctx } = makeCtx();
    await expect(handlers.listRecurringTaskComments(ctx, { seriesId: 'missing' })).resolves.toEqual(
      [],
    );
  });

  it('returns [] for a cross-org caller', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ organizationId: 'other' }));
    const { ctx } = makeCtx({ docs: { s1: seriesDoc() } });
    await expect(handlers.listRecurringTaskComments(ctx, { seriesId: 's1' })).resolves.toEqual([]);
  });

  it('decorates comments with the author', async () => {
    const { ctx } = makeCtx({
      docs: { s1: seriesDoc(), a1: { _id: 'a1', name: 'Author', avatarUrl: 'a.png' } },
      tables: { recurringTaskComments: [{ _id: 'c1', seriesId: 's1', authorId: 'a1' }] },
    });

    const result = await handlers.listRecurringTaskComments(ctx, { seriesId: 's1' });
    expect(result[0]).toMatchObject({ authorName: 'Author', authorAvatar: 'a.png' });
  });

  it('falls back to "Unknown" for a deleted author', async () => {
    const { ctx } = makeCtx({
      docs: { s1: seriesDoc() },
      tables: { recurringTaskComments: [{ _id: 'c1', seriesId: 's1', authorId: 'ghost' }] },
    });
    const result = await handlers.listRecurringTaskComments(ctx, { seriesId: 's1' });
    expect(result[0].authorName).toBe('Unknown');
  });
});

describe('addRecurringTaskComment', () => {
  it('rejects an empty comment', async () => {
    const { ctx } = makeCtx({ docs: { s1: seriesDoc() } });
    await expect(
      handlers.addRecurringTaskComment(ctx, { seriesId: 's1', content: '   ' }),
    ).rejects.toThrow('cannot be empty');
  });

  it('rejects a too-long comment', async () => {
    const { ctx } = makeCtx({ docs: { s1: seriesDoc() } });
    await expect(
      handlers.addRecurringTaskComment(ctx, { seriesId: 's1', content: 'x'.repeat(2001) }),
    ).rejects.toThrow('too long');
  });

  it('adds a comment and notifies the assignee', async () => {
    const { ctx, insert } = makeCtx({ docs: { s1: seriesDoc() } });
    const result = await handlers.addRecurringTaskComment(ctx, { seriesId: 's1', content: ' hi ' });

    expect(result.commentId).toBeTruthy();
    expect(insert).toHaveBeenCalledWith(
      'recurringTaskComments',
      expect.objectContaining({ content: 'hi' }),
    );
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: ASSIGNEE_ID }),
    );
  });

  it('does not notify when the assignee comments on their own series', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ _id: ASSIGNEE_ID, role: 'employee' }));
    const { ctx } = makeCtx({ docs: { s1: seriesDoc({ assignedTo: ASSIGNEE_ID }) } });
    await handlers.addRecurringTaskComment(ctx, { seriesId: 's1', content: 'mine' });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('deleteRecurringTaskComment', () => {
  it('rejects an unauthenticated caller', async () => {
    getAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx();
    await expect(handlers.deleteRecurringTaskComment(ctx, { commentId: 'c1' })).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws when the comment is missing', async () => {
    const { ctx } = makeCtx();
    await expect(
      handlers.deleteRecurringTaskComment(ctx, { commentId: 'missing' }),
    ).rejects.toThrow('Comment not found');
  });

  it('throws when the series is missing', async () => {
    const { ctx } = makeCtx({ docs: { c1: { _id: 'c1', seriesId: 'gone' } } });
    await expect(handlers.deleteRecurringTaskComment(ctx, { commentId: 'c1' })).rejects.toThrow(
      'Recurring task not found',
    );
  });

  it('rejects a cross-organization caller', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ organizationId: 'other' }));
    const { ctx } = makeCtx({ docs: { c1: { _id: 'c1', seriesId: 's1' }, s1: seriesDoc() } });
    await expect(handlers.deleteRecurringTaskComment(ctx, { commentId: 'c1' })).rejects.toThrow(
      'cross-organization',
    );
  });

  it('blocks a non-author from deleting', async () => {
    getAuthCaller.mockResolvedValue(adminCaller({ role: 'employee', _id: 'other' }));
    const { ctx } = makeCtx({
      docs: { c1: { _id: 'c1', seriesId: 's1', authorId: 'author1' }, s1: seriesDoc() },
    });
    await expect(handlers.deleteRecurringTaskComment(ctx, { commentId: 'c1' })).rejects.toThrow(
      'Only the author',
    );
  });

  it('lets the author delete their comment', async () => {
    const { ctx, remove } = makeCtx({
      docs: { c1: { _id: 'c1', seriesId: 's1', authorId: CALLER_ID }, s1: seriesDoc() },
    });
    const result = await handlers.deleteRecurringTaskComment(ctx, { commentId: 'c1' });
    expect(result).toEqual({ success: true });
    expect(remove).toHaveBeenCalledWith('c1');
  });
});
