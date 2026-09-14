/**
 * Benefits → payroll bridge — attach / release / reimburse lifecycle,
 * run against convex-test's in-memory database with the real schema.
 *
 * Proves the full story end-to-end:
 *   1. `approvedClaimsByUser` only picks up APPROVED claims of the run's
 *      month that are not already attached to a record;
 *   2. `attachClaimsToRecord` links them to the payroll record;
 *   3. `markRecordClaimsReimbursed` (run paid) flips them to 'reimbursed';
 *   4. `releaseClaimsOfRecord` (run cancelled) detaches them back to
 *      'approved' so a later run picks them up again;
 *   5. a rejected claim never enters the pipeline.
 */
import { describe, it, expect } from '@jest/globals';
import { convexTest } from 'convex-test';

import schema from '../../convex/schema';
import type { Id } from '../../convex/_generated/dataModel';
import {
  approvedClaimsByUser,
  reimbursementFor,
  attachClaimsToRecord,
  claimsForRecord,
  releaseClaimsOfRecord,
  markRecordClaimsReimbursed,
} from '../../convex/lib/payrollBenefits';

// convex-test normally discovers functions via `import.meta.glob`, which ts-jest
// does not provide - the module map is therefore spelled out. The `_generated`
// entry is what convex-test uses to locate the modules root. payrollBenefits.ts
// itself is pure DB (no cross-module calls), so no other modules are needed.
const modules = {
  './_generated/api.ts': () => import('../../convex/_generated/api'),
} as unknown as Record<string, () => Promise<unknown>>;

type Ctx = Awaited<ReturnType<typeof seed>>;

/** Fixed clock: 2026-09-15 12:00 UTC — inside the '2026-09' period. */
const NOW = Date.UTC(2026, 8, 15, 12, 0, 0);
const SEP_2026_START = Date.UTC(2026, 8, 1);
const AUG_2026_MID = Date.UTC(2026, 7, 15);

const baseUser = {
  passwordHash: 'x',
  employeeType: 'staff' as const,
  isActive: true,
  isApproved: true,
  travelAllowance: 0,
  paidLeaveBalance: 10,
  sickLeaveBalance: 5,
  familyLeaveBalance: 5,
  dayOffBalance: 4,
  createdAt: NOW,
};

async function seed() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert('organizations', {
      name: 'Acme',
      slug: `acme-${Math.random().toString(36).slice(2)}`,
      plan: 'professional',
      isActive: true,
      createdBySuperadmin: false,
      employeeLimit: 100,
      createdAt: NOW,
      updatedAt: NOW,
    } as never);

    const userId = await ctx.db.insert('users', {
      ...baseUser,
      organizationId,
      name: 'Employee',
      email: 'employee@acme.test',
      role: 'employee',
    });

    const planId = await ctx.db.insert('benefitPlans', {
      organizationId,
      name: 'Fitness',
      kind: 'allowance',
      category: 'fitness',
      annualAmount: 50_000,
      isActive: true,
      createdBy: userId,
      createdAt: NOW,
      updatedAt: NOW,
    } as never);

    return { organizationId, userId, planId };
  });
  return { t, ...ids };
}

/** Insert a benefit claim with the given shape. */
async function insertClaim(
  c: Ctx,
  overrides: {
    status?: 'submitted' | 'approved' | 'rejected' | 'reimbursed';
    expenseDate?: number;
    amount?: number;
    userId?: Id<'users'>;
    payrollRecordId?: Id<'payrollRecords'>;
  } = {},
): Promise<Id<'benefitClaims'>> {
  return await c.t.run(async (ctx) =>
    ctx.db.insert('benefitClaims', {
      organizationId: c.organizationId,
      planId: c.planId,
      userId: overrides.userId ?? c.userId,
      title: 'Claim',
      amount: overrides.amount ?? 5_000,
      currency: 'AMD',
      expenseDate: overrides.expenseDate ?? SEP_2026_START + 5 * 86_400_000,
      status: overrides.status ?? 'approved',
      createdBy: overrides.userId ?? c.userId,
      createdAt: NOW,
      updatedAt: NOW,
      ...(overrides.payrollRecordId ? { payrollRecordId: overrides.payrollRecordId } : {}),
    } as never),
  );
}

/** Read a claim back. */
async function getClaim(c: Ctx, claimId: Id<'benefitClaims'>) {
  return await c.t.run(async (ctx) => ctx.db.get(claimId));
}

/**
 * The bridge returns a Map, which cannot cross the convex-test serialization
 * boundary — flatten it to plain convex values inside `t.run`.
 */
async function collect(c: Ctx, period = '2026-09') {
  return await c.t.run(async (ctx) => {
    const byUser = await approvedClaimsByUser(ctx, c.organizationId, period);
    const total = reimbursementFor(byUser, c.userId);
    return {
      total,
      groups: Array.from(byUser.entries()).map(([userId, claims]) => ({
        userId,
        claims: claims.map((x) => ({ _id: x._id, amount: x.amount })),
      })),
    };
  });
}

/** Insert an empty payroll record to attach claims to. */
async function insertRecord(c: Ctx, period = '2026-09'): Promise<Id<'payrollRecords'>> {
  return await c.t.run(async (ctx) =>
    ctx.db.insert('payrollRecords', {
      organizationId: c.organizationId,
      userId: c.userId,
      period,
      baseSalary: 200_000,
      grossSalary: 200_000,
      netSalary: 160_000,
      taxCountry: 'armenia',
      status: 'calculated',
      createdAt: NOW,
      updatedAt: NOW,
    } as never),
  );
}

describe('benefits → payroll bridge lifecycle', () => {
  it('collects approved claims of the run period, grouped by user', async () => {
    const c = await seed();
    await insertClaim(c, { expenseDate: SEP_2026_START + 5 * 86_400_000 });
    await insertClaim(c, { expenseDate: SEP_2026_START + 6 * 86_400_000 });

    const { total, groups } = await collect(c);
    const mine = groups.find((g) => g.userId === c.userId);
    expect(mine?.claims).toHaveLength(2);
    expect(total).toBe(10_000);
  });

  it('skips submitted, rejected and reimbursed claims', async () => {
    const c = await seed();
    await insertClaim(c, { status: 'submitted' });
    await insertClaim(c, { status: 'rejected' });
    await insertClaim(c, { status: 'reimbursed' });

    const { total, groups } = await collect(c);
    expect(groups.find((g) => g.userId === c.userId)?.claims ?? []).toHaveLength(0);
    expect(total).toBe(0);
  });

  it('skips claims outside the run period and already-attached ones', async () => {
    const c = await seed();
    const recordId = await insertRecord(c);
    await insertClaim(c, { expenseDate: AUG_2026_MID }); // different month
    await insertClaim(c, { payrollRecordId: recordId }); // already attached

    const { groups } = await collect(c);
    expect(groups.find((g) => g.userId === c.userId)?.claims ?? []).toHaveLength(0);
  });

  it('attach → paid marks claims reimbursed with a timestamp', async () => {
    const c = await seed();
    const claimId = await insertClaim(c);
    const recordId = await insertRecord(c);

    const { groups } = await collect(c);
    const claims = groups.find((g) => g.userId === c.userId)?.claims ?? [];
    expect(claims).toHaveLength(1);

    await c.t.run(async (ctx) =>
      attachClaimsToRecord(
        ctx,
        claims.map((x) => ({
          _id: x._id as Id<'benefitClaims'>,
          userId: c.userId,
          amount: x.amount,
        })),
        recordId,
      ),
    );
    expect((await getClaim(c, claimId)).payrollRecordId).toBe(recordId);

    await c.t.run(async (ctx) => markRecordClaimsReimbursed(ctx, recordId));
    const paid = await getClaim(c, claimId);
    expect(paid.status).toBe('reimbursed');
    expect(paid.reimbursedAt).toBeGreaterThan(0);
  });

  it('attach → cancel releases claims back to detached approved', async () => {
    const c = await seed();
    const claimId = await insertClaim(c);
    const recordId = await insertRecord(c);

    const { groups } = await collect(c);
    const claims = groups.find((g) => g.userId === c.userId)?.claims ?? [];
    await c.t.run(async (ctx) =>
      attachClaimsToRecord(
        ctx,
        claims.map((x) => ({
          _id: x._id as Id<'benefitClaims'>,
          userId: c.userId,
          amount: x.amount,
        })),
        recordId,
      ),
    );

    // Sanity: visible through the record index.
    const attached = await c.t.run(async (ctx) => claimsForRecord(ctx, recordId));
    expect(attached).toHaveLength(1);

    await c.t.run(async (ctx) => releaseClaimsOfRecord(ctx, recordId));
    const released = await getClaim(c, claimId);
    expect(released.status).toBe('approved'); // untouched — still payable later
    expect(released.payrollRecordId).toBeUndefined();

    // A later run picks the claim up again.
    const secondRun = await collect(c);
    expect(secondRun.groups.find((g) => g.userId === c.userId)?.claims).toHaveLength(1);
  });

  it('release is a no-op for a record with no attached claims', async () => {
    const c = await seed();
    const recordId = await insertRecord(c);
    // Must not throw; convex-test serializes the void result to null.
    const result = await c.t.run(async (ctx) => {
      await releaseClaimsOfRecord(ctx, recordId);
      return 'ok';
    });
    expect(result).toBe('ok');
  });

  it('handles an invalid period key without touching the DB', async () => {
    const c = await seed();
    await insertClaim(c);
    const empty = await collect(c, 'not-a-period');
    expect(empty.groups).toHaveLength(0);
  });

  it('isolates claims by organization', async () => {
    const c = await seed();
    await insertClaim(c); // Acme claim: 5 000
    // A second org with its own approved claim.
    const otherOrgId = await c.t.run(async (ctx) =>
      ctx.db.insert('organizations', {
        name: 'Beta',
        slug: `beta-${Math.random().toString(36).slice(2)}`,
        plan: 'professional',
        isActive: true,
        createdBySuperadmin: false,
        employeeLimit: 100,
        createdAt: NOW,
        updatedAt: NOW,
      } as never),
    );
    const otherUserId = await c.t.run(async (ctx) =>
      ctx.db.insert('users', {
        ...baseUser,
        organizationId: otherOrgId,
        name: 'Beta Employee',
        email: 'employee@beta.test',
        role: 'employee',
      }),
    );
    const otherPlanId = await c.t.run(async (ctx) =>
      ctx.db.insert('benefitPlans', {
        organizationId: otherOrgId,
        name: 'Beta Fitness',
        kind: 'allowance',
        category: 'fitness',
        annualAmount: 10_000,
        isActive: true,
        createdBy: otherUserId,
        createdAt: NOW,
        updatedAt: NOW,
      } as never),
    );
    await c.t.run(async (ctx) =>
      ctx.db.insert('benefitClaims', {
        organizationId: otherOrgId,
        planId: otherPlanId,
        userId: otherUserId,
        title: 'Beta claim',
        amount: 7_000,
        currency: 'AMD',
        expenseDate: SEP_2026_START + 3 * 86_400_000,
        status: 'approved',
        createdBy: otherUserId,
        createdAt: NOW,
        updatedAt: NOW,
      } as never),
    );

    // Acme's run sees only Acme's claims.
    const { total, groups } = await collect(c);
    expect(groups.some((g) => g.userId === otherUserId)).toBe(false);
    expect(total).toBe(5_000);
  });
});
