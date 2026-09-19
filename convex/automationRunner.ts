/**
 * automationRunner — executes what `lib/workflowEngine.ts` planned.
 *
 * The engine answers "which of this tenant's workflows apply to this event, and
 * what should they do?". This module does the doing, and — just as important —
 * records *why*, so an admin can see that step 3 was skipped because the
 * recipient was missing rather than wonder whether the automation ran at all.
 *
 * ── The honesty rule this module exists to enforce ──────────────────────────
 * The builder used to offer ten action types; this runner implemented two. An
 * unimplemented action is **recorded as `unsupported` in the run result**, never
 * dropped silently: a workflow that quietly does nothing is the worst possible
 * outcome for the person who built it. The list now lives in
 * `lib/workflowActions.ts` and the builder renders from the same catalogue, so an
 * action that cannot run is no longer offered in the first place. Anything still
 * reaching here unimplemented is reported rather than ignored.
 *
 * ── Delays ─────────────────────────────────────────────────────────────────
 * `planRun` splits a workflow into stages. This module runs the first stage
 * immediately and parks the remainder in `automationPendingRuns`, scheduling
 * itself to resume. A `delay` step therefore means what it says: `action, delay
 * 1h, action` sends the second action an hour later, not both at once.
 *
 * If the workflow is paused or deleted while a run is waiting, the run is
 * dropped. A delay is not a licence to execute a workflow somebody has since
 * switched off.
 */

import { v } from 'convex/values';
import { internalMutation, mutation, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { getAuthCaller } from './lib/getAuthCaller';
import { isSuperadmin } from './lib/auth';
import { assertModuleAccess } from './lib/entitlements';
import {
  planRun,
  normalizeWorkflowConfig,
  type PlanStage,
  type PlanTraceEntry,
  type PlannedAction,
  type WorkflowPlan,
} from './lib/workflowEngine';
import {
  IMPLEMENTED_ACTION_IDS,
  isImplementedAction,
  findWorkflowAction,
} from './lib/workflowActions';

/**
 * Actions the runner can actually perform — re-exported from the catalogue so
 * there is exactly one list. Adding an action means implementing it here and
 * flipping `implemented` in `lib/workflowActions.ts`.
 */
export const SUPPORTED_ACTIONS = IMPLEMENTED_ACTION_IDS;

/** Platform webhook event emitted by the `webhook` action. */
const WORKFLOW_WEBHOOK_EVENT = 'workflow.triggered';

/** Outcome of one action, as stored in the run result. */
interface ActionResult {
  stepIndex: number;
  actionType: string;
  /**
   * `queued` is distinct from `done` on purpose. Sending mail is an HTTP call,
   * which a mutation cannot make, so the action schedules it and returns — the
   * delivery's own row carries the final outcome. Calling that "done" would let a
   * run report success for a message that Resend later rejected.
   */
  status: 'done' | 'queued' | 'unsupported' | 'skipped' | 'failed';
  /** Stable machine-readable reason; the UI localises off `status` + `reason`. */
  reason?: string;
  detail?: string;
}

/** Everything an action needs to know about the run it belongs to. */
interface RunContext {
  organizationId: Id<'organizations'>;
  workflowId: Id<'automationWorkflows'>;
  workflowName: string;
  /** The person the run is attributed to — the workflow's author. */
  actorId: Id<'users'>;
  eventType: string;
  payload: Record<string, unknown>;
}

// ── Parameter helpers ────────────────────────────────────────────────────────

/**
 * Read a string parameter, then fall back to the event payload.
 *
 * `fromPayload` is opt-in per key rather than automatic. Some actions must never
 * read the triggering event's fields: `block_user` deactivating "the user this
 * event is about" because an admin left the field blank is not a recoverable
 * mistake, so it passes an empty list here.
 */
function readParam(
  action: PlannedAction,
  payload: Record<string, unknown>,
  keys: string[],
  fallbackKeys: string[] = [],
): string | null {
  for (const key of keys) {
    const value = action.parameters[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  for (const key of fallbackKeys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

/**
 * Resolve a string to a row id of `table` without throwing.
 *
 * The id arrives from a JSON config an admin typed, so it can be any string at
 * all. `ctx.db.normalizeId` returns null for a malformed one, which turns "the
 * author pasted a URL into the request id field" into a reported skip instead of
 * an exception that fails the whole run.
 */
type ActionTable = 'users' | 'tasks' | 'leaveRequests';

function toId<Table extends ActionTable>(
  ctx: MutationCtx,
  table: Table,
  value: string | null,
): Id<Table> | null {
  if (!value) return null;
  try {
    return ctx.db.normalizeId(table, value) as Id<Table> | null;
  } catch {
    return null;
  }
}

/**
 * Load a row only if it exists *and* belongs to the running organisation.
 *
 * The org check cannot be skipped: the ids in an action's config are strings an
 * admin typed, and a wrong one must resolve to a reported skip, never to another
 * tenant's employee.
 */
async function loadInOrg<Table extends ActionTable>(
  ctx: MutationCtx,
  table: Table,
  id: Id<Table> | null,
  organizationId: Id<'organizations'>,
): Promise<Doc<Table> | null> {
  if (!id) return null;
  const row = await ctx.db.get(id);
  if (!row) return null;
  if ((row as { organizationId?: Id<'organizations'> }).organizationId !== organizationId) {
    return null;
  }
  return row as Doc<Table>;
}

// ── Action implementations ───────────────────────────────────────────────────

/**
 * Resolve the person a notification-style action targets: the action's own
 * parameter first (an explicit choice by the author), then the event.
 * No fallback to "everyone in the organisation" — an automation that broadcasts
 * because a field was empty is noisier than one that did nothing, and the trace
 * says exactly which happened.
 */
function resolveRecipient(
  action: PlannedAction,
  payload: Record<string, unknown>,
): Id<'users'> | null {
  const candidate = readParam(
    action,
    payload,
    ['userId', 'recipientId'],
    ['userId', 'recipientId'],
  );
  return candidate ? (candidate as Id<'users'>) : null;
}

async function notifyUser(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
  title: string,
  message: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await ctx.db.insert('notifications', {
    organizationId,
    userId,
    type: 'automation',
    title,
    message,
    isRead: false,
    metadata: JSON.stringify(metadata),
    createdAt: Date.now(),
  });
}

/** Every org member who can act on an escalated item, deduplicated. */
async function findEscalationTargets(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  actorId: Id<'users'>,
): Promise<Id<'users'>[]> {
  const members = await ctx.db
    .query('users')
    .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
    .take(500);
  const targets = members
    .filter((m) => m.isActive && (isSuperadmin(m) || m.role === 'admin'))
    .map((m) => m._id);
  // The workflow's author hears about it too: they are the one who has to decide
  // whether the escalation path they configured is the right one.
  if (!targets.includes(actorId)) targets.push(actorId);
  return targets;
}

async function performAction(
  ctx: MutationCtx,
  run: RunContext,
  action: PlannedAction,
): Promise<ActionResult> {
  const base = { stepIndex: action.stepIndex, actionType: action.actionType };

  if (!isImplementedAction(action.actionType)) {
    const definition = findWorkflowAction(action.actionType);
    return {
      ...base,
      status: 'unsupported',
      reason: definition?.implemented ? 'action_not_implemented' : 'action_not_available',
      detail: `Implemented actions: ${SUPPORTED_ACTIONS.join(', ')}`,
    };
  }

  switch (action.actionType) {
    // ── In-app notification ─────────────────────────────────────────────────
    case 'send_notification': {
      const userId = resolveRecipient(action, run.payload);
      if (!userId) return { ...base, status: 'skipped', reason: 'no_recipient' };
      const user = await loadInOrg(ctx, 'users', userId, run.organizationId);
      if (!user) {
        return { ...base, status: 'skipped', reason: 'recipient_not_in_organization' };
      }
      await notifyUser(
        ctx,
        run.organizationId,
        userId,
        readParam(action, run.payload, ['title'], []) ?? 'Automation',
        readParam(action, run.payload, ['message'], []) ?? 'A workflow you configured ran.',
        { actionType: action.actionType, workflowName: run.workflowName },
      );
      return { ...base, status: 'done' };
    }

    // ── Email ───────────────────────────────────────────────────────────────
    case 'send_email': {
      // An address may be given directly, or the action may name a user whose
      // address we look up — the second form is what a workflow author actually
      // wants, since they think in people, not in mailboxes.
      const explicitEmail = readParam(action, run.payload, ['email', 'to'], ['email']);
      const targetUserId = toId(
        ctx,
        'users',
        readParam(action, run.payload, ['userId', 'recipientId'], ['userId', 'recipientId']),
      );
      const targetUser = await loadInOrg(ctx, 'users', targetUserId, run.organizationId);

      const intendedTo = explicitEmail ?? targetUser?.email ?? '';
      if (!intendedTo) return { ...base, status: 'skipped', reason: 'no_recipient' };
      // A named user that resolved to nothing is a configuration error worth
      // distinguishing from an address that was simply left blank.
      if (!explicitEmail && !targetUser) {
        return { ...base, status: 'skipped', reason: 'recipient_not_in_organization' };
      }

      const subject = readParam(action, run.payload, ['subject'], ['subject']);
      if (!subject) return { ...base, status: 'skipped', reason: 'no_subject' };
      const body = readParam(action, run.payload, ['body', 'message'], ['body']);
      if (!body) return { ...base, status: 'skipped', reason: 'no_body' };

      const organization = await ctx.db.get(run.organizationId);
      const queued = await ctx.runMutation(internal.emails.queueEmail, {
        organizationId: run.organizationId,
        intendedTo,
        subject,
        body,
        organizationName: organization?.name,
        recipientName: targetUser?.name,
        actionUrl: readParam(action, run.payload, ['actionUrl', 'url'], []) ?? undefined,
        actionLabel: readParam(action, run.payload, ['actionLabel'], []) ?? undefined,
        source: 'workflow',
        workflowId: run.workflowId,
        createdBy: run.actorId,
      });

      if (queued.status === 'skipped') {
        // The deployment cannot send email: no key, no recipient, or an
        // unverified domain with nowhere to redirect to. Reported as skipped with
        // the deployment's own reason, never as a successful send.
        return { ...base, status: 'skipped', reason: queued.reason ?? 'email_not_configured' };
      }

      return {
        ...base,
        status: 'queued',
        reason: 'queued',
        // A redirect means the mail went to the account owner instead of the
        // recipient, which the run record has to say out loud.
        detail: queued.redirected
          ? `delivery ${queued.deliveryId} (redirected to ${queued.to})`
          : `delivery ${queued.deliveryId}`,
      };
    }

    // ── Task ────────────────────────────────────────────────────────────────
    case 'create_task': {
      const assignedTo = resolveRecipient(action, run.payload);
      if (!assignedTo) return { ...base, status: 'skipped', reason: 'no_assignee' };
      const assignee = await loadInOrg(ctx, 'users', assignedTo, run.organizationId);
      if (!assignee) {
        return { ...base, status: 'skipped', reason: 'assignee_not_in_organization' };
      }
      const title = readParam(action, run.payload, ['title'], ['title']);
      if (!title) return { ...base, status: 'skipped', reason: 'no_title' };
      const now = Date.now();
      const dueInDays = Number(action.parameters.dueInDays);
      const deadline =
        Number.isFinite(dueInDays) && dueInDays > 0
          ? now + Math.round(dueInDays) * 86_400_000
          : undefined;
      await ctx.db.insert('tasks', {
        organizationId: run.organizationId,
        title,
        description: readParam(action, run.payload, ['description'], []) ?? undefined,
        assignedTo,
        assignedBy: run.actorId,
        status: 'pending',
        priority: isTaskPriority(action.parameters.priority)
          ? action.parameters.priority
          : 'medium',
        deadline,
        createdAt: now,
        updatedAt: now,
      });
      return { ...base, status: 'done' };
    }

    // ── Escalation ──────────────────────────────────────────────────────────
    case 'escalate': {
      const targets = await findEscalationTargets(ctx, run.organizationId, run.actorId);
      if (targets.length === 0) {
        return { ...base, status: 'skipped', reason: 'no_escalation_target' };
      }
      const title =
        readParam(action, run.payload, ['title'], []) ?? `Escalation: ${run.workflowName}`;
      const message =
        readParam(action, run.payload, ['message'], []) ??
        `The workflow "${run.workflowName}" escalated an event of type ${run.eventType}.`;
      for (const userId of targets) {
        await notifyUser(ctx, run.organizationId, userId, title, message, {
          actionType: 'escalate',
          workflowName: run.workflowName,
          eventType: run.eventType,
        });
      }
      return { ...base, status: 'done', detail: `${targets.length} recipient(s)` };
    }

    // ── Reassign a task ─────────────────────────────────────────────────────
    case 'assign_user': {
      const assigneeId = toId(ctx, 'users', readParam(action, run.payload, ['userId'], ['userId']));
      const taskId = toId(ctx, 'tasks', readParam(action, run.payload, ['taskId'], ['taskId']));
      if (!assigneeId) return { ...base, status: 'skipped', reason: 'no_assignee' };
      if (!taskId) return { ...base, status: 'skipped', reason: 'no_task' };
      const assignee = await loadInOrg(ctx, 'users', assigneeId, run.organizationId);
      if (!assignee) {
        return { ...base, status: 'skipped', reason: 'assignee_not_in_organization' };
      }
      const task = await loadInOrg(ctx, 'tasks', taskId, run.organizationId);
      if (!task) return { ...base, status: 'skipped', reason: 'task_not_in_organization' };
      await ctx.db.patch(taskId, { assignedTo: assigneeId, updatedAt: Date.now() });
      return { ...base, status: 'done' };
    }

    // ── Leave decisions ─────────────────────────────────────────────────────
    // Delegated to the real approval pipeline rather than reimplemented here:
    // approving a leave deducts balance, closes the SLA metric and schedules the
    // countersignature document. Doing any of that by hand in this file is how
    // balances silently drift from the UI's arithmetic.
    case 'approve_request':
    case 'reject_request': {
      const requestId = toId(
        ctx,
        'leaveRequests',
        readParam(action, run.payload, ['requestId', 'leaveId'], ['requestId', 'leaveId']),
      );
      if (!requestId) return { ...base, status: 'skipped', reason: 'no_request' };
      const leave = await loadInOrg(ctx, 'leaveRequests', requestId, run.organizationId);
      if (!leave) return { ...base, status: 'skipped', reason: 'request_not_in_organization' };

      const comment = readParam(action, run.payload, ['comment'], []) ?? undefined;
      const approving = action.actionType === 'approve_request';
      try {
        if (approving) {
          await ctx.runMutation(internal.leaves.mutations.approveLeaveInternal, {
            leaveId: requestId,
            reviewerId: run.actorId,
            comment,
            workflowName: run.workflowName,
          });
        } else {
          await ctx.runMutation(internal.leaves.mutations.rejectLeaveInternal, {
            leaveId: requestId,
            reviewerId: run.actorId,
            comment,
            workflowName: run.workflowName,
          });
        }
        return { ...base, status: 'done' };
      } catch (error) {
        // The pipeline refuses for good reasons — not pending, outside the
        // reviewer's reporting line, unsigned document. The refusal is the
        // outcome, and a run that reports "you are not allowed to do this" is
        // far more useful than one that pretends to have decided.
        return {
          ...base,
          status: 'failed',
          reason: 'request_refused',
          detail: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // ── Deactivate an account ───────────────────────────────────────────────
    case 'block_user': {
      // Explicit id only — never the event's user. See `readParam`.
      const userId = toId(ctx, 'users', readParam(action, run.payload, ['userId'], []));
      if (!userId) return { ...base, status: 'skipped', reason: 'no_user' };
      if (userId === run.actorId) {
        // An automation deactivating its own author locks the door from outside.
        return { ...base, status: 'skipped', reason: 'refuses_self' };
      }
      const user = await loadInOrg(ctx, 'users', userId, run.organizationId);
      if (!user) return { ...base, status: 'skipped', reason: 'user_not_in_organization' };
      if (!user.isActive) return { ...base, status: 'skipped', reason: 'already_inactive' };

      const now = Date.now();
      await ctx.db.patch(userId, { isActive: false, updatedAt: now });
      await ctx.db.insert('auditLogs', {
        organizationId: run.organizationId,
        userId: run.actorId,
        action: 'user_deactivated_by_automation',
        target: userId,
        details: JSON.stringify({
          workflowId: run.workflowId,
          workflowName: run.workflowName,
        }),
        createdAt: now,
      });
      return { ...base, status: 'done', detail: user.email };
    }

    // ── Outbound webhook ────────────────────────────────────────────────────
    case 'webhook': {
      // Routed through the registered-endpoint pipeline rather than POSTing to a
      // URL from the config: that path is already signed, retried with backoff,
      // dead-lettered and audited, and it keeps an automation from becoming an
      // open request-forgery primitive pointed at arbitrary hosts.
      const result = await ctx.runMutation(internal.webhooks.main.emitEvent, {
        eventType: WORKFLOW_WEBHOOK_EVENT,
        organizationId: run.organizationId,
        data: {
          workflowId: run.workflowId,
          workflowName: run.workflowName,
          eventType: run.eventType,
          payload: run.payload,
          occurredAt: Date.now(),
        },
      });
      if (result.queued === 0) {
        return { ...base, status: 'skipped', reason: 'no_webhook_endpoint' };
      }
      return { ...base, status: 'done', detail: `${result.queued} endpoint(s)` };
    }

    default: {
      // Only reachable if the catalogue marks an action implemented without a
      // case here. `src/__tests__/workflowCatalogue.test.ts` pins the implemented
      // list, so adding an action without implementing it — or renaming one —
      // fails there rather than at runtime. This branch reports it either way,
      // because a run that silently did nothing is the outcome we care about.
      return { ...base, status: 'unsupported', reason: 'action_not_implemented' };
    }
  }
}

function isTaskPriority(value: unknown): value is 'low' | 'medium' | 'high' | 'urgent' {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'urgent';
}

// ── Stage execution ──────────────────────────────────────────────────────────

function runStatus(results: ActionResult[]): 'completed' | 'failed' {
  return results.some((r) => r.status === 'failed') ? 'failed' : 'completed';
}

/**
 * Execute the first stage, then either finish or park the rest.
 *
 * Returns the results accumulated so far and whether the run is now waiting.
 * The caller finalises the run record only when nothing is waiting — otherwise a
 * delayed run would look `completed` while its later actions had not run yet.
 */
async function runStages(
  ctx: MutationCtx,
  run: RunContext,
  taskId: Id<'automationTasks'>,
  stages: PlanStage[],
  done: ActionResult[],
  trace: PlanTraceEntry[],
): Promise<{ results: ActionResult[]; waiting: boolean }> {
  const current = stages[0];
  if (!current) return { results: done, waiting: false };

  const results = [...done];
  for (const action of current.actions) {
    results.push(await performAction(ctx, run, action));
  }

  const rest = stages.slice(1);
  if (rest.length === 0) return { results, waiting: false };

  // `delayToMs` already clamps to 30 days; a negative can only come from a
  // hand-edited row, and sleeping "minus one hour" means running now.
  const waitMs = Math.max(0, rest[0]!.delayMs);
  const now = Date.now();
  const pendingRunId = await ctx.db.insert('automationPendingRuns', {
    organizationId: run.organizationId,
    workflowId: run.workflowId,
    workflowName: run.workflowName,
    actorId: run.actorId,
    taskId,
    remaining: rest,
    done: results,
    trace,
    resumeAt: now + waitMs,
    createdAt: now,
  });
  await ctx.scheduler.runAfter(waitMs, internal.automationRunner.resumePendingRun, {
    pendingRunId,
  });
  return { results, waiting: true };
}

/** Write the terminal state of a run onto its record. */
async function finaliseRun(
  ctx: MutationCtx,
  taskId: Id<'automationTasks'>,
  results: ActionResult[],
  trace: PlanTraceEntry[],
  delayMs: number,
): Promise<void> {
  await ctx.db.patch(taskId, {
    status: runStatus(results),
    result: { trace, actions: results, delayMs },
    updatedAt: Date.now(),
  });
}

// ── Resume a delayed run ─────────────────────────────────────────────────────

/**
 * Continue a run that was waiting out a `delay` step.
 *
 * Runs as an `internalMutation` from the scheduler with no user context, so it
 * re-reads everything it needs from the pending row and refuses to continue if
 * the workflow has since been paused or deleted.
 */
export const resumePendingRun = internalMutation({
  args: { pendingRunId: v.id('automationPendingRuns') },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingRunId);
    if (!pending) return { resumed: false, reason: 'not_found' };

    // Claim the row first: if this function is re-entered, the second call finds
    // nothing and stops instead of running the same actions twice.
    await ctx.db.delete(args.pendingRunId);

    const workflow = await ctx.db.get(pending.workflowId);
    if (!workflow) {
      await ctx.db.patch(pending.taskId, {
        status: 'failed',
        error: 'Workflow was deleted while a delay was pending',
        updatedAt: Date.now(),
      });
      return { resumed: false, reason: 'workflow_deleted' };
    }
    if (!workflow.isActive) {
      await ctx.db.patch(pending.taskId, {
        status: 'failed',
        error: 'Workflow was paused while a delay was pending',
        updatedAt: Date.now(),
      });
      return { resumed: false, reason: 'workflow_paused' };
    }

    const run: RunContext = {
      organizationId: pending.organizationId,
      workflowId: pending.workflowId,
      workflowName: pending.workflowName,
      actorId: pending.actorId,
      // The triggering event is long past; the payload is not re-injected because
      // re-running conditions against a re-read of live data is how an automation
      // starts acting on facts nobody approved.
      eventType: 'resumed',
      payload: {},
    };

    const stages = pending.remaining as PlanStage[];
    const done = pending.done as ActionResult[];
    const trace = pending.trace as PlanTraceEntry[];

    const { results, waiting } = await runStages(ctx, run, pending.taskId, stages, done, trace);
    if (!waiting) {
      const delayMs = stages.reduce((sum, stage) => sum + stage.delayMs, 0);
      await finaliseRun(ctx, pending.taskId, results, trace, delayMs);
    }
    return { resumed: true, waiting };
  },
});

// ── Run one workflow ─────────────────────────────────────────────────────────

interface WorkflowRow {
  _id: Id<'automationWorkflows'>;
  name: string;
  config: unknown;
  isActive: boolean;
  organizationId?: Id<'organizations'>;
  createdBy?: Id<'users'>;
}

/**
 * Who a run is attributed to.
 *
 * The workflow's author, because that is the person whose rule this is and whose
 * name has to appear in the audit trail of, say, an automated approval. Legacy
 * rows written before `createdBy` existed fall back to an org admin, and an
 * organisation with no admin at all simply cannot run automations.
 */
async function resolveRunActor(
  ctx: MutationCtx,
  workflow: WorkflowRow,
  organizationId: Id<'organizations'>,
): Promise<Id<'users'> | null> {
  if (workflow.createdBy) {
    const author = await ctx.db.get(workflow.createdBy);
    if (author?.organizationId === organizationId && author.isActive) return author._id;
  }
  const members = await ctx.db
    .query('users')
    .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
    .take(200);
  const admin = members.find((m) => m.isActive && (isSuperadmin(m) || m.role === 'admin'));
  return admin?._id ?? null;
}

interface WorkflowRunOutcome {
  workflowId: Id<'automationWorkflows'>;
  name: string;
  plan: WorkflowPlan;
  actions: ActionResult[];
  status: 'completed' | 'failed';
  taskId: Id<'automationTasks'> | null;
}

/**
 * Manual-run variant of the plan: same conditions, no event-type requirement.
 *
 * Kept here rather than in the pure engine because "ignore the trigger because a
 * human asked" is an execution decision, not a property of the workflow.
 */
function planIgnoringEventType(
  config: unknown,
  event: { type: string; payload: Record<string, unknown> },
): WorkflowPlan {
  const steps = normalizeWorkflowConfig(config);
  const triggerIndex = steps.findIndex((step) => step.type === 'trigger');
  if (triggerIndex === -1) return planRun(config, event);
  const patched = steps.map((step, index) =>
    index === triggerIndex ? { ...step, config: { ...step.config, eventType: event.type } } : step,
  );
  return planRun({ steps: patched }, event);
}

async function executeWorkflow(
  ctx: MutationCtx,
  workflow: WorkflowRow,
  event: { type: string; payload: Record<string, unknown> },
  options: { skipTriggerMatch: boolean; actorOverride?: Id<'users'> },
): Promise<WorkflowRunOutcome> {
  let plan = planRun(workflow.config, event);
  if (!plan.matched && options.skipTriggerMatch) {
    plan = planIgnoringEventType(workflow.config, event);
  }

  const organizationId = workflow.organizationId;
  if (!plan.matched || !organizationId) {
    return {
      workflowId: workflow._id,
      name: workflow.name,
      plan,
      actions: [],
      status: 'completed',
      taskId: null,
    };
  }

  const actorId = options.actorOverride ?? (await resolveRunActor(ctx, workflow, organizationId));
  if (!actorId) {
    return {
      workflowId: workflow._id,
      name: workflow.name,
      plan: {
        ...plan,
        matched: false,
        reason: 'no_actor',
        actions: [],
        stages: [],
      },
      actions: [],
      status: 'failed',
      taskId: null,
    };
  }

  const now = Date.now();
  const taskId = await ctx.db.insert('automationTasks', {
    organizationId,
    name: workflow.name,
    status: 'running',
    result: { trace: plan.trace, actions: [], delayMs: plan.totalDelayMs, startedAt: now },
    createdAt: now,
    updatedAt: now,
  });

  const run: RunContext = {
    organizationId,
    workflowId: workflow._id,
    workflowName: workflow.name,
    actorId,
    eventType: event.type,
    payload: event.payload,
  };

  const { results, waiting } = await runStages(ctx, run, taskId, plan.stages, [], plan.trace);
  if (!waiting) {
    await finaliseRun(ctx, taskId, results, plan.trace, plan.totalDelayMs);
  }

  return {
    workflowId: workflow._id,
    name: workflow.name,
    plan,
    actions: results,
    status: runStatus(results),
    taskId,
  };
}

// ── Entry point: run every workflow of an organisation for an event ──────────

/**
 * Evaluate every active workflow of an organisation against one event.
 *
 * This is the function a domain event calls — one call per event, not one per
 * workflow, so a tenant with 40 workflows still costs one lookup and the
 * evaluation order is stable.
 *
 * `eventType` is the *trigger id* the builder writes into a config
 * (`leave_created`, `user_onboarded`, …), not the domain event name; the mapping
 * between the two vocabularies lives in `lib/workflowActions.ts` and is applied
 * by `lib/workflowEvents.ts`.
 */
export const runWorkflowsForEvent = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const workflows = await ctx.db
      .query('automationWorkflows')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .collect();
    const active = workflows.filter((workflow) => workflow.isActive);

    const payload =
      args.payload && typeof args.payload === 'object'
        ? (args.payload as Record<string, unknown>)
        : {};
    const event = { type: args.eventType, payload };

    let matched = 0;
    let waiting = 0;
    for (const workflow of active) {
      const outcome = await executeWorkflow(ctx, workflow as WorkflowRow, event, {
        skipTriggerMatch: false,
      });
      // Only workflows that actually applied are counted and logged: rows for
      // every non-matching workflow would bury the ones that did something.
      if (outcome.taskId !== null) {
        matched += 1;
        // More than one stage is exactly the condition under which `runStages`
        // parks a continuation — not `totalDelayMs > 0`, which also counts a
        // trailing delay with nothing after it.
        if (outcome.plan.stages.length > 1) waiting += 1;
      }
    }

    return { evaluated: active.length, matched, waiting };
  },
});

// ── Manual run (tenant-facing "Run now") ─────────────────────────────────────

/**
 * Run one workflow immediately, from the admin UI.
 *
 * Trigger conditions still apply — they are the author's own guard rails — but
 * the event-type filter does not: the admin asked for *this* workflow. The real
 * actions execute and a real trace is recorded, replacing the placeholder that
 * waited two seconds and reported success without reading the config at all.
 */
export const runWorkflowNow = mutation({
  args: { workflowId: v.id('automationWorkflows') },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    const requester = await ctx.db.get(caller._id);
    if (!requester) throw new Error('Requester not found');
    if (!isSuperadmin(requester) && requester.role !== 'admin') {
      throw new Error('Only administrators can run workflows');
    }
    await assertModuleAccess(ctx, 'automation');

    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) throw new Error('Workflow not found');
    const organizationId = requester.organizationId as Id<'organizations'> | undefined;

    // Platform-level workflows (no organisation) stay superadmin-only; a tenant
    // admin must never be able to trigger one against their own data.
    if (workflow.organizationId === undefined) {
      if (!isSuperadmin(requester)) throw new Error('Access denied');
    } else if (workflow.organizationId !== organizationId) {
      throw new Error('Access denied');
    }
    if (!workflow.isActive) throw new Error('This workflow is paused');

    const outcome = await executeWorkflow(
      ctx,
      workflow as WorkflowRow,
      { type: 'manual', payload: {} },
      { skipTriggerMatch: true, actorOverride: caller._id },
    );

    return {
      success: true,
      taskId: outcome.taskId,
      executed: outcome.actions,
      matched: outcome.plan.matched,
      reason: outcome.plan.reason,
      // True when a `delay` step parked the remainder — the UI says "started"
      // rather than "done", because the later actions have not run yet.
      scheduled: outcome.plan.stages.length > 1,
    };
  },
});
