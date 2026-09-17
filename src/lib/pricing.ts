/**
 * Per-seat pricing model with volume tiers.
 *
 * The platform used to be sold as a flat monthly plan ($29 / $79), which made
 * a 50-person Pro customer pay $1.58 per seat — an order of magnitude below
 * every competitor and impossible to sustain. This module is the single source
 * of the pricing *shape*: a per-seat base price that drops as the team grows
 * (volume pricing — the whole team moves to the bracket rate, not just the
 * marginal seats).
 *
 * The per-seat base prices live in `convex/billing/defaults.ts` (the seed and
 * the fallback the billing engine reads); a unit test asserts the two stay
 * aligned, so changing one without the other fails CI.
 *
 * Price tiers (USD/seat/mo, monthly billing): Starter $4 → $3.50, Pro $8 →
 * $7 → $5.50 → $4.50, Enterprise quoted from $12. These sit at the market
 * median of the SMB HRIS field (PeopleForce ≈ $3–5, Factorial ≈ €4–6,
 * Personio ≈ €4.5–9, BambooHR ≈ $6.5–9.5, Rippling ≈ $8–10, HiBob ≈ $10–14),
 * which is what "priced like the market" was chosen to mean — see
 * docs/gtm-playbook.md §4 for the reasoning and the sources to re-check.
 *
 * Annual billing applies a discount to the monthly per-seat price; the UI shows
 * the monthly-equivalent figure in both cases, exactly like the plan cards.
 */

export type PlanKey = 'starter' | 'pro' | 'enterprise';
export type BillingPeriod = 'monthly' | 'annual';

export interface SeatTier {
  /** Inclusive lower bound of the bracket. */
  fromSeats: number;
  /** Per-seat price in USD per month billed monthly. */
  pricePerSeatMonthly: number;
}

export interface PlanSeatPricing {
  /** Entry seat count — the cheapest way to start on this plan. */
  minSeats: number;
  /** Seat count above which the plan requires sales (null = uncapped). */
  maxSeats: number | null;
  /** Ascending brackets; the first bracket's `fromSeats` equals `minSeats`. */
  tiers: SeatTier[];
  /** Fraction taken off the monthly per-seat price when billed annually. */
  annualDiscount: number;
  /** Enterprise-style plans are quoted rather than self-served. */
  selfServe: boolean;
}

export const PLAN_SEAT_PRICING: Record<PlanKey, PlanSeatPricing> = {
  starter: {
    minSeats: 5,
    maxSeats: 25,
    tiers: [
      { fromSeats: 5, pricePerSeatMonthly: 4 },
      { fromSeats: 15, pricePerSeatMonthly: 3.5 },
    ],
    annualDiscount: 0.2,
    selfServe: true,
  },
  pro: {
    minSeats: 10,
    maxSeats: 300,
    tiers: [
      { fromSeats: 10, pricePerSeatMonthly: 8 },
      { fromSeats: 50, pricePerSeatMonthly: 7 },
      { fromSeats: 100, pricePerSeatMonthly: 5.5 },
      { fromSeats: 250, pricePerSeatMonthly: 4.5 },
    ],
    annualDiscount: 0.2,
    selfServe: true,
  },
  enterprise: {
    minSeats: 100,
    maxSeats: null,
    tiers: [{ fromSeats: 100, pricePerSeatMonthly: 12 }],
    annualDiscount: 0.25,
    selfServe: false,
  },
};

/** Clamp a requested seat count to the plan's billable range. */
export function normalizeSeats(planKey: PlanKey, seats: number): number {
  const plan = PLAN_SEAT_PRICING[planKey];
  const rounded = Math.max(plan.minSeats, Math.round(seats || plan.minSeats));
  return plan.maxSeats === null ? rounded : Math.min(plan.maxSeats, rounded);
}

/** The volume bracket a given team size falls into (whole-team rate). */
export function volumeTierFor(planKey: PlanKey, seats: number): SeatTier {
  const plan = PLAN_SEAT_PRICING[planKey];
  const clamped = normalizeSeats(planKey, seats);
  let current = plan.tiers[0]!;
  for (const tier of plan.tiers) {
    if (clamped >= tier.fromSeats) current = tier;
  }
  return current;
}

/**
 * Effective per-seat price (monthly-equivalent, in USD) for a team size and
 * billing period. Annual billing applies the plan's discount. Enterprise is
 * quoted, so its tier price is an indicative "from" figure.
 */
export function perSeatPrice(
  planKey: PlanKey,
  seats: number,
  period: BillingPeriod = 'monthly',
): number {
  const tier = volumeTierFor(planKey, seats);
  const discount = period === 'annual' ? PLAN_SEAT_PRICING[planKey].annualDiscount : 0;
  return round2(tier.pricePerSeatMonthly * (1 - discount));
}

/** Total monthly (monthly-equivalent) cost for a team size. */
export function monthlyTotal(
  planKey: PlanKey,
  seats: number,
  period: BillingPeriod = 'monthly',
): number {
  const billable = normalizeSeats(planKey, seats);
  return Math.round(perSeatPrice(planKey, seats, period) * billable);
}

/** Total charged per year for a team size, given the billing period. */
export function annualTotal(
  planKey: PlanKey,
  seats: number,
  period: BillingPeriod = 'annual',
): number {
  return monthlyTotal(planKey, seats, period) * 12;
}

/** Entry seat count (the smallest team the plan sells). */
export function entrySeatCount(planKey: PlanKey): number {
  return PLAN_SEAT_PRICING[planKey].minSeats;
}

export interface SeatTierQuote {
  /** Bracket the team lands in (the whole team pays this rate). */
  tier: SeatTier;
  /** Tier rate relative to the plan's entry rate (1 in the entry bracket). */
  rateMultiplier: number;
  /** Seats actually billed — clamped to the plan's self-serve range. */
  billableSeats: number;
  /** The team is bigger than the plan self-serves, so it needs sales. */
  overCap: boolean;
}

/**
 * Everything a price quote needs for one team size: which bracket applies, how
 * the entry rate scales into it, and whether the plan can serve that team at
 * all.
 *
 * `rateMultiplier` — not a price — is what callers apply to the *catalog's*
 * entry rate, so a superadmin editing the base price still sees their own
 * numbers while the volume discount comes from the model. The tariff editor's
 * team-size slider reads exactly this.
 */
export function seatTierQuote(planKey: PlanKey, seats: number): SeatTierQuote {
  const plan = PLAN_SEAT_PRICING[planKey];
  const entryRate = plan.tiers[0]!.pricePerSeatMonthly;
  const tier = volumeTierFor(planKey, seats);
  return {
    tier,
    rateMultiplier: entryRate === 0 ? 1 : tier.pricePerSeatMonthly / entryRate,
    billableSeats: normalizeSeats(planKey, seats),
    overCap: plan.maxSeats !== null && seats > plan.maxSeats,
  };
}

/** Headline price for the plan card: cost of the entry team size. */
export function entryMonthlyTotal(planKey: PlanKey, period: BillingPeriod = 'monthly'): number {
  return monthlyTotal(planKey, PLAN_SEAT_PRICING[planKey].minSeats, period);
}

/** Percentage saved by paying annually, for the pricing toggle badge. */
export function annualDiscountPct(planKey: PlanKey): number {
  return Math.round(PLAN_SEAT_PRICING[planKey].annualDiscount * 100);
}

export function isSelfServePlan(planKey: PlanKey): boolean {
  return PLAN_SEAT_PRICING[planKey].selfServe;
}

/**
 * Seat (employee) cap of a plan, straight from the pricing shape. `null` means
 * quoted / uncapped.
 *
 * Any copy that promises a team size — "Up to N employees" — must derive N from
 * here instead of a translated string. The locale files spelled the numbers out
 * (10 / 50) and every one of them went stale the moment the plans gained seat
 * limits, so the number is now computed rather than translated.
 */
export function seatCap(planKey: PlanKey): number | null {
  return PLAN_SEAT_PRICING[planKey].maxSeats;
}

/** Format a per-seat price without trailing `.00` noise. */
export function formatPerSeat(value: number, symbol = '$'): string {
  const rounded = round2(value);
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${symbol}${text}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
