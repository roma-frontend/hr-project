import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const compliance = {
  gdprRequests: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    requestType: v.union(
      v.literal('data_access'),
      v.literal('data_deletion'),
      v.literal('data_rectification'),
      v.literal('data_portability'),
      v.literal('data_restriction'),
      v.literal('consent_withdrawal'),
    ),
    status: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('rejected'),
    ),
    details: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    requestedBy: v.id('users'),
    processedBy: v.optional(v.id('users')),
    requestedAt: v.number(),
    processedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index('by_org', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_requested_at', ['requestedAt']),

  consentRecords: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    consentType: v.string(),
    granted: v.boolean(),
    grantedAt: v.number(),
    withdrawnAt: v.optional(v.number()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    version: v.optional(v.string()),
    metadata: v.optional(v.string()),
  })
    .index('by_org', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_user_consent', ['userId', 'consentType'])
    .index('by_org_consent', ['organizationId', 'consentType']),

  compliancePolicies: defineTable({
    organizationId: v.id('organizations'),
    title: v.string(),
    description: v.optional(v.string()),
    policyType: v.union(
      v.literal('data_retention'),
      v.literal('privacy'),
      v.literal('security'),
      v.literal('access_control'),
      v.literal('general'),
    ),
    content: v.string(),
    version: v.string(),
    isActive: v.boolean(),
    effectiveFrom: v.number(),
    effectiveUntil: v.optional(v.number()),
    createdBy: v.id('users'),
    updatedBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_type', ['organizationId', 'policyType'])
    .index('by_org_active', ['organizationId', 'isActive']),

  dataAccessLogs: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    accessedBy: v.id('users'),
    accessType: v.union(
      v.literal('view'),
      v.literal('export'),
      v.literal('modify'),
      v.literal('delete'),
    ),
    dataType: v.string(),
    recordId: v.optional(v.string()),
    reason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_accessed_by', ['accessedBy'])
    .index('by_org_created', ['organizationId', 'createdAt']),
};
