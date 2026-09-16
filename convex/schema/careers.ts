import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Career development paths (ROADMAP 3.8).
 *
 * Skill matrices define what each position requires; career tracks chain
 * positions into a Junior → Mid → Senior → Lead ladder; gap analyses compare a
 * person against the next step; mentorships pair people across the ladder.
 * LMS integration is a `courseId` reference — the same soft link succession
 * development plans use.
 */
export const careers = {
  /** A named skill with 1..5 proficiency scale, reusable across positions. */
  skills: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    category: v.optional(v.string()), // e.g. 'technical', 'leadership', 'domain'
    description: v.optional(v.string()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_name', ['organizationId', 'name']),

  /** Required skill levels per position title — the "matrix" half. */
  skillRequirements: defineTable({
    organizationId: v.id('organizations'),
    /** Position title snapshot, matching keyPositions.positionTitle style. */
    positionTitle: v.string(),
    skillId: v.id('skills'),
    /** 1 = awareness … 5 = expert, required level for the position. */
    requiredLevel: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5)),
    /** true → without this skill the promotion is blocked, not just delayed. */
    isMandatory: v.boolean(),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org_position', ['organizationId', 'positionTitle'])
    .index('by_skill', ['skillId']),

  /** Observed proficiency of one employee in one skill. */
  employeeSkills: defineTable({
    organizationId: v.id('organizations'),
    employeeId: v.id('users'),
    skillId: v.id('skills'),
    level: v.union(
      v.literal(0),
      v.literal(1),
      v.literal(2),
      v.literal(3),
      v.literal(4),
      v.literal(5),
    ),
    assessedBy: v.id('users'),
    assessedAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index('by_org_employee', ['organizationId', 'employeeId'])
    .index('by_skill', ['skillId']),

  /** Junior → Mid → Senior → Lead: positions chained with requirements. */
  careerTracks: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(), // e.g. 'Engineering', 'Accounting'
    description: v.optional(v.string()),
    department: v.optional(v.string()),
    steps: v.array(
      v.object({
        key: v.string(),
        positionTitle: v.string(),
        level: v.union(
          v.literal('junior'),
          v.literal('mid'),
          v.literal('senior'),
          v.literal('lead'),
        ),
        /** Typical time in step before promotion review, months. */
        minMonthsInStep: v.optional(v.number()),
      }),
    ),
    isArchived: v.optional(v.boolean()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_archived', ['organizationId', 'isArchived']),

  /** One employee's standing against a track: current step + next target. */
  trackProgress: defineTable({
    organizationId: v.id('organizations'),
    employeeId: v.id('users'),
    trackId: v.id('careerTracks'),
    currentStepKey: v.string(),
    targetStepKey: v.string(),
    status: v.union(v.literal('on_track'), v.literal('at_risk'), v.literal('blocked')),
    /** When the employee becomes eligible for promotion review. */
    eligibleAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org_employee', ['organizationId', 'employeeId'])
    .index('by_track', ['trackId']),

  /**
   * Cached promotion-gap snapshot for one employee vs one target step.
   * Recomputed on demand (recomputeGapAnalysis) — never trusted on read.
   */
  gapAnalyses: defineTable({
    organizationId: v.id('organizations'),
    employeeId: v.id('users'),
    positionTitle: v.string(),
    /** Flattened [{ skillId, requiredLevel, currentLevel, gap, isMandatory }] */
    gaps: v.string(),
    mandatoryGapsCount: v.number(),
    totalGapLevels: v.number(),
    /** Optional LMS courses covering the mandatory gaps. */
    recommendedCourseIds: v.optional(v.array(v.id('courses'))),
    computedAt: v.number(),
    computedBy: v.id('users'),
  })
    .index('by_org_employee', ['organizationId', 'employeeId'])
    .index('by_org_position', ['organizationId', 'positionTitle']),

  /** Pairing an experienced employee with a growing one. */
  mentorships: defineTable({
    organizationId: v.id('organizations'),
    mentorId: v.id('users'),
    menteeId: v.id('users'),
    focus: v.optional(v.string()), // e.g. 'promotion to senior', 'people skills'
    /** Optional track this mentorship serves. */
    trackId: v.optional(v.id('careerTracks')),
    status: v.union(v.literal('active'), v.literal('completed'), v.literal('cancelled')),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_mentor', ['mentorId'])
    .index('by_mentee', ['menteeId']),
};
