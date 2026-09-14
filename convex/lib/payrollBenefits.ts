import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../_generated/server';

/**
 * Benefits → payroll bridge.
 *
 * Approved benefit claims ride into the payroll run that covers their period
 * as a **non-taxable reimbursement** on top of net salary (a documented
 * expense repayment, not salary — so no income-tax/pension impact and no
 * change to the SRC filing logic, which mirrors taxRules exactly).
 *
 * Lifecycle:
 *   calculatePayrollRun → attach approved claims (payrollRecordId set),
 *   markPayrollRunAsPaid → claims marked reimbursed,
 *   cancelPayrollRun (before paid) → claims released back to 'approved'.
 */

/** A benefit claim narrow enough for the payroll writer to consume. */
export interface PayrollBenefitClaim {
  _id: Id<'benefitClaims'>;
  userId: Id<'users'>;
  amount: number;
}

/**
 * Approved (not yet attached) claims for an org, grouped by user.
 * `period` is a payroll period key (e.g. '2026-09'); a claim belongs to the
 * run when its expense date falls in that month.
 */
export async function approvedClaimsByUser(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  period: string,
): Promise<Map<Id<'users'>, PayrollBenefitClaim[]>> {
  const [year, month] = period.split('-').map((p) => Number(p));
  const out = new Map<Id<'users'>, PayrollBenefitClaim[]>();

  if (!year || !month || month < 1 || month > 12) return out;

  const start = new Date(Date.UTC(year, month - 1, 1)).getTime();
  const end = new Date(Date.UTC(year, month, 1)).getTime();

  const claims = await ctx.db
    .query('benefitClaims')
    .withIndex('by_org_status', (q) =>
      q.eq('organizationId', organizationId).eq('status', 'approved'),
    )
    .take(1000);

  for (const claim of claims) {
    if (claim.payrollRecordId) continue; // already attached to a run
    if (claim.expenseDate < start || claim.expenseDate >= end) continue;
    const list = out.get(claim.userId) ?? [];
    list.push({ _id: claim._id, userId: claim.userId, amount: claim.amount });
    out.set(claim.userId, list);
  }
  return out;
}

/** Sum of reimbursement for one user. */
export function reimbursementFor(
  byUser: Map<Id<'users'>, PayrollBenefitClaim[]>,
  userId: Id<'users'>,
): number {
  return (byUser.get(userId) ?? []).reduce((sum, c) => sum + c.amount, 0);
}

/** Attach claims to a payroll record (run calculation). */
export async function attachClaimsToRecord(
  ctx: MutationCtx,
  claims: PayrollBenefitClaim[],
  payrollRecordId: Id<'payrollRecords'>,
): Promise<void> {
  for (const claim of claims) {
    await ctx.db.patch(claim._id, { payrollRecordId });
  }
}

/** Claims attached to a specific payroll record. */
export async function claimsForRecord(
  ctx: QueryCtx | MutationCtx,
  payrollRecordId: Id<'payrollRecords'>,
): Promise<Doc<'benefitClaims'>[]> {
  return await ctx.db
    .query('benefitClaims')
    .withIndex('by_record', (q) => q.eq('payrollRecordId', payrollRecordId))
    .take(1000);
}

/**
 * Release claims when a run is cancelled before payment: back to 'approved',
 * detached from the record so a later run can pick them up.
 */
export async function releaseClaimsOfRecord(
  ctx: MutationCtx,
  payrollRecordId: Id<'payrollRecords'>,
): Promise<void> {
  const attached = await claimsForRecord(ctx, payrollRecordId);
  for (const claim of attached) {
    await ctx.db.patch(claim._id, { payrollRecordId: undefined });
  }
}

/** Mark all claims of a record reimbursed (run paid). */
export async function markRecordClaimsReimbursed(
  ctx: MutationCtx,
  payrollRecordId: Id<'payrollRecords'>,
): Promise<void> {
  const attached = await claimsForRecord(ctx, payrollRecordId);
  const now = Date.now();
  for (const claim of attached) {
    if (claim.status !== 'approved') continue;
    await ctx.db.patch(claim._id, { status: 'reimbursed', reimbursedAt: now, updatedAt: now });
  }
}
