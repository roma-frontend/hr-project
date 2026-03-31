/**
 * Automation - Actions (for operations with delays, external APIs, etc.)
 */

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const runAutomation = action({
  args: {},
  handler: async (ctx) => {
    // Create a new automation task via internal mutation
    const taskId = await ctx.runMutation(internal.automationMutations.createAutomationTask, {
      name: "Manual automation run",
    });

    // Simulate automation execution with delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update task status via internal mutation
    await ctx.runMutation(internal.automationMutations.completeAutomationTask, {
      taskId: taskId as Id<"automationTasks">,
    });

    return { success: true, taskId };
  },
});
