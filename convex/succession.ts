/**
 * Succession planning API (ROADMAP 2.7).
 *
 * Read model mirrors the module's two decisions:
 *   - `getNineBox` — the 3×3 grid for a period, with zone lookup per employee;
 *   - `getSuccessionOverview` — every key position with its successor bench,
 *     computed risk, and an org-level summary.
 *
 * Writes are admin/superadmin only (talent reviews are confidential by nature);
 * regular employees get no read path to other people's ratings at all.
 * Plan gating uses `assertModuleAccess(ctx, 'succession')` like every module.
 */

import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { getAuthCaller } from './lib/getAuthCaller';
import { isSuperadmin } from './lib/auth';
import { assertModuleAccess } from './lib/entitlements';
import { DEFAULT_LIST_CAP, SMALL_LIST_CAP } from './lib/limits';
import {
  assessPositionRisk,
  nineBoxCell,
  summarizeRisk,
  type PerformanceScore,
  type PotentialScore,
  type Readiness,
} from './lib/succession';

type OrgId = Id<'organizations'>;

/** Identity + org check; derived from the verified JWT, never from client args. */
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
  if (!access.admin) throw new Error('Only admins can manage succession planning');
  return access;
}

// ══════════════════════════════════════════════════════════════════════════════
// NINE BOX
// ══════════════════════════════════════════════════════════════════════════════

/** Distinct rating periods in the org, newest first (by first-seen order). */
export const listPeriods = query({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    await checkAccess(ctx, args.organizationId);

    const ratings = await ctx.db
      .query('nineBoxRatings')
      .withIndex('by_org_period', (q) => q.eq('organizationId', args.organizationId))
      .take(DEFAULT_LIST_CAP);

    const periods: string[] = [];
    for (const r of ratings) {
      if (!periods.includes(r.period)) periods.push(r.period);
    }
    return periods;
  },
});

/** The 3×3 grid for one period, with each rated employee resolved. */
export const getNineBox = query({
  args: { organizationId: v.id('organizations'), period: v.string() },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    await checkAccess(ctx, args.organizationId);

    const ratings = await ctx.db
      .query('nineBoxRatings')
      .withIndex('by_org_period', (q) =>
        q.eq('organizationId', args.organizationId).eq('period', args.period),
      )
      .take(SMALL_LIST_CAP);

    const cells = await Promise.all(
      ratings.map(async (r) => {
        const employee = await ctx.db.get(r.employeeId);
        const cell = nineBoxCell(r.performance as PerformanceScore, r.potential as PotentialScore);
        return {
          ratingId: r._id,
          employeeId: r.employeeId,
          employeeName: employee?.name ?? '—',
          position: employee?.position ?? null,
          department: employee?.department ?? null,
          performance: r.performance,
          potential: r.potential,
          zone: cell.zone,
          labelKey: cell.labelKey,
          notes: r.notes ?? null,
          ratedBy: r.ratedBy,
          ratedAt: r.updatedAt,
        };
      }),
    );

    return { period: args.period, cells };
  },
});

/** Rate (or re-rate) an employee for a period. Upsert per (employee, period). */
export const upsertNineBoxRating = mutation({
  args: {
    organizationId: v.id('organizations'),
    employeeId: v.id('users'),
    period: v.string(),
    performance: v.union(v.literal(1), v.literal(2), v.literal(3)),
    potential: v.union(v.literal(1), v.literal(2), v.literal(3)),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    const { requesterId } = await requireAdmin(ctx, args.organizationId);

    const existing = await ctx.db
      .query('nineBoxRatings')
      .withIndex('by_org_employee', (q) =>
        q.eq('organizationId', args.organizationId).eq('employeeId', args.employeeId),
      )
      .filter((q) => q.eq(q.field('period'), args.period))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        performance: args.performance,
        potential: args.potential,
        notes: args.notes,
        ratedBy: requesterId,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert('nineBoxRatings', {
      organizationId: args.organizationId,
      employeeId: args.employeeId,
      period: args.period,
      performance: args.performance,
      potential: args.potential,
      notes: args.notes,
      ratedBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteNineBoxRating = mutation({
  args: { organizationId: v.id('organizations'), ratingId: v.id('nineBoxRatings') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    await requireAdmin(ctx, args.organizationId);
    const rating = await ctx.db.get(args.ratingId);
    if (!rating || rating.organizationId !== args.organizationId) {
      throw new Error('Rating not found');
    }
    await ctx.db.delete(args.ratingId);
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// KEY POSITIONS + SUCCESSORS + RISK
// ══════════════════════════════════════════════════════════════════════════════

/** Every active key position with its bench and computed risk, plus a summary. */
export const getSuccessionOverview = query({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    await checkAccess(ctx, args.organizationId);

    const positions = await ctx.db
      .query('keyPositions')
      .withIndex('by_org_archived', (q) =>
        q.eq('organizationId', args.organizationId).eq('isArchived', false),
      )
      .take(SMALL_LIST_CAP);

    const allSuccessors = await ctx.db
      .query('successors')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(SMALL_LIST_CAP);

    const positionRows = await Promise.all(
      positions.map(async (p) => {
        const bench = allSuccessors.filter((s) => s.keyPositionId === p._id);
        const benchRows = await Promise.all(
          bench.map(async (s) => {
            const person = await ctx.db.get(s.successorId);
            return {
              successorId: s._id,
              employeeId: s.successorId,
              employeeName: person?.name ?? '—',
              position: person?.position ?? null,
              readiness: s.readiness as Readiness,
              notes: s.notes ?? null,
            };
          }),
        );
        const risk = assessPositionRisk({
          criticality: p.criticality,
          vacancyRisk: p.vacancyRisk,
          successors: bench.map((s) => ({ readiness: s.readiness as Readiness })),
        });
        const incumbent = p.incumbentId ? await ctx.db.get(p.incumbentId) : null;
        return {
          positionId: p._id,
          positionTitle: p.positionTitle,
          department: p.department ?? null,
          criticality: p.criticality,
          vacancyRisk: p.vacancyRisk,
          incumbent: incumbent ? { id: incumbent._id, name: incumbent.name } : null,
          notes: p.notes ?? null,
          bench: benchRows,
          risk,
        };
      }),
    );

    const summary = summarizeRisk(
      positionRows.map((r) => ({
        ...r.risk,
        exists: r.risk.effective > 0,
      })),
    );

    return { positions: positionRows, summary };
  },
});

export const upsertKeyPosition = mutation({
  args: {
    organizationId: v.id('organizations'),
    positionId: v.optional(v.id('keyPositions')),
    positionTitle: v.string(),
    department: v.optional(v.string()),
    criticality: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
    vacancyRisk: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
    incumbentId: v.optional(v.id('users')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    const { requesterId } = await requireAdmin(ctx, args.organizationId);
    const now = Date.now();

    if (args.positionId) {
      const existing = await ctx.db.get(args.positionId);
      if (!existing || existing.organizationId !== args.organizationId) {
        throw new Error('Key position not found');
      }
      await ctx.db.patch(args.positionId, {
        positionTitle: args.positionTitle,
        department: args.department,
        criticality: args.criticality,
        vacancyRisk: args.vacancyRisk,
        incumbentId: args.incumbentId,
        notes: args.notes,
        updatedAt: now,
      });
      return args.positionId;
    }

    return ctx.db.insert('keyPositions', {
      organizationId: args.organizationId,
      positionTitle: args.positionTitle,
      department: args.department,
      criticality: args.criticality,
      vacancyRisk: args.vacancyRisk,
      incumbentId: args.incumbentId,
      notes: args.notes,
      isArchived: false,
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const archiveKeyPosition = mutation({
  args: { organizationId: v.id('organizations'), positionId: v.id('keyPositions') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    await requireAdmin(ctx, args.organizationId);
    const position = await ctx.db.get(args.positionId);
    if (!position || position.organizationId !== args.organizationId) {
      throw new Error('Key position not found');
    }
    // Cascade: an archived role keeps no active bench.
    const bench = await ctx.db
      .query('successors')
      .withIndex('by_position', (q) => q.eq('keyPositionId', args.positionId))
      .collect();
    for (const s of bench) await ctx.db.delete(s._id);
    await ctx.db.patch(args.positionId, { isArchived: true, updatedAt: Date.now() });
  },
});

export const upsertSuccessor = mutation({
  args: {
    organizationId: v.id('organizations'),
    successorRowId: v.optional(v.id('successors')),
    keyPositionId: v.id('keyPositions'),
    successorId: v.id('users'),
    readiness: v.union(
      v.literal('ready_now'),
      v.literal('ready_within_year'),
      v.literal('ready_within_two_years'),
      v.literal('development_needed'),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    const { requesterId } = await requireAdmin(ctx, args.organizationId);
    const position = await ctx.db.get(args.keyPositionId);
    if (!position || position.organizationId !== args.organizationId) {
      throw new Error('Key position not found');
    }
    if (position.incumbentId === args.successorId) {
      throw new Error('The incumbent cannot be their own successor');
    }
    const now = Date.now();

    if (args.successorRowId) {
      const existing = await ctx.db.get(args.successorRowId);
      if (!existing || existing.organizationId !== args.organizationId) {
        throw new Error('Successor row not found');
      }
      await ctx.db.patch(args.successorRowId, {
        readiness: args.readiness,
        notes: args.notes,
        updatedAt: now,
      });
      return args.successorRowId;
    }

    // One row per (position, person): re-adding updates the existing row.
    const dup = await ctx.db
      .query('successors')
      .withIndex('by_position', (q) => q.eq('keyPositionId', args.keyPositionId))
      .filter((q) => q.eq(q.field('successorId'), args.successorId))
      .first();
    if (dup) {
      await ctx.db.patch(dup._id, {
        readiness: args.readiness,
        notes: args.notes,
        updatedAt: now,
      });
      return dup._id;
    }

    return ctx.db.insert('successors', {
      organizationId: args.organizationId,
      keyPositionId: args.keyPositionId,
      successorId: args.successorId,
      readiness: args.readiness,
      notes: args.notes,
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeSuccessor = mutation({
  args: { organizationId: v.id('organizations'), successorRowId: v.id('successors') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    await requireAdmin(ctx, args.organizationId);
    const row = await ctx.db.get(args.successorRowId);
    if (!row || row.organizationId !== args.organizationId) {
      throw new Error('Successor row not found');
    }
    await ctx.db.delete(args.successorRowId);
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// DEVELOPMENT PLANS
// ══════════════════════════════════════════════════════════════════════════════

export const listDevelopmentPlans = query({
  args: {
    organizationId: v.id('organizations'),
    employeeId: v.optional(v.id('users')),
    status: v.optional(v.union(v.literal('draft'), v.literal('active'), v.literal('completed'))),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    const access = await checkAccess(ctx, args.organizationId);
    // Non-admins may see only their own plan — reviews are confidential.
    if (!access.admin && access.requester._id !== args.employeeId) {
      throw new Error('Access denied');
    }

    const rows = args.employeeId
      ? await ctx.db
          .query('developmentPlans')
          .withIndex('by_org_employee', (q) =>
            q.eq('organizationId', args.organizationId).eq('employeeId', args.employeeId!),
          )
          .take(SMALL_LIST_CAP)
      : await ctx.db
          .query('developmentPlans')
          .withIndex('by_org_status', (q) => q.eq('organizationId', args.organizationId))
          .take(SMALL_LIST_CAP);

    return rows
      .filter((r) => !args.status || r.status === args.status)
      .map((r) => ({
        planId: r._id,
        employeeId: r.employeeId,
        title: r.title,
        description: r.description ?? null,
        courseId: r.courseId ?? null,
        actions: r.actions,
        status: r.status,
        dueDate: r.dueDate ?? null,
      }));
  },
});

export const upsertDevelopmentPlan = mutation({
  args: {
    organizationId: v.id('organizations'),
    planId: v.optional(v.id('developmentPlans')),
    employeeId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    courseId: v.optional(v.id('courses')),
    dueDate: v.optional(v.number()),
    actions: v.optional(
      v.array(
        v.object({
          key: v.string(),
          title: v.string(),
          dueDate: v.optional(v.number()),
          completed: v.boolean(),
          completedAt: v.optional(v.number()),
        }),
      ),
    ),
    status: v.optional(v.union(v.literal('draft'), v.literal('active'), v.literal('completed'))),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    const { requesterId } = await requireAdmin(ctx, args.organizationId);
    const now = Date.now();

    if (args.planId) {
      const existing = await ctx.db.get(args.planId);
      if (!existing || existing.organizationId !== args.organizationId) {
        throw new Error('Development plan not found');
      }
      await ctx.db.patch(args.planId, {
        title: args.title,
        description: args.description,
        courseId: args.courseId,
        dueDate: args.dueDate,
        ...(args.actions ? { actions: args.actions } : {}),
        ...(args.status ? { status: args.status } : {}),
        updatedAt: now,
      });
      return args.planId;
    }

    return ctx.db.insert('developmentPlans', {
      organizationId: args.organizationId,
      employeeId: args.employeeId,
      title: args.title,
      description: args.description,
      courseId: args.courseId,
      actions: args.actions ?? [],
      status: args.status ?? 'draft',
      dueDate: args.dueDate,
      createdBy: requesterId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Toggle one action's completion; completing every action completes the plan. */
export const togglePlanAction = mutation({
  args: {
    organizationId: v.id('organizations'),
    planId: v.id('developmentPlans'),
    actionKey: v.string(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    const access = await checkAccess(ctx, args.organizationId);
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.organizationId !== args.organizationId) {
      throw new Error('Development plan not found');
    }
    // The employee ticks their own steps; admins tick anyone's.
    if (!access.admin && access.requester._id !== plan.employeeId) {
      throw new Error('Access denied');
    }

    const now = Date.now();
    const actions = plan.actions.map((a) =>
      a.key === args.actionKey
        ? { ...a, completed: args.completed, completedAt: args.completed ? now : undefined }
        : a,
    );
    const allDone = actions.length > 0 && actions.every((a) => a.completed);
    await ctx.db.patch(args.planId, {
      actions,
      status: allDone ? 'completed' : plan.status === 'completed' ? 'active' : plan.status,
      updatedAt: now,
    });
  },
});

export const deleteDevelopmentPlan = mutation({
  args: { organizationId: v.id('organizations'), planId: v.id('developmentPlans') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'succession');
    await requireAdmin(ctx, args.organizationId);
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.organizationId !== args.organizationId) {
      throw new Error('Development plan not found');
    }
    await ctx.db.delete(args.planId);
  },
});
