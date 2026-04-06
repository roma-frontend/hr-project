import { query } from './_generated/server';
import { v } from 'convex/values';
import { isSuperadminEmail } from './lib/auth';

// ── Get analytics overview ─────────────────────────────────────────────────
export const getAnalyticsOverview = query({
  args: { organizationId: v.optional(v.id('organizations')) },
  handler: async (ctx, { organizationId }) => {
    let users, leaves;

    if (organizationId) {
      users = await ctx.db
        .query('users')
        .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
        .collect();

      leaves = await ctx.db
        .query('leaveRequests')
        .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
        .collect();
    } else {
      // Superadmin: load with indexes where available
      users = await ctx.db.query('users').collect();
      // For leaves, use status index if possible
      leaves = await ctx.db.query('leaveRequests').collect();
    }

    // Exclude superadmin from employee count
    const filteredUsers = users.filter((u) => u.role !== 'superadmin');

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
    const departments = filteredUsers.reduce(
      (acc, user) => {
        const dept = user.department || 'Unassigned';
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
      users,
      leaves,
    };
  },
});

// ── Get department statistics ──────────────────────────────────────────────
export const getDepartmentStats = query({
  args: { requesterId: v.optional(v.id('users')) },
  handler: async (ctx, { requesterId }) => {
    let users = await ctx.db.query('users').collect();

    if (requesterId) {
      const requester = await ctx.db.get(requesterId);
      if (!requester) throw new Error('Requester not found');

      if (!isSuperadminEmail(requester.email)) {
        if (!requester.organizationId) {
          throw new Error('User does not belong to an organization');
        }
        // Use by_org index instead of collecting all users
        users = await ctx.db
          .query('users')
          .withIndex('by_org', (q) => q.eq('organizationId', requester.organizationId))
          .collect();
      }
    }

    // Exclude superadmin from employee count
    users = users.filter((u) => u.role !== 'superadmin');

    const stats = users.reduce(
      (acc, user) => {
        const dept = user.department || 'Unassigned';
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
        acc[dept].employees += 1;
        acc[dept].totalPaidLeave += user.paidLeaveBalance;
        acc[dept].totalSickLeave += user.sickLeaveBalance;
        acc[dept].totalFamilyLeave += user.familyLeaveBalance;
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

    return Object.values(stats);
  },
});

// ── Get leave trends (last 6 months) ───────────────────────────────────────
export const getLeaveTrends = query({
  args: { requesterId: v.optional(v.id('users')) },
  handler: async (ctx, { requesterId }) => {
    let leaves: any[];

    if (requesterId) {
      const requester = await ctx.db.get(requesterId);
      if (!requester) throw new Error('Requester not found');

      if (!isSuperadminEmail(requester.email)) {
        if (!requester.organizationId) {
          throw new Error('User does not belong to an organization');
        }
        // Use by_org index for efficiency
        leaves = await ctx.db
          .query('leaveRequests')
          .withIndex('by_org', (q) => q.eq('organizationId', requester.organizationId))
          .collect();
      } else {
        // Superadmin: collect all leaves
        leaves = await ctx.db.query('leaveRequests').collect();
      }
    } else {
      leaves = await ctx.db.query('leaveRequests').collect();
    }

    const now = Date.now();
    const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000;

    const recentLeaves = leaves.filter((l) => l.createdAt >= sixMonthsAgo);

    return recentLeaves;
  },
});

// ── Get user personal analytics ────────────────────────────────────────────
export const getUserAnalytics = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error('User not found');

    const userLeaves = await ctx.db
      .query('leaveRequests')
      .filter((q) => q.eq(q.field('userId'), userId))
      .collect();

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
      user,
      totalDaysTaken,
      pendingDays,
      leavesByType,
      userLeaves,
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
  args: { requesterId: v.optional(v.id('users')) },
  handler: async (ctx, { requesterId }) => {
    let leaves = await ctx.db
      .query('leaveRequests')
      .filter((q) => q.eq(q.field('status'), 'approved'))
      .collect();

    if (requesterId) {
      const requester = await ctx.db.get(requesterId);
      if (!requester) throw new Error('Requester not found');

      if (!isSuperadminEmail(requester.email)) {
        if (!requester.organizationId) {
          throw new Error('User does not belong to an organization');
        }
        leaves = leaves.filter((l) => l.organizationId === requester.organizationId);
      }
    }

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
        return {
          ...leave,
          userName: user?.name || 'Unknown',
          userDepartment: user?.department,
        };
      }),
    );

    return enrichedLeaves;
  },
});
