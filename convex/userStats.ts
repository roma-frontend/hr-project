import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Get user statistics - UNIFIED VERSION matching mobile
 */
export const getUserStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      // User not found - return null instead of throwing
      return null;
    }

    // Get user's leaves
    const userLeaves = await ctx.db
      .query("leaveRequests")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    // Calculate leave statistics
    const approved = userLeaves.filter(l => l.status === "approved");
    const pending = userLeaves.filter(l => l.status === "pending");
    const rejected = userLeaves.filter(l => l.status === "rejected");

    const totalDaysUsed = approved.reduce((sum, l) => sum + (l.days ?? 0), 0);
    const totalDaysPending = pending.reduce((sum, l) => sum + (l.days ?? 0), 0);

    // Get user's tasks
    const userTasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("assignedTo"), userId))
      .collect();

    const completedTasks = userTasks.filter(t => t.status === "completed").length;
    const totalTasks = userTasks.length;
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Get user's messages/activity
    const userMessages = await ctx.db
      .query("chatMessages")
      .filter((q) => q.eq(q.field("senderId"), userId))
      .collect();

    // Get attendance records if available
    let attendanceStats = {
      presentDays: 0,
      absentDays: 0,
      leaveDays: totalDaysUsed,
      totalWorkingDays: 0,
    };

    // Attendance table not available in this schema
    // Attendance data would be tracked through timeTracking or other modules

    // Calculate leave balances
    const leaveBalances = {
      paid: (user as any).paidLeaveBalance ?? 20,
      sick: (user as any).sickLeaveBalance ?? 10,
      family: (user as any).familyLeaveBalance ?? 5,
    };

    // Count projects from tasks
    const projects = new Set(
      userTasks
        .filter(t => (t as any).projectId)
        .map(t => (t as any).projectId)
    );

    return {
      userId: user._id,
      userName: user.name,
      department: user.department,
      position: (user as any).position ?? "N/A",
      avatar: user.avatarUrl,
      joinDate: (user as any).createdAt,
      
      leaveStats: {
        totalDaysUsed,
        totalDaysPending,
        approvedLeaves: approved.length,
        pendingLeaves: pending.length,
        rejectedLeaves: rejected.length,
        balances: leaveBalances,
      },

      taskStats: {
        totalTasks,
        completedTasks,
        completionRate: Math.round(taskCompletionRate),
        pendingTasks: userTasks.filter(t => t.status !== "completed").length,
      },

      activityStats: {
        totalMessages: userMessages.length,
        lastActive: userMessages.length > 0 
          ? Math.max(...userMessages.map(m => m.createdAt ?? 0))
          : null,
      },

      attendanceStats,

      // Legacy fields for backward compatibility
      daysActive: Math.floor((Date.now() - ((user as any).createdAt ?? Date.now())) / (1000 * 60 * 60 * 24)),
      tasksCompleted: completedTasks,
      leavesTaken: approved.length,
      projects: projects.size,

      // Overall productivity score (0-100)
      productivityScore: Math.round(
        (taskCompletionRate * 0.4) + 
        (Math.min(userMessages.length / 100, 1) * 100 * 0.3) +
        (attendanceStats.presentDays > 0 ? (attendanceStats.presentDays / (attendanceStats.presentDays + attendanceStats.absentDays)) * 100 * 0.3 : 0)
      ),
    };
  },
});
