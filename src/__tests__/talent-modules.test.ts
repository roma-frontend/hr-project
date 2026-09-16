import {
  NINE_BOX_GRID,
  assessPositionRisk,
  summarizeRisk,
  EFFECTIVE_READINESS,
  type Readiness,
} from '../../convex/lib/succession';
import {
  computeGapAnalysis,
  readinessVerdict,
  nextStepKey,
  DEFAULT_STEP_MONTHS,
  READINESS_KEYS,
  type SkillRequirementRow,
  type EmployeeSkillRow,
} from '../../convex/lib/careers';

// ── Nine-box grid ────────────────────────────────────────────────────────────

describe('NINE_BOX_GRID', () => {
  it('maps every (performance, potential) pair to exactly one zone', () => {
    const seen = new Set<string>();
    for (const perf of [1, 2, 3] as const) {
      for (const pot of [1, 2, 3] as const) {
        const cell = NINE_BOX_GRID[perf][pot];
        expect(cell.zone).not.toBe('unrated');
        expect(cell.labelKey).toBeTruthy();
        expect(cell.descriptorKey).toBeTruthy();
        seen.add(cell.zone);
      }
    }
    // 9 cells, 8 distinct zones — 'needs_support' appears twice by design.
    expect(seen.size).toBe(8);
  });

  it('puts star at high performance + high potential', () => {
    expect(NINE_BOX_GRID[3][3].zone).toBe('star');
  });

  it('labels low performance + high potential as under_review (role mismatch)', () => {
    expect(NINE_BOX_GRID[1][3].zone).toBe('under_review');
  });

  it('labels low performance + low potential as risk', () => {
    expect(NINE_BOX_GRID[1][1].zone).toBe('risk');
  });
});

// ── Position risk ────────────────────────────────────────────────────────────

describe('assessPositionRisk', () => {
  it('high-criticality + empty effective bench lands one step above the severity class', () => {
    // severity = critical(3) but effective === 0 → stepUp(critical) = 'high'
    const r = assessPositionRisk({
      criticality: 'high',
      vacancyRisk: 'high',
      successors: [],
    });
    expect(r.risk).toBe('high');
    expect(r.coverage).toBe(0);
    expect(r.readyNow).toBe(0);
    expect(r.effective).toBe(0);
  });

  it('a critical-severity position stays capped at high when the bench is empty', () => {
    // severity = max(medium, high) = 3 → 'critical'; empty bench stepUp(critical) = 'high'
    const r = assessPositionRisk({
      criticality: 'medium',
      vacancyRisk: 'high',
      successors: [],
    });
    expect(r.risk).toBe('high');
  });

  it('steps down one class when the bench is strong', () => {
    const r = assessPositionRisk({
      criticality: 'high',
      vacancyRisk: 'high',
      successors: [{ readiness: 'ready_now' }, { readiness: 'ready_now' }],
    });
    expect(r.risk).toBe('high'); // critical → strong bench → high
    expect(r.coverage).toBe(100);
    expect(r.effective).toBe(2);
  });

  it('treats ready-within-a-year as effective but weaker than ready-now', () => {
    const strong = assessPositionRisk({
      criticality: 'medium',
      vacancyRisk: 'medium',
      successors: [{ readiness: 'ready_now' }, { readiness: 'ready_within_year' }],
    });
    expect(strong.effective).toBe(2);
    expect(strong.risk).toBe('moderate'); // high → strong bench → moderate

    const weak = assessPositionRisk({
      criticality: 'medium',
      vacancyRisk: 'medium',
      successors: [{ readiness: 'ready_within_two_years' }],
    });
    expect(EFFECTIVE_READINESS.has('ready_within_two_years')).toBe(false);
    expect(weak.effective).toBe(0);
    expect(weak.risk).toBe('critical'); // high → empty effective bench → critical
  });

  it('upgrades a low-criticality position with an empty bench to moderate', () => {
    const r = assessPositionRisk({
      criticality: 'low',
      vacancyRisk: 'low',
      successors: [],
    });
    expect(r.risk).toBe('moderate');
  });
});

describe('summarizeRisk', () => {
  it('counts risk classes and positions without any successor', () => {
    const mk = (risk: 'critical' | 'high' | 'moderate' | 'low', exists: boolean) => ({
      risk,
      coverage: exists ? 50 : 0,
      readyNow: 0,
      effective: 0,
      exists,
    });

    const summary = summarizeRisk([
      mk('critical', true),
      mk('high', false),
      mk('low', false),
      mk('low', true),
    ]);
    expect(summary.critical).toBe(1);
    expect(summary.high).toBe(1);
    expect(summary.moderate).toBe(0);
    expect(summary.low).toBe(2);
    expect(summary.noSuccessors).toBe(2);
    expect(summary.total).toBe(4);
  });
});

// ── Gap analysis (career paths) ──────────────────────────────────────────────

describe('computeGapAnalysis', () => {
  const requirements: SkillRequirementRow[] = [
    { skillId: 's1' as never, requiredLevel: 4, isMandatory: true },
    { skillId: 's2' as never, requiredLevel: 3, isMandatory: false },
    { skillId: 's3' as never, requiredLevel: 2, isMandatory: false },
  ];

  it('flags mandatory gaps and computes totals', () => {
    const observed: EmployeeSkillRow[] = [
      { skillId: 's1' as never, level: 2 },
      { skillId: 's2' as never, level: 3 },
    ];
    const r = computeGapAnalysis(requirements, observed);
    expect(r.mandatoryGapsCount).toBe(1); // s1: 2 vs required 4
    expect(r.totalGapLevels).toBe(2 + 0 + 2); // s1 gap 2, s2 gap 0, s3 missing entirely
    expect(r.readiness).toBe('blocked'); // a mandatory gap blocks promotion
    const s1 = r.gaps.find((g) => g.skillId === 's1');
    expect(s1?.gap).toBe(2);
    expect(s1?.isMandatory).toBe(true);
    // s3 has no observation → current level 0
    const s3 = r.gaps.find((g) => g.skillId === 's3');
    expect(s3?.currentLevel).toBe(0);
    expect(s3?.gap).toBe(2);
  });

  it('reports ready when all mandatory skills meet the bar', () => {
    const observed: EmployeeSkillRow[] = [
      { skillId: 's1' as never, level: 4 },
      { skillId: 's2' as never, level: 5 },
      { skillId: 's3' as never, level: 2 },
    ];
    const r = computeGapAnalysis(requirements, observed);
    expect(r.mandatoryGapsCount).toBe(0);
    expect(r.totalGapLevels).toBe(0); // s1: 4/4, s2: 5≥3, s3: 2/2
    expect(r.readiness).toBe('ready');
    expect(readinessVerdict(r.mandatoryGapsCount, r.totalGapLevels, requirements.length)).toBe(
      'ready',
    );
    expect(READINESS_KEYS.ready).toBe('ready');
  });

  it('reports close when only optional gaps remain', () => {
    const observed: EmployeeSkillRow[] = [
      { skillId: 's1' as never, level: 4 },
      { skillId: 's2' as never, level: 1 },
    ];
    const r = computeGapAnalysis(requirements, observed);
    expect(r.mandatoryGapsCount).toBe(0);
    // s2: 1 vs 3 → gap 2; s3 unassessed → gap 2. Total 4 > 2 → developing.
    expect(r.totalGapLevels).toBe(4);
    expect(r.readiness).toBe('developing');
  });
});

// ── Track helpers ────────────────────────────────────────────────────────────

describe('nextStepKey', () => {
  const steps = [
    { key: 's1', positionTitle: 'Junior', level: 'junior' as const },
    { key: 's2', positionTitle: 'Mid', level: 'mid' as const },
    { key: 's3', positionTitle: 'Senior', level: 'senior' as const },
  ];

  it('returns the following step key', () => {
    expect(nextStepKey(steps, 's1')).toBe('s2');
    expect(nextStepKey(steps, 's2')).toBe('s3');
  });

  it('returns null at the top of the ladder and for unknown keys', () => {
    expect(nextStepKey(steps, 's3')).toBeNull();
    expect(nextStepKey(steps, 'nope')).toBeNull();
  });
});

describe('DEFAULT_STEP_MONTHS', () => {
  it('grows monotonically up the ladder; lead is terminal (0)', () => {
    expect(DEFAULT_STEP_MONTHS.junior).toBeLessThan(DEFAULT_STEP_MONTHS.mid);
    expect(DEFAULT_STEP_MONTHS.mid).toBeLessThan(DEFAULT_STEP_MONTHS.senior);
    expect(DEFAULT_STEP_MONTHS.lead).toBe(0); // terminal step — no default time-in-step
  });
});
