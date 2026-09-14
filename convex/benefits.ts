import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx, MutationCtx } from './_generated/server';
import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import { assertFeatureEnabled } from './superadmin/featureToggles';
import { DEFAULT_LIST_CAP, SMALL_LIST_CAP } from './lib/limits';
import {
  assertOrgScope,
  assertOrgStaff,
  resolveOrgScope,
  resolveOrgStaff,
  scopeOwnsRecord,
  type OrgScope,
} from './lib/orgAccess';
import {
  assertModuleAccess,
  assertQuota,
  currentPeriodKey,
  incrementUsage,
} from './lib/entitlements';
import {
  isEligibleForPlan,
  isEnrollmentWindowOpen,
  type PlanEligibility,
} from './lib/benefitEligibility';

/**
 * Benefits Administration — server-side rules
 * ───────────────────────────────────────────
 * Mirrors the expenses module's discipline:
 *   - reads are scoped to the caller's organization; non-staff see their own
 *     enrollments and claims only;
 *   - ownership/attribution fields come from `ctx.auth`, never from arguments;
 *   - review decisions require same-org staff and forbid self-review;
 *   - org-wide configuration (plans) is admin-only;
 *   - wallet math (grant, debit on approval) happens server-side only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** One active enrollment per (plan, user) — enforced on create. */
async function findActiveEnrollment(
  ctx: MutationCtx,
  planId: Id<'benefitPlans'>,
  userId: Id<'users'>,
): Promise<Doc<'benefitEnrollments'> | null> {
  return await ctx.db
    .query('benefitEnrollments')
    .withIndex('by_plan_user', (q) => q.eq('planId', planId).eq('userId', userId))
    .filter((q) => q.eq(q.field('status'), 'active'))
    .first();
}

/** The caller's wallet row for a year (may be absent when no flex budget). */
async function getWallet(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
  year: number,
): Promise<Doc<'benefitWallets'> | null> {
  return await ctx.db
    .query('benefitWallets')
    .withIndex('by_org_user_year', (q) =>
      q.eq('organizationId', organizationId).eq('userId', userId).eq('year', year),
    )
    .unique();
}

/** Debit a wallet by `amount`; throws when the balance would go negative. */
async function debitWallet(
  ctx: MutationCtx,
  wallet: Doc<'benefitWallets'>,
  amount: number,
): Promise<void> {
  if (wallet.spent + amount > wallet.granted) {
    throw new Error('Insufficient flexible benefits balance');
  }
  await ctx.db.patch(wallet._id, { spent: wallet.spent + amount, updatedAt: Date.now() });
}

/** Authorize a claim decision — same-org staff, never self-review. */
async function assertCanReviewClaim(
  ctx: MutationCtx,
  claim: Doc<'benefitClaims'>,
): Promise<OrgScope> {
  const scope = await assertOrgStaff(ctx, claim.organizationId);
  if (!scopeOwnsRecord(scope, claim)) throw new Error('Not authorized to review this claim');
  if (claim.userId === scope.caller._id || claim.createdBy === scope.caller._id) {
    throw new Error('Cannot review your own claim');
  }
  return scope;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plans — org-wide configuration (admin only)
// ─────────────────────────────────────────────────────────────────────────────

export const listPlans = query({
  args: { organizationId: v.optional(v.id('organizations')) },
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    await assertModuleAccess(ctx, 'benefits');
    const scope = await resolveOrgScope(ctx, args.organizationId);
    if (!scope?.organizationId) return [];
    return await ctx.db
      .query('benefitPlans')
      .withIndex('by_org', (q) => q.eq('organizationId', scope.organizationId!))
      .take(SMALL_LIST_CAP);
  },
});

export const upsertPlan = mutation({
  args: {
    id: v.optional(v.id('benefitPlans')),
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
    annualAmount: v.optional(v.number()),
    perClaimLimit: v.optional(v.number()),
    eligibility: v.optional(
      v.object({
        departments: v.optional(v.array(v.string())),
        minTenureDays: v.optional(v.number()),
        employeeTypes: v.optional(v.array(v.union(v.literal('staff'), v.literal('contractor')))),
      }),
    ),
    enrollmentOpensAt: v.optional(v.number()),
    enrollmentClosesAt: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    await assertModuleAccess(ctx, 'benefits');
    const scope = await assertOrgStaff(ctx, undefined, { adminOnly: true });

    if (args.annualAmount !== undefined && args.annualAmount < 0) {
      throw new Error('Annual amount must be non-negative');
    }
    if (
      args.perClaimLimit !== undefined &&
      args.annualAmount !== undefined &&
      args.perClaimLimit > args.annualAmount
    ) {
      throw new Error('Per-claim limit cannot exceed the annual amount');
    }

    const doc = {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      kind: args.kind,
      category: args.category,
      annualAmount: args.annualAmount,
      perClaimLimit: args.perClaimLimit,
      eligibility: args.eligibility,
      enrollmentOpensAt: args.enrollmentOpensAt,
      enrollmentClosesAt: args.enrollmentClosesAt,
      isActive: args.isActive,
      updatedAt: Date.now(),
    };

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || !scopeOwnsRecord(scope, existing)) throw new Error('Plan not found');
      await ctx.db.patch(args.id, doc);
      return args.id;
    }
    return await ctx.db.insert('benefitPlans', {
      organizationId: scope.organizationId!,
      ...doc,
      createdBy: scope.caller._id,
      createdAt: Date.now(),
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Flexible benefits wallet (admin grants, one per employee per year)
// ─────────────────────────────────────────────────────────────────────────────

export const grantWallet = mutation({
  args: {
    userId: v.id('users'),
    year: v.number(),
    amount: v.number(),
  },
  handler: async (ctx, { userId, year, amount }) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    await assertModuleAccess(ctx, 'benefits');
    if (amount <= 0) throw new Error('Grant must be positive');

    const scope = await assertOrgStaff(ctx, undefined, { adminOnly: true });
    const target = await ctx.db.get(userId);
    if (!target || target.organizationId !== scope.organizationId) {
      throw new Error('User not found in your organization');
    }

    const wallet = await getWallet(ctx, scope.organizationId!, userId, year);
    if (wallet) {
      await ctx.db.patch(wallet._id, { granted: amount, updatedAt: Date.now() });
      return wallet._id;
    }
    return await ctx.db.insert('benefitWallets', {
      organizationId: scope.organizationId!,
      userId,
      year,
      granted: amount,
      spent: 0,
      updatedAt: Date.now(),
    });
  },
});

export const getMyWallet = query({
  args: { year: v.optional(v.number()) },
  handler: async (ctx, { year }) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    const scope = await resolveOrgScope(ctx);
    if (!scope?.organizationId) return null;
    return await getWallet(
      ctx,
      scope.organizationId,
      scope.caller._id,
      year ?? new Date().getFullYear(),
    );
  },
});

export const listWallets = query({
  args: { year: v.optional(v.number()) },
  handler: async (ctx, { year }) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    await assertModuleAccess(ctx, 'benefits');
    const scope = await resolveOrgStaff(ctx, undefined, { adminOnly: true });
    if (!scope?.organizationId) return [];
    const y = year ?? new Date().getFullYear();
    return await ctx.db
      .query('benefitWallets')
      .withIndex('by_org_user_year', (q) => q.eq('organizationId', scope.organizationId!))
      .take(DEFAULT_LIST_CAP)
      .then((rows) => rows.filter((r) => r.year === y));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Enrollment
// ─────────────────────────────────────────────────────────────────────────────

export const listMyEnrollments = query({
  args: {},
  handler: async (ctx) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    const scope = await resolveOrgScope(ctx);
    if (!scope?.organizationId) return [];
    return await ctx.db
      .query('benefitEnrollments')
      .withIndex('by_org_user', (q) =>
        q.eq('organizationId', scope.organizationId!).eq('userId', scope.caller._id),
      )
      .take(SMALL_LIST_CAP);
  },
});

export const listEnrollmentsForOrg = query({
  args: { planId: v.optional(v.id('benefitPlans')) },
  handler: async (ctx, { planId }) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    await assertModuleAccess(ctx, 'benefits');
    const scope = await resolveOrgStaff(ctx, undefined);
    if (!scope?.organizationId) return [];
    if (planId) {
      const plan = await ctx.db.get(planId);
      if (!plan || !scopeOwnsRecord(scope, plan)) throw new Error('Plan not found');
      return await ctx.db
        .query('benefitEnrollments')
        .withIndex('by_plan', (q) => q.eq('planId', planId))
        .take(SMALL_LIST_CAP);
    }
    return await ctx.db
      .query('benefitEnrollments')
      .withIndex('by_org', (q) => q.eq('organizationId', scope.organizationId!))
      .take(DEFAULT_LIST_CAP);
  },
});

/**
 * Enroll the caller (or an admin-enrolled employee) into a plan. Validates
 * eligibility + window server-side, snapshots the plan price, debits the
 * flex wallet for priced plans.
 */
export const enroll = mutation({
  args: {
    planId: v.id('benefitPlans'),
    /** Admin-only: enroll someone else. */
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, { planId, userId }) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    await assertModuleAccess(ctx, 'benefits');

    let scope = await assertOrgScope(ctx);
    let targetId = scope.caller._id;
    if (userId && userId !== scope.caller._id) {
      // Enrolling someone else requires staff rights in their org.
      scope = await assertOrgStaff(ctx, undefined);
      const target = await ctx.db.get(userId);
      if (!target || target.organizationId !== scope.organizationId) {
        throw new Error('User not found in your organization');
      }
      targetId = userId;
    }

    const plan = await ctx.db.get(planId);
    if (!plan || !scopeOwnsRecord(scope, plan) || !plan.isActive) {
      throw new Error('Plan not found or inactive');
    }
    if (!isEnrollmentWindowOpen(plan)) {
      throw new Error('Enrollment window is closed for this plan');
    }

    const target = await ctx.db.get(targetId);
    if (!target) throw new Error('User not found');
    if (
      !isEligibleForPlan(
        {
          _id: target._id,
          department: target.department,
          employeeType: target.employeeType,
          createdAt: target.createdAt,
        },
        plan.eligibility as PlanEligibility | undefined,
      )
    ) {
      throw new Error('Not eligible for this plan');
    }

    if (await findActiveEnrollment(ctx, planId, targetId)) {
      throw new Error('Already enrolled in this plan');
    }

    // Priced plans draw the flexible wallet; no wallet → no flex budget →
    // only unpriced (or zero-cost) plans can be enrolled.
    const price = plan.annualAmount ?? 0;
    if (price > 0) {
      const wallet = await getWallet(ctx, plan.organizationId, targetId, new Date().getFullYear());
      if (!wallet) throw new Error('No flexible benefits wallet — ask HR to grant a budget');
      await debitWallet(ctx, wallet, price);
    }

    const enrollmentId = await ctx.db.insert('benefitEnrollments', {
      organizationId: plan.organizationId,
      planId,
      userId: targetId,
      status: 'active',
      annualAmount: plan.annualAmount,
      enrolledBy: scope.caller._id,
      enrolledAt: Date.now(),
    });

    // Count the enrollment against the plan's monthly quota for metering.
    await incrementUsage(
      ctx,
      plan.organizationId,
      'benefits',
      'enrollments',
      1,
      currentPeriodKey(),
    );

    return enrollmentId;
  },
});

/** Cancel an active enrollment. Refunds the wallet when it was priced. */
export const cancelEnrollment = mutation({
  args: { enrollmentId: v.id('benefitEnrollments') },
  handler: async (ctx, { enrollmentId }) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    const scope = await assertOrgScope(ctx);
    const enrollment = await ctx.db.get(enrollmentId);
    if (!enrollment) throw new Error('Enrollment not found');

    const isOwner = enrollment.userId === scope.caller._id;
    if (!scopeOwnsRecord(scope, enrollment) || (!scope.isStaff && !isOwner)) {
      throw new Error('Not authorized to cancel this enrollment');
    }
    if (enrollment.status !== 'active') throw new Error('Enrollment is not active');

    // Refund the plan price to the wallet (claims already spent stay spent).
    if (enrollment.annualAmount && enrollment.annualAmount > 0) {
      const wallet = await getWallet(
        ctx,
        enrollment.organizationId,
        enrollment.userId,
        new Date().getFullYear(),
      );
      if (wallet) {
        await ctx.db.patch(wallet._id, {
          spent: Math.max(0, wallet.spent - enrollment.annualAmount),
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.patch(enrollmentId, { status: 'cancelled', endedAt: Date.now() });
    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Claims — the expenses approval flow
// ─────────────────────────────────────────────────────────────────────────────

export const listClaims = query({
  args: {
    organizationId: v.optional(v.id('organizations')),
    planId: v.optional(v.id('benefitPlans')),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    const scope = await resolveOrgScope(ctx, args.organizationId);
    if (!scope?.organizationId) return [];

    let rows = args.planId
      ? await ctx.db
          .query('benefitClaims')
          .withIndex('by_plan', (q) => q.eq('planId', args.planId!))
          .take(DEFAULT_LIST_CAP)
      : await ctx.db
          .query('benefitClaims')
          .withIndex('by_org', (q) => q.eq('organizationId', scope.organizationId!))
          .take(DEFAULT_LIST_CAP);

    if (!scope.isStaff) {
      rows = rows.filter((r) => r.userId === scope.caller._id || r.createdBy === scope.caller._id);
    }
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    return rows;
  },
});

export const submitClaim = mutation({
  args: {
    planId: v.id('benefitPlans'),
    title: v.string(),
    amount: v.number(),
    expenseDate: v.number(),
    currency: v.optional(v.string()),
    receiptUrl: v.optional(v.string()),
  },
  handler: async (ctx, { planId, title, amount, expenseDate, currency, receiptUrl }) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    await assertModuleAccess(ctx, 'benefits');
    await assertQuota(ctx, 'benefits', 'claims', 1, currentPeriodKey());

    const scope = await assertOrgScope(ctx);
    if (amount <= 0) throw new Error('Amount must be positive');

    const plan = await ctx.db.get(planId);
    if (!plan || !scopeOwnsRecord(scope, plan) || !plan.isActive) {
      throw new Error('Plan not found or inactive');
    }
    if (plan.kind !== 'allowance') {
      throw new Error('Claims are only available for allowance plans');
    }
    if (plan.perClaimLimit !== undefined && amount > plan.perClaimLimit) {
      throw new Error(`Claim exceeds the per-claim limit of ${plan.perClaimLimit}`);
    }

    // Claimant must hold an active enrollment (or be admin-filed for someone).
    const targetId = scope.caller._id;
    const enrollment = await findActiveEnrollment(ctx, planId, targetId);
    if (!enrollment) throw new Error('You must be enrolled in this plan to file a claim');

    // Optional soft check against the remaining wallet balance.
    const wallet = await getWallet(ctx, plan.organizationId, targetId, new Date().getFullYear());
    if (wallet && wallet.spent + amount > wallet.granted) {
      throw new Error('Insufficient flexible benefits balance');
    }

    const claimId = await ctx.db.insert('benefitClaims', {
      organizationId: plan.organizationId,
      planId,
      userId: targetId,
      title: title.trim(),
      amount,
      currency: currency ?? 'AMD',
      expenseDate,
      receiptUrl: receiptUrl || undefined,
      status: 'submitted',
      walletId: wallet?._id,
      createdBy: scope.caller._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await incrementUsage(ctx, plan.organizationId, 'benefits', 'claims', 1, currentPeriodKey());
    return claimId;
  },
});

export const reviewClaim = mutation({
  args: {
    claimId: v.id('benefitClaims'),
    decision: v.union(v.literal('approved'), v.literal('rejected')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { claimId, decision, notes }) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    const claim = await ctx.db.get(claimId);
    if (!claim) throw new Error('Claim not found');
    const scope = await assertCanReviewClaim(ctx, claim);
    if (claim.status !== 'submitted') throw new Error('Claim has already been reviewed');

    // Approval debits the wallet immediately; rejection leaves it untouched.
    if (decision === 'approved' && claim.walletId) {
      const wallet = await ctx.db.get(claim.walletId);
      if (wallet) await debitWallet(ctx, wallet, claim.amount);
    }

    await ctx.db.patch(claimId, {
      status: decision,
      reviewedBy: scope.caller._id,
      reviewedAt: Date.now(),
      reviewNotes: notes?.trim() || undefined,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const markClaimReimbursed = mutation({
  args: { claimId: v.id('benefitClaims') },
  handler: async (ctx, { claimId }) => {
    await assertFeatureEnabled(ctx, 'benefits.module');
    const claim = await ctx.db.get(claimId);
    if (!claim) throw new Error('Claim not found');
    await assertCanReviewClaim(ctx, claim);
    if (claim.status !== 'approved') throw new Error('Only approved claims can be reimbursed');

    await ctx.db.patch(claimId, {
      status: 'reimbursed',
      reimbursedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
