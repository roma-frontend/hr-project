/**
 * Career development API (ROADMAP 3.8) — table `careerPaths`.
 *
 * NOTE: the *public* job-board module lives in `convex/careers.ts` (`api.careers`);
 * this module is the internal career-pathing toolkit and must keep its own
 * `careerPaths` API name to avoid colliding with it.
 *
 * Structure: skills → per-position requirements (the matrix) → employee skill
 * levels → tracks (position ladders) → gap analysis vs a target position →
 * mentorships.
 *
 * `recomputeGapAnalysis` is a mutation (it writes the cached snapshot) that
 * reads like a query: it recomputes from live rows and never trusts the stored
 * gaps. Recommended courses come from the learning catalog by matching course
 * category to the skill name (best-effort, string-normalized).
 */

import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { getAuthCaller } from './lib/getAuthCaller';
import { isSuperadmin } from './lib/auth';
import { assertModuleAccess } from './lib/entitlements';
import { DEFAULT_LIST_CAP, SMALL_LIST_CAP } from './lib/limits';
import {
  computeGapAnalysis,
  nextStepKey,
  READINESS_KEYS,
  type RequiredLevel,
  type SkillLevel,
} from './lib/careers';

type OrgId = Id<'organizations'>;

async function checkAccess(ctx: Parameters<typeof getAuthCaller>[0], organizationId: OrgId) {
  const caller = await getAuthCaller(ctx);
  if (!caller) throw new Error('Not authenticated');
  const requester = await ctx.db.get(caller._id);
  if (!requester) throw new Error('Requester not found');
  const admin = isSuperadmin(requester) || requester.role === 'admin';
  if (!admin && requester.organizationId !== organizationId) {
    throw new Error('Access denied');
  }
  return { requester, requesterId: caller._id, admin };
}

async function requireAdmin(ctx: Parameters<typeof getAuthCaller>[0], organizationId: OrgId) {
  const access = await checkAccess(ctx, organizationId);
  if (!access.admin) throw new Error('Only admins can manage career development');
  return access;
}

// ══════════════════════════════════════════════════════════════════════════════
// SKILLS + MATRIX
// ══════════════════════════════════════════════════════════════════════════════

export const listSkills = query({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    await checkAccess(ctx, args.organizationId);
    return ctx.db
      .query('skills')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(DEFAULT_LIST_CAP);
  },
});

export const upsertSkill = mutation({
  args: {
    organizationId: v.id('organizations'),
    skillId: v.optional(v.id('skills')),
    name: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    const { requesterId } = await requireAdmin(ctx, args.organizationId);
    const now = Date.now();

    if (args.skillId) {
      const existing = await ctx.db.get(args.skillId);
      if (!existing || existing.organizationId !== args.organizationId) {
        throw new Error('Skill not found');
      }
      await ctx.db.patch(args.skillId, {
        name: args.name,
        category: args.category,
        description: args.description,
        updatedAt: now,
      });
      return args.skillId;
    }

    // One skill per name per org keeps the matrix unique by name.
    const dup = await ctx.db
      .query('skills')
      .withIndex('by_org_name', (q) =>
        q.eq('organizationId', args.organizationId).eq('name', args.name),
      )
      .first();
    if (dup) {
      await ctx.db.patch(dup._id, {
        category: args.category,
        description: args.description,
        updatedAt: now,
      });
      return dup._id;
    }

    return ctx.db.insert('skills', {
      organizationId: args.organizationId,
      name: args.name,
      category: args.category,
      description: args.description,
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteSkill = mutation({
  args: { organizationId: v.id('organizations'), skillId: v.id('skills') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    await requireAdmin(ctx, args.organizationId);
    const skill = await ctx.db.get(args.skillId);
    if (!skill || skill.organizationId !== args.organizationId) {
      throw new Error('Skill not found');
    }
    // Cascade the matrix rows that reference this skill.
    const reqs = await ctx.db
      .query('skillRequirements')
      .withIndex('by_skill', (q) => q.eq('skillId', args.skillId))
      .collect();
    for (const r of reqs) await ctx.db.delete(r._id);
    const obs = await ctx.db
      .query('employeeSkills')
      .withIndex('by_skill', (q) => q.eq('skillId', args.skillId))
      .collect();
    for (const o of obs) await ctx.db.delete(o._id);
    await ctx.db.delete(args.skillId);
  },
});

/** The matrix for one position: required skills with their levels. */
export const getPositionMatrix = query({
  args: { organizationId: v.id('organizations'), positionTitle: v.string() },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    await checkAccess(ctx, args.organizationId);

    const requirements = await ctx.db
      .query('skillRequirements')
      .withIndex('by_org_position', (q) =>
        q.eq('organizationId', args.organizationId).eq('positionTitle', args.positionTitle),
      )
      .take(SMALL_LIST_CAP);

    const rows = await Promise.all(
      requirements.map(async (req) => {
        const skill = await ctx.db.get(req.skillId);
        return {
          requirementId: req._id,
          skillId: req.skillId,
          skillName: skill?.name ?? '—',
          category: skill?.category ?? null,
          requiredLevel: req.requiredLevel,
          isMandatory: req.isMandatory,
        };
      }),
    );
    return { positionTitle: args.positionTitle, requirements: rows };
  },
});

export const setSkillRequirement = mutation({
  args: {
    organizationId: v.id('organizations'),
    requirementId: v.optional(v.id('skillRequirements')),
    positionTitle: v.string(),
    skillId: v.id('skills'),
    requiredLevel: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5)),
    isMandatory: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    const { requesterId } = await requireAdmin(ctx, args.organizationId);
    const skill = await ctx.db.get(args.skillId);
    if (!skill || skill.organizationId !== args.organizationId) {
      throw new Error('Skill not found');
    }
    const now = Date.now();

    if (args.requirementId) {
      const existing = await ctx.db.get(args.requirementId);
      if (!existing || existing.organizationId !== args.organizationId) {
        throw new Error('Requirement not found');
      }
      await ctx.db.patch(args.requirementId, {
        requiredLevel: args.requiredLevel,
        isMandatory: args.isMandatory,
        updatedAt: now,
      });
      return args.requirementId;
    }

    // One row per (position, skill): re-adding updates.
    const dup = await ctx.db
      .query('skillRequirements')
      .withIndex('by_org_position', (q) =>
        q.eq('organizationId', args.organizationId).eq('positionTitle', args.positionTitle),
      )
      .filter((q) => q.eq(q.field('skillId'), args.skillId))
      .first();
    if (dup) {
      await ctx.db.patch(dup._id, {
        requiredLevel: args.requiredLevel,
        isMandatory: args.isMandatory,
        updatedAt: now,
      });
      return dup._id;
    }

    return ctx.db.insert('skillRequirements', {
      organizationId: args.organizationId,
      positionTitle: args.positionTitle,
      skillId: args.skillId,
      requiredLevel: args.requiredLevel,
      isMandatory: args.isMandatory,
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteSkillRequirement = mutation({
  args: { organizationId: v.id('organizations'), requirementId: v.id('skillRequirements') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    await requireAdmin(ctx, args.organizationId);
    const req = await ctx.db.get(args.requirementId);
    if (!req || req.organizationId !== args.organizationId) {
      throw new Error('Requirement not found');
    }
    await ctx.db.delete(args.requirementId);
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE SKILL LEVELS
// ══════════════════════════════════════════════════════════════════════════════

/** One employee's assessed levels. Admins read anyone; employees read self. */
export const getEmployeeSkills = query({
  args: {
    organizationId: v.id('organizations'),
    employeeId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    const access = await checkAccess(ctx, args.organizationId);
    const targetId = args.employeeId ?? access.requester._id;
    if (!access.admin && access.requester._id !== targetId) {
      throw new Error('Access denied');
    }

    const rows = await ctx.db
      .query('employeeSkills')
      .withIndex('by_org_employee', (q) =>
        q.eq('organizationId', args.organizationId).eq('employeeId', targetId),
      )
      .take(SMALL_LIST_CAP);

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const skill = await ctx.db.get(row.skillId);
        return {
          skillId: row.skillId,
          skillName: skill?.name ?? '—',
          category: skill?.category ?? null,
          level: row.level,
          assessedAt: row.assessedAt,
          notes: row.notes ?? null,
        };
      }),
    );
    return { employeeId: targetId, skills: enriched };
  },
});

export const setEmployeeSkill = mutation({
  args: {
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
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    const { requesterId } = await requireAdmin(ctx, args.organizationId);
    const now = Date.now();

    const existing = await ctx.db
      .query('employeeSkills')
      .withIndex('by_org_employee', (q) =>
        q.eq('organizationId', args.organizationId).eq('employeeId', args.employeeId),
      )
      .filter((q) => q.eq(q.field('skillId'), args.skillId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        level: args.level,
        assessedBy: requesterId,
        assessedAt: now,
        notes: args.notes,
      });
      return existing._id;
    }

    return ctx.db.insert('employeeSkills', {
      organizationId: args.organizationId,
      employeeId: args.employeeId,
      skillId: args.skillId,
      level: args.level,
      assessedBy: requesterId,
      assessedAt: now,
      notes: args.notes,
    });
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// CAREER TRACKS
// ══════════════════════════════════════════════════════════════════════════════

export const listTracks = query({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    await checkAccess(ctx, args.organizationId);
    const rows = await ctx.db
      .query('careerTracks')
      .withIndex('by_org_archived', (q) =>
        q.eq('organizationId', args.organizationId).eq('isArchived', false),
      )
      .take(DEFAULT_LIST_CAP);
    return rows.map((r) => ({
      trackId: r._id,
      name: r.name,
      description: r.description ?? null,
      department: r.department ?? null,
      steps: r.steps,
    }));
  },
});

export const upsertTrack = mutation({
  args: {
    organizationId: v.id('organizations'),
    trackId: v.optional(v.id('careerTracks')),
    name: v.string(),
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
        minMonthsInStep: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    const { requesterId } = await requireAdmin(ctx, args.organizationId);
    if (args.steps.length === 0) throw new Error('A track needs at least one step');
    if (new Set(args.steps.map((s) => s.key)).size !== args.steps.length) {
      throw new Error('Step keys must be unique within a track');
    }
    const now = Date.now();

    if (args.trackId) {
      const existing = await ctx.db.get(args.trackId);
      if (!existing || existing.organizationId !== args.organizationId) {
        throw new Error('Track not found');
      }
      await ctx.db.patch(args.trackId, {
        name: args.name,
        description: args.description,
        department: args.department,
        steps: args.steps,
        updatedAt: now,
      });
      return args.trackId;
    }

    return ctx.db.insert('careerTracks', {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      department: args.department,
      steps: args.steps,
      isArchived: false,
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const archiveTrack = mutation({
  args: { organizationId: v.id('organizations'), trackId: v.id('careerTracks') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    await requireAdmin(ctx, args.organizationId);
    const track = await ctx.db.get(args.trackId);
    if (!track || track.organizationId !== args.organizationId) {
      throw new Error('Track not found');
    }
    await ctx.db.patch(args.trackId, { isArchived: true, updatedAt: Date.now() });
  },
});

/** An employee's standing on a track (admins: anyone; employees: self). */
export const getMyTrackProgress = query({
  args: {
    organizationId: v.id('organizations'),
    employeeId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    const access = await checkAccess(ctx, args.organizationId);
    const targetId = args.employeeId ?? access.requester._id;
    if (!access.admin && access.requester._id !== targetId) {
      throw new Error('Access denied');
    }

    const rows = await ctx.db
      .query('trackProgress')
      .withIndex('by_org_employee', (q) =>
        q.eq('organizationId', args.organizationId).eq('employeeId', targetId),
      )
      .take(SMALL_LIST_CAP);

    return Promise.all(
      rows.map(async (row) => {
        const track = await ctx.db.get(row.trackId);
        return {
          progressId: row._id,
          trackId: row.trackId,
          trackName: track?.name ?? '—',
          steps: track?.steps ?? [],
          currentStepKey: row.currentStepKey,
          targetStepKey: row.targetStepKey,
          status: row.status,
          eligibleAt: row.eligibleAt ?? null,
          notes: row.notes ?? null,
        };
      }),
    );
  },
});

export const upsertTrackProgress = mutation({
  args: {
    organizationId: v.id('organizations'),
    progressId: v.optional(v.id('trackProgress')),
    employeeId: v.id('users'),
    trackId: v.id('careerTracks'),
    currentStepKey: v.string(),
    targetStepKey: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    const { requesterId } = await requireAdmin(ctx, args.organizationId);
    const track = await ctx.db.get(args.trackId);
    if (!track || track.organizationId !== args.organizationId) {
      throw new Error('Track not found');
    }
    if (!track.steps.some((s) => s.key === args.currentStepKey)) {
      throw new Error('currentStepKey is not a step of this track');
    }
    const target =
      args.targetStepKey ?? nextStepKey(track.steps, args.currentStepKey) ?? args.currentStepKey;
    if (!track.steps.some((s) => s.key === target)) {
      throw new Error('targetStepKey is not a step of this track');
    }
    const now = Date.now();

    if (args.progressId) {
      const existing = await ctx.db.get(args.progressId);
      if (!existing || existing.organizationId !== args.organizationId) {
        throw new Error('Track progress not found');
      }
      await ctx.db.patch(args.progressId, {
        currentStepKey: args.currentStepKey,
        targetStepKey: target,
        notes: args.notes,
        updatedAt: now,
      });
      return args.progressId;
    }

    const dup = await ctx.db
      .query('trackProgress')
      .withIndex('by_org_employee', (q) =>
        q.eq('organizationId', args.organizationId).eq('employeeId', args.employeeId),
      )
      .filter((q) => q.eq(q.field('trackId'), args.trackId))
      .first();
    if (dup) {
      await ctx.db.patch(dup._id, {
        currentStepKey: args.currentStepKey,
        targetStepKey: target,
        notes: args.notes,
        updatedAt: now,
      });
      return dup._id;
    }

    return ctx.db.insert('trackProgress', {
      organizationId: args.organizationId,
      employeeId: args.employeeId,
      trackId: args.trackId,
      currentStepKey: args.currentStepKey,
      targetStepKey: target,
      status: 'on_track',
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// GAP ANALYSIS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Recompute and cache the gap for one employee vs one position.
 * Admin-only write; employees may recompute their own gap against any position.
 */
export const recomputeGapAnalysis = mutation({
  args: {
    organizationId: v.id('organizations'),
    employeeId: v.id('users'),
    positionTitle: v.string(),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    const access = await checkAccess(ctx, args.organizationId);
    if (!access.admin && access.requester._id !== args.employeeId) {
      throw new Error('Access denied');
    }

    const requirements = await ctx.db
      .query('skillRequirements')
      .withIndex('by_org_position', (q) =>
        q.eq('organizationId', args.organizationId).eq('positionTitle', args.positionTitle),
      )
      .take(SMALL_LIST_CAP);
    const observed = await ctx.db
      .query('employeeSkills')
      .withIndex('by_org_employee', (q) =>
        q.eq('organizationId', args.organizationId).eq('employeeId', args.employeeId),
      )
      .take(SMALL_LIST_CAP);

    const result = computeGapAnalysis(
      requirements.map((r) => ({
        skillId: r.skillId,
        requiredLevel: r.requiredLevel as RequiredLevel,
        isMandatory: r.isMandatory,
      })),
      observed.map((o) => ({ skillId: o.skillId, level: o.level as SkillLevel })),
    );

    // Best-effort LMS recommendations: match course category to a gapped skill.
    const gapSkillIds = new Set<string>(
      result.gaps.filter((g) => g.gap > 0).map((g) => String(g.skillId)),
    );
    const gapSkillNames = new Set<string>();
    for (const skillId of gapSkillIds) {
      const skill = await ctx.db.get(skillId as Id<'skills'>);
      if (skill && 'name' in skill) gapSkillNames.add(skill.name.toLowerCase());
    }
    const recommendedCourseIds: Id<'courses'>[] = [];
    if (gapSkillNames.size > 0) {
      const courses = await ctx.db
        .query('courses')
        .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
        .take(DEFAULT_LIST_CAP);
      for (const course of courses) {
        const cat = (course.category ?? '').toLowerCase();
        if (gapSkillNames.has(cat) && !recommendedCourseIds.includes(course._id)) {
          recommendedCourseIds.push(course._id);
        }
      }
    }

    const now = Date.now();
    const existing = await ctx.db
      .query('gapAnalyses')
      .withIndex('by_org_employee', (q) =>
        q.eq('organizationId', args.organizationId).eq('employeeId', args.employeeId),
      )
      .filter((q) => q.eq(q.field('positionTitle'), args.positionTitle))
      .first();

    const payload = {
      gaps: JSON.stringify(result.gaps),
      mandatoryGapsCount: result.mandatoryGapsCount,
      totalGapLevels: result.totalGapLevels,
      recommendedCourseIds,
      computedAt: now,
      computedBy: access.requesterId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { ...result, gapAnalysisId: existing._id, recommendedCourseIds };
    }
    const gapAnalysisId = await ctx.db.insert('gapAnalyses', {
      organizationId: args.organizationId,
      employeeId: args.employeeId,
      positionTitle: args.positionTitle,
      ...payload,
    });
    return { ...result, gapAnalysisId, recommendedCourseIds };
  },
});

/** Read the live gap for one employee+position — always computed fresh. */
export const getGapAnalysis = query({
  args: {
    organizationId: v.id('organizations'),
    employeeId: v.optional(v.id('users')),
    positionTitle: v.string(),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    const access = await checkAccess(ctx, args.organizationId);
    const targetId = args.employeeId ?? access.requester._id;
    if (!access.admin && access.requester._id !== targetId) {
      throw new Error('Access denied');
    }

    const requirements = await ctx.db
      .query('skillRequirements')
      .withIndex('by_org_position', (q) =>
        q.eq('organizationId', args.organizationId).eq('positionTitle', args.positionTitle),
      )
      .take(SMALL_LIST_CAP);
    const observed = await ctx.db
      .query('employeeSkills')
      .withIndex('by_org_employee', (q) =>
        q.eq('organizationId', args.organizationId).eq('employeeId', targetId),
      )
      .take(SMALL_LIST_CAP);

    const result = computeGapAnalysis(
      requirements.map((r) => ({
        skillId: r.skillId,
        requiredLevel: r.requiredLevel as RequiredLevel,
        isMandatory: r.isMandatory,
      })),
      observed.map((o) => ({ skillId: o.skillId, level: o.level as SkillLevel })),
    );

    const requirementRows = await Promise.all(
      requirements.map(async (r) => {
        const skill = await ctx.db.get(r.skillId);
        return { skillId: String(r.skillId), skillName: skill?.name ?? '—' };
      }),
    );
    const nameBySkill = new Map(requirementRows.map((r) => [r.skillId, r.skillName]));

    return {
      employeeId: targetId,
      positionTitle: args.positionTitle,
      readiness: result.readiness,
      readinessKey: READINESS_KEYS[result.readiness],
      mandatoryGapsCount: result.mandatoryGapsCount,
      totalGapLevels: result.totalGapLevels,
      gaps: result.gaps.map((g) => ({
        ...g,
        skillName: nameBySkill.get(String(g.skillId)) ?? '—',
      })),
    };
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// MENTORSHIPS
// ══════════════════════════════════════════════════════════════════════════════

export const listMentorships = query({
  args: {
    organizationId: v.id('organizations'),
    status: v.optional(
      v.union(v.literal('active'), v.literal('completed'), v.literal('cancelled')),
    ),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    await checkAccess(ctx, args.organizationId);

    const rows = await ctx.db
      .query('mentorships')
      .withIndex('by_org_status', (q) => q.eq('organizationId', args.organizationId))
      .take(SMALL_LIST_CAP);

    const filtered = args.status ? rows.filter((r) => r.status === args.status) : rows;

    return Promise.all(
      filtered.map(async (row) => {
        const mentor = await ctx.db.get(row.mentorId);
        const mentee = await ctx.db.get(row.menteeId);
        return {
          mentorshipId: row._id,
          mentor: { id: row.mentorId, name: mentor?.name ?? '—' },
          mentee: { id: row.menteeId, name: mentee?.name ?? '—' },
          focus: row.focus ?? null,
          trackId: row.trackId ?? null,
          status: row.status,
          startedAt: row.startedAt,
          endedAt: row.endedAt ?? null,
        };
      }),
    );
  },
});

export const upsertMentorship = mutation({
  args: {
    organizationId: v.id('organizations'),
    mentorshipId: v.optional(v.id('mentorships')),
    mentorId: v.id('users'),
    menteeId: v.id('users'),
    focus: v.optional(v.string()),
    trackId: v.optional(v.id('careerTracks')),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    const { requesterId } = await requireAdmin(ctx, args.organizationId);
    if (args.mentorId === args.menteeId) {
      throw new Error('A mentor cannot mentor themselves');
    }
    const now = Date.now();

    if (args.mentorshipId) {
      const existing = await ctx.db.get(args.mentorshipId);
      if (!existing || existing.organizationId !== args.organizationId) {
        throw new Error('Mentorship not found');
      }
      await ctx.db.patch(args.mentorshipId, {
        mentorId: args.mentorId,
        menteeId: args.menteeId,
        focus: args.focus,
        trackId: args.trackId,
        updatedAt: now,
      });
      return args.mentorshipId;
    }

    return ctx.db.insert('mentorships', {
      organizationId: args.organizationId,
      mentorId: args.mentorId,
      menteeId: args.menteeId,
      focus: args.focus,
      trackId: args.trackId,
      status: 'active',
      startedAt: now,
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const endMentorship = mutation({
  args: {
    organizationId: v.id('organizations'),
    mentorshipId: v.id('mentorships'),
    status: v.union(v.literal('completed'), v.literal('cancelled')),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'careerPaths');
    await requireAdmin(ctx, args.organizationId);
    const row = await ctx.db.get(args.mentorshipId);
    if (!row || row.organizationId !== args.organizationId) {
      throw new Error('Mentorship not found');
    }
    const now = Date.now();
    await ctx.db.patch(args.mentorshipId, {
      status: args.status,
      endedAt: now,
      updatedAt: now,
    });
  },
});
