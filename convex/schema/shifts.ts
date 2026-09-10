import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Shift scheduling — visual week/month rosters for shift-based teams
 * (retail, HoReCa, security, production, dispatch).
 *
 * Design notes:
 * - A `shifts` row is one person on one calendar day (template-expanded or
 *   hand-added). `startMinute`/`endMinute` are minutes from local midnight so
 *   night shifts (22:00 → 06:00) store `end < start` without a second field —
 *   the renderer wraps them past 24h.
 * - `shiftTemplates` are reusable patterns (morning/evening/night) applied to
 *   a week at once.
 * - Swap requests keep the flow inside approvals: a colleague agrees, the
 *   supervisor confirms; the swap mutates both shifts in one transaction.
 * - Everything keys off `organizationId` with composite indexes
 *   (`by_org_day`, `by_org_user_day`, `by_template`) so rosters stay fast at
 *   hundreds of shifts per month.
 */
export const shifts = {
  shiftTemplates: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    /** Minutes from midnight. Night shift: 1320 → 360 (22:00 → 06:00). */
    startMinute: v.number(),
    endMinute: v.number(),
    /** Paid break length in minutes (deducted from the span by payroll views). */
    breakMinutes: v.optional(v.number()),
    /** Tailwind-ish accent used by the roster grid; falls back to theme. */
    color: v.optional(v.string()),
    /** lucide icon key rendered next to the name (Sun, Moon, Sunset…). */
    icon: v.optional(v.string()),
    createdBy: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_org', ['organizationId']),

  shifts: defineTable({
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    /** Local calendar date, `YYYY-MM-DD` — matches attendance/leaves keys. */
    date: v.string(),
    templateId: v.optional(v.id('shiftTemplates')),
    startMinute: v.number(),
    endMinute: v.number(),
    breakMinutes: v.optional(v.number()),
    /** Optional free-text note shown on the roster cell (e.g. "register"). */
    note: v.optional(v.string()),
    /** drafts are visible to supervisors only; published to the employee. */
    status: v.union(v.literal('draft'), v.literal('published'), v.literal('cancelled')),
    /** Who last changed the shift — feed for change notifications. */
    updatedBy: v.optional(v.id('users')),
    createdBy: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_date', ['organizationId', 'date'])
    .index('by_org_user_date', ['organizationId', 'userId', 'date'])
    .index('by_user', ['userId'])
    .index('by_template', ['templateId']),

  shiftSwapRequests: defineTable({
    organizationId: v.id('organizations'),
    /** The shift being given away… */
    fromShiftId: v.id('shifts'),
    /** …and the shift taken in return (empty = one-way give). */
    toShiftId: v.optional(v.id('shifts')),
    requesterId: v.id('users'),
    /** The colleague asked to take over. */
    targetUserId: v.optional(v.id('users')),
    /** Who agreed — required before the supervisor sees it. */
    acceptedBy: v.optional(v.id('users')),
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('cancelled'),
    ),
    decidedBy: v.optional(v.id('users')),
    decidedAt: v.optional(v.number()),
    comment: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_requester', ['requesterId'])
    .index('by_target', ['targetUserId']),
};
