/**
 * Public API v1 — the read surface.
 *
 * Every query here is `internal` and takes `organizationId` as an argument. The
 * HTTP layer is the only caller and derives that id from the API key, never from
 * the request. That is the whole tenancy model of this API: if the id ever came
 * from the client, one key would read every customer's employees.
 *
 * Every row is projected into an explicit DTO. Returning the raw document would
 * ship `passwordHash`, `sessionToken`, `totpSecret`, `backupCodes`,
 * `resetPasswordToken` and `faceDescriptor` to whoever holds a read key — the
 * single worst mistake available in this file.
 */

import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import type { Doc } from './_generated/dataModel';

/** Page size ceiling — a key cannot ask for the whole tenant in one call. */
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(Math.floor(limit), MAX_LIMIT));
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

interface EmployeeDto {
  id: string;
  email: string;
  name: string;
  role: Doc<'users'>['role'];
  employeeType: Doc<'users'>['employeeType'];
  departmentId: string | null;
  department: string | null;
  positionId: string | null;
  position: string | null;
  supervisorId: string | null;
  phone: string | null;
  location: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isApproved: boolean;
  language: string | null;
  leaveBalances: {
    paid: number;
    sick: number;
    family: number;
    dayOff: number | null;
    maternity: number | null;
    study: number | null;
  };
  createdAt: number;
}

// Exported for tests: the projection is the single most dangerous function in
// this file (see the header), so it is asserted directly rather than only
// through an HTTP round-trip.
export function toEmployeeDto(user: Doc<'users'>): EmployeeDto {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    employeeType: user.employeeType,
    departmentId: user.departmentId ?? null,
    department: user.department ?? null,
    positionId: user.positionId ?? null,
    position: user.position ?? null,
    supervisorId: user.supervisorId ?? null,
    phone: user.phone ?? null,
    location: user.location ?? null,
    avatarUrl: user.avatarUrl ?? null,
    isActive: user.isActive,
    isApproved: user.isApproved,
    language: user.language ?? null,
    leaveBalances: {
      paid: user.paidLeaveBalance,
      sick: user.sickLeaveBalance,
      family: user.familyLeaveBalance,
      dayOff: user.dayOffBalance ?? null,
      maternity: user.maternityLeaveBalance ?? null,
      study: user.studyLeaveBalance ?? null,
    },
    createdAt: user.createdAt,
  };
}

// ── Employees ────────────────────────────────────────────────────────────────

export const listEmployees = internalQuery({
  args: {
    organizationId: v.id('organizations'),
    limit: v.optional(v.number()),
    /** Only active employees — the common case for an integration. */
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<EmployeeDto[]> => {
    const take = clampLimit(args.limit);
    // take() one extra than requested would be needed for a real cursor; this
    // endpoint is offset-free by design, so the caller pages by raising `limit`
    // or filters. A cursor is the next iteration.
    const rows = await ctx.db
      .query('users')
      .withIndex('by_org_created', (q) => q.eq('organizationId', args.organizationId))
      .take(Math.min(take + 20, MAX_LIMIT + 20));

    return (
      rows
        // The platform operator is not an employee of the tenant and must never
        // appear in a customer's roster — the same rule every in-app list follows.
        .filter((u) => u.role !== 'superadmin')
        .filter((u) => (args.activeOnly ? u.isActive : true))
        .slice(0, take)
        .map(toEmployeeDto)
    );
  },
});

export const getEmployee = internalQuery({
  args: {
    organizationId: v.id('organizations'),
    employeeId: v.id('users'),
  },
  handler: async (ctx, args): Promise<EmployeeDto | null> => {
    const user = await ctx.db.get(args.employeeId);
    // Cross-tenant read is "not found", not "forbidden": the existence of an
    // id in another organization is itself information.
    if (!user || user.organizationId !== args.organizationId) return null;
    if (user.role === 'superadmin') return null;
    return toEmployeeDto(user);
  },
});

export const countEmployees = internalQuery({
  args: {
    organizationId: v.id('organizations'),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<number> => {
    const rows = await ctx.db
      .query('users')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .collect();
    return rows
      .filter((u) => u.role !== 'superadmin')
      .filter((u) => (args.activeOnly ? u.isActive : true)).length;
  },
});

// ── Departments & positions ──────────────────────────────────────────────────

export const listDepartments = internalQuery({
  args: {
    organizationId: v.id('organizations'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('departments')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(clampLimit(args.limit));
    return rows.map((d) => ({
      id: d._id,
      name: d.name,
      nameEn: d.nameEn ?? null,
      nameRu: d.nameRu ?? null,
      nameHy: d.nameHy ?? null,
      description: d.description ?? null,
      managerId: d.managerId ?? null,
      isActive: d.isActive ?? true,
      createdAt: d.createdAt,
    }));
  },
});

export const listPositions = internalQuery({
  args: {
    organizationId: v.id('organizations'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('positions')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(clampLimit(args.limit));
    // Salary bands (`salaryMin` / `salaryMax`) are deliberately omitted from v1:
    // an integration that reads the roster should not thereby read everyone's
    // compensation. Grant it explicitly when it is actually needed.
    return rows.map((p) => ({
      id: p._id,
      title: p.title,
      titleEn: p.titleEn ?? null,
      titleRu: p.titleRu ?? null,
      titleHy: p.titleHy ?? null,
      departmentId: p.departmentId ?? null,
      reportsToPositionId: p.reportsToPositionId ?? null,
      level: p.level ?? null,
      rank: p.rank ?? null,
      isDriverPosition: p.isDriverPosition ?? false,
      isActive: p.isActive ?? true,
      createdAt: p.createdAt,
    }));
  },
});

// ── Leaves ───────────────────────────────────────────────────────────────────

export const listLeaves = internalQuery({
  args: {
    organizationId: v.id('organizations'),
    limit: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('approved'),
        v.literal('rejected'),
        v.literal('cancel_requested'),
      ),
    ),
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const take = clampLimit(args.limit);

    // Pick the narrowest index the filters allow, rather than scanning the org.
    const rows =
      args.userId && args.status
        ? await ctx.db
            .query('leaveRequests')
            .withIndex('by_user_status', (q) =>
              q.eq('userId', args.userId!).eq('status', args.status!),
            )
            .take(take)
        : args.status
          ? await ctx.db
              .query('leaveRequests')
              .withIndex('by_org_status', (q) =>
                q.eq('organizationId', args.organizationId).eq('status', args.status!),
              )
              .take(take)
          : await ctx.db
              .query('leaveRequests')
              .withIndex('by_org_created', (q) => q.eq('organizationId', args.organizationId))
              .order('desc')
              .take(take);

    return (
      rows
        // `by_user_status` is not org-scoped, so the organization check has to
        // happen here for that branch. Better a filter than a leaked roster.
        .filter((l) => l.organizationId === args.organizationId)
        .filter((l) => (args.userId ? l.userId === args.userId : true))
        .filter((l) => (args.status ? l.status === args.status : true))
        .map((l) => ({
          id: l._id,
          userId: l.userId,
          createdBy: l.createdBy ?? null,
          type: l.type,
          startDate: l.startDate,
          endDate: l.endDate,
          days: l.days,
          reason: l.reason,
          comment: l.comment ?? null,
          status: l.status,
          reviewedBy: l.reviewedBy ?? null,
          reviewComment: l.reviewComment ?? null,
          reviewedAt: l.reviewedAt ?? null,
          createdAt: l.createdAt,
        }))
    );
  },
});
