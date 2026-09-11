/**
 * Fire-and-forget webhook emission helpers for product mutations.
 *
 * Design rules:
 *  - NEVER throw: a webhook outage must not fail the business operation that
 *    triggered it. All errors are swallowed after being reported.
 *  - NEVER block meaningfully: emission is two indexed reads + a few inserts
 *    inside the caller's transaction (atomic with the business write); HTTP
 *    delivery happens later in the worker action.
 *  - Resolved lazily via `internal` to avoid a static circular import between
 *    convex/lib and feature modules.
 */
import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';

type LeaveEventType = 'leave.requested' | 'leave.approved' | 'leave.rejected' | 'leave.cancelled';

/**
 * Emit a `leave.*` webhook event. The leave row is re-read (indexed get) to
 * resolve the organizationId so call-sites don't have to pass it — leaves are
 * always org-scoped.
 */
export async function emitLeaveEvent(
  ctx: MutationCtx,
  eventType: LeaveEventType,
  leaveId: Id<'leaveRequests'>,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const leave = await ctx.db.get(leaveId);
    if (!leave?.organizationId) return;
    await ctx.runMutation(internal.webhooks.main.emitEvent, {
      eventType,
      organizationId: leave.organizationId,
      data,
    });
  } catch (error) {
    console.error(`[webhooks] failed to emit ${eventType} for ${leaveId}:`, error);
  }
}
