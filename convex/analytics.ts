import { query } from './_generated/server';
import { v } from 'convex/values';
import { resolveOrgScope, resolveOrgStaff } from './lib/orgAccess';
import type { Doc } from './_generated/dataModel';

// Explicit output contracts: never return raw HR/user documents from analytics.
// DATA-01: add isCapped + source counts so clients can warn about truncated data.
function analyticsUser(user: Doc<'users'>) {
  return {
    _id: user._id,
    name: user.name,
    role: user.role,
    department: user.department,
    isActive: user.isActive,
    isApproved: user.isApproved,
    paidLeaveBalance: user.paidLeaveBalance,
    sickLeaveBalance: user.sickLeaveBalance,
    familyLeaveBalance: user.familyLeaveBalance,
  };
}
function analyticsLeave(leave: Doc<'leaveRequests'>) {
  return {
    _id: leave._id,
    userId: leave.userId,
    startDate: leave.startDate,
    endDate: leave.endDate,
    days: leave.days,
    status: leave.status,
    type: leave.type,
    createdAt: leave.createdAt,
  };
}
function capped(total: number, cap: number) {
  return total > cap;
}
import { DEFAULT_LIST_CAP, XLARGE_LIST_CAP } from './lib/limits';
import { getProfile, type UserProfile } from './lib/userProfile';
import { isSystemAccountEmail } from './lib/systemAccounts';

// ── Get analytics overview ─────────────────────────────────────────────────
export const getAnalyticsOverview = query({
  args: { organizationId: v.optional(v.id('organizations')) },
  handler: async (ctx, { organizationId }) => {
    const scope = await resolveOrgStaff(ctx, organizationId);
    if (!scope)
      return {
        totalEmployees: 0,
        pendingApprovals: 0,
        totalLeaves: 0,
        pendingLeaves: 0,
        approvedLeaves: 0,
        avgApprovalTime: 0,
        departments: {},
        users: [],
        leaves: [],
      };
    organizationId = scope.organizationId;
    let usersRaw, leavesRaw;

    if (organizationId) {
      usersRaw = await ctx.db
        .query('users')
        .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
        .take(DEFAULT_LIST_CAP + 1);

      leavesRaw = await ctx.db
        .query('leaveRequests')
        .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
        .take(DEFAULT_LIST_CAP + 1);
    } else {
      // Superadmin: full-table reads capped at XLARGE.
      usersRaw = await ctx.db.query('users').take(XLARGE_LIST_CAP + 1);
      leavesRaw = await ctx.db.query('leaveRequests').take(XLARGE_LIST_CAP + 1);
    }
    const _capOverview = organizationId ? DEFAULT_LIST_CAP : XLARGE_LIST_CAP;
    const _isCappedOverview = usersRaw.length > _capOverview || leavesRaw.length > _capOverview;
    const users = usersRaw.slice(0, _capOverview);
    const leaves = leavesRaw.slice(0, _capOverview);

    // Exclude superadmin and system bot accounts from employee count
    const filteredUsers = users.filter(
      (u) => u.role !== 'superadmin' && !isSystemAccountEmail(u.email),
    );

    const totalEmployees = filteredUsers.filter((u) => u.isActive).length;
    const pendingApprovals = filteredUsers.filter((u) => !u.isApproved && u.isActive).length;

    const totalLeaves = leaves.length;
    const pendingLeaves = leaves.filter((l) => l.status === 'pending').length;
    const approvedLeaves = leaves.filter((l) => l.status === 'approved').length;

    // Calculate average approval time (in hours) — guarded against division by zero
    const approvedWithTime = leaves.filter(
      (l) => l.status === 'approved' && l.reviewedAt && l.createdAt,
    );
    const avgApprovalTime =
      approvedWithTime.length > 0
        ? approvedWithTime.reduce(
            (sum, l) => sum + (l.reviewedAt! - l.createdAt) / (1000 * 60 * 60),
            0,
          ) / approvedWithTime.length
        : 0;

    // Department breakdown (excluding superadmin)
    const aoProfiles = await Promise.all(filteredUsers.map((u) => getProfile(ctx, u._id)));
    const aoProfileMap = new Map(filteredUsers.map((u, i) => [u._id, aoProfiles[i]]));

    const departments = filteredUsers.reduce(
      (acc, user) => {
        const p = aoProfileMap.get(user._id);
        const dept = p?.department ?? user.department ?? 'Unassigned';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalEmployees,
      pendingApprovals,
      totalLeaves,
      pendingLeaves,
      approvedLeaves,
      avgApprovalTime: Math.round(avgApprovalTime * 10) / 10,
      departments,
      isCapped: _isCappedOverview,
      users: filteredUsers.map((u) => ({
        ...analyticsUser(u),
        department: aoProfileMap.get(u._id)?.department ?? u.department,
      })),
      leaves: leaves.map(analyticsLeave),
    };
  },
});

// ── Get department statistics ──────────────────────────────────────────────
export const getDepartmentStats = query({
  args: {},
  handler: async (ctx) => {
    const scope = await resolveOrgStaff(ctx);
    if (!scope) return [];
    const cap = scope.organizationId ? DEFAULT_LIST_CAP : XLARGE_LIST_CAP;
    const usersInScopeRaw = scope.organizationId
      ? await ctx.db
          .query('users')
          .withIndex('by_org', (q) => q.eq('organizationId', scope.organizationId!))
          .take(cap + 1)
      : await ctx.db.query('users').take(cap + 1);
    const _isCappedDept = usersInScopeRaw.length > cap;
    const usersInScope = usersInScopeRaw.slice(0, cap);
    let users = usersInScope;

    // Exclude superadmin from employee count
    users = users.filter((u) => u.role !== 'superadmin');

    // Load profiles in parallel
    const dsProfiles = await Promise.all(users.map((u) => getProfile(ctx, u._id)));
    const dsProfileMap = new Map(users.map((u, i) => [u._id, dsProfiles[i]]));

    const stats = users.reduce(
      (acc, user) => {
        const p = dsProfileMap.get(user._id);
        const dept = p?.department ?? user.department ?? 'Unassigned';
        if (!acc[dept]) {
          acc[dept] = {
            department: dept,
            employees: 0,
            totalPaidLeave: 0,
            totalSickLeave: 0,
            totalFamilyLeave: 0,
            avgPaidLeave: 0,
            avgSickLeave: 0,
            avgFamilyLeave: 0,
          };
        }
        acc[dept]!.employees += 1;
        acc[dept]!.totalPaidLeave += p?.paidLeaveBalance ?? user.paidLeaveBalance;
        acc[dept]!.totalSickLeave += p?.sickLeaveBalance ?? user.sickLeaveBalance;
        acc[dept]!.totalFamilyLeave += p?.familyLeaveBalance ?? user.familyLeaveBalance;
        return acc;
      },
      {} as Record<
        string,
        {
          department: string;
          employees: number;
          totalPaidLeave: number;
          totalSickLeave: number;
          totalFamilyLeave: number;
          avgPaidLeave: number;
          avgSickLeave: number;
          avgFamilyLeave: number;
        }
      >,
    );

    // Calculate averages — division-by-zero guard
    Object.values(stats).forEach((dept) => {
      const count = dept.employees;
      dept.avgPaidLeave = count > 0 ? Math.round(dept.totalPaidLeave / count) : 0;
      dept.avgSickLeave = count > 0 ? Math.round(dept.totalSickLeave / count) : 0;
      dept.avgFamilyLeave = count > 0 ? Math.round(dept.totalFamilyLeave / count) : 0;
    });

    return {
      data: Object.values(stats),
      isCapped: _isCappedDept,
    };
  },
});

// ── Get leave trends (last 6 months) ───────────────────────────────────────
export const getLeaveTrends = query({
  args: {},
  handler: async (ctx) => {
    const scope = await resolveOrgStaff(ctx);
    if (!scope) return { data: [], isCapped: false };
    const cap = scope.organizationId ? DEFAULT_LIST_CAP : XLARGE_LIST_CAP;
    const leavesRaw = scope.organizationId
      ? await ctx.db
          .query('leaveRequests')
          .withIndex('by_org', (q) => q.eq('organizationId', scope.organizationId!))
          .take(cap + 1)
      : await ctx.db.query('leaveRequests').take(cap + 1);
    const _isCappedLT = leavesRaw.length > cap;
    const leaves = leavesRaw.slice(0, cap);

    const now = Date.now();
    const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000;

    const recentLeaves = leaves.filter((l) => l.createdAt >= sixMonthsAgo);

    return { data: recentLeaves.map(analyticsLeave), isCapped: _isCappedLT };
  },
});

// ── Get user personal analytics ────────────────────────────────────────────
export const getUserAnalytics = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const scope = await resolveOrgScope(ctx);
    if (!scope) return null;
    const user = await ctx.db.get(userId);
    if (
      !user ||
      (!scope.isSuper && user.organizationId !== scope.organizationId) ||
      (!scope.isStaff && userId !== scope.caller._id)
    )
      return null;

    const userLeavesRaw = await ctx.db
      .query('leaveRequests')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(DEFAULT_LIST_CAP + 1);
    const _isCappedUL = userLeavesRaw.length > DEFAULT_LIST_CAP;
    const userLeaves = userLeavesRaw.slice(0, DEFAULT_LIST_CAP);

    const totalDaysTaken = userLeaves
      .filter((l) => l.status === 'approved')
      .reduce((sum, l) => sum + l.days, 0);

    const pendingDays = userLeaves
      .filter((l) => l.status === 'pending')
      .reduce((sum, l) => sum + l.days, 0);

    const leavesByType = userLeaves.reduce(
      (acc, leave) => {
        acc[leave.type] = (acc[leave.type] || 0) + (leave.status === 'approved' ? leave.days : 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      user: analyticsUser(user),
      totalDaysTaken,
      pendingDays,
      leavesByType,
      userLeaves: userLeaves.map(analyticsLeave),
      isCapped: _isCappedUL,
      balances: {
        paid: user.paidLeaveBalance,
        sick: user.sickLeaveBalance,
        family: user.familyLeaveBalance,
      },
    };
  },
});

// ── Get team calendar (who's on leave) ────────────────────────────────────
export const getTeamCalendar = query({
  args: {},
  handler: async (ctx) => {
    const scope = await resolveOrgScope(ctx);
    if (!scope) return [];
    const capTC = scope.organizationId ? DEFAULT_LIST_CAP : XLARGE_LIST_CAP;
    const leavesRaw = scope.organizationId
      ? await ctx.db
          .query('leaveRequests')
          .withIndex('by_org', (q) => q.eq('organizationId', scope.organizationId!))
          .filter((q) => q.eq(q.field('status'), 'approved'))
          .take(capTC + 1)
      : await ctx.db
          .query('leaveRequests')
          .withIndex('by_status', (q) => q.eq('status', 'approved'))
          .take(capTC + 1);
    const _isCappedTC = leavesRaw.length > capTC;
    const leaves = leavesRaw.slice(0, capTC);

    const now = Date.now();
    const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;

    const upcomingLeaves = leaves.filter((l) => {
      const startDate = new Date(l.startDate).getTime();
      const endDate = new Date(l.endDate).getTime();
      return startDate <= thirtyDaysFromNow && endDate >= now;
    });

    // Enrich with user data
    const enrichedLeaves = await Promise.all(
      upcomingLeaves.map(async (leave) => {
        const user = await ctx.db.get(leave.userId);
        const profile = await getProfile(ctx, leave.userId);
        return {
          ...analyticsLeave(leave),
          userName: user?.name || 'Unknown',
          userDepartment: profile?.department ?? user?.department,
        };
      }),
    );

    return {
      data: enrichedLeaves,
      isCapped: _isCappedTC,
    };
  },
});

// ── Dashboard Stats (aggregated counts — no full data transfer) ────────────
export const getDashboardStats = query({
  args: { organizationId: v.optional(v.id('organizations')) },
  handler: async (ctx, { organizationId }) => {
    const scope = await resolveOrgScope(ctx, organizationId);
    if (!scope)
      return {
        totalEmployees: 0,
        pendingRequests: 0,
        onLeaveNow: 0,
        approvedThisMonth: 0,
        pieData: [],
        monthlyTrend: [],
      };

    const isSuperadminUser = scope.isSuper;
    const orgId = scope.organizationId;

    if (!isSuperadminUser && !orgId) {
      return {
        totalEmployees: 0,
        pendingRequests: 0,
        onLeaveNow: 0,
        approvedThisMonth: 0,
        pieData: [],
        monthlyTrend: [],
      };
    }

    // Count employees
    const capDS = isSuperadminUser && !orgId ? XLARGE_LIST_CAP : DEFAULT_LIST_CAP;
    const usersRaw =
      isSuperadminUser && !orgId
        ? await ctx.db.query('users').take(capDS + 1)
        : await ctx.db
            .query('users')
            .withIndex('by_org', (q) => q.eq('organizationId', orgId!))
            .take(capDS + 1);
    const isCappedUsers = usersRaw.length > capDS;
    const users = usersRaw.slice(0, capDS);
    const totalEmployees = users.filter(
      (u) => u.role !== 'superadmin' && u.isActive !== false && !isSystemAccountEmail(u.email),
    ).length;

    // Get leaves scoped by org
    const leavesRaw =
      isSuperadminUser && !orgId
        ? await ctx.db.query('leaveRequests').take(capDS + 1)
        : await ctx.db
            .query('leaveRequests')
            .withIndex('by_org', (q) => q.eq('organizationId', orgId!))
            .take(capDS + 1);
    const isCappedLeaves = leavesRaw.length > capDS;
    const leaves = leavesRaw.slice(0, capDS);

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const pendingRequests = leaves.filter((l) => l.status === 'pending').length;
    const onLeaveNow = leaves.filter(
      (l) => l.status === 'approved' && l.startDate <= today && l.endDate >= today,
    ).length;
    const approvedThisMonth = leaves.filter(
      (l) => l.status === 'approved' && l.startDate >= monthStart,
    ).length;

    // Pie data by type
    const typeCounts: Record<string, number> = {};
    for (const l of leaves) {
      typeCounts[l.type] = (typeCounts[l.type] || 0) + 1;
    }
    const pieData = Object.entries(typeCounts).map(([type, value]) => ({ type, value }));

    // Monthly trend (last 6 months)
    const monthlyTrend: { key: string; approved: number; pending: number; rejected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyTrend.push({ key, approved: 0, pending: 0, rejected: 0 });
    }
    for (const l of leaves) {
      const key = l.startDate.slice(0, 7);
      const entry = monthlyTrend.find((m) => m.key === key);
      if (entry && (l.status === 'approved' || l.status === 'pending' || l.status === 'rejected')) {
        entry[l.status]++;
      }
    }

    const isCapped = isCappedUsers || isCappedLeaves;
    return {
      totalEmployees,
      pendingRequests,
      onLeaveNow,
      approvedThisMonth,
      pieData,
      monthlyTrend,
      isCapped,
    };
  },
});

// ── Recent Leaves (last 6, lightweight) ────────────────────────────────────
export const getRecentLeaves = query({
  args: { organizationId: v.optional(v.id('organizations')) },
  handler: async (ctx, { organizationId }) => {
    const scope = await resolveOrgStaff(ctx, organizationId);
    if (!scope) return [];

    const isSuperadminUser = scope.isSuper;
    const orgId = scope.organizationId;

    if (!isSuperadminUser && !orgId) return [];

    const leaves =
      isSuperadminUser && !orgId
        ? await ctx.db.query('leaveRequests').order('desc').take(6)
        : await ctx.db
            .query('leaveRequests')
            .withIndex('by_org_created', (q) => q.eq('organizationId', orgId!))
            .order('desc')
            .take(6);

    // Batch enrich with user name/email only
    const userIds = [...new Set(leaves.map((l) => l.userId))];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userMap = new Map(users.map((u) => [u?._id, u]));

    // Load profiles in parallel
    const rlProfiles = await Promise.all(userIds.map((id) => getProfile(ctx, id)));
    const rlProfileMap = new Map(userIds.map((id, i) => [id, rlProfiles[i]]));

    return leaves.map((l) => {
      const user = userMap.get(l.userId);
      const profile = rlProfileMap.get(l.userId);
      return {
        _id: l._id,
        _creationTime: l._creationTime,
        userId: l.userId,
        type: l.type,
        startDate: l.startDate,
        endDate: l.endDate,
        days: l.days,
        status: l.status,

        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        organizationId: l.organizationId,
        userName: user?.name ?? 'Unknown',
        userEmail: user?.email ?? '',
        userDepartment: profile?.department ?? user?.department ?? '',
      };
    });
  },
});

// ── Report Builder: aggregate any metric by any dimension ───────────────────
// Powers the custom widgets on /analytics/reports. Returns a normalized
// `{ series, total, unit, isCapped }` shape that every chart type can render.
// `isCapped` signals the underlying take() hit its cap — totals may under-count.
const REPORT_METRIC = v.union(
  v.literal('employees'),
  v.literal('leaves'),
  v.literal('attendance'),
  v.literal('tasks'),
  v.literal('payroll'),
  v.literal('performance'),
  v.literal('recruitment'),
);
const REPORT_GROUP_BY = v.union(
  v.literal('department'),
  v.literal('team'),
  v.literal('role'),
  v.literal('location'),
  v.literal('none'),
);

export const getReportData = query({
  args: {
    organizationId: v.optional(v.id('organizations')),
    metric: REPORT_METRIC,
    groupBy: REPORT_GROUP_BY,
    rangeDays: v.optional(v.number()), // time window; omit for all-time
  },
  handler: async (ctx, { organizationId, metric, groupBy, rangeDays }) => {
    const scope = await resolveOrgStaff(ctx, organizationId, { adminOnly: metric === 'payroll' });
    const orgId = scope?.organizationId;

    if (!scope) {
      return { series: [], total: 0, unit: 'count' as const };
    }

    const rangeStart = rangeDays ? Date.now() - rangeDays * 24 * 60 * 60 * 1000 : 0;

    // Fetch rows for `table`, org-scoped when possible, capped for safety.
    // Generic over the table name so callers get the concrete document type.
    let reportIsCapped = false;
    async function fetchByOrg<T extends 'users' | 'leaveRequests' | 'tasks' | 'payrollRecords'>(
      table: T,
    ) {
      const cap = orgId ? DEFAULT_LIST_CAP : XLARGE_LIST_CAP;
      const rowsRaw = orgId
        ? await ctx.db
            .query(table)
            .withIndex('by_org', (q) => q.eq('organizationId', orgId as never))
            .take(cap + 1)
        : await ctx.db.query(table).take(cap + 1);
      if (rowsRaw.length > cap) reportIsCapped = true;
      void reportIsCapped;
      const rows = rowsRaw.slice(0, cap);
      return rows;
    }

    // Resolve the grouping key for a user (via profile, falling back to the
    // user record). Returns null for the 'none' dimension.
    const groupKeyForUser = (
      user: { department?: string; role?: string; location?: string } | null | undefined,
      profile: UserProfile | null | undefined,
    ): string => {
      switch (groupBy) {
        case 'department':
          return profile?.department ?? user?.department ?? 'Unassigned';
        case 'role':
          return user?.role ?? 'Unknown';
        case 'location':
          return profile?.location ?? user?.location ?? 'Unassigned';
        case 'team':
          // No dedicated team field — fall back to department as a proxy.
          return profile?.department ?? user?.department ?? 'Unassigned';
        default:
          return 'All';
      }
    };

    const tally = (rows: Array<{ key: string; value: number }>) => {
      const map = new Map<string, number>();
      for (const r of rows) map.set(r.key, (map.get(r.key) ?? 0) + r.value);
      const series = [...map.entries()]
        .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value);
      const total = series.reduce((s, x) => s + x.value, 0);
      return { series, total: Math.round(total * 100) / 100, isCapped: reportIsCapped } as const;
    };

    switch (metric) {
      case 'employees': {
        const users = (await fetchByOrg('users')).filter((u) => u.role !== 'superadmin');
        const profiles = await Promise.all(users.map((u) => getProfile(ctx, u._id)));
        const rows = users.map((u, i) => ({ key: groupKeyForUser(u, profiles[i]), value: 1 }));
        return { ...tally(rows), unit: 'count' as const };
      }

      case 'leaves': {
        let leaves = await fetchByOrg('leaveRequests');
        if (rangeStart) leaves = leaves.filter((l) => l.createdAt >= rangeStart);
        // Group by status when no org-dimension is requested, else by user dept.
        if (groupBy === 'none') {
          const rows = leaves.map((l) => ({ key: l.status, value: 1 }));
          return { ...tally(rows), unit: 'count' as const };
        }
        const userIds = [...new Set(leaves.map((l) => l.userId))];
        const profs = await Promise.all(userIds.map((id) => getProfile(ctx, id)));
        const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
        const keyByUser = new Map(
          userIds.map((id, i) => [id, groupKeyForUser(users[i], profs[i])]),
        );
        const rows = leaves.map((l) => ({
          key: keyByUser.get(l.userId) ?? 'Unassigned',
          value: 1,
        }));
        return { ...tally(rows), unit: 'count' as const };
      }

      case 'tasks': {
        let tasks = await fetchByOrg('tasks');
        if (rangeStart) tasks = tasks.filter((t) => t.createdAt >= rangeStart);
        // Tasks have no dept dimension of their own — group by status.
        const rows = tasks.map((t) => ({ key: t.status, value: 1 }));
        return { ...tally(rows), unit: 'count' as const };
      }

      case 'payroll': {
        let records = await fetchByOrg('payrollRecords');
        if (rangeStart) records = records.filter((r) => r.createdAt >= rangeStart);
        if (groupBy === 'none') {
          const rows = records.map((r) => ({ key: r.status, value: r.netSalary }));
          return { ...tally(rows), unit: 'currency' as const };
        }
        const userIds = [...new Set(records.map((r) => r.userId))];
        const profs = await Promise.all(userIds.map((id) => getProfile(ctx, id)));
        const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
        const keyByUser = new Map(
          userIds.map((id, i) => [id, groupKeyForUser(users[i], profs[i])]),
        );
        const rows = records.map((r) => ({
          key: keyByUser.get(r.userId) ?? 'Unassigned',
          value: r.netSalary,
        }));
        return { ...tally(rows), unit: 'currency' as const };
      }

      case 'performance': {
        // reviewAssignments has no by_org index — capped scan + field filter.
        const assignmentsRaw = await ctx.db.query('reviewAssignments').take(XLARGE_LIST_CAP + 1);
        if (assignmentsRaw.length > XLARGE_LIST_CAP) reportIsCapped = true;
        void reportIsCapped;
        let assignments = assignmentsRaw.slice(0, XLARGE_LIST_CAP);
        if (orgId) assignments = assignments.filter((a) => a.organizationId === orgId);
        if (rangeStart) assignments = assignments.filter((a) => a.createdAt >= rangeStart);
        const rows = assignments.map((a) => ({ key: a.status, value: 1 }));
        return { ...tally(rows), unit: 'count' as const };
      }

      case 'recruitment': {
        if (!orgId) return { series: [], total: 0, unit: 'count' as const };
        const appsRaw = await ctx.db
          .query('applications')
          .withIndex('by_org', (q) => q.eq('organizationId', orgId))
          .take(DEFAULT_LIST_CAP + 1);
        if (appsRaw.length > DEFAULT_LIST_CAP) reportIsCapped = true;
        void reportIsCapped;
        let apps = appsRaw.slice(0, DEFAULT_LIST_CAP);
        if (rangeStart) apps = apps.filter((a) => a.createdAt >= rangeStart);
        const rows = apps.map((a) => ({ key: a.stage, value: 1 }));
        return { ...tally(rows), unit: 'count' as const };
      }

      case 'attendance': {
        // Worked hours from the timeTracking table (clock in/out sessions).
        const capAtt = orgId ? DEFAULT_LIST_CAP : XLARGE_LIST_CAP;
        const sessionsRaw = orgId
          ? await ctx.db
              .query('timeTracking')
              .withIndex('by_org', (q) => q.eq('organizationId', orgId))
              .take(capAtt + 1)
          : await ctx.db.query('timeTracking').take(capAtt + 1);
        if (sessionsRaw.length > capAtt) reportIsCapped = true;
        void reportIsCapped;
        let sessions = sessionsRaw.slice(0, capAtt);
        if (rangeStart) sessions = sessions.filter((s) => s.createdAt >= rangeStart);

        // Convert worked minutes → hours per session.
        const hoursOf = (s: { totalWorkedMinutes?: number }) =>
          Math.round(((s.totalWorkedMinutes ?? 0) / 60) * 100) / 100;

        if (groupBy === 'none') {
          const rows = sessions.map((s) => ({ key: s.status, value: hoursOf(s) }));
          return { ...tally(rows), unit: 'hours' as const };
        }
        const userIds = [...new Set(sessions.map((s) => s.userId))];
        const profs = await Promise.all(userIds.map((id) => getProfile(ctx, id)));
        const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
        const keyByUser = new Map(
          userIds.map((id, i) => [id, groupKeyForUser(users[i], profs[i])]),
        );
        const rows = sessions.map((s) => ({
          key: keyByUser.get(s.userId) ?? 'Unassigned',
          value: hoursOf(s),
        }));
        return { ...tally(rows), unit: 'hours' as const };
      }

      default:
        return { series: [], total: 0, unit: 'count' as const };
    }
  },
});
