/**
 * Stripe configuration — single source of truth
 */

export const STRIPE_PLANS = {
  starter: {
    name: 'Starter',
    priceMonthly: 29,
    priceIdEnv: 'STRIPE_PRICE_STARTER',
  },
  professional: {
    name: 'Professional',
    priceMonthly: 79,
    priceIdEnv: 'STRIPE_PRICE_PROFESSIONAL',
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthly: 199,
    priceIdEnv: 'STRIPE_PRICE_ENTERPRISE',
  },
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
