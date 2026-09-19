import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const automation = {
  automationRules: defineTable({
    organizationId: v.optional(v.id('organizations')),
    name: v.string(),
    description: v.string(),
    trigger: v.object({
      type: v.union(
        v.literal('leave_created'),
        v.literal('leave_pending_hours'),
        v.literal('user_inactive_days'),
        v.literal('sla_breach'),
        v.literal('multiple_failed_logins'),
        v.literal('ticket_created'),
        v.literal('ticket_priority'),
      ),
      conditions: v.any(),
    }),
    actions: v.array(
      v.object({
        type: v.union(
          v.literal('auto_approve'),
          v.literal('auto_reject'),
          v.literal('send_notification'),
          v.literal('escalate'),
          v.literal('create_ticket'),
          v.literal('block_user'),
          v.literal('assign_user'),
        ),
        parameters: v.any(),
      }),
    ),
    isActive: v.boolean(),
    executionCount: v.number(),
    lastExecutedAt: v.optional(v.number()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_active', ['isActive'])
    .index('by_trigger', ['trigger']),

  /**
   * Workflow definitions.
   *
   * `organizationId` is what keeps one tenant's automations out of another's:
   * while it was absent every row was global, so any signed-in user could list
   * and delete workflows belonging to every other organisation. An entry with no
   * `organizationId` is platform-level and reachable only by superadmins.
   */
  automationWorkflows: defineTable({
    /** Absent = platform-level row, superadmin only. */
    organizationId: v.optional(v.id('organizations')),
    name: v.string(),
    description: v.optional(v.string()),
    config: v.any(),
    isActive: v.boolean(),
    createdBy: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_active', ['isActive'])
    .index('by_org', ['organizationId']),

  automationTasks: defineTable({
    /** Absent = platform-level run. */
    organizationId: v.optional(v.id('organizations')),
    name: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_org', ['organizationId'])
    .index('by_created', ['createdAt']),

  /**
   * A workflow run that is waiting out a `delay` step.
   *
   * `planRun` splits a workflow into stages — `action, delay 1h, action` is two
   * stages — and the runner executes the first immediately, then parks the rest
   * here with the remaining stages verbatim. Storing the resolved stages rather
   * than re-planning from the config later is deliberate: the event payload is
   * gone by then, and conditions that were evaluated against it must not be
   * re-decided against a re-read of live data.
   *
   * One row per waiting run; deleted when it resumes. A row whose workflow was
   * paused or deleted in the meantime is dropped on resume rather than run: a
   * delay is not a licence to execute a workflow somebody has since switched off.
   */
  automationPendingRuns: defineTable({
    organizationId: v.id('organizations'),
    workflowId: v.id('automationWorkflows'),
    workflowName: v.string(),
    /** Who the run is attributed to (the admin who configured it). */
    actorId: v.id('users'),
    /** Run record this continuation appends its results to. */
    taskId: v.id('automationTasks'),
    /** Remaining stages, exactly as `planRun` produced them. */
    remaining: v.any(),
    /** Already-completed actions, carried forward into the run record. */
    done: v.any(),
    /** Trace of the steps already considered, carried forward for the audit. */
    trace: v.any(),
    /** When the next stage becomes due. */
    resumeAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_resume', ['resumeAt'])
    .index('by_workflow', ['workflowId']),
};
