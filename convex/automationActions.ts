/**
 * Automation — actions (operations with delays or external calls).
 *
 * NOTE: this run is still a placeholder. It marks a task running, waits, and
 * marks it complete — no workflow `config` is read or executed anywhere in the
 * codebase. That is why the dashboard is not tenant-facing: exposing a builder
 * whose output never runs would be a worse experience than not showing it.
 *
 * What the action does get right is authorisation, which it previously skipped
 * entirely: it was callable by any signed-in user and wrote a platform-level row.
 */

import { action } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

// Isolate internal API reference at module level to avoid deep type instantiation
const internalAutomation = internal.automationMutations;

interface RunAutomationResult {
  success: boolean;
  taskId: string;
}

export const runAutomation = action({
  args: {},
  handler: async (ctx): Promise<RunAutomationResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) {
      throw new Error('Not authenticated');
    }

    const actor = await ctx.runQuery(internalAutomation.getAutomationActor, {
      email: identity.email,
    });
    if (!actor) {
      throw new Error('Only administrators can run automations');
    }

    // Create the task in the caller's organisation (null = platform-level for a
    // superadmin without an organisation), so the run is visible to the same
    // scope the dashboard reads from.
    const taskId: string = await ctx.runMutation(internalAutomation.createAutomationTask, {
      name: 'Manual automation run',
      organizationId: actor.organizationId ?? undefined,
    });

    // Placeholder execution — see the module note above.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await ctx.runMutation(internalAutomation.completeAutomationTask, {
      taskId: taskId as Id<'automationTasks'>,
    });

    return { success: true, taskId };
  },
});
