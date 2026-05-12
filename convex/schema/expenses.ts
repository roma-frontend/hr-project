import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const expenses = {
  // Expense submissions by employees
  expenses: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    // Expense details
    title: v.string(),
    description: v.optional(v.string()),
    category: v.union(
      v.literal('travel'),
      v.literal('meals'),
      v.literal('accommodation'),
      v.literal('transport'),
      v.literal('office_supplies'),
      v.literal('software'),
      v.literal('training'),
      v.literal('health'),
      v.literal('communication'),
      v.literal('other'),
    ),
    amount: v.number(),
    currency: v.string(),
    // Dates
    expenseDate: v.number(),
    // Receipts
    receiptFileId: v.optional(v.id('_storage')),
    receiptUrl: v.optional(v.string()),
    // Approval workflow
    status: v.union(
      v.literal('draft'),
      v.literal('submitted'),
      v.literal('under_review'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('reimbursed'),
      v.literal('cancelled'),
    ),
    reviewedBy: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    // Reimbursement
    reimbursementMethod: v.optional(
      v.union(v.literal('payroll'), v.literal('bank_transfer'), v.literal('cash')),
    ),
    reimbursedAt: v.optional(v.number()),
    // Metadata
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_org_user', ['organizationId', 'userId'])
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_org_category', ['organizationId', 'category'])
    .index('by_org_date', ['organizationId', 'expenseDate'])
    .index('by_user_status', ['userId', 'status']),

  // Expense categories configuration
  expenseCategories: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    key: v.string(), // machine-readable key matching the union literals
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    // Limits and policies
    dailyLimit: v.optional(v.number()),
    monthlyLimit: v.optional(v.number()),
    requiresReceipt: v.optional(v.boolean()),
    requiresApproval: v.optional(v.boolean()),
    // Status
    isActive: v.boolean(),
    // Metadata
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_active', ['organizationId', 'isActive'])
    .index('by_org_key', ['organizationId', 'key']),

  // Expense approval policies
  expensePolicies: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    description: v.optional(v.string()),
    // Threshold-based approval
    autoApprovalLimit: v.optional(v.number()), // expenses below this auto-approved
    managerApprovalLimit: v.optional(v.number()), // expenses below this need manager approval
    directorApprovalLimit: v.optional(v.number()), // expenses above this need director approval
    // Category-specific rules
    restrictedCategories: v.optional(v.array(v.string())),
    requiredCategories: v.optional(v.array(v.string())),
    // Time constraints
    submissionDeadlineDays: v.optional(v.number()), // days after expense to submit
    receiptRequiredAbove: v.optional(v.number()), // amount above which receipt is mandatory
    // Status
    isActive: v.boolean(),
    // Metadata
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_active', ['organizationId', 'isActive']),

  // Expense reports (grouping multiple expenses)
  expenseReports: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    name: v.string(),
    description: v.optional(v.string()),
    // Period
    periodStart: v.number(),
    periodEnd: v.number(),
    // Status
    status: v.union(
      v.literal('draft'),
      v.literal('submitted'),
      v.literal('under_review'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('reimbursed'),
    ),
    // Totals
    totalAmount: v.number(),
    currency: v.string(),
    expenseCount: v.number(),
    // Approval
    reviewedBy: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    // Metadata
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_org_period', ['organizationId', 'periodStart', 'periodEnd']),

  // Linking expenses to reports
  expenseReportItems: defineTable({
    organizationId: v.id('organizations'),
    reportId: v.id('expenseReports'),
    expenseId: v.id('expenses'),
    // Metadata
    addedAt: v.number(),
  })
    .index('by_report', ['reportId'])
    .index('by_expense', ['expenseId'])
    .index('by_org_report', ['organizationId', 'reportId']),
};
