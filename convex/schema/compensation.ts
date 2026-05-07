import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const compensation = {
  // Compensation records for employees
  compensationRecords: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    // Compensation type
    type: v.union(
      v.literal('base'),
      v.literal('bonus'),
      v.literal('raise'),
      v.literal('adjustment'),
      v.literal('allowance'),
    ),
    // Amount details
    amount: v.number(),
    currency: v.string(),
    frequency: v.union(v.literal('monthly'), v.literal('yearly'), v.literal('one-time')),
    // Effective dates
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    // Status
    status: v.union(
      v.literal('draft'),
      v.literal('pending_approval'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('active'),
      v.literal('expired'),
    ),
    // Approval workflow
    approvedBy: v.optional(v.id('users')),
    approvedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    // Notes
    notes: v.optional(v.string()),
    // Metadata
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_org_user', ['organizationId', 'userId'])
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_org_type', ['organizationId', 'type'])
    .index('by_effective_date', ['effectiveFrom']),

  // Compensation bands / salary ranges for positions
  compensationBands: defineTable({
    organizationId: v.id('organizations'),
    // Band definition
    name: v.string(),
    description: v.optional(v.string()),
    level: v.string(), // e.g., "Junior", "Senior", "Lead", "Manager"
    department: v.optional(v.string()),
    // Salary range
    currency: v.string(),
    minSalary: v.number(),
    maxSalary: v.number(),
    medianSalary: v.optional(v.number()),
    frequency: v.union(v.literal('monthly'), v.literal('yearly')),
    // Metadata
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_level', ['organizationId', 'level'])
    .index('by_org_department', ['organizationId', 'department']),

  // Bonus programs
  bonusPrograms: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    description: v.optional(v.string()),
    type: v.union(
      v.literal('performance'),
      v.literal('retention'),
      v.literal('signing'),
      v.literal('referral'),
      v.literal('holiday'),
      v.literal('custom'),
    ),
    // Eligibility
    eligibleRoles: v.optional(v.array(v.string())),
    eligibleDepartments: v.optional(v.array(v.string())),
    // Bonus details
    currency: v.string(),
    bonusAmount: v.optional(v.number()),
    bonusPercentage: v.optional(v.number()), // percentage of base salary
    // Period
    periodStart: v.number(),
    periodEnd: v.number(),
    // Status
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('completed'),
      v.literal('cancelled'),
    ),
    // Metadata
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_org_type', ['organizationId', 'type']),

  // Compensation review cycles
  compensationReviewCycles: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    description: v.optional(v.string()),
    // Period
    cycleStart: v.number(),
    cycleEnd: v.number(),
    year: v.number(),
    // Status
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('completed'),
      v.literal('cancelled'),
    ),
    // Settings
    allowSelfNomination: v.optional(v.boolean()),
    requireJustification: v.optional(v.boolean()),
    maxIncreasePercentage: v.optional(v.number()),
    // Metadata
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_org_year', ['organizationId', 'year']),

  // Individual compensation review entries
  compensationReviewEntries: defineTable({
    organizationId: v.id('organizations'),
    reviewCycleId: v.id('compensationReviewCycles'),
    userId: v.id('users'),
    // Current compensation
    currentSalary: v.number(),
    currentCurrency: v.string(),
    // Proposed changes
    proposedSalary: v.optional(v.number()),
    proposedIncrease: v.optional(v.number()), // percentage
    proposedBonus: v.optional(v.number()),
    // Justification
    justification: v.optional(v.string()),
    performanceRating: v.optional(v.number()), // 1-5 scale
    // Review status
    status: v.union(
      v.literal('draft'),
      v.literal('submitted'),
      v.literal('under_review'),
      v.literal('approved'),
      v.literal('rejected'),
    ),
    reviewedBy: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_review_cycle', ['reviewCycleId'])
    .index('by_user', ['userId'])
    .index('by_org_status', ['organizationId', 'status']),
};
