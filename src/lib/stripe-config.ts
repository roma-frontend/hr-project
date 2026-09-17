/**
 * Stripe configuration — single source of truth
 *
 * PER SEAT, not per plan. These entries used to carry flat plan prices
 * ($29 / $79 / $199) while the product is sold per seat with volume tiers, so
 * "Starter = $29" disagreed with the landing page, the billing editor and the
 * entitlements engine. The numbers below are derived from the shared per-seat
 * model (`src/lib/pricing.ts`, mirrored by `convex/billing/defaults.ts`), and
 * the real charge is `quantity = seats` against a per-seat Stripe Price — see
 * `src/app/api/stripe/checkout/route.ts`. Nothing here should be read as
 * "the plan costs $X/month".
 */

import { PLAN_SEAT_PRICING, entrySeatCount, type PlanKey } from '@/lib/pricing';

interface StripePlanConfig {
  name: string;
  /** Seat-pricing plan key ('professional' in Stripe maps to the 'pro' plan). */
  planKey: PlanKey;
  /** USD per active seat per month, at the plan's entry bracket. */
  perSeatMonthly: number;
  /** Seats the subscription starts at (the plan's minimum billable team). */
  entrySeats: number;
  priceIdEnv: string;
}

function planConfig(name: string, planKey: PlanKey, priceIdEnv: string): StripePlanConfig {
  return {
    name,
    planKey,
    perSeatMonthly: PLAN_SEAT_PRICING[planKey].tiers[0]?.pricePerSeatMonthly ?? 0,
    entrySeats: entrySeatCount(planKey),
    priceIdEnv,
  };
}

export const STRIPE_PLANS = {
  starter: planConfig('Starter', 'starter', 'STRIPE_PRICE_STARTER'),
  professional: planConfig('Professional', 'pro', 'STRIPE_PRICE_PROFESSIONAL'),
  enterprise: planConfig('Enterprise', 'enterprise', 'STRIPE_PRICE_ENTERPRISE'),
} as const;

export type StripePlan = keyof typeof STRIPE_PLANS;

/**
 * Resolve plan from Stripe Price ID.
 * Returns null if priceId doesn't match any known plan.
 */
export function resolvePlanFromPriceId(priceId: string): StripePlan | null {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) return 'professional';
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'enterprise';
  console.warn('[Stripe Config] Unknown price ID:', priceId);
  return null;
}

/**
 * Validate email format (basic RFC 5322 simplified check)
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
