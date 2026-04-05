/**
 * Migration: Backfill organizationId on existing tasks
 *
 * For each task without organizationId, look up the assignedBy user
 * and copy their organizationId onto the task.
 *
 * Run once via: npx convex run migrateTaskOrgId:migrateOrgIdOnTasks
 */

import { action } from './_generated/server';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

export const migrateOrgIdOnTasks = action({
  args: {},
  handler: async (ctx) => {
    let totalProcessed = 0;

    // Get all tasks (raw, without filtering)
    const allTasks = await ctx.runQuery(api.tasks.getAllTasksRaw, {});
    const tasksWithoutOrg = allTasks.filter((t: any) => !t.organizationId);

    console.log(`Found ${tasksWithoutOrg.length} tasks without organizationId`);

    for (const task of tasksWithoutOrg) {
      const assignedByUser = await ctx.runQuery(api.users.queries.getUserById, {
        userId: task.assignedBy as Id<'users'>,
      });

      const orgId = assignedByUser?.organizationId;

      if (orgId) {
        await ctx.runMutation(api.tasks.backfillTaskOrg, {
          taskId: task._id as Id<'tasks'>,
          organizationId: orgId as Id<'organizations'>,
        });
        totalProcessed++;
      }
    }

    console.log(`✅ Migration complete. Processed ${totalProcessed} tasks.`);
    return { success: true, processed: totalProcessed };
  },
});
