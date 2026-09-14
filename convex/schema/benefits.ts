import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Benefits Administration — plans, enrollment and claims.
 *
 * Additive-only module. An org admin defines benefit plans (insurance,
 * fitness, education, transport…) optionally priced against a flexible
 * benefits budget; employees enroll during enrollment windows; claims are
 * reimbursed through the approval flow the expenses module already uses.
 * Approved claims surface in payroll as a reimbursement line.
 */
export const benefits = {
  /**
   * A benefit plan the company offers. `kind` drives the UI shape:
   *  - allowance: money the employee spends via claims (reimbursed)
   *  - covered: company-paid (e.g. health insurance — no claims here, just
   *    enrollment records the broker manages)
   */
  benefitPlans: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    description: v.optional(v.string()),
    kind: v.union(v.literal('allowance'), v.literal('covered')),
    category: v.union(
      v.literal('insurance'),
      v.literal('fitness'),
      v.literal('education'),
      v.literal('transport'),
      v.literal('meals'),
      v.literal('communication'),
      v.literal('childcare'),
      v.literal('other'),
    ),
    /** Annual employer money for `allowance` plans (org currency). */
    annualAmount: v.optional(v.number()),
    /** Cap per single claim, when the plan wants one. */
    perClaimLimit: v.optional(v.number()),
    /** Optional eligibility rules — all must pass for an employee to enroll. */
    eligibility: v.optional(
      v.object({
        /** Only these departments; empty/omitted = whole org. */
        departments: v.optional(v.array(v.string())),
        /** Minimum tenure in days (probation gate). */
        minTenureDays: v.optional(v.number()),
        /** Only these employment types; omitted = both. */
        employeeTypes: v.optional(v.array(v.union(v.literal('staff'), v.literal('contractor')))),
      }),
    ),
    /** Enrollment window — omit for always-open enrollment. */
    enrollmentOpensAt: v.optional(v.number()),
    enrollmentClosesAt: v.optional(v.number()),
    isActive: v.boolean(),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_active', ['organizationId', 'isActive']),

  /**
   * An employee's enrollment in a plan. One active enrollment per
   * (employee, plan) — enforced server-side on create.
   */
  benefitEnrollments: defineTable({
    organizationId: v.id('organizations'),
    planId: v.id('benefitPlans'),
    userId: v.id('users'),
    status: v.union(v.literal('active'), v.literal('cancelled'), v.literal('declined')),
    /** Snapshot of the plan's annual amount at enrollment time. */
    annualAmount: v.optional(v.number()),
    /** Who enrolled: the employee (self-service) or an admin on their behalf. */
    enrolledBy: v.id('users'),
    enrolledAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index('by_org', ['organizationId'])
    .index('by_plan', ['planId'])
    .index('by_user', ['userId'])
    .index('by_org_user', ['organizationId', 'userId'])
    .index('by_plan_user', ['planId', 'userId']),

  /**
   * Flexible benefits budget wallet — one per employee per year. The org's
   * `flexibleBenefitsBudget` (settings) tops it up; plan enrollment and
   * claims draw it down. Absent row = no wallet (org has no flex budget).
   */
  benefitWallets: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    year: v.number(),
    /** Total granted for the year. */
    granted: v.number(),
    /** Spent so far (enrollments of priced plans + approved claims). */
    spent: v.number(),
    updatedAt: v.number(),
  }).index('by_org_user_year', ['organizationId', 'userId', 'year']),

  /**
   * A reimbursement claim against an allowance plan — the same
   * submit → review → approve/reject → reimburse flow as expenses.
   */
  benefitClaims: defineTable({
    organizationId: v.id('organizations'),
    planId: v.id('benefitPlans'),
    userId: v.id('users'),
    title: v.string(),
    amount: v.number(),
    currency: v.string(),
    expenseDate: v.number(),
    receiptFileId: v.optional(v.id('_storage')),
    receiptUrl: v.optional(v.string()),
    status: v.union(
      v.literal('submitted'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('reimbursed'),
    ),
    reviewedBy: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    /** Set when the approved amount is paid out via a payroll run. */
    reimbursedAt: v.optional(v.number()),
    /**
     * Payroll record the claim is attached to. Set when a run is calculated
     * (the approved amount rides into that record's benefitsReimbursement),
     * cleared if the run is cancelled before payment.
     */
    payrollRecordId: v.optional(v.id('payrollRecords')),
    /** Wallet row debited on approval (kept for refunds/audit). */
    walletId: v.optional(v.id('benefitWallets')),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_plan', ['planId'])
    .index('by_user', ['userId'])
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_org_user', ['organizationId', 'userId'])
    .index('by_org_date', ['organizationId', 'expenseDate'])
    .index('by_record', ['payrollRecordId']),
};
