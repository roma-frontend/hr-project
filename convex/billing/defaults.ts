/**
 * Billing defaults — the out-of-the-box Starter/Pro/Enterprise matrix.
 *
 * Shared by:
 *   - the seed mutation (writes them into Convex),
 *   - the entitlements engine (code-level fallback when no billing tables
 *     exist yet — keeps enforcement working from day one without a seed).
 *
 * IMPORTANT: enforcement uses these defaults ONLY when the billing catalog has
 * never been seeded. Once the superadmin publishes plans, the published
 * snapshots are the single source of truth.
 */

export type PlanKey = 'starter' | 'pro' | 'enterprise';

/** Legacy subscription/organization plan → billing plan key. */
export function mapLegacyPlan(plan: string | null | undefined): PlanKey | undefined {
  switch (plan) {
    case 'starter':
      return 'starter';
    case 'professional':
      return 'pro';
    case 'enterprise':
      return 'enterprise';
    default:
      return undefined;
  }
}

export interface DefaultPlanDef {
  key: PlanKey;
  name: string;
  tagline: string;
  /**
   * PER-SEAT price in USD/month (billed monthly), NOT a flat plan price.
   * Historic flat pricing ($29/$79 per plan) is retired: it made a 50-person
   * customer pay $1.58/seat. Volume tiers live in `seatTiers` and in the shared
   * model `src/lib/pricing.ts`; `src/__tests__/pricing.test.ts` asserts the two
   * stay aligned. `undefined` marks a quoted (custom) plan.
   */
  priceMonthly?: number;
  /** Per-seat price when billed annually (a discount on `priceMonthly`). */
  priceYearly?: number;
  currency: string;
  isPopular: boolean;
  isCustom: boolean;
  ctaLabel: string;
  sortOrder: number;
  /** Pricing shape. Kept explicit so the seed/editor can render it. */
  priceModel: 'per_seat';
  /** Volume brackets (whole-team rate). Mirrors `PLAN_SEAT_PRICING`. */
  seatTiers: Array<{ fromSeats: number; pricePerSeatMonthly: number }>;
  /** Fraction off the monthly per-seat price when billed annually. */
  annualDiscount: number;
}

/**
 * Volume brackets of a plan, ascending. Empty for an unknown key.
 */
export function seatTiersFor(planKey: string): DefaultPlanDef['seatTiers'] {
  return DEFAULT_PLANS.find((p) => p.key === planKey)?.seatTiers ?? [];
}

/**
 * Whole-team per-seat rate for a team size: the team moves to the bracket it
 * reaches, it is not charged marginally. Mirrors `volumeTierFor` /
 * `perSeatPrice` in `src/lib/pricing.ts` — a pricing unit test asserts the two
 * agree, because the server (this file) and the UI must quote the same number.
 */
export function perSeatUsdFor(planKey: string, seats: number): number {
  const tiers = seatTiersFor(planKey);
  if (tiers.length === 0) return 0;
  const billable = Math.max(1, Math.floor(seats || 1));
  let rate = tiers[0]!.pricePerSeatMonthly;
  for (const tier of tiers) {
    if (billable >= tier.fromSeats) rate = tier.pricePerSeatMonthly;
  }
  return rate;
}

/** Entry seat count — the cheapest way to start the plan. */
export function entrySeatsFor(planKey: string): number {
  return seatTiersFor(planKey)[0]?.fromSeats ?? 1;
}

export const DEFAULT_PLANS: DefaultPlanDef[] = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'For small teams getting organized — priced per seat',
    priceMonthly: 4,
    priceYearly: 3.2,
    currency: 'USD',
    isPopular: false,
    isCustom: false,
    ctaLabel: 'Start free trial',
    sortOrder: 1,
    priceModel: 'per_seat',
    seatTiers: [
      { fromSeats: 5, pricePerSeatMonthly: 4 },
      { fromSeats: 15, pricePerSeatMonthly: 3.5 },
    ],
    annualDiscount: 0.2,
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'For growing companies that need the full toolkit — priced per seat',
    priceMonthly: 8,
    priceYearly: 6.4,
    currency: 'USD',
    isPopular: true,
    isCustom: false,
    ctaLabel: 'Start free trial',
    sortOrder: 2,
    priceModel: 'per_seat',
    seatTiers: [
      { fromSeats: 10, pricePerSeatMonthly: 8 },
      { fromSeats: 50, pricePerSeatMonthly: 7 },
      { fromSeats: 100, pricePerSeatMonthly: 5.5 },
      { fromSeats: 250, pricePerSeatMonthly: 4.5 },
    ],
    annualDiscount: 0.2,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom solutions with dedicated support and SLA',
    priceMonthly: undefined,
    priceYearly: undefined,
    currency: 'USD',
    isPopular: false,
    isCustom: true,
    ctaLabel: 'Contact sales',
    sortOrder: 3,
    priceModel: 'per_seat',
    seatTiers: [{ fromSeats: 100, pricePerSeatMonthly: 12 }],
    annualDiscount: 0.25,
  },
];

export interface DefaultEntitlement {
  included: boolean;
  limits?: Record<string, number | boolean>;
  overLimit?: 'block' | 'warn' | 'allow';
}

type EntitlementMap = Record<string, DefaultEntitlement>;

export const DEFAULT_ENTITLEMENTS: Record<PlanKey, EntitlementMap> = {
  starter: {
    dashboard: { included: true },
    profile: { included: true },
    employees: { included: true, limits: { seats: 25 }, overLimit: 'block' },
    departments: { included: true },
    positions: { included: true },
    orgchart: { included: true },
    attendance: { included: true, limits: { faceKiosks: 1, biometric: true }, overLimit: 'block' },
    timeTracking: { included: true },
    leaves: { included: true, limits: { leaveTypes: 5 }, overLimit: 'block' },
    calendar: { included: true },
    chat: { included: true, limits: { channels: 10 }, overLimit: 'block' },
    tasks: { included: true, limits: { projects: 5 }, overLimit: 'block' },
    news: { included: true },
    documents: { included: true, limits: { documents: 100, storageGB: 5 }, overLimit: 'block' },
    signatures: { included: true, limits: { envelopes: 10 }, overLimit: 'block' },
  },
  pro: {
    dashboard: { included: true },
    profile: { included: true },
    employees: { included: true, limits: { seats: 300 }, overLimit: 'block' },
    departments: { included: true },
    positions: { included: true },
    orgchart: { included: true },
    drivers: { included: true, limits: { drivers: 10 }, overLimit: 'block' },
    probation: { included: true },
    attendance: { included: true, limits: { faceKiosks: 3, biometric: true }, overLimit: 'block' },
    timeTracking: { included: true },
    shiftScheduling: { included: true, limits: { shifts: 500 }, overLimit: 'block' },
    leaves: { included: true, limits: { leaveTypes: 10 }, overLimit: 'block' },
    calendar: { included: true },
    meetingRooms: { included: true, limits: { rooms: 10 }, overLimit: 'block' },
    videoConferences: {
      included: true,
      limits: { rooms: 10, recording: true, webinars: false },
      overLimit: 'block',
    },
    productivity: { included: true },
    performance: { included: true },
    reviews: { included: true },
    goals: { included: true },
    succession: { included: true },
    careerPaths: { included: true },
    recognition: { included: true },
    rewards: { included: true },
    surveys: { included: true },
    recruitment: { included: true, limits: { openRoles: 10 }, overLimit: 'block' },
    onboarding: { included: true },
    offboarding: { included: true },
    learning: { included: true },
    hiringPackets: { included: true },
    payroll: { included: true, limits: { runs: 12 }, overLimit: 'block' },
    compensation: { included: true },
    expenses: { included: true, limits: { reports: 50 }, overLimit: 'block' },
    benefits: { included: true, limits: { plans: 5, claims: 100 }, overLimit: 'block' },
    assets: { included: true },
    reports: { included: true },
    analytics: { included: true },
    chat: { included: true, limits: { channels: 50 }, overLimit: 'block' },
    news: { included: true },
    approvals: { included: true },
    newsletter: { included: true },
    documents: { included: true, limits: { documents: 1000, storageGB: 50 }, overLimit: 'block' },
    signatures: { included: true, limits: { envelopes: 100 }, overLimit: 'block' },
    documentBuilder: { included: true },
    backups: { included: true, limits: { retentionDays: 30 }, overLimit: 'block' },
    integrations: { included: true },
    automation: { included: true },
    tasks: { included: true, limits: { projects: 50 }, overLimit: 'block' },
    aiAssistant: { included: true, limits: { queries: 500 }, overLimit: 'block' },
    aiSiteEditor: { included: true },
    securityCenter: { included: true },
    compliance: { included: true },
    // Public API from Pro up: every competitor we are compared against ships an
    // API on their mid tier, so gating it to Enterprise only made us look worse
    // on the one row buyers check first. Starter stays without it — a 10-seat
    // team integrates nothing, and it keeps the Pro upgrade honest.
    apiAccess: { included: true, limits: { apiCalls: 25000 }, overLimit: 'block' },
  },
  enterprise: {
    dashboard: { included: true },
    profile: { included: true },
    employees: { included: true, limits: { seats: 999999 }, overLimit: 'block' },
    departments: { included: true },
    positions: { included: true },
    orgchart: { included: true },
    drivers: { included: true, limits: { drivers: 999 }, overLimit: 'block' },
    probation: { included: true },
    attendance: { included: true, limits: { faceKiosks: 99, biometric: true }, overLimit: 'block' },
    timeTracking: { included: true },
    shiftScheduling: { included: true, limits: { shifts: 9999 }, overLimit: 'block' },
    leaves: { included: true, limits: { leaveTypes: 50 }, overLimit: 'block' },
    calendar: { included: true },
    meetingRooms: { included: true, limits: { rooms: 999 }, overLimit: 'block' },
    videoConferences: {
      included: true,
      limits: { rooms: 999, recording: true, webinars: true },
      overLimit: 'block',
    },
    productivity: { included: true },
    performance: { included: true },
    reviews: { included: true },
    goals: { included: true },
    succession: { included: true },
    careerPaths: { included: true },
    recognition: { included: true },
    rewards: { included: true },
    surveys: { included: true },
    recruitment: { included: true, limits: { openRoles: 999 }, overLimit: 'block' },
    onboarding: { included: true },
    offboarding: { included: true },
    learning: { included: true },
    hiringPackets: { included: true },
    payroll: { included: true, limits: { runs: 999 }, overLimit: 'block' },
    compensation: { included: true },
    expenses: { included: true, limits: { reports: 999 }, overLimit: 'block' },
    benefits: { included: true, limits: { plans: 999, claims: 9999 }, overLimit: 'block' },
    assets: { included: true },
    reports: { included: true },
    analytics: { included: true },
    chat: { included: true, limits: { channels: 999 }, overLimit: 'block' },
    news: { included: true },
    approvals: { included: true },
    newsletter: { included: true },
    supportTickets: { included: true },
    documents: { included: true, limits: { documents: 99999, storageGB: 999 }, overLimit: 'block' },
    signatures: { included: true, limits: { envelopes: 999 }, overLimit: 'block' },
    documentBuilder: { included: true },
    backups: { included: true, limits: { retentionDays: 365 }, overLimit: 'block' },
    integrations: { included: true },
    automation: { included: true },
    tasks: { included: true, limits: { projects: 999 }, overLimit: 'block' },
    aiAssistant: { included: true, limits: { queries: 99999 }, overLimit: 'block' },
    aiSiteEditor: { included: true },
    securityCenter: { included: true },
    compliance: { included: true },
    // Coming modules are configurable today; enforcement unlocks them on release.
    aiMeetingAgent: { included: true, limits: { hours: 100 }, overLimit: 'block' },
    breakoutRooms: { included: true },
    guestAccess: { included: true, limits: { guests: 50 }, overLimit: 'block' },
    mobileApp: { included: true },
    apiAccess: { included: true, limits: { apiCalls: 100000 }, overLimit: 'block' },
  },
};

/** Build the effective entitlements from the code-level defaults. */
export function buildDefaultEntitlements(planKey: PlanKey): Record<
  string,
  {
    included: boolean;
    limits?: Record<string, number | boolean>;
    overLimit: 'block' | 'warn' | 'allow';
  }
> {
  const matrix = DEFAULT_ENTITLEMENTS[planKey] ?? {};
  const out: Record<
    string,
    {
      included: boolean;
      limits?: Record<string, number | boolean>;
      overLimit: 'block' | 'warn' | 'allow';
    }
  > = {};
  for (const [key, ent] of Object.entries(matrix)) {
    out[key] = {
      included: ent.included,
      limits: ent.limits,
      overLimit: ent.overLimit ?? 'block',
    };
  }
  return out;
}

export function defaultPlanName(planKey: PlanKey): string {
  return DEFAULT_PLANS.find((p) => p.key === planKey)?.name ?? planKey;
}
