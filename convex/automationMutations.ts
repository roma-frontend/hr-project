/**
 * Automation — writes.
 *
 * Every handler here previously ran `assertModuleAccess` and nothing else. That
 * helper is a *plan* gate: it deliberately treats a missing identity as passing,
 * because each caller is supposed to do its own authorisation. These handlers did
 * not, so any signed-in user could create workflows and `deleteWorkflow` would
 * remove a row by id with no ownership check at all — on a table that had no
 * organisation column, meaning one tenant could delete another's.
 *
 * Authorisation is now explicit, and every write is stamped with the caller's
 * organisation so the read model can scope it.
 */

import { mutation, internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { assertModuleAccess } from './lib/entitlements';
import { getAuthCaller } from './lib/getAuthCaller';
import { isSuperadmin } from './lib/auth';
import type { Id } from './_generated/dataModel';

type OrgId = Id<'organizations'>;

/**
 * Resolve the caller, apply the plan gate, and require an org admin.
 * `allowPlatform` marks the two operations a superadmin may perform on
 * platform-level rows (those with no organisation).
 */
async function requireAutomationAdmin(ctx: Parameters<typeof getAuthCaller>[0]) {
  const caller = await getAuthCaller(ctx);
  if (!caller) throw new Error('Not authenticated');

  const requester = await ctx.db.get(caller._id);
  if (!requester) throw new Error('Requester not found');

  const superadmin = isSuperadmin(requester);
  await assertModuleAccess(ctx, 'automation');

  if (!superadmin && requester.role !== 'admin') {
    throw new Error('Only administrators can manage automations');
  }

  return {
    requesterId: caller._id,
    superadmin,
    organizationId: requester.organizationId as OrgId | undefined,
  };
}

/** A caller may touch platform rows as superadmin, and their own org's rows. */
function assertOwnership(
  row: { organizationId?: OrgId },
  actor: { superadmin: boolean; organizationId?: OrgId },
): void {
  if (row.organizationId === undefined) {
    if (!actor.superadmin) throw new Error('Access denied');
    return;
  }
  if (!actor.superadmin && row.organizationId !== actor.organizationId) {
    throw new Error('Access denied');
  }
}

/**
 * Organisation to stamp on a new row. Superadmins without an organisation create
 * platform-level rows; everyone else must belong to one.
 */
function resolveTargetOrg(actor: {
  superadmin: boolean;
  organizationId?: OrgId;
}): OrgId | undefined {
  if (actor.superadmin && !actor.organizationId) return undefined;
  if (!actor.organizationId) throw new Error('No organisation for this account');
  return actor.organizationId;
}

// Public mutation that triggers the action
export const runAutomation = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await requireAutomationAdmin(ctx);

    const taskId = await ctx.db.insert('automationTasks', {
      organizationId: resolveTargetOrg(actor),
      name: 'Manual automation run',
      status: 'running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, taskId };
  },
});

// Internal mutations for action
export const createAutomationTask = internalMutation({
  args: {
    name: v.string(),
    organizationId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert('automationTasks', {
      organizationId: args.organizationId,
      name: args.name,
      status: 'running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return taskId;
  },
});

export const completeAutomationTask = internalMutation({
  args: { taskId: v.id('automationTasks') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      status: 'completed',
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const toggleWorkflow = mutation({
  args: { workflowId: v.id('automationWorkflows') },
  handler: async (ctx, args) => {
    const actor = await requireAutomationAdmin(ctx);

    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    assertOwnership(workflow, actor);

    await ctx.db.patch(args.workflowId, {
      isActive: !workflow.isActive,
      updatedAt: Date.now(),
    });

    return { success: true, isActive: !workflow.isActive };
  },
});

export const createWorkflow = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAutomationAdmin(ctx);

    const now = Date.now();
    const workflowId = await ctx.db.insert('automationWorkflows', {
      organizationId: resolveTargetOrg(actor),
      name: args.name,
      description: args.description || '',
      config: args.config as Record<string, unknown>,
      isActive: true,
      createdBy: actor.requesterId,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, workflowId };
  },
});

export const deleteWorkflow = mutation({
  args: { workflowId: v.id('automationWorkflows') },
  handler: async (ctx, args) => {
    const actor = await requireAutomationAdmin(ctx);

    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    assertOwnership(workflow, actor);

    await ctx.db.delete(args.workflowId);
    return { success: true };
  },
});

/**
 * Authorisation probe for the `runAutomation` action.
 *
 * Actions cannot read the database directly, so the identity is resolved here
 * and the decision made in the action. Returns null when the caller is not an
 * administrator, rather than throwing, so the action reports one consistent
 * refusal message.
 */
export const getAutomationActor = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email.toLowerCase()))
      .unique();

    if (!user) return null;
    const superadmin = isSuperadmin(user);
    if (!superadmin && user.role !== 'admin') return null;

    return {
      superadmin,
      organizationId: (user.organizationId as OrgId | undefined) ?? null,
    };
  },
});
