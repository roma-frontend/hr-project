/**
 * Pure succession-planning logic (ROADMAP 2.7) — no Convex imports, so it is
 * unit-testable without mocking the runtime.
 *
 * Two decision tables carry the domain:
 *   1. the 3×3 nine-box grid, where each (performance, potential) cell maps to
 *      a talent action and a display zone;
 *   2. succession risk, computed from a position's criticality against its
 *      ready-now/ready-soon successor coverage.
 *
 * Keeping these tables in code (not in the DB) means every tenant gets the same
 * methodology, and a change to the methodology is a reviewed code change.
 */

export type PerformanceScore = 1 | 2 | 3;
export type PotentialScore = 1 | 2 | 3;

/** The classic talent-review verdicts, row by row from the top of the grid. */
export type NineBoxZone =
  | 'star' // high performance, high potential — keep and grow fast
  | 'high_potential' // lower performance today, high potential — invest
  | 'core_performer' // high performance, moderate potential — reward, keep
  | 'growth' // moderate everything — develop steadily
  | 'specialist' // high performance, low potential — deep expertise, keep
  | 'under_review' // low performance, high potential — mismatch to diagnose
  | 'needs_support' // low performance, moderate potential — coach
  | 'risk' // low performance, low potential — plan exit or role change
  | 'unrated';

export interface NineBoxCell {
  zone: NineBoxZone;
  /** i18n key suffix under `succession.zones.` */
  labelKey: string;
  /** Row/column label, e.g. 'High performance · High potential'. */
  descriptorKey: string;
}

/**
 * Cell lookup: index [performance][potential], both 1..3.
 *
 * The mapping follows the standard talent-review grid:
 *   - performance is the Y axis (row), potential the X axis (column);
 *   - the top row (performance 3) owns 'star' at potential 3;
 *   - 'enigma'-style cells (low performance, high potential) are labelled
 *     'under_review' because the usual cause is a role mismatch, not the person.
 */
export const NINE_BOX_GRID: Record<PerformanceScore, Record<PotentialScore, NineBoxCell>> = {
  3: {
    1: {
      zone: 'specialist',
      labelKey: 'specialist',
      descriptorKey: 'perfHighPotLow',
    },
    2: { zone: 'core_performer', labelKey: 'corePerformer', descriptorKey: 'perfHighPotMid' },
    3: { zone: 'star', labelKey: 'star', descriptorKey: 'perfHighPotHigh' },
  },
  2: {
    1: { zone: 'needs_support', labelKey: 'needsSupport', descriptorKey: 'perfMidPotLow' },
    2: { zone: 'growth', labelKey: 'growth', descriptorKey: 'perfMidPotMid' },
    3: { zone: 'high_potential', labelKey: 'highPotential', descriptorKey: 'perfMidPotHigh' },
  },
  1: {
    1: { zone: 'risk', labelKey: 'risk', descriptorKey: 'perfLowPotLow' },
    2: { zone: 'needs_support', labelKey: 'needsSupport', descriptorKey: 'perfLowPotMid' },
    3: { zone: 'under_review', labelKey: 'underReview', descriptorKey: 'perfLowPotHigh' },
  },
};

export function nineBoxCell(performance: PerformanceScore, potential: PotentialScore): NineBoxCell {
  return NINE_BOX_GRID[performance][potential];
}

/** Suggested action per zone — i18n key suffix under `succession.actions.` */
export const ZONE_ACTIONS: Record<Exclude<NineBoxZone, 'unrated'>, string> = {
  star: 'growFast',
  high_potential: 'invest',
  core_performer: 'retain',
  growth: 'develop',
  specialist: 'retain',
  under_review: 'diagnose',
  needs_support: 'coach',
  risk: 'actNow',
};

// ── Risk assessment ──────────────────────────────────────────────────────────

export type Level = 'high' | 'medium' | 'low';
export type Readiness =
  | 'ready_now'
  | 'ready_within_year'
  | 'ready_within_two_years'
  | 'development_needed';

/** Successors who could take over without a long run-up. */
export const EFFECTIVE_READINESS: ReadonlySet<Readiness> = new Set([
  'ready_now',
  'ready_within_year',
]);

/** Weight of a readiness level in the coverage score (0..1). */
const READINESS_WEIGHT: Record<Readiness, number> = {
  ready_now: 1,
  ready_within_year: 0.6,
  ready_within_two_years: 0.3,
  development_needed: 0,
};

export interface PositionRiskInput {
  criticality: Level;
  vacancyRisk: Level;
  successors: ReadonlyArray<{ readiness: Readiness }>;
}

export type SuccessionRisk = 'critical' | 'high' | 'moderate' | 'low';

export interface PositionRiskResult {
  risk: SuccessionRisk;
  /** 0..100 — higher is better coverage. */
  coverage: number;
  readyNow: number;
  effective: number;
}

/**
 * Risk of a key position, from criticality + vacancy damage + successor depth.
 *
 * - A high-criticality position with zero effective successors is 'critical'
 *   regardless of the vacancy-risk label: the single worst state in the model.
 * - Otherwise the risk class is the worse of (criticality, vacancyRisk), then
 *   downgraded one step when coverage is strong and upgraded one step when the
 *   bench is empty even for a 'low' position.
 */
export function assessPositionRisk(input: PositionRiskInput): PositionRiskResult {
  const levelRank: Record<Level, number> = { high: 3, medium: 2, low: 1 };
  const readyNow = input.successors.filter((s) => s.readiness === 'ready_now').length;
  const effective = input.successors.filter((s) => EFFECTIVE_READINESS.has(s.readiness)).length;
  const coverageRaw = input.successors.reduce((sum, s) => sum + READINESS_WEIGHT[s.readiness], 0);
  // Two ready-now successors saturate the score; more than that still reads 100.
  const coverage = Math.min(100, Math.round((coverageRaw / 2) * 100));

  const severity = Math.max(levelRank[input.criticality], levelRank[input.vacancyRisk]);
  let risk: SuccessionRisk = severity === 3 ? 'critical' : severity === 2 ? 'high' : 'low';

  // Strong bench buys one step down; empty bench costs one step up.
  const stepDown = (r: SuccessionRisk): SuccessionRisk =>
    r === 'critical' ? 'high' : r === 'high' ? 'moderate' : 'low';
  const stepUp = (r: SuccessionRisk): SuccessionRisk =>
    r === 'low' ? 'moderate' : r === 'high' ? 'critical' : 'high';
  if (effective >= 2 && coverage >= 80) {
    risk = stepDown(risk);
  } else if (effective === 0) {
    risk = stepUp(risk);
  }

  return { risk, coverage, readyNow, effective };
}

/** Org-level headline: how many key positions sit in each risk class. */
export interface RiskSummary {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  /** Positions without any successor at all — the bench-building queue. */
  noSuccessors: number;
  total: number;
}

export function summarizeRisk(
  results: ReadonlyArray<PositionRiskResult & { exists: boolean }>,
): RiskSummary {
  const summary: RiskSummary = {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    noSuccessors: 0,
    total: results.length,
  };
  for (const r of results) {
    summary[r.risk] += 1;
    if (!r.exists) summary.noSuccessors += 1;
  }
  return summary;
}

/** Human-facing label suffixes for readiness, under `succession.readiness.` */
export const READINESS_LABEL_KEYS: Record<Readiness, string> = {
  ready_now: 'readyNow',
  ready_within_year: 'readyWithinYear',
  ready_within_two_years: 'readyWithinTwoYears',
  development_needed: 'developmentNeeded',
};
