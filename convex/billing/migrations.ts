/**
 * Migration: plan prices → the current per-seat model.
 *
 * History, in two steps:
 *   1. the catalog was originally seeded with flat monthly plan prices
 *      ($29 Starter / $79 Pro);
 *   2. it moved to per-seat pricing with volume tiers, first at $3 / $6, and
 *      then — once the tiers were benchmarked against the market — at $4 / $8.
 *
 * `convex/billing/defaults.ts` is the source of truth, but the seed is
 * deliberately conservative — it never overwrites an existing `billingPlans`
 * row — so an already-seeded deployment keeps its old numbers on the landing
 * and in the billing engine until someone republishes by hand.
 *
 * This operator-only migration bridges that gap. It is **idempotent** and
 * **conservative**:
 *   - a plan price is only rewritten when it still equals one of the *known*
 *     legacy values (flat 29/79, or the first per-seat release 3/6), so a price
 *     a superadmin has customised is never clobbered;
 *   - the legacy seat cap (10 / 50) is only raised when it still equals the old
 *     default, so a custom cap survives;
 *   - every plan that actually changed is republished as a new version.
 * Running it a second time is a no-op.
 *
 * Operator-only; run with `npx convex run`:
 *
 *   # 1. Report what would change — writes nothing (default):
 *   npx convex run billing/migrations:migrateBillingPlansToPerSeat
 *
 *   # 2. Apply (publishes a new version for each changed plan):
 *   npx convex run billing/migrations:migrateBillingPlansToPerSeat '{"dryRun":false}'
 *
 *   # 3. Apply without publishing (leaves the new prices as a draft):
 *   npx convex run billing/migrations:migrateBillingPlansToPerSeat '{"dryRun":false,"publish":false}'
 *
 * `dryRun` defaults to **true**: an accidental invocation reports instead of
 * writing.
 */

import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';
import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { DEFAULT_ENTITLEMENTS, DEFAULT_PLANS, type PlanKey } from './defaults';
import { publishPlanSnapshot } from './plans';

/**
 * Prices the catalog was seeded with in earlier releases: the flat era and the
 * first per-seat release. A row still holding one of these is untouched by the
 * superadmin and safe to update.
 */
const LEGACY_PLAN_PRICES: Record<PlanKey, number[]> = {
  starter: [29, 3],
  pro: [79, 6],
  enterprise: [199],
};

/** Seat caps the catalog used to be seeded with, per plan key. */
const LEGACY_SEAT_CAPS: Partial<Record<PlanKey, number>> = {
  starter: 10,
  pro: 50,
};

interface PlanChange {
  planKey: PlanKey;
  priceBefore: number | undefined;
  priceAfter: number | undefined;
  seatCapBefore: number | undefined;
  seatCapAfter: number | undefined;
}

/** First superadmin, used as the actor attributed to the published versions. */
async function resolveSystemActor(ctx: MutationCtx): Promise<Id<'users'>> {
  const admin = await ctx.db
    .query('users')
    .filter((q) => q.eq(q.field('role'), 'superadmin'))
    .first();
  if (!admin) {
    throw new Error(
      'No superadmin exists to attribute the published versions to. Create one, or pass an explicit actorId.',
    );
  }
  return admin._id;
}

export const migrateBillingPlansToPerSeat = internalMutation({
  args: {
    /** Report only — writes nothing. Defaults to true (safe by default). */
    dryRun: v.optional(v.boolean()),
    /** Publish a new version for every changed plan. Defaults to true. */
    publish: v.optional(v.boolean()),
    /** Actor for the published version. Defaults to the first superadmin. */
    actorId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const shouldPublish = args.publish ?? true;
    const now = Date.now();

    const planRows = await ctx.db.query('billingPlans').take(100);

    const changes: PlanChange[] = [];

    for (const def of DEFAULT_PLANS) {
      const plan = planRows.find((p) => p.key === def.key);
      if (!plan) continue; // Catalog not seeded for this plan — nothing to migrate.

      const knownLegacy = LEGACY_PLAN_PRICES[def.key] ?? [];
      const priceMatchesLegacy =
        plan.priceMonthly !== undefined && knownLegacy.includes(plan.priceMonthly);

      const entitlement = await ctx.db
        .query('billingPlanEntitlements')
        .withIndex('by_plan_module', (q) => q.eq('planId', plan._id).eq('moduleKey', 'employees'))
        .first();
      const currentSeats = entitlement?.limits
        ? (JSON.parse(entitlement.limits) as Record<string, number | boolean>).seats
        : undefined;
      const legacyCap = LEGACY_SEAT_CAPS[def.key];
      const newCap = DEFAULT_ENTITLEMENTS[def.key].employees?.limits?.seats as number | undefined;
      const capMatchesLegacy =
        legacyCap !== undefined && currentSeats === legacyCap && newCap !== undefined;

      if (!priceMatchesLegacy && !capMatchesLegacy) continue; // Already migrated or customised.

      const change: PlanChange = {
        planKey: def.key,
        priceBefore: priceMatchesLegacy ? (plan.priceMonthly ?? undefined) : undefined,
        priceAfter: priceMatchesLegacy ? def.priceMonthly : undefined,
        seatCapBefore: capMatchesLegacy ? currentSeats : undefined,
        seatCapAfter: capMatchesLegacy ? newCap : undefined,
      };

      if (!dryRun) {
        if (priceMatchesLegacy) {
          await ctx.db.patch(plan._id, {
            priceMonthly: def.priceMonthly,
            priceYearly: def.priceYearly,
            updatedAt: now,
          });
        }
        if (capMatchesLegacy && entitlement) {
          const limits = {
            ...(JSON.parse(entitlement.limits ?? '{}') as Record<string, number | boolean>),
            seats: newCap,
          };
          await ctx.db.patch(entitlement._id, {
            limits: JSON.stringify(limits),
            updatedAt: now,
          });
        }
      }

      changes.push(change);
    }

    const published: Array<{ planId: Id<'billingPlans'>; version: number }> = [];
    if (!dryRun && shouldPublish && changes.length > 0) {
      const actorId = args.actorId ?? (await resolveSystemActor(ctx));
      for (const change of changes) {
        const plan = planRows.find((p) => p.key === change.planKey);
        if (!plan) continue;
        published.push(await publishPlanSnapshot(ctx, plan._id, actorId, now));
      }
      await ctx.db.insert('auditLogs', {
        organizationId: undefined,
        userId: actorId,
        action: 'billing.plans.migrate_per_seat',
        details: JSON.stringify(changes),
        createdAt: now,
      });
    }

    return {
      dryRun,
      changedPlans: changes.length,
      published: published.length,
      changes,
      publishedVersions: published,
    };
  },
});
