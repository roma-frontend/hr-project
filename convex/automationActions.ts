/**
 * Automation — the "run now" entry point (actions with external calls).
 *
 * History worth keeping: this used to be a placeholder. It created a task row,
 * slept two seconds and marked it complete without ever reading a workflow's
 * `config` — which is why the builder was kept out of tenant hands. It now
 * delegates to `automationRunner.runWorkflowNow`, which plans the workflow with
 * `lib/workflowEngine.ts` and performs the real actions.
 *
 * What has NOT changed: authorisation. Every call still resolves the caller to an
 * admin of their own organisation through the runtime `getAuthCaller` path, so a
 * signed-in user cannot run another tenant's workflows.
 */

import { action } from './_generated/server';
import { api } from './_generated/api';

interface RunAutomationResult {
  success: boolean;
  /** Workflows that were executed, in order. */
  ran: number;
  /** Workflows that refused at runtime (paused, wrong org, bad config). */
  failed: number;
}

export const runAutomation = action({
  args: {},
  handler: async (ctx): Promise<RunAutomationResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) {
      throw new Error('Not authenticated');
    }

    // The query applies both the org scope and the `automation` entitlement, so
    // this call is the authorisation gate for the whole action.
    const workflows = await ctx.runQuery(api.automation.getActiveWorkflows, {});
    if (workflows.length === 0) {
      return { success: true, ran: 0, failed: 0 };
    }

    let ran = 0;
    let failed = 0;
    for (const workflow of workflows) {
      if (!workflow.isActive) continue;
      try {
        const result = await ctx.runMutation(api.automationRunner.runWorkflowNow, {
          workflowId: workflow._id,
        });
        if (result.matched) ran += 1;
        else failed += 1;
      } catch {
        // One misconfigured workflow must not abort the batch — the run history
        // shows which ones did nothing and why.
        failed += 1;
      }
    }

    return { success: true, ran, failed };
  },
});
