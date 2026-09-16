/**
 * Pure career-development logic (ROADMAP 3.8) — no Convex imports.
 *
 * The gap analysis is the module's core computation: required skill levels of a
 * target position minus an employee's observed levels, split into mandatory
 * (promotion-blocking) and optional gaps. The result also names the readiness
 * verdict so the UI never re-derives it.
 */

export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type RequiredLevel = 1 | 2 | 3 | 4 | 5;

export interface SkillRequirementRow {
  skillId: string;
  requiredLevel: RequiredLevel;
  isMandatory: boolean;
}

export interface EmployeeSkillRow {
  skillId: string;
  level: SkillLevel;
}

export interface GapRow {
  skillId: string;
  requiredLevel: RequiredLevel;
  currentLevel: SkillLevel;
  /** requiredLevel − currentLevel, 0 when met or exceeded. */
  gap: number;
  isMandatory: boolean;
}

export type PromotionReadiness = 'ready' | 'close' | 'developing' | 'blocked';

export interface GapAnalysisResult {
  gaps: GapRow[];
  mandatoryGapsCount: number;
  totalGapLevels: number;
  readiness: PromotionReadiness;
}

/** Levels missing entirely read as 0 (unassessed), not as an error. */
export function computeGapAnalysis(
  requirements: ReadonlyArray<SkillRequirementRow>,
  observed: ReadonlyArray<EmployeeSkillRow>,
): GapAnalysisResult {
  const levelBySkill = new Map(observed.map((o) => [o.skillId, o.level]));

  const gaps: GapRow[] = requirements.map((req) => {
    const currentLevel = levelBySkill.get(req.skillId) ?? 0;
    const rawGap = req.requiredLevel - currentLevel;
    return {
      skillId: req.skillId,
      requiredLevel: req.requiredLevel,
      currentLevel,
      gap: rawGap > 0 ? rawGap : 0,
      isMandatory: req.isMandatory,
    };
  });

  const mandatoryGapsCount = gaps.filter((g) => g.isMandatory && g.gap > 0).length;
  const totalGapLevels = gaps.reduce((sum, g) => sum + g.gap, 0);

  return {
    gaps,
    mandatoryGapsCount,
    totalGapLevels,
    readiness: readinessVerdict(mandatoryGapsCount, totalGapLevels, requirements.length),
  };
}

/**
 * Verdict from the gap shape:
 *   - no mandatory gaps and no optional ones → ready;
 *   - no mandatory gaps but small polish left (≤2 levels total) → close;
 *   - no mandatory gaps, big polish left → developing;
 *   - any mandatory gap → blocked (a promotion review would fail on it).
 * An empty requirement set is 'blocked' too — nothing to promote against yet.
 */
export function readinessVerdict(
  mandatoryGapsCount: number,
  totalGapLevels: number,
  requirementsCount: number,
): PromotionReadiness {
  if (requirementsCount === 0 || mandatoryGapsCount > 0) return 'blocked';
  if (totalGapLevels === 0) return 'ready';
  return totalGapLevels <= 2 ? 'close' : 'developing';
}

/** i18n key suffixes under `careers.readiness.` */
export const READINESS_KEYS: Record<PromotionReadiness, string> = {
  ready: 'ready',
  close: 'close',
  developing: 'developing',
  blocked: 'blocked',
};

/** Typical months-in-step ladder, used when a track omits minMonthsInStep. */
export const DEFAULT_STEP_MONTHS: Record<'junior' | 'mid' | 'senior' | 'lead', number> = {
  junior: 18,
  mid: 24,
  senior: 36,
  lead: 0, // terminal step
};

/** Next step key in a track, or null when the employee sits at the last step. */
export function nextStepKey(
  steps: ReadonlyArray<{ key: string }>,
  currentStepKey: string,
): string | null {
  const index = steps.findIndex((s) => s.key === currentStepKey);
  if (index === -1 || index === steps.length - 1) return null;
  return steps[index + 1]!.key;
}
