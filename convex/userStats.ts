import { v } from "convex/values";
import { query } from "./_generated/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET USER ACTIVITY STATS
// ─────────────────────────────────────────────────────────────────────────────
export const getUserStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const now = Date.now();
    const userCreatedAt = user.createdAt ?? now;

    // Calculate days since joined
    const daysActive = Math.floor((now - userCreatedAt) / (1000 * 60 * 60 * 24));

    // Count completed tasks
    const allTasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("assignedTo"), userId))
      .collect();

    const completedTasks = allTasks.filter(t => t.status === "completed").length;

    // Count approved leaves
    const leaves = await ctx.db
      .query("leaveRequests")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    const approvedLeaves = leaves.filter(l => l.status === "approved").length;

    // Count projects (from tasks - unique project references)
    const projects = new Set(
      allTasks
        .filter(t => (t as any).projectId)
        .map(t => (t as any).projectId)
    );

    return {
      daysActive,
      tasksCompleted: completedTasks,
      leavesTaken: approvedLeaves,
      projects: projects.size,
    };
  },
});
