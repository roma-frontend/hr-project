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
};
