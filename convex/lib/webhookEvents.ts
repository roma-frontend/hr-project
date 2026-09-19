/**
 * Domain-event fan-out: when something happens, tell everyone who asked.
 *
 * Two consumers subscribe to the same business events and they used to be wired
 * independently — outbound webhooks through this module, tenant workflows not at
 * all. That gap was the reason `/automation` had a "Run now" button and nothing
 * else: a workflow could be saved, listed, shown as active, and never once fire,
 * because no code path called the runner.
 *
 * So this module now fans one event out to both. Webhooks and workflows are the
 * same signal at two levels of abstraction (an external system definitely wants
 * each leave request; an internal automation might), and publishing it from one
 * place means a third consumer — a queue, a metrics sink — is one more branch
 * here rather than a hunt for every call site.
 *
 * Design rules, unchanged from the webhook-only version:
 *  - NEVER throw: an outage in either consumer must not fail the business
 *    operation that triggered it. Errors are reported and swallowed.
 *  - NEVER block meaningfully: webhook fan-out is indexed reads plus inserts
 *    inside the caller's transaction, and the workflow runner is a nested
 *    mutation that no-ops in one `by_org` query when the org has no workflows.
 *  - Resolved lazily via `internal` to avoid a static circular import between
 *    convex/lib and feature modules.
 */
import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { triggerForDomainEvent } from './workflowActions';

type LeaveEventType = 'leave.requested' | 'leave.approved' | 'leave.rejected' | 'leave.cancelled';

type EmployeeEventType = 'employee.created' | 'employee.updated' | 'employee.deactivated';

/**
 * Dispatch one automation trigger to the organisation's workflows.
 *
 * Separate from webhook emission because the two catalogues are not the same,
 * and pretending otherwise would either invent public webhook events or leave
 * triggers permanently unwired:
 *
 *   - `leave.*` / `employee.*` are **published** events. They exist in
 *     `WEBHOOK_EVENT_TYPES`, are documented in `docs/webhooks.md` and are
 *     exposed in the Zapier app, so a new consumer can join them safely.
 *   - `ticket_created`, `ticket_escalated`, `performance_review_due` and
 *     `probation_ending` are **internal** triggers. Nothing outside the product
 *     subscribes to them, and adding them to the public event list would be a
 *     promise to customers that nobody asked for. They go to workflows only.
 *
 * Never throws: a workflow misconfiguration must not fail the business operation
 * that fired the event.
 */
export async function triggerWorkflows(
  ctx: MutationCtx,
  triggerId: string,
  organizationId: Id<'organizations'>,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await ctx.runMutation(internal.automationRunner.runWorkflowsForEvent, {
      organizationId,
      eventType: triggerId,
      payload,
    });
  } catch (error) {
    console.error(`[automation] failed to dispatch ${triggerId}:`, error);
  }
}

/**
 * Publish one domain event to outbound webhooks and to tenant workflows.
 *
 * Both branches catch independently: a failing webhook must not stop an
 * automation from running, and neither may propagate into the caller.
 */
async function fanOut(
  ctx: MutationCtx,
  eventType: LeaveEventType | EmployeeEventType,
  organizationId: Id<'organizations'>,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await ctx.runMutation(internal.webhooks.main.emitEvent, {
      eventType,
      organizationId,
      data,
    });
  } catch (error) {
    console.error(`[webhooks] failed to emit ${eventType}:`, error);
  }

  // Not every domain event has a workflow trigger (there is no
  // `employee.updated` one), and a workflow only ever listens for the trigger id
  // the builder writes into its config.
  const triggerId = triggerForDomainEvent(eventType);
  if (!triggerId) return;

  await triggerWorkflows(ctx, triggerId, organizationId, { ...data, eventType });
}

/**
 * Emit a `leave.*` event. The leave row is re-read (indexed get) to resolve the
 * organizationId so call-sites don't have to pass it — leaves are always
 * org-scoped.
 *
 * The `data` payload doubles as the workflow event payload, which is why
 * call sites already include `leaveId`: the `approve_request` / `reject_request`
 * actions read it to find the request they were configured to act on.
 */
export async function emitLeaveEvent(
  ctx: MutationCtx,
  eventType: LeaveEventType,
  leaveId: Id<'leaveRequests'>,
  data: Record<string, unknown>,
): Promise<void> {
  const leave = await ctx.db.get(leaveId);
  if (!leave?.organizationId) return;
  await fanOut(ctx, eventType, leave.organizationId, data);
}

/**
 * Emit an `employee.*` event from the raw user row.
 *
 * `employee.created` and `employee.deactivated` were both declared in
 * `WEBHOOK_EVENT_TYPES` and published in the docs and the Zapier app while
 * nothing in the product ever fired them — a customer could subscribe and wait
 * forever. This is the emitter they were missing, and it is also what makes the
 * `user_onboarded` / `user_offboarded` workflow triggers real.
 */
export async function emitUserEvent(
  ctx: MutationCtx,
  eventType: EmployeeEventType,
  userId: Id<'users'>,
  data: Record<string, unknown>,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user?.organizationId) return;
  await fanOut(ctx, eventType, user.organizationId, {
    userId,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    ...data,
  });
}
