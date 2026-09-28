import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const scheduledReports = {
  scheduledReports: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    reportType: v.union(
      v.literal('leaves_summary'),
      v.literal('attendance_digest'),
      v.literal('tasks_overview'),
      v.literal('headcount_analytics'),
    ),
    frequency: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
    dayOfWeek: v.optional(v.number()), // 1 (Mon) to 7 (Sun) for weekly
    dayOfMonth: v.optional(v.number()), // 1 to 31 for monthly
    timeOfDayUTC: v.string(), // "09:00" format
    recipients: v.array(v.string()), // Email addresses
    isEnabled: v.boolean(),
    lastRunAt: v.optional(v.number()),
    lastStatus: v.optional(v.union(v.literal('success'), v.literal('error'))),
    lastError: v.optional(v.string()),
    nextRunAt: v.number(),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_enabled', ['organizationId', 'isEnabled'])
    .index('by_nextRunAt', ['isEnabled', 'nextRunAt']),
};
