/**
 * Tests for stripe-config.ts — plan config and helpers.
 *
 * The prices are PER SEAT and derived from the shared model; the flat plan
 * prices ($29 / $79 / $199) this file used to carry are the regression being
 * guarded here: they disagreed with the landing page, the tariff editor and the
 * entitlements engine at once.
 */
import { STRIPE_PLANS, resolvePlanFromPriceId, isValidEmail } from '@/lib/stripe-config';
import { PLAN_SEAT_PRICING, entrySeatCount } from '@/lib/pricing';

describe('STRIPE_PLANS', () => {
  it('quotes the entry-bracket per-seat rate of the shared model', () => {
    expect(STRIPE_PLANS.starter.name).toBe('Starter');
    expect(STRIPE_PLANS.starter.planKey).toBe('starter');
    expect(STRIPE_PLANS.starter.perSeatMonthly).toBe(
      PLAN_SEAT_PRICING.starter.tiers[0]!.pricePerSeatMonthly,
    );
    expect(STRIPE_PLANS.starter.entrySeats).toBe(entrySeatCount('starter'));

    expect(STRIPE_PLANS.professional.name).toBe('Professional');
    // Stripe's product name is "Professional"; the seat model calls it 'pro'.
    expect(STRIPE_PLANS.professional.planKey).toBe('pro');
    expect(STRIPE_PLANS.professional.perSeatMonthly).toBe(
      PLAN_SEAT_PRICING.pro.tiers[0]!.pricePerSeatMonthly,
    );
    expect(STRIPE_PLANS.professional.entrySeats).toBe(entrySeatCount('pro'));

    expect(STRIPE_PLANS.enterprise.name).toBe('Enterprise');
    expect(STRIPE_PLANS.enterprise.planKey).toBe('enterprise');
  });

  it('carries no flat plan price', () => {
    for (const plan of Object.values(STRIPE_PLANS)) {
      expect(plan).not.toHaveProperty('priceMonthly');
      // A per-seat rate for a real plan is never in flat-plan territory.
      expect(plan.perSeatMonthly).toBeGreaterThan(0);
      expect(plan.perSeatMonthly).toBeLessThan(20);
    }
  });

  it('agrees with the currency layer the UI prices from', () => {
    // Both read the same model, so a UI price and a checkout price can only
    // differ if one of them stops being derived.
    const { BASE_PRICES } = require('@/lib/currency');
    expect(BASE_PRICES.starter).toBe(STRIPE_PLANS.starter.perSeatMonthly);
    expect(BASE_PRICES.professional).toBe(STRIPE_PLANS.professional.perSeatMonthly);
  });

  it('all plans have priceIdEnv', () => {
    expect(STRIPE_PLANS.starter.priceIdEnv).toBe('STRIPE_PRICE_STARTER');
    expect(STRIPE_PLANS.professional.priceIdEnv).toBe('STRIPE_PRICE_PROFESSIONAL');
    expect(STRIPE_PLANS.enterprise.priceIdEnv).toBe('STRIPE_PRICE_ENTERPRISE');
  });

  it('is a const object (as const)', () => {
    const plans = Object.keys(STRIPE_PLANS);
    expect(plans).toEqual(['starter', 'professional', 'enterprise']);
  });
});

describe('resolvePlanFromPriceId', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns starter for matching price ID', () => {
    process.env.STRIPE_PRICE_STARTER = 'price_starter_123';
    expect(resolvePlanFromPriceId('price_starter_123')).toBe('starter');
  });

  it('returns professional for matching price ID', () => {
    process.env.STRIPE_PRICE_PROFESSIONAL = 'price_pro_456';
    expect(resolvePlanFromPriceId('price_pro_456')).toBe('professional');
  });

  it('returns enterprise for matching price ID', () => {
    process.env.STRIPE_PRICE_ENTERPRISE = 'price_ent_789';
    expect(resolvePlanFromPriceId('price_ent_789')).toBe('enterprise');
  });

  it('returns null for unknown price ID', () => {
    process.env.STRIPE_PRICE_STARTER = 'price_starter_123';
    process.env.STRIPE_PRICE_PROFESSIONAL = 'price_pro_456';
    process.env.STRIPE_PRICE_ENTERPRISE = 'price_ent_789';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolvePlanFromPriceId('unknown_price')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns null when env vars are not set', () => {
    delete process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_PROFESSIONAL;
    delete process.env.STRIPE_PRICE_ENTERPRISE;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolvePlanFromPriceId('anything')).toBeNull();
    warnSpy.mockRestore();
  });
});

describe('isValidEmail', () => {
  it('accepts valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects missing @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects missing TLD', () => {
    expect(isValidEmail('user@example')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('accepts subdomain email', () => {
    expect(isValidEmail('user@sub.example.com')).toBe(true);
  });
});
