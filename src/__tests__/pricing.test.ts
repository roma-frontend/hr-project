/**
 * Per-seat pricing model (`src/lib/pricing.ts`).
 *
 * The billing defaults (`convex/billing/defaults.ts`) carry the same base
 * per-seat prices the seed writes into Convex. These tests keep the two in
 * sync: changing a price in one place without the other fails CI rather than
 * shipping a landing page that quotes a number the billing system never
 * charges.
 */

import { describe, it, expect } from '@jest/globals';
import {
  PLAN_SEAT_PRICING,
  annualDiscountPct,
  annualTotal,
  entryMonthlyTotal,
  entrySeatCount,
  isSelfServePlan,
  monthlyTotal,
  normalizeSeats,
  perSeatPrice,
  seatCap,
  seatTierQuote,
  volumeTierFor,
  type PlanKey,
} from '@/lib/pricing';
import { DEFAULT_PLANS, entrySeatsFor, perSeatUsdFor } from '../../convex/billing/defaults';

const PAID_PLANS: PlanKey[] = ['starter', 'pro'];

describe('seat pricing shape', () => {
  it('has ascending tiers whose first bracket equals the entry seat count', () => {
    for (const key of ['starter', 'pro', 'enterprise'] as PlanKey[]) {
      const plan = PLAN_SEAT_PRICING[key];
      expect(plan.tiers.length).toBeGreaterThan(0);
      expect(plan.tiers[0]!.fromSeats).toBe(plan.minSeats);
      for (let i = 1; i < plan.tiers.length; i++) {
        expect(plan.tiers[i]!.fromSeats).toBeGreaterThan(plan.tiers[i - 1]!.fromSeats);
        // Volume pricing: the per-seat rate never rises as the team grows.
        expect(plan.tiers[i]!.pricePerSeatMonthly).toBeLessThanOrEqual(
          plan.tiers[i - 1]!.pricePerSeatMonthly,
        );
      }
    }
  });

  it('clamps seat counts to the plan range', () => {
    expect(normalizeSeats('starter', 1)).toBe(5);
    expect(normalizeSeats('starter', 999)).toBe(25);
    expect(normalizeSeats('pro', 40)).toBe(40);
    expect(normalizeSeats('enterprise', 1)).toBe(100);
  });

  it('selects the whole-team volume bracket', () => {
    expect(volumeTierFor('pro', 10).pricePerSeatMonthly).toBe(8);
    expect(volumeTierFor('pro', 49).pricePerSeatMonthly).toBe(8);
    expect(volumeTierFor('pro', 50).pricePerSeatMonthly).toBe(7);
    expect(volumeTierFor('pro', 120).pricePerSeatMonthly).toBe(5.5);
    expect(volumeTierFor('pro', 260).pricePerSeatMonthly).toBe(4.5);
  });

  it('drops the per-seat price monotonically as the team grows', () => {
    let previous = Infinity;
    for (const seats of [10, 30, 60, 150, 300]) {
      const perSeat = perSeatPrice('pro', seats);
      expect(perSeat).toBeLessThanOrEqual(previous);
      previous = perSeat;
    }
  });

  it('applies the annual discount to the monthly-equivalent price', () => {
    expect(perSeatPrice('pro', 10, 'annual')).toBeCloseTo(6.4, 5);
    expect(perSeatPrice('pro', 10, 'monthly')).toBe(8);
    expect(annualDiscountPct('pro')).toBe(20);
  });

  it('multiplies the effective per-seat price by the billable seats', () => {
    expect(monthlyTotal('pro', 10)).toBe(80);
    expect(monthlyTotal('pro', 50)).toBe(350);
    expect(annualTotal('pro', 10, 'annual')).toBe(monthlyTotal('pro', 10, 'annual') * 12);
  });

  it('exposes entry totals and self-serve flags', () => {
    expect(entrySeatCount('pro')).toBe(10);
    expect(entryMonthlyTotal('starter')).toBe(20);
    expect(isSelfServePlan('pro')).toBe(true);
    expect(isSelfServePlan('enterprise')).toBe(false);
  });

  it('stays inside the market band the price tiers were chosen for', () => {
    // The tiers are set at the market median of the SMB HRIS field (≈$7/seat):
    // below PeopleForce/BambooHR premium tiers, above the local ERP add-ons.
    // Guards against a careless edit pushing the entry rate out of the band.
    expect(perSeatPrice('starter', 5)).toBeGreaterThanOrEqual(3);
    expect(perSeatPrice('starter', 5)).toBeLessThanOrEqual(5);
    expect(perSeatPrice('pro', 10)).toBeGreaterThanOrEqual(5);
    expect(perSeatPrice('pro', 10)).toBeLessThanOrEqual(10);
    expect(perSeatPrice('enterprise', 100)).toBeGreaterThanOrEqual(10);
    expect(perSeatPrice('enterprise', 100)).toBeLessThanOrEqual(18);
  });
});

describe('seat tier quoting (tariff editor preview)', () => {
  it('reports the bracket a team lands in and scales the entry rate into it', () => {
    // The editor slider shows the *catalog's* base price scaled by this ratio,
    // so the ratio has to be the model's — not a second, hand-kept table.
    const cases: Array<[number, number]> = [
      [10, 1],
      [49, 1],
      [50, 7 / 8],
      [100, 5.5 / 8],
      [250, 4.5 / 8],
      [300, 4.5 / 8],
    ];
    for (const [seats, expected] of cases) {
      expect(seatTierQuote('pro', seats).rateMultiplier).toBeCloseTo(expected, 6);
    }
    expect(seatTierQuote('pro', 50).tier).toEqual(volumeTierFor('pro', 50));
    expect(seatTierQuote('starter', 15).rateMultiplier).toBeCloseTo(3.5 / 4, 6);
  });

  it('flags a team past the self-serve cap and bills only up to it', () => {
    const starterAt50 = seatTierQuote('starter', 50);
    expect(starterAt50.overCap).toBe(true);
    expect(starterAt50.billableSeats).toBe(seatCap('starter'));

    expect(seatTierQuote('starter', 25).overCap).toBe(false);
    expect(seatTierQuote('pro', 300).overCap).toBe(false);
    expect(seatTierQuote('enterprise', 1000).overCap).toBe(false); // quoted, uncapped
  });

  it('never quotes a team smaller than the plan sells', () => {
    const tiny = seatTierQuote('pro', 3);
    expect(tiny.billableSeats).toBe(entrySeatCount('pro'));
    expect(tiny.rateMultiplier).toBe(1);
  });
});

describe('billing defaults align with the seat pricing model', () => {
  it('stores the same per-seat base price as the model', () => {
    for (const key of PAID_PLANS) {
      const def = DEFAULT_PLANS.find((p) => p.key === key);
      expect(def?.priceModel).toBe('per_seat');
      expect(def?.priceMonthly).toBe(PLAN_SEAT_PRICING[key].tiers[0]!.pricePerSeatMonthly);
      expect(def?.seatTiers).toEqual(PLAN_SEAT_PRICING[key].tiers);
      expect(def?.annualDiscount).toBe(PLAN_SEAT_PRICING[key].annualDiscount);
    }
  });

  it('keeps Enterprise quoted (no self-serve price)', () => {
    const ent = DEFAULT_PLANS.find((p) => p.key === 'enterprise');
    expect(ent?.isCustom).toBe(true);
    expect(ent?.priceMonthly).toBeUndefined();
  });

  it('picks the same volume bracket as the model, for every team size', () => {
    // The server bills local orders from `perSeatUsdFor`; the UI quotes from
    // `perSeatPrice`. If these two ever disagree, a customer is charged a
    // different number than the one they were shown.
    for (const key of PAID_PLANS) {
      for (const seats of [5, 9, 10, 14, 15, 25, 49, 50, 99, 100, 249, 250, 300, 500]) {
        expect(perSeatUsdFor(key, seats)).toBe(perSeatPrice(key, seats));
      }
    }
    expect(entrySeatsFor('pro')).toBe(entrySeatCount('pro'));
  });

  it('maps the Stripe-named plan key onto the seat model key', () => {
    // `professional` is the Stripe/local-PSP name; `pro` is the billing name.
    expect(perSeatUsdFor('pro', 50)).toBe(7);
    expect(entrySeatsFor('professional')).toBe(1); // unknown key, never a crash
  });
});
