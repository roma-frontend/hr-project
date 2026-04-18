import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const tickets = {
  supportTickets: defineTable({
    organizationId: v.optional(v.id('organizations')),
    ticketNumber: v.string(),
    title: v.string(),
    description: v.string(),
    priority: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('critical'),
    ),
    status: v.union(
      v.literal('open'),
      v.literal('in_progress'),
      v.literal('waiting_customer'),
      v.literal('resolved'),
      v.literal('closed'),
    ),
    category: v.union(
      v.literal('technical'),
      v.literal('billing'),
      v.literal('access'),
      v.literal('feature_request'),
      v.literal('bug'),
      v.literal('other'),
    ),
    createdBy: v.id('users'),
    assignedTo: v.optional(v.id('users')),
    relatedLeaveId: v.optional(v.id('leaveRequests')),
    relatedDriverRequestId: v.optional(v.id('driverRequests')),
    relatedTaskId: v.optional(v.id('tasks')),
    resolution: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id('users')),
    closedAt: v.optional(v.number()),
    slaDeadline: v.optional(v.number()),
    firstResponseAt: v.optional(v.number()),
    chatId: v.optional(v.id('chatConversations')),
    chatActivated: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_status', ['status'])
    .index('by_priority', ['priority'])
    .index('by_created_by', ['createdBy'])
    .index('by_assigned_to', ['assignedTo'])
    .index('by_status_priority', ['status', 'priority'])
    .index('by_created', ['createdAt'])
    .index('by_ticket_number', ['ticketNumber']),

  ticketComments: defineTable({
    ticketId: v.id('supportTickets'),
    organizationId: v.optional(v.id('organizations')),
    authorId: v.id('users'),
    message: v.string(),
    isInternal: v.boolean(),
    attachments: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_ticket', ['ticketId'])
    .index('by_org', ['organizationId'])
    .index('by_created', ['createdAt']),
};
