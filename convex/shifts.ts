/**
 * Shift scheduling backend — rosters, templates and swap requests.
 *
 * Authorization model:
 * - Supervisors+ manage the roster for their whole org (`requireOrgSupervisor`),
 *   mirroring leaves/attendance administration.
 * - Employees/drivers read only their own published shifts.
 * - Swap requests flow employee → colleague → supervisor; the actual shift
 *   swap happens in one transaction when the supervisor approves.
 *
 * Entitlements: every mutation gates on `assertModuleAccess(ctx, 'shiftScheduling')`
 * so plans without the module cannot write shifts even via a crafted client.
 */

import { v } from 'convex/values';
import { getAuthCaller } from './lib/getAuthCaller';
import { requireOrgSupervisor, requireUser } from './lib/rbac';
import { assertModuleAccess } from './lib/entitlements';
import { notify } from './lib/notify';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { DEFAULT_LIST_CAP } from './lib/limits';

const MINUTE_MS = 60_000;

/** Validate `HH:MM` and convert to minutes from midnight. */
function hhmmToMinutes(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error('Time must be in HH:MM format');
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error('Time must be in HH:MM format');
  return h * 60 + min;
}

export function minutesToHHMM(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Span of a shift in minutes, wrapping past midnight when end < start. */
export function shiftSpanMinutes(startMinute: number, endMinute: number): number {
  const raw = endMinute - startMinute;
  return raw > 0 ? raw : raw + 1440;
}

// ── Templates ────────────────────────────────────────────────────────────────

export const listTemplates = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireUser(ctx, caller._id);
    if (!caller.organizationId) return [];
    return await ctx.db
      .query('shiftTemplates')
      .withIndex('by_org', (q) => q.eq('organizationId', caller.organizationId!))
      .take(DEFAULT_LIST_CAP);
  },
});

export const createTemplate = mutation({
  args: {
    name: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    breakMinutes: v.optional(v.number()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'shiftScheduling');
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireOrgSupervisor(ctx, caller._id, caller.organizationId!);
    if (!caller.organizationId) throw new Error('No organization');

    const now = Date.now();
    const templateId = await ctx.db.insert('shiftTemplates', {
      organizationId: caller.organizationId,
      name: args.name.trim(),
      startMinute: hhmmToMinutes(args.startTime),
      endMinute: hhmmToMinutes(args.endTime),
      breakMinutes: args.breakMinutes,
      color: args.color,
      icon: args.icon,
      createdBy: caller._id,
      createdAt: now,
      updatedAt: now,
    });
    return templateId;
  },
});

export const deleteTemplate = mutation({
  args: { templateId: v.id('shiftTemplates') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'shiftScheduling');
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireOrgSupervisor(ctx, caller._id, caller.organizationId!);

    const template = await ctx.db.get(args.templateId);
    if (!template || template.organizationId !== caller.organizationId) {
      throw new Error('Template not found');
    }
    // Shifts keep their snapshot start/end; only the link is cleared.
    const linked = await ctx.db
      .query('shifts')
      .withIndex('by_template', (q) => q.eq('templateId', args.templateId))
      .take(DEFAULT_LIST_CAP);
    for (const shift of linked) {
      await ctx.db.patch(shift._id, { templateId: undefined, updatedAt: Date.now() });
    }
    await ctx.db.delete(args.templateId);
    return { success: true };
  },
});

// ── Roster read ──────────────────────────────────────────────────────────────

/**
 * Roster for a date range. Supervisors+ see the whole org (drafts included);
 * employees see only their own published shifts. Rows carry the user names so
 * the grid renders without N client round-trips.
 */
export const getRoster = query({
  args: {
    /** Inclusive `YYYY-MM-DD` range. */
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireUser(ctx, caller._id);
    const orgId = caller.organizationId;
    if (!orgId) return { shifts: [], canManage: false };

    const isManager = caller.role === 'admin' || caller.role === 'supervisor';
    const isSuperadmin = caller.role === 'superadmin';

    // Day-indexed scan between the bounds; per-day index keeps it cheap.
    const all = await ctx.db
      .query('shifts')
      .withIndex('by_org', (q) => q.eq('organizationId', orgId))
      .take(DEFAULT_LIST_CAP);
    const inRange = all.filter((s) => s.date >= args.from && s.date <= args.to);
    const visible = inRange.filter((s) => {
      if (isManager || isSuperadmin) return true;
      return s.userId === caller._id && s.status === 'published';
    });

    const users = new Map<Id<'users'>, { name: string; position?: string }>();
    for (const s of visible) {
      if (!users.has(s.userId)) {
        const u = await ctx.db.get(s.userId);
        users.set(s.userId, { name: u?.name ?? '—', position: u?.position });
      }
    }

    return {
      canManage: isManager || isSuperadmin,
      shifts: visible.map((s) => ({
        ...s,
        userName: users.get(s.userId)?.name ?? '—',
        userPosition: users.get(s.userId)?.position,
        spanMinutes: shiftSpanMinutes(s.startMinute, s.endMinute),
      })),
    };
  },
});

// ── Shift writes ─────────────────────────────────────────────────────────────

export const upsertShift = mutation({
  args: {
    shiftId: v.optional(v.id('shifts')),
    userId: v.id('users'),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    breakMinutes: v.optional(v.number()),
    note: v.optional(v.string()),
    templateId: v.optional(v.id('shiftTemplates')),
    status: v.optional(v.union(v.literal('draft'), v.literal('published'))),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'shiftScheduling');
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireOrgSupervisor(ctx, caller._id, caller.organizationId!);
    if (!caller.organizationId) throw new Error('No organization');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new Error('Date must be YYYY-MM-DD');
    }

    const now = Date.now();
    const patch = {
      organizationId: caller.organizationId,
      userId: args.userId,
      date: args.date,
      startMinute: hhmmToMinutes(args.startTime),
      endMinute: hhmmToMinutes(args.endTime),
      breakMinutes: args.breakMinutes,
      note: args.note,
      templateId: args.templateId,
      status: args.status ?? ('published' as const),
      updatedBy: caller._id,
      updatedAt: now,
    };

    if (args.shiftId) {
      const existing = await ctx.db.get(args.shiftId);
      if (!existing || existing.organizationId !== caller.organizationId) {
        throw new Error('Shift not found');
      }
      await ctx.db.patch(args.shiftId, patch);
      return args.shiftId;
    }

    const shiftId = await ctx.db.insert('shifts', {
      ...patch,
      createdBy: caller._id,
      createdAt: now,
    });

    // Notify the employee when their shift is published to them.
    if (patch.status === 'published' && args.userId !== caller._id) {
      await notify(ctx, {
        organizationId: caller.organizationId,
        userId: args.userId,
        type: 'shift_published',
        titleKey: 'notifications.titles.shiftPublished',
        messageKey: 'notifications.messages.shiftPublished',
        params: { date: args.date, start: args.startTime, end: args.endTime },
        fallbackTitle: '📅 New shift scheduled',
        fallbackMessage: `You are scheduled for ${args.date} ${args.startTime}–${args.endTime}.`,
        relatedId: shiftId,
        route: '/shifts',
      });
    }
    return shiftId;
  },
});

export const deleteShift = mutation({
  args: { shiftId: v.id('shifts') },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'shiftScheduling');
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireOrgSupervisor(ctx, caller._id, caller.organizationId!);
    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.organizationId !== caller.organizationId) {
      throw new Error('Shift not found');
    }
    await ctx.db.patch(args.shiftId, { status: 'cancelled', updatedAt: Date.now() });
    return { success: true };
  },
});

/** Apply a template across a week of dates for one employee. */
export const applyTemplateWeek = mutation({
  args: {
    templateId: v.id('shiftTemplates'),
    userId: v.id('users'),
    /** First day (a Monday is conventional but not required). */
    fromDate: v.string(),
    /** How many days to schedule (7 = the whole week). */
    days: v.number(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'shiftScheduling');
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireOrgSupervisor(ctx, caller._id, caller.organizationId!);
    if (!caller.organizationId) throw new Error('No organization');

    const template = await ctx.db.get(args.templateId);
    if (!template || template.organizationId !== caller.organizationId) {
      throw new Error('Template not found');
    }

    const start = args.startTime ? hhmmToMinutes(args.startTime) : template.startMinute;
    const end = args.endTime ? hhmmToMinutes(args.endTime) : template.endMinute;
    const base = new Date(`${args.fromDate}T00:00:00Z`).getTime();
    if (Number.isNaN(base)) throw new Error('Date must be YYYY-MM-DD');

    const now = Date.now();
    const created: Id<'shifts'>[] = [];
    for (let i = 0; i < args.days; i += 1) {
      const date = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
      const shiftId = await ctx.db.insert('shifts', {
        organizationId: caller.organizationId,
        userId: args.userId,
        date,
        templateId: args.templateId,
        startMinute: start,
        endMinute: end,
        breakMinutes: template.breakMinutes,
        status: args.publish === false ? 'draft' : 'published',
        createdBy: caller._id,
        updatedBy: caller._id,
        createdAt: now,
        updatedAt: now,
      });
      created.push(shiftId);
    }

    if (args.publish !== false && args.userId !== caller._id) {
      await notify(ctx, {
        organizationId: caller.organizationId,
        userId: args.userId,
        type: 'shift_published',
        titleKey: 'notifications.titles.shiftPublished',
        messageKey: 'notifications.messages.shiftPublishedWeek',
        params: { count: created.length, start: args.fromDate },
        fallbackTitle: '📅 New shifts scheduled',
        fallbackMessage: `${created.length} shifts were scheduled starting ${args.fromDate}.`,
        route: '/shifts',
      });
    }
    return { created: created.length };
  },
});

// ── Swap requests ────────────────────────────────────────────────────────────

export const requestSwap = mutation({
  args: {
    fromShiftId: v.id('shifts'),
    toShiftId: v.optional(v.id('shifts')),
    targetUserId: v.optional(v.id('users')),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'shiftScheduling');
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireUser(ctx, caller._id);
    if (!caller.organizationId) throw new Error('No organization');

    const fromShift = await ctx.db.get(args.fromShiftId);
    if (!fromShift || fromShift.organizationId !== caller.organizationId) {
      throw new Error('Shift not found');
    }
    if (fromShift.userId !== caller._id) {
      throw new Error('You can only request a swap for your own shift');
    }

    const now = Date.now();
    const swapId = await ctx.db.insert('shiftSwapRequests', {
      organizationId: caller.organizationId,
      fromShiftId: args.fromShiftId,
      toShiftId: args.toShiftId,
      requesterId: caller._id,
      targetUserId: args.targetUserId,
      status: 'pending',
      comment: args.comment,
      createdAt: now,
      updatedAt: now,
    });

    if (args.targetUserId && args.targetUserId !== caller._id) {
      await notify(ctx, {
        organizationId: caller.organizationId,
        userId: args.targetUserId,
        type: 'shift_swap_requested',
        titleKey: 'notifications.titles.shiftSwapRequested',
        messageKey: 'notifications.messages.shiftSwapRequested',
        params: { date: fromShift.date },
        fallbackTitle: '🔄 Shift swap request',
        fallbackMessage: `A colleague asked you to take their shift on ${fromShift.date}.`,
        relatedId: swapId,
        route: '/shifts',
      });
    }
    return swapId;
  },
});

/** The asked colleague accepts or declines. */
export const respondSwap = mutation({
  args: {
    swapId: v.id('shiftSwapRequests'),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'shiftScheduling');
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireUser(ctx, caller._id);

    const swap = await ctx.db.get(args.swapId);
    if (!swap || swap.organizationId !== caller.organizationId) {
      throw new Error('Swap request not found');
    }
    if (swap.targetUserId !== caller._id) {
      throw new Error('Only the requested colleague can respond');
    }
    if (swap.status !== 'pending') {
      throw new Error('Swap request is no longer pending');
    }

    const now = Date.now();
    await ctx.db.patch(args.swapId, {
      status: args.accept ? 'accepted' : 'rejected',
      acceptedBy: args.accept ? caller._id : undefined,
      updatedAt: now,
    });

    await notify(ctx, {
      organizationId: swap.organizationId,
      userId: swap.requesterId,
      type: 'shift_swap_accepted',
      titleKey: 'notifications.titles.shiftSwapResponded',
      messageKey: 'notifications.messages.shiftSwapResponded',
      params: { status: args.accept ? 'accepted' : 'declined' },
      fallbackTitle: args.accept ? '🔄 Swap accepted' : '🔄 Swap declined',
      fallbackMessage: args.accept
        ? 'Your colleague accepted the swap — waiting for supervisor approval.'
        : 'Your colleague declined the swap.',
      relatedId: args.swapId,
      route: '/shifts',
    });
    return { success: true };
  },
});

/**
 * Supervisor approval — performs the actual swap in one transaction:
 * the requested shift is reassigned to the colleague (and vice versa for
 * two-way swaps), swap requests are closed.
 */
export const decideSwap = mutation({
  args: {
    swapId: v.id('shiftSwapRequests'),
    approve: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'shiftScheduling');
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireOrgSupervisor(ctx, caller._id, caller.organizationId!);

    const swap = await ctx.db.get(args.swapId);
    if (!swap || swap.organizationId !== caller.organizationId) {
      throw new Error('Swap request not found');
    }
    if (swap.status !== 'accepted') {
      throw new Error('Swap must be accepted by the colleague first');
    }

    const now = Date.now();
    if (!args.approve) {
      await ctx.db.patch(args.swapId, {
        status: 'rejected',
        decidedBy: caller._id,
        decidedAt: now,
        updatedAt: now,
      });
    } else {
      const fromShift = await ctx.db.get(swap.fromShiftId);
      if (!fromShift) throw new Error('Original shift no longer exists');
      const target = swap.targetUserId ?? swap.acceptedBy;
      if (!target) throw new Error('No colleague on this swap');

      // Two-way: the colleague's own shift moves to the requester.
      if (swap.toShiftId) {
        const toShift = await ctx.db.get(swap.toShiftId);
        if (toShift && toShift.organizationId === swap.organizationId) {
          await ctx.db.patch(toShift._id, {
            userId: swap.requesterId,
            updatedBy: caller._id,
            updatedAt: now,
          });
        }
      }
      await ctx.db.patch(swap.fromShiftId, {
        userId: target,
        updatedBy: caller._id,
        updatedAt: now,
      });
      await ctx.db.patch(args.swapId, {
        status: 'approved',
        decidedBy: caller._id,
        decidedAt: now,
        updatedAt: now,
      });
    }

    await notify(ctx, {
      organizationId: swap.organizationId,
      userId: swap.requesterId,
      type: 'shift_swap_decided',
      titleKey: 'notifications.titles.shiftSwapDecided',
      messageKey: 'notifications.messages.shiftSwapDecided',
      params: { decision: args.approve ? 'approved' : 'rejected' },
      fallbackTitle: args.approve ? '✅ Swap approved' : '❌ Swap rejected',
      fallbackMessage: args.approve
        ? 'The shift swap was approved by a supervisor.'
        : 'The shift swap was rejected by a supervisor.',
      relatedId: args.swapId,
      route: '/shifts',
    });
    return { success: true };
  },
});

/** Pending swap queue for supervisors (accepted) and employees (their own). */
export const listSwapRequests = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireUser(ctx, caller._id);
    const orgId = caller.organizationId;
    if (!orgId) return [];

    const all = await ctx.db
      .query('shiftSwapRequests')
      .withIndex('by_org', (q) => q.eq('organizationId', orgId))
      .take(DEFAULT_LIST_CAP);

    const isManager = caller.role === 'admin' || caller.role === 'supervisor';
    const mine = all.filter((s) => {
      if (isManager || caller.role === 'superadmin') return true;
      return s.requesterId === caller._id || s.targetUserId === caller._id;
    });

    const names = new Map<Id<'users'>, string>();
    for (const s of mine) {
      for (const uid of [s.requesterId, s.targetUserId, s.acceptedBy]) {
        if (uid && !names.has(uid)) {
          const u = await ctx.db.get(uid);
          names.set(uid, u?.name ?? '—');
        }
      }
    }

    return mine
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        ...s,
        requesterName: names.get(s.requesterId) ?? '—',
        targetName: s.targetUserId ? (names.get(s.targetUserId) ?? '—') : null,
        acceptedByName: s.acceptedBy ? (names.get(s.acceptedBy) ?? '—') : null,
      }));
  },
});
