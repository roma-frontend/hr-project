/**
 * Automation — read model for the automation dashboard.
 *
 * These queries used to be unauthenticated and unscoped: they returned every
 * task and workflow row on the platform to whoever asked. Both problems are the
 * same problem — the tables had no organisation, so the only possible answer to
 * "what may this caller see?" was "everything".
 *
 * Visibility is now:
 *   - superadmin  → platform rows (no `organizationId`) and every org's rows;
 *   - org admin   → rows belonging to their own organisation only.
 *
 * Everyone else is refused: the dashboard is an administrative surface, and the
 * client-side superadmin check that used to guard it was cosmetic.
 */

import { query } from './_generated/server';
import { v } from 'convex/values';
import { DEFAULT_LIST_CAP, XLARGE_LIST_CAP } from './lib/limits';
import { getAuthCaller } from './lib/getAuthCaller';
import { isSuperadmin } from './lib/auth';
import { assertModuleAccess } from './lib/entitlements';
import type { Id } from './_generated/dataModel';

/**
 * Resolve who is asking and what they may see. Also applies the `automation`
 * plan gate, so the entitlement is checked on read as well as on write.
 */
async function requireAutomationViewer(ctx: Parameters<typeof getAuthCaller>[0]) {
  const caller = await getAuthCaller(ctx);
  if (!caller) throw new Error('Not authenticated');

  const requester = await ctx.db.get(caller._id);
  if (!requester) throw new Error('Requester not found');

  const superadmin = isSuperadmin(requester);
  await assertModuleAccess(ctx, 'automation');

  if (!superadmin && requester.role !== 'admin') {
    throw new Error('Access denied');
  }

  return {
    superadmin,
    organizationId: requester.organizationId as Id<'organizations'> | undefined,
  };
}

/** True when this row is visible to the viewer resolved above. */
function isVisible(
  row: { organizationId?: Id<'organizations'> },
  viewer: { superadmin: boolean; organizationId?: Id<'organizations'> },
): boolean {
  if (row.organizationId === undefined) return viewer.superadmin;
  return viewer.superadmin || row.organizationId === viewer.organizationId;
}

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireAutomationViewer(ctx);

    const allTasks = await ctx.db.query('automationTasks').take(XLARGE_LIST_CAP);
    const allWorkflows = await ctx.db.query('automationWorkflows').take(DEFAULT_LIST_CAP);

    const tasks = allTasks.filter((task) => isVisible(task, viewer));
    const workflows = allWorkflows.filter((workflow) => isVisible(workflow, viewer));

    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7d = now - 7 * 24 * 60 * 60 * 1000;

    const recentTasks = tasks.filter((t) => t.createdAt > last24h);
    const previousTasks = tasks.filter((t) => t.createdAt > last7d && t.createdAt <= last24h);

    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
    const failedTasks = tasks.filter((t) => t.status === 'failed').length;

    const completedTrend = calculateTrend(
      tasks.filter((t) => t.status === 'completed' && t.createdAt > last24h).length,
      previousTasks.filter((t) => t.status === 'completed').length,
    );

    const pendingTrend = calculateTrend(
      tasks.filter((t) => t.status === 'pending' && t.createdAt > last24h).length,
      previousTasks.filter((t) => t.status === 'pending').length,
    );

    const failedTrend = calculateTrend(
      tasks.filter((t) => t.status === 'failed' && t.createdAt > last24h).length,
      previousTasks.filter((t) => t.status === 'failed').length,
    );

    const tasksTrend = calculateTrend(recentTasks.length, previousTasks.length);

    return {
      totalTasks: tasks.length,
      completedTasks,
      pendingTasks,
      failedTasks,
      tasksTrend,
      completedTrend,
      pendingTrend,
      failedTrend,
      activeWorkflows: workflows.filter((w) => w.isActive).length,
    };
  },
});

export const getRecentTasks = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await requireAutomationViewer(ctx);
    const limit = args?.limit ?? 10;

    // Filter first, then cap: a limit applied before the visibility filter would
    // let platform rows crowd out the caller's own tasks.
    const tasks = await ctx.db.query('automationTasks').order('desc').take(XLARGE_LIST_CAP);
    return tasks.filter((task) => isVisible(task, viewer)).slice(0, limit);
  },
});

export const getActiveWorkflows = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireAutomationViewer(ctx);
    const workflows = await ctx.db.query('automationWorkflows').take(DEFAULT_LIST_CAP);
    return workflows.filter((workflow) => isVisible(workflow, viewer));
  },
});

function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
