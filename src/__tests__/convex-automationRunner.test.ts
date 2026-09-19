/**
 * Tests for convex/automationRunner.ts — what a workflow actually does.
 *
 * This file is where the whole automation feature becomes real or fake, and the
 * cases below are the ones that decide which:
 *
 *   - a run must never report success for an action nobody implemented
 *     (`unsupported`, with the reason), because a builder that silently does
 *     nothing is the failure the whole catalogue exists to prevent;
 *   - `block_user` must deactivate only the account explicitly named. Falling
 *     back to "the user this event is about" would deactivate somebody because an
 *     admin left a field blank — and it is not reversible;
 *   - an automation must not deactivate its own author, which locks the door from
 *     the outside;
 *   - a delay must park the remainder in `automationPendingRuns` and schedule its
 *     own resume, or "wait an hour" is decorative;
 *   - a run resumed after a pause must stop, because the pause happened after the
 *     author approved the run.
 *
 * The engine (`lib/workflowEngine.ts`) is real here — the plan is what the runner
 * consumes, and stubbing it would test nothing.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../../convex/_generated/server', () => ({
  mutation: ({ handler, args }: any) => ({ handler, args }),
  internalMutation: ({ handler, args }: any) => ({ handler, args }),
}));

const mockInternal = {
  automationRunner: { resumePendingRun: { _name: 'resumePendingRun' } },
  emails: { queueEmail: { _name: 'queueEmail' } },
  leaves: {
    mutations: {
      approveLeaveInternal: { _name: 'approveLeaveInternal' },
      rejectLeaveInternal: { _name: 'rejectLeaveInternal' },
    },
  },
  webhooks: { main: { emitEvent: { _name: 'emitEvent' } } },
};

jest.mock('../../convex/_generated/api', () => ({ internal: mockInternal }));

jest.mock('../../convex/lib/getAuthCaller', () => ({ getAuthCaller: jest.fn() }));
jest.mock('../../convex/lib/auth', () => ({ isSuperadmin: jest.fn() }));
jest.mock('../../convex/lib/entitlements', () => ({ assertModuleAccess: jest.fn() }));

// ── Module under test ────────────────────────────────────────────────────────
let mockGetAuthCaller: jest.Mock;
let mockIsSuperadmin: jest.Mock;
let mockAssertModuleAccess: jest.Mock;

type Handler = (ctx: any, args: any) => Promise<any>;
const handlers: Record<string, Handler> = {};

const ORG = 'org_1';
const OTHER_ORG = 'org_2';
const ADMIN = 'user_admin';
const WORKFLOW = 'wf_1';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuthCaller = jest.requireMock('../../convex/lib/getAuthCaller').getAuthCaller;
  mockIsSuperadmin = jest.requireMock('../../convex/lib/auth').isSuperadmin;
  mockAssertModuleAccess = jest.requireMock('../../convex/lib/entitlements').assertModuleAccess;
  mockGetAuthCaller.mockReset();
  mockIsSuperadmin.mockReset();
  mockIsSuperadmin.mockReturnValue(false);
  mockAssertModuleAccess.mockReset();
  mockAssertModuleAccess.mockResolvedValue(undefined);

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../convex/automationRunner');
    for (const [name, def] of Object.entries(mod)) {
      if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
        handlers[name] = (def as any).handler;
      }
    }
  });
});

// ── A ctx with a small in-memory store ───────────────────────────────────────
interface StoredRow {
  _id: string;
  [key: string]: unknown;
}

function makeCtx(seed: Record<string, StoredRow[]> = {}) {
  const store: Record<string, StoredRow[]> = {};
  for (const [table, rows] of Object.entries(seed)) store[table] = rows.map((r) => ({ ...r }));

  const inserts: { table: string; doc: Record<string, unknown>; id: string }[] = [];
  const patches: { id: string; patch: Record<string, unknown> }[] = [];
  const deleted: string[] = [];
  const runAfter = jest.fn().mockResolvedValue(undefined);
  const runMutation = jest.fn().mockResolvedValue({ queued: 1 });

  let counter = 0;

  const findById = (id: string): StoredRow | null => {
    for (const rows of Object.values(store)) {
      const found = rows.find((r) => r._id === id);
      if (found) return found;
    }
    return null;
  };

  const db = {
    get: jest.fn(async (id: string) => findById(id)),
    insert: jest.fn(async (table: string, doc: Record<string, unknown>) => {
      const id = `${table}_${++counter}`;
      store[table] = store[table] ?? [];
      store[table]!.push({ _id: id, ...doc });
      inserts.push({ table, doc, id });
      return id;
    }),
    patch: jest.fn(async (id: string, patch: Record<string, unknown>) => {
      const row = findById(id);
      if (row) Object.assign(row, patch);
      patches.push({ id, patch });
    }),
    delete: jest.fn(async (id: string) => {
      for (const table of Object.keys(store)) {
        store[table] = store[table]!.filter((r) => r._id !== id);
      }
      deleted.push(id);
    }),
    // `toId` runs every config string through this, so returning the value
    // unchanged is what a well-formed id looks like.
    normalizeId: jest.fn((_table: string, value: string) => value),
    query: jest.fn((table: string) => ({
      withIndex: jest.fn(() => ({
        take: jest.fn(async (limit: number) => (store[table] ?? []).slice(0, limit)),
        collect: jest.fn(async () => store[table] ?? []),
        unique: jest.fn(async () => (store[table] ?? [])[0] ?? null),
        first: jest.fn(async () => (store[table] ?? [])[0] ?? null),
      })),
    })),
  };

  return {
    ctx: { db, scheduler: { runAfter }, runMutation },
    inserts,
    patches,
    deleted,
    runAfter,
    runMutation,
    db,
    // The stored `_id` is included, so a test can follow a row the runner
    // inserted (the parked run schedules itself by id).
    inserted: (table: string) =>
      inserts.filter((i) => i.table === table).map((i) => ({ _id: i.id, ...i.doc })),
    patched: (id: string) => patches.filter((p) => p.id === id).map((p) => p.patch),
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
type Step = Record<string, unknown>;

function trigger(eventType = 'leave_created', conditions: unknown[] = []): Step {
  return { type: 'trigger', config: { eventType, conditions }, position: 0 };
}

function action(actionType: string, parameters: Record<string, unknown> = {}, position = 1): Step {
  return { type: 'action', config: { actionType, parameters }, position };
}

function delay(duration: number, unit: string, position = 2): Step {
  return { type: 'delay', config: { duration, unit }, position };
}

function workflowRow(overrides: Record<string, unknown> = {}): StoredRow {
  return {
    _id: WORKFLOW,
    name: 'Notify on leave',
    config: { steps: [trigger(), action('send_notification', { userId: 'user_1', title: 'Hi' })] },
    isActive: true,
    organizationId: ORG,
    createdBy: ADMIN,
    ...overrides,
  };
}

function adminRow(overrides: Record<string, unknown> = {}): StoredRow {
  return {
    _id: ADMIN,
    name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    organizationId: ORG,
    ...overrides,
  };
}

function userRow(id: string, overrides: Record<string, unknown> = {}): StoredRow {
  return {
    _id: id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    role: 'employee',
    isActive: true,
    organizationId: ORG,
    ...overrides,
  };
}

/** A context where the caller is an org admin of ORG. */
function adminCtx(extra: Record<string, StoredRow[]> = {}, workflow: StoredRow = workflowRow()) {
  mockGetAuthCaller.mockResolvedValue({ _id: ADMIN });
  return makeCtx({
    users: [adminRow()],
    automationWorkflows: [workflow],
    ...extra,
  });
}

async function runNow(ctx: unknown, workflowId = WORKFLOW) {
  return handlers.runWorkflowNow!(ctx, { workflowId });
}

/** The action results recorded by the run's task row. */
function recordedActions(ctx: ReturnType<typeof makeCtx>, taskId: string) {
  const patch = ctx.patched(taskId).find((p) => p.result !== undefined);
  const result = patch?.result as {
    actions: { status: string; reason?: string; detail?: string }[];
  };
  return result.actions;
}

// ── Access control ───────────────────────────────────────────────────────────
describe('runWorkflowNow — who may run a workflow', () => {
  it('refuses an unauthenticated caller', async () => {
    mockGetAuthCaller.mockResolvedValue(null);
    const { ctx } = makeCtx({ automationWorkflows: [workflowRow()] });

    await expect(runNow(ctx)).rejects.toThrow('Not authenticated');
  });

  it('refuses a caller with no user row', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'ghost' });
    const { ctx } = makeCtx({ automationWorkflows: [workflowRow()] });

    await expect(runNow(ctx)).rejects.toThrow('Requester not found');
  });

  it('refuses an employee', async () => {
    mockGetAuthCaller.mockResolvedValue({ _id: 'user_1' });
    const { ctx } = makeCtx({
      users: [userRow('user_1', { role: 'employee' })],
      automationWorkflows: [workflowRow()],
    });

    await expect(runNow(ctx)).rejects.toThrow(/Only administrators/);
  });

  it('lets the entitlement check refuse before anything is read', async () => {
    mockAssertModuleAccess.mockRejectedValue(new Error('Module not available'));
    const ctx = adminCtx();

    await expect(runNow(ctx.ctx)).rejects.toThrow('Module not available');
    expect(ctx.inserted('automationTasks')).toHaveLength(0);
  });

  it('refuses a workflow that does not exist', async () => {
    const ctx = adminCtx({ automationWorkflows: [] });

    await expect(runNow(ctx.ctx)).rejects.toThrow('Workflow not found');
  });

  it('refuses a workflow belonging to another organisation', async () => {
    const ctx = adminCtx({}, workflowRow({ organizationId: OTHER_ORG }));

    await expect(runNow(ctx.ctx)).rejects.toThrow('Access denied');
  });

  it('keeps a platform-level workflow away from a tenant admin', async () => {
    const ctx = adminCtx({}, workflowRow({ organizationId: undefined }));

    await expect(runNow(ctx.ctx)).rejects.toThrow('Access denied');
  });

  it('lets a superadmin run a platform-level workflow', async () => {
    mockIsSuperadmin.mockReturnValue(true);
    const ctx = adminCtx({}, workflowRow({ organizationId: undefined }));

    await expect(runNow(ctx.ctx)).resolves.toMatchObject({ success: true });
  });

  it('refuses a paused workflow', async () => {
    const ctx = adminCtx({}, workflowRow({ isActive: false }));

    await expect(runNow(ctx.ctx)).rejects.toThrow('This workflow is paused');
  });
});

// ── Execution ────────────────────────────────────────────────────────────────
describe('runWorkflowNow — execution', () => {
  it('runs the actions and records a completed task with a trace', async () => {
    const ctx = adminCtx({ users: [adminRow(), userRow('user_1')] });

    const result = await runNow(ctx.ctx);

    expect(result.success).toBe(true);
    expect(result.matched).toBe(true);
    expect(result.scheduled).toBe(false);
    expect(result.executed).toEqual([
      { stepIndex: 1, actionType: 'send_notification', status: 'done' },
    ]);

    const tasks = ctx.inserted('automationTasks');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      organizationId: ORG,
      name: 'Notify on leave',
      status: 'running',
    });
    expect(recordedActions(ctx, result.taskId)).toEqual([
      { stepIndex: 1, actionType: 'send_notification', status: 'done' },
    ]);
  });

  it('writes the notification the action asked for', async () => {
    const ctx = adminCtx({ users: [adminRow(), userRow('user_1')] });

    await runNow(ctx.ctx);

    const notifications = ctx.inserted('notifications');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      organizationId: ORG,
      userId: 'user_1',
      type: 'automation',
      title: 'Hi',
      isRead: false,
    });
    expect(JSON.parse(notifications[0]!.metadata as string)).toMatchObject({
      actionType: 'send_notification',
      workflowName: 'Notify on leave',
    });
  });

  it('executes nothing when a trigger condition fails', async () => {
    const ctx = adminCtx(
      {},
      workflowRow({
        config: {
          steps: [
            trigger('leave_created', [{ field: 'days', operator: 'gt', value: 30 }]),
            action('send_notification', { userId: 'user_1' }),
          ],
        },
      }),
    );

    const result = await runNow(ctx.ctx);

    // Read by the UI as "your guard rails stopped it", which is different from a
    // workflow that ran and did nothing.
    expect(result.matched).toBe(false);
    expect(result.taskId).toBeNull();
    expect(ctx.inserted('automationTasks')).toHaveLength(0);
  });

  it('parks the remainder and schedules its own resume around a delay', async () => {
    const ctx = adminCtx(
      { users: [adminRow(), userRow('user_1')] },
      workflowRow({
        config: {
          steps: [
            trigger(),
            action('send_notification', { userId: 'user_1', title: 'now' }, 1),
            delay(2, 'hours', 2),
            action('create_task', { userId: 'user_1', title: 'later' }, 3),
          ],
        },
      }),
    );

    const result = await runNow(ctx.ctx);

    // The UI shows "started", not "done", because stage two has not run.
    expect(result.scheduled).toBe(true);
    expect(result.executed).toHaveLength(1);

    const pending = ctx.inserted('automationPendingRuns');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ organizationId: ORG, workflowId: WORKFLOW, actorId: ADMIN });
    // Two hours, and the parked run keeps the results already achieved.
    expect(ctx.runAfter).toHaveBeenCalledWith(
      2 * 60 * 60 * 1000,
      mockInternal.automationRunner.resumePendingRun,
      expect.objectContaining({ pendingRunId: pending[0]!._id }),
    );
    // The later action did not run yet.
    expect(ctx.inserted('tasks')).toHaveLength(0);
    expect(ctx.patched(result.taskId!)).toHaveLength(0);
  });

  it('marks a trailing delay as scheduled nothing, not as a waiting run', async () => {
    const ctx = adminCtx(
      { users: [adminRow(), userRow('user_1')] },
      workflowRow({
        config: {
          steps: [
            trigger(),
            action('send_notification', { userId: 'user_1' }, 1),
            delay(1, 'hours', 2),
          ],
        },
      }),
    );

    const result = await runNow(ctx.ctx);

    expect(result.scheduled).toBe(false);
    expect(ctx.inserted('automationPendingRuns')).toHaveLength(0);
  });

  it('reports an action nobody implemented instead of doing nothing quietly', async () => {
    const ctx = adminCtx(
      { users: [adminRow()] },
      workflowRow({
        config: { steps: [trigger(), action('update_record', { userId: 'user_1' })] },
      }),
    );

    const result = await runNow(ctx.ctx);

    // `action_not_available` is the catalogue saying "this action exists but is
    // not implemented"; `action_not_implemented` is reserved for the case the
    // catalogue claims otherwise, which would be a bug in the catalogue.
    expect(result.executed[0]).toMatchObject({
      status: 'unsupported',
      reason: 'action_not_available',
    });
    // The detail names what *can* be done, which is what an operator needs.
    expect(result.executed[0]!.detail).toContain('send_notification');
  });
});

// ── Actions ──────────────────────────────────────────────────────────────────
describe('action dispatch', () => {
  async function runAction(
    actionType: string,
    parameters: Record<string, unknown>,
    extra: Record<string, StoredRow[]> = {},
  ) {
    const ctx = adminCtx(
      extra,
      workflowRow({ config: { steps: [trigger(), action(actionType, parameters)] } }),
    );
    const result = await runNow(ctx.ctx);
    return { ctx, result, step: result.executed[0]! };
  }

  it('skips send_notification when nobody was named, rather than broadcasting', async () => {
    const { ctx, step } = await runAction('send_notification', {});

    expect(step).toMatchObject({ status: 'skipped', reason: 'no_recipient' });
    expect(ctx.inserted('notifications')).toHaveLength(0);
  });

  it('skips send_notification to somebody in another organisation', async () => {
    const { step } = await runAction(
      'send_notification',
      { userId: 'outsider' },
      {
        users: [adminRow(), userRow('outsider', { organizationId: OTHER_ORG })],
      },
    );

    expect(step).toMatchObject({ status: 'skipped', reason: 'recipient_not_in_organization' });
  });

  it('reports send_email as queued, never as done — the delivery row owns the outcome', async () => {
    const ctx = adminCtx(
      { users: [adminRow(), userRow('user_1')] },
      workflowRow({
        config: {
          steps: [
            trigger(),
            action('send_email', { userId: 'user_1', subject: 'Hello', body: 'Body' }),
          ],
        },
      }),
    );
    ctx.runMutation.mockResolvedValue({
      status: 'pending',
      deliveryId: 'delivery_1',
      to: 'user_1@example.com',
      redirected: false,
    });

    const result = await runNow(ctx.ctx);

    expect(result.executed[0]).toMatchObject({ status: 'queued', reason: 'queued' });
    expect(ctx.runMutation).toHaveBeenCalledWith(
      mockInternal.emails.queueEmail,
      expect.objectContaining({
        organizationId: ORG,
        intendedTo: 'user_1@example.com',
        subject: 'Hello',
        body: 'Body',
        source: 'workflow',
        workflowId: WORKFLOW,
        createdBy: ADMIN,
      }),
    );
  });

  it('says out loud when an email was redirected to the account owner', async () => {
    const ctx = adminCtx(
      { users: [adminRow(), userRow('user_1')] },
      workflowRow({
        config: {
          steps: [trigger(), action('send_email', { userId: 'user_1', subject: 'S', body: 'B' })],
        },
      }),
    );
    ctx.runMutation.mockResolvedValue({
      status: 'pending',
      deliveryId: 'delivery_1',
      to: 'owner@example.com',
      redirected: true,
    });

    const result = await runNow(ctx.ctx);

    expect(result.executed[0]!.detail).toContain('redirected to owner@example.com');
  });

  it('skips send_email with the deployment’s own reason when mail is not configured', async () => {
    const ctx = adminCtx(
      { users: [adminRow(), userRow('user_1')] },
      workflowRow({
        config: {
          steps: [trigger(), action('send_email', { userId: 'user_1', subject: 'S', body: 'B' })],
        },
      }),
    );
    ctx.runMutation.mockResolvedValue({
      status: 'skipped',
      reason: 'email_no_api_key',
      to: '',
      redirected: false,
    });

    const result = await runNow(ctx.ctx);

    expect(result.executed[0]).toMatchObject({ status: 'skipped', reason: 'email_no_api_key' });
  });

  it('skips send_email with no subject', async () => {
    const { step } = await runAction(
      'send_email',
      { userId: 'user_1', body: 'B' },
      {
        users: [adminRow(), userRow('user_1')],
      },
    );

    expect(step).toMatchObject({ status: 'skipped', reason: 'no_subject' });
  });

  it('creates the task it was asked for, with the priority and deadline', async () => {
    const { ctx, step } = await runAction(
      'create_task',
      {
        userId: 'user_1',
        title: 'Collect the form',
        description: 'By Friday',
        priority: 'high',
        dueInDays: 3,
      },
      { users: [adminRow(), userRow('user_1')] },
    );

    expect(step).toMatchObject({ status: 'done' });
    const tasks = ctx.inserted('tasks');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      organizationId: ORG,
      title: 'Collect the form',
      description: 'By Friday',
      assignedTo: 'user_1',
      assignedBy: ADMIN,
      status: 'pending',
      priority: 'high',
    });
    expect(tasks[0]!.deadline).toBeGreaterThan(Date.now());
  });

  it('falls back to the default priority for a nonsense one', async () => {
    const { ctx } = await runAction(
      'create_task',
      { userId: 'user_1', title: 'T', priority: 'whenever' },
      { users: [adminRow(), userRow('user_1')] },
    );

    expect(ctx.inserted('tasks')[0]!.priority).toBe('medium');
  });

  it('skips create_task without a title', async () => {
    const { step } = await runAction(
      'create_task',
      { userId: 'user_1' },
      {
        users: [adminRow(), userRow('user_1')],
      },
    );

    expect(step).toMatchObject({ status: 'skipped', reason: 'no_title' });
  });

  it('notifies every admin plus the workflow author on escalate', async () => {
    const { ctx, step } = await runAction(
      'escalate',
      { title: 'Escalated' },
      {
        users: [
          adminRow(),
          adminRow({ _id: 'admin_2', email: 'admin2@example.com' }),
          userRow('user_1'),
        ],
      },
    );

    expect(step).toMatchObject({ status: 'done' });
    const recipients = ctx.inserted('notifications').map((n) => n.userId);
    expect(recipients).toContain(ADMIN);
    expect(recipients).toContain('admin_2');
    // Employees are not escalation targets.
    expect(recipients).not.toContain('user_1');
  });

  it('always has an escalation target, because the run is attributed to somebody', async () => {
    // `findEscalationTargets` appends the run's actor when the member list has no
    // admin in it, and the actor always exists (a run with none fails earlier as
    // `no_actor`). So the `no_escalation_target` branch is unreachable from an
    // entry point, and asserting a skip here would be asserting a fiction.
    const { ctx, step } = await runAction('escalate', {}, { users: [adminRow()] });

    expect(step).toMatchObject({ status: 'done' });
    expect(ctx.inserted('notifications').map((n) => n.userId)).toEqual([ADMIN]);
  });

  it('skips assign_user without a task', async () => {
    const { step } = await runAction(
      'assign_user',
      { userId: 'user_1' },
      {
        users: [adminRow(), userRow('user_1')],
      },
    );

    expect(step).toMatchObject({ status: 'skipped', reason: 'no_task' });
  });

  it('reassigns the task it was pointed at', async () => {
    const { ctx, step } = await runAction(
      'assign_user',
      { userId: 'user_1', taskId: 'task_1' },
      {
        users: [adminRow(), userRow('user_1')],
        tasks: [{ _id: 'task_1', organizationId: ORG, title: 'T', assignedTo: 'user_2' }],
      },
    );

    expect(step).toMatchObject({ status: 'done' });
    expect(ctx.patched('task_1')[0]).toMatchObject({ assignedTo: 'user_1' });
  });

  it('approves a leave through the real pipeline, attributed to the workflow', async () => {
    const { ctx, step } = await runAction(
      'approve_request',
      { requestId: 'leave_1', comment: 'Auto' },
      {
        leaveRequests: [{ _id: 'leave_1', organizationId: ORG, status: 'pending' }],
      },
    );

    expect(step).toMatchObject({ status: 'done' });
    expect(ctx.runMutation).toHaveBeenCalledWith(
      mockInternal.leaves.mutations.approveLeaveInternal,
      {
        leaveId: 'leave_1',
        reviewerId: ADMIN,
        comment: 'Auto',
        workflowName: 'Notify on leave',
      },
    );
  });

  it('reports a refusal by the leave pipeline as the outcome, not as a crash', async () => {
    const ctx = adminCtx(
      { leaveRequests: [{ _id: 'leave_1', organizationId: ORG }] },
      workflowRow({
        config: { steps: [trigger(), action('reject_request', { requestId: 'leave_1' })] },
      }),
    );
    ctx.runMutation.mockRejectedValue(new Error('Not in your reporting line'));

    const result = await runNow(ctx.ctx);

    expect(result.executed[0]).toMatchObject({
      status: 'failed',
      reason: 'request_refused',
      detail: 'Not in your reporting line',
    });
  });

  it('skips a leave request that is not in this organisation', async () => {
    const { step } = await runAction(
      'approve_request',
      { requestId: 'leave_9' },
      {
        leaveRequests: [{ _id: 'leave_9', organizationId: OTHER_ORG }],
      },
    );

    expect(step).toMatchObject({ status: 'skipped', reason: 'request_not_in_organization' });
  });

  it('skips a leave request id that normalises to nothing', async () => {
    const ctx = adminCtx(
      {},
      workflowRow({
        config: {
          steps: [trigger(), action('approve_request', { requestId: 'https://example.com/x' })],
        },
      }),
    );
    ctx.db.normalizeId.mockReturnValue(null);

    const result = await runNow(ctx.ctx);

    expect(result.executed[0]).toMatchObject({ status: 'skipped', reason: 'no_request' });
  });

  it('refuses to deactivate anyone when block_user names nobody', async () => {
    // The safety rule: reading "the user this event is about" here would
    // deactivate somebody because an admin left a field blank.
    const { ctx, step } = await runAction(
      'block_user',
      {},
      {
        users: [adminRow(), userRow('user_1')],
      },
    );

    expect(step).toMatchObject({ status: 'skipped', reason: 'no_user' });
    expect(ctx.patched('user_1')).toHaveLength(0);
  });

  it('refuses to let an automation deactivate its own author', async () => {
    const { ctx, step } = await runAction('block_user', { userId: ADMIN });

    expect(step).toMatchObject({ status: 'skipped', reason: 'refuses_self' });
    expect(ctx.patched(ADMIN)).toHaveLength(0);
  });

  it('deactivates the named account and writes the audit entry', async () => {
    const { ctx, step } = await runAction(
      'block_user',
      { userId: 'user_1' },
      {
        users: [adminRow(), userRow('user_1')],
      },
    );

    expect(step).toMatchObject({ status: 'done', detail: 'user_1@example.com' });
    expect(ctx.patched('user_1')[0]).toMatchObject({ isActive: false });
    const audit = ctx.inserted('auditLogs');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      organizationId: ORG,
      userId: ADMIN,
      action: 'user_deactivated_by_automation',
      target: 'user_1',
    });
  });

  it('leaves an already inactive account alone', async () => {
    const { step } = await runAction(
      'block_user',
      { userId: 'user_1' },
      {
        users: [adminRow(), userRow('user_1', { isActive: false })],
      },
    );

    expect(step).toMatchObject({ status: 'skipped', reason: 'already_inactive' });
  });

  it('sends the webhook through the signed-endpoint pipeline, not to a URL from the config', async () => {
    const ctx = adminCtx(
      {},
      workflowRow({
        config: { steps: [trigger(), action('webhook', { url: 'https://evil.example' })] },
      }),
    );
    ctx.runMutation.mockResolvedValue({ queued: 3 });

    const result = await runNow(ctx.ctx);

    expect(result.executed[0]).toMatchObject({ status: 'done', detail: '3 endpoint(s)' });
    expect(ctx.runMutation).toHaveBeenCalledWith(
      mockInternal.webhooks.main.emitEvent,
      expect.objectContaining({
        eventType: 'workflow.triggered',
        organizationId: ORG,
        data: expect.objectContaining({ workflowId: WORKFLOW }),
      }),
    );
  });

  it('skips the webhook when the organisation has no endpoint registered', async () => {
    const ctx = adminCtx(
      {},
      workflowRow({ config: { steps: [trigger(), action('webhook', {})] } }),
    );
    ctx.runMutation.mockResolvedValue({ queued: 0 });

    const result = await runNow(ctx.ctx);

    expect(result.executed[0]).toMatchObject({ status: 'skipped', reason: 'no_webhook_endpoint' });
  });
});

// ── Event entry point ────────────────────────────────────────────────────────
describe('runWorkflowsForEvent', () => {
  async function fireEvent(ctx: unknown, eventType = 'leave_created') {
    return handlers.runWorkflowsForEvent!(ctx, { organizationId: ORG, eventType, payload: {} });
  }

  it('evaluates only active workflows', async () => {
    const ctx = makeCtx({
      users: [adminRow(), userRow('user_1')],
      automationWorkflows: [
        workflowRow(),
        workflowRow({ _id: 'wf_2', name: 'Paused', isActive: false }),
      ],
    });

    const result = await fireEvent(ctx.ctx);

    expect(result.evaluated).toBe(1);
    expect(result.matched).toBe(1);
  });

  it('does not count a workflow whose trigger listens for another event', async () => {
    const ctx = makeCtx({
      users: [adminRow()],
      automationWorkflows: [
        workflowRow({ config: { steps: [trigger('user_onboarded'), action('escalate', {})] } }),
      ],
    });

    const result = await fireEvent(ctx.ctx);

    expect(result.evaluated).toBe(1);
    expect(result.matched).toBe(0);
    expect(ctx.inserted('automationTasks')).toHaveLength(0);
  });

  it('counts a workflow that parked a continuation as waiting', async () => {
    const ctx = makeCtx({
      users: [adminRow(), userRow('user_1')],
      automationWorkflows: [
        workflowRow({
          config: {
            steps: [
              trigger(),
              action('send_notification', { userId: 'user_1' }, 1),
              delay(30, 'minutes', 2),
              action('send_notification', { userId: 'user_1' }, 3),
            ],
          },
        }),
      ],
    });

    const result = await fireEvent(ctx.ctx);

    expect(result).toMatchObject({ matched: 1, waiting: 1 });
  });

  it('is a no-op for an organisation with no workflows', async () => {
    const ctx = makeCtx({ users: [adminRow()] });

    expect(await fireEvent(ctx.ctx)).toEqual({ evaluated: 0, matched: 0, waiting: 0 });
  });

  it('reports a run that has no actor as failed rather than running it unowned', async () => {
    // An organisation with no active admin cannot run automations: nobody would
    // be accountable for an automated approval.
    const ctx = makeCtx({
      users: [userRow('user_1')],
      automationWorkflows: [workflowRow({ createdBy: undefined })],
    });

    const result = await fireEvent(ctx.ctx);

    expect(result.matched).toBe(0);
    expect(ctx.inserted('automationTasks')).toHaveLength(0);
  });
});

// ── Resume ───────────────────────────────────────────────────────────────────
describe('resumePendingRun', () => {
  const PENDING = 'pending_1';

  function pendingRow(overrides: Record<string, unknown> = {}): StoredRow {
    return {
      _id: PENDING,
      organizationId: ORG,
      workflowId: WORKFLOW,
      workflowName: 'Notify on leave',
      actorId: ADMIN,
      taskId: 'automationTasks_1',
      remaining: [
        {
          delayMs: 0,
          actions: [
            {
              stepIndex: 3,
              actionType: 'create_task',
              parameters: { userId: 'user_1', title: 'later' },
            },
          ],
        },
      ],
      done: [{ stepIndex: 1, actionType: 'send_notification', status: 'done' }],
      trace: [],
      resumeAt: 0,
      createdAt: 0,
      ...overrides,
    };
  }

  it('does nothing when the pending row is gone', async () => {
    const ctx = makeCtx({ automationWorkflows: [workflowRow()] });

    expect(await handlers.resumePendingRun!(ctx.ctx, { pendingRunId: PENDING })).toEqual({
      resumed: false,
      reason: 'not_found',
    });
  });

  it('fails the run when the workflow was deleted while waiting', async () => {
    const ctx = makeCtx({ automationPendingRuns: [pendingRow()] });

    const result = await handlers.resumePendingRun!(ctx.ctx, { pendingRunId: PENDING });

    expect(result).toEqual({ resumed: false, reason: 'workflow_deleted' });
    expect(ctx.inserted('tasks')).toHaveLength(0);
    expect(ctx.patched('automationTasks_1')[0]).toMatchObject({ status: 'failed' });
  });

  it('stops when the workflow was paused while waiting — a pause is not a licence to execute', async () => {
    const ctx = makeCtx({
      automationWorkflows: [workflowRow({ isActive: false })],
      automationPendingRuns: [pendingRow()],
    });

    const result = await handlers.resumePendingRun!(ctx.ctx, { pendingRunId: PENDING });

    expect(result).toEqual({ resumed: false, reason: 'workflow_paused' });
    expect(ctx.inserted('tasks')).toHaveLength(0);
  });

  it('claims the pending row before running, so a re-entry cannot act twice', async () => {
    const ctx = makeCtx({
      users: [userRow('user_1')],
      automationWorkflows: [workflowRow()],
      automationPendingRuns: [pendingRow()],
    });

    await handlers.resumePendingRun!(ctx.ctx, { pendingRunId: PENDING });

    expect(ctx.deleted).toContain(PENDING);
  });

  it('runs the remaining stages and finalises the task the run already owns', async () => {
    const ctx = makeCtx({
      users: [userRow('user_1')],
      automationWorkflows: [workflowRow()],
      automationPendingRuns: [pendingRow()],
    });

    const result = await handlers.resumePendingRun!(ctx.ctx, { pendingRunId: PENDING });

    expect(result).toEqual({ resumed: true, waiting: false });
    expect(ctx.inserted('tasks')).toHaveLength(1);
    const patch = ctx.patched('automationTasks_1')[0]!;
    expect(patch.status).toBe('completed');
    // The results achieved before the delay are kept, not recomputed.
    expect(recordedActions(ctx, 'automationTasks_1')).toEqual([
      { stepIndex: 1, actionType: 'send_notification', status: 'done' },
      { stepIndex: 3, actionType: 'create_task', status: 'done' },
    ]);
  });

  it('does not re-inject the original event payload into a resumed run', async () => {
    // Re-running conditions against data re-read hours later is how an automation
    // starts acting on facts nobody approved.
    const ctx = makeCtx({
      users: [userRow('user_1')],
      automationWorkflows: [workflowRow()],
      automationPendingRuns: [
        pendingRow({
          remaining: [
            {
              delayMs: 0,
              actions: [
                {
                  stepIndex: 3,
                  actionType: 'send_notification',
                  parameters: { title: 'Needs an id from the event' },
                },
              ],
            },
          ],
        }),
      ],
    });

    await handlers.resumePendingRun!(ctx.ctx, { pendingRunId: PENDING });

    // No recipient in the config and none in the payload → a reported skip.
    expect(ctx.inserted('notifications')).toHaveLength(0);
    expect(recordedActions(ctx, 'automationTasks_1')[1]).toMatchObject({
      status: 'skipped',
      reason: 'no_recipient',
    });
  });
});
