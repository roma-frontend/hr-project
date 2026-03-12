import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL LEAVES — scoped to caller's organization
// ─────────────────────────────────────────────────────────────────────────────
export const getAllLeaves = query({
  args: { 
    requesterId: v.optional(v.id("users")),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { requesterId, organizationId }) => {
    // If organizationId is provided directly, use it
    if (organizationId && !requesterId) {
      const leaves = await ctx.db
        .query("leaveRequests")
        .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .collect();

      return await Promise.all(
        leaves.map(async (leave) => {
          const user = await ctx.db.get(leave.userId);
          const reviewer = leave.reviewedBy ? await ctx.db.get(leave.reviewedBy) : null;
          return {
            ...leave,
            userName: user?.name ?? "Unknown",
            userEmail: user?.email ?? "",
            userDepartment: user?.department ?? "",
            userEmployeeType: user?.employeeType ?? "staff",
            userAvatarUrl: user?.avatarUrl,
            reviewerName: reviewer?.name,
          };
        })
      );
    }

    // Otherwise use requesterId
    if (!requesterId) return [];
    
    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error("Requester not found");

    // Superadmin sees all leaves across all organizations
    const SUPERADMIN_EMAIL = "romangulanyan@gmail.com";
    let leaves;
    if (requester.email.toLowerCase() === SUPERADMIN_EMAIL) {
      leaves = await ctx.db.query("leaveRequests").order("desc").collect();
    } else {
      if (!requester.organizationId) throw new Error("User does not belong to an organization");
      leaves = await ctx.db
        .query("leaveRequests")
        .withIndex("by_org", (q) => q.eq("organizationId", requester.organizationId))
        .order("desc")
        .collect();
    }

    return await Promise.all(
      leaves.map(async (leave) => {
        const user = await ctx.db.get(leave.userId);
        const reviewer = leave.reviewedBy ? await ctx.db.get(leave.reviewedBy) : null;
        return {
          ...leave,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "",
          userDepartment: user?.department ?? "",
          userEmployeeType: user?.employeeType ?? "staff",
          userAvatarUrl: user?.avatarUrl,
          reviewerName: reviewer?.name,
        };
      })
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET LEAVES FOR SPECIFIC ORGANIZATION (superadmin filtered view)
// ─────────────────────────────────────────────────────────────────────────────
export const getLeavesForOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    const leaves = await ctx.db
      .query("leaveRequests")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .collect();

    return await Promise.all(
      leaves.map(async (leave) => {
        const user = await ctx.db.get(leave.userId);
        const reviewer = leave.reviewedBy ? await ctx.db.get(leave.reviewedBy) : null;
        return {
          ...leave,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "",
          userDepartment: user?.department ?? "",
          userEmployeeType: user?.employeeType ?? "staff",
          userAvatarUrl: user?.avatarUrl,
          reviewerName: reviewer?.name,
        };
      })
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET USER LEAVES — own leaves only (or admin sees all within org)
// ─────────────────────────────────────────────────────────────────────────────
export const getUserLeaves = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("leaveRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET PENDING LEAVES — scoped to org
// ─────────────────────────────────────────────────────────────────────────────
export const getPendingLeaves = query({
  args: { requesterId: v.id("users") },
  handler: async (ctx, { requesterId }) => {
    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error("Requester not found");

    // Superadmin sees all pending leaves
    const SUPERADMIN_EMAIL = "romangulanyan@gmail.com";
    let leaves;
    if (requester.email.toLowerCase() === SUPERADMIN_EMAIL) {
      const allLeaves = await ctx.db.query("leaveRequests").collect();
      leaves = allLeaves.filter(l => l.status === "pending");
    } else {
      if (!requester.organizationId) throw new Error("User does not belong to an organization");
      leaves = await ctx.db
        .query("leaveRequests")
        .withIndex("by_org_status", (q) =>
          q.eq("organizationId", requester.organizationId).eq("status", "pending")
        )
        .collect();
    }

    return await Promise.all(
      leaves.map(async (leave) => {
        const user = await ctx.db.get(leave.userId);
        return {
          ...leave,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "",
          userDepartment: user?.department ?? "",
          userAvatarUrl: user?.avatarUrl,
        };
      })
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE LEAVE REQUEST
// ─────────────────────────────────────────────────────────────────────────────
export const createLeave = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("paid"),
      v.literal("unpaid"),
      v.literal("sick"),
      v.literal("family"),
      v.literal("doctor")
    ),
    startDate: v.string(),
    endDate: v.string(),
    days: v.number(),
    reason: v.string(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (!user.isApproved) throw new Error("Account pending approval");
    if (!user.organizationId) throw new Error("User does not belong to an organization");

    const leaveId = await ctx.db.insert("leaveRequests", {
      organizationId: user.organizationId, // ← tenant isolation
      userId: args.userId,
      type: args.type,
      startDate: args.startDate,
      endDate: args.endDate,
      days: args.days,
      reason: args.reason,
      comment: args.comment,
      status: "pending",
      isRead: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Conflict detection with company events is handled by:
    // 1. Admin manually checking events before approving
    // 2. Future: scheduled job to check conflicts

    // Notify admins and supervisors within same org only
    const admins = await ctx.db
      .query("users")
      .withIndex("by_org_role", (q) =>
        q.eq("organizationId", user.organizationId).eq("role", "admin")
      )
      .collect();

    const supervisors = await ctx.db
      .query("users")
      .withIndex("by_org_role", (q) =>
        q.eq("organizationId", user.organizationId).eq("role", "supervisor")
      )
      .collect();

    // ═══════════════════════════════════════════════════════════════
    // АВТО-ОТВЕТ СОТРУДНИКУ — Заявка получена
    // ═══════════════════════════════════════════════════════════════
    const expectedResponseDate = new Date();
    expectedResponseDate.setDate(expectedResponseDate.getDate() + 1); // 24 часа
    
    const autoReplyMessage = `Ваша заявка на ${args.type} отпуск (${args.startDate} → ${args.endDate}) получена! ✅

📋 Детали:
• Тип: ${args.type === 'paid' ? 'Оплачиваемый' : args.type === 'sick' ? 'Больничный' : args.type === 'family' ? 'Семейный' : args.type}
• Даты: ${args.startDate} — ${args.endDate} (${args.days} дн.)
• Причина: ${args.reason}

⏰ Ожидайте ответа до: ${expectedResponseDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}

Если заявка не будет рассмотрена в течение 24 часов, вам придёт напоминание.`;

    await ctx.db.insert("notifications", {
      organizationId: user.organizationId,
      userId: args.userId,
      type: "system",
      title: "📋 Заявка получена",
      message: autoReplyMessage,
      isRead: false,
      relatedId: leaveId,
      createdAt: Date.now(),
    });

    for (const recipient of [...admins, ...supervisors]) {
      if (recipient._id === args.userId) continue;
      await ctx.db.insert("notifications", {
        organizationId: user.organizationId,
        userId: recipient._id,
        type: "leave_request",
        title: "🏖 New Leave Request",
        message: `${user.name} requested ${args.days} day(s) of ${args.type} leave (${args.startDate} → ${args.endDate})`,
        isRead: false,
        relatedId: leaveId,
        createdAt: Date.now(),
      });
    }

    // Create SLA metric
    await ctx.db.insert("slaMetrics", {
      organizationId: user.organizationId,
      leaveRequestId: leaveId,
      submittedAt: Date.now(),
      targetResponseTime: 24,
      status: "pending",
      warningTriggered: false,
      criticalTriggered: false,
      createdAt: Date.now(),
    });

    return leaveId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE LEAVE — cross-org check
// ─────────────────────────────────────────────────────────────────────────────
export const approveLeave = mutation({
  args: {
    leaveId: v.id("leaveRequests"),
    reviewerId: v.id("users"),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, { leaveId, reviewerId, comment }) => {
    const leave = await ctx.db.get(leaveId);
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "pending") throw new Error("Leave is not pending");

    const reviewer = await ctx.db.get(reviewerId);
    if (!reviewer) throw new Error("Reviewer not found");

    // Cross-org protection
    if (reviewer.organizationId !== leave.organizationId) {
      throw new Error("Access denied: cross-organization operation");
    }
    if (reviewer.role !== "admin" && reviewer.role !== "supervisor" && reviewer.role !== "superadmin") {
      throw new Error("Only admins and supervisors can approve leaves");
    }

    const now = Date.now();
    await ctx.db.patch(leaveId, {
      status: "approved",
      reviewedBy: reviewerId,
      reviewComment: comment,
      reviewedAt: now,
      updatedAt: now,
    });

    // Notify employee
    await ctx.db.insert("notifications", {
      organizationId: leave.organizationId,
      userId: leave.userId,
      type: "leave_approved",
      title: "✅ Leave Approved!",
      message: `Your ${leave.type} leave (${leave.startDate} → ${leave.endDate}) has been approved by ${reviewer.name}.${comment ? ` Note: ${comment}` : ""}`,
      isRead: false,
      relatedId: leaveId,
      createdAt: now,
    });

    // Deduct balance
    const user = await ctx.db.get(leave.userId);
    if (user) {
      if (leave.type === "paid") {
        await ctx.db.patch(leave.userId, {
          paidLeaveBalance: Math.max(0, (user.paidLeaveBalance ?? 24) - leave.days),
        });
      } else if (leave.type === "sick") {
        await ctx.db.patch(leave.userId, {
          sickLeaveBalance: Math.max(0, (user.sickLeaveBalance ?? 10) - leave.days),
        });
      } else if (leave.type === "family") {
        await ctx.db.patch(leave.userId, {
          familyLeaveBalance: Math.max(0, (user.familyLeaveBalance ?? 5) - leave.days),
        });
      }
    }

    // Update SLA metric
    const metric = await ctx.db
      .query("slaMetrics")
      .withIndex("by_leave", (q) => q.eq("leaveRequestId", leaveId))
      .first();

    if (metric) {
      const responseTimeHours = (now - metric.submittedAt) / (1000 * 60 * 60);
      const onTime = responseTimeHours <= metric.targetResponseTime;
      const slaScore = onTime
        ? Math.max(80, 100 - (responseTimeHours / metric.targetResponseTime) * 20)
        : Math.max(0, 79 - ((responseTimeHours - metric.targetResponseTime) / metric.targetResponseTime) * 40);

      await ctx.db.patch(metric._id, {
        respondedAt: now,
        responseTimeHours: Math.round(responseTimeHours * 10) / 10,
        slaScore: Math.round(slaScore * 10) / 10,
        status: onTime ? "on_time" : "breached",
      });
    }

    return leaveId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// REJECT LEAVE — cross-org check
// ─────────────────────────────────────────────────────────────────────────────
export const rejectLeave = mutation({
  args: {
    leaveId: v.id("leaveRequests"),
    reviewerId: v.id("users"),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, { leaveId, reviewerId, comment }) => {
    const leave = await ctx.db.get(leaveId);
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "pending") throw new Error("Leave is not pending");

    const reviewer = await ctx.db.get(reviewerId);
    if (!reviewer) throw new Error("Reviewer not found");

    if (reviewer.organizationId !== leave.organizationId) {
      throw new Error("Access denied: cross-organization operation");
    }
    if (reviewer.role !== "admin" && reviewer.role !== "supervisor" && reviewer.role !== "superadmin") {
      throw new Error("Only admins and supervisors can reject leaves");
    }

    const now = Date.now();
    await ctx.db.patch(leaveId, {
      status: "rejected",
      reviewedBy: reviewerId,
      reviewComment: comment,
      reviewedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("notifications", {
      organizationId: leave.organizationId,
      userId: leave.userId,
      type: "leave_rejected",
      title: "❌ Leave Rejected",
      message: `Your ${leave.type} leave (${leave.startDate} → ${leave.endDate}) was rejected by ${reviewer.name}.${comment ? ` Reason: ${comment}` : ""}`,
      isRead: false,
      relatedId: leaveId,
      createdAt: now,
    });

    // Update SLA metric
    const metric = await ctx.db
      .query("slaMetrics")
      .withIndex("by_leave", (q) => q.eq("leaveRequestId", leaveId))
      .first();

    if (metric) {
      const responseTimeHours = (now - metric.submittedAt) / (1000 * 60 * 60);
      const onTime = responseTimeHours <= metric.targetResponseTime;
      const slaScore = onTime
        ? Math.max(80, 100 - (responseTimeHours / metric.targetResponseTime) * 20)
        : Math.max(0, 79 - ((responseTimeHours - metric.targetResponseTime) / metric.targetResponseTime) * 40);

      await ctx.db.patch(metric._id, {
        respondedAt: now,
        responseTimeHours: Math.round(responseTimeHours * 10) / 10,
        slaScore: Math.round(slaScore * 10) / 10,
        status: onTime ? "on_time" : "breached",
      });
    }

    return leaveId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE LEAVE — org scoped
// ─────────────────────────────────────────────────────────────────────────────
export const updateLeave = mutation({
  args: {
    leaveId: v.id("leaveRequests"),
    requesterId: v.id("users"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    days: v.optional(v.number()),
    reason: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("paid"), v.literal("unpaid"), v.literal("sick"),
      v.literal("family"), v.literal("doctor")
    )),
  },
  handler: async (ctx, { leaveId, requesterId, ...updates }) => {
    const leave = await ctx.db.get(leaveId);
    if (!leave) throw new Error("Leave request not found");

    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error("Requester not found");

    // Cross-org protection
    if (requester.organizationId !== leave.organizationId) {
      throw new Error("Access denied: cross-organization operation");
    }

    const isAdmin = requester.role === "admin" || requester.role === "superadmin";
    const isOwner = leave.userId === requesterId;

    if (!isAdmin && !isOwner) throw new Error("You can only edit your own leave requests");
    if (!isAdmin && leave.status !== "pending") throw new Error("Only pending leaves can be edited");

    await ctx.db.patch(leaveId, { ...updates, updatedAt: Date.now() });

    if (isAdmin && !isOwner) {
      await ctx.db.insert("notifications", {
        organizationId: leave.organizationId,
        userId: leave.userId,
        type: "leave_request",
        title: "✏️ Leave Updated",
        message: `Your leave request (${leave.startDate} → ${leave.endDate}) was updated by ${requester.name}.`,
        isRead: false,
        relatedId: leaveId,
        createdAt: Date.now(),
      });
    }

    return leaveId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE LEAVE — org scoped
// ─────────────────────────────────────────────────────────────────────────────
export const deleteLeave = mutation({
  args: {
    leaveId: v.id("leaveRequests"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, { leaveId, requesterId }) => {
    const leave = await ctx.db.get(leaveId);
    if (!leave) throw new Error("Leave request not found");

    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error("Requester not found");

    if (requester.organizationId !== leave.organizationId) {
      throw new Error("Access denied: cross-organization operation");
    }

    const isAdmin = requester.role === "admin" || requester.role === "superadmin";
    const isOwner = leave.userId === requesterId;

    if (!isAdmin && !isOwner) throw new Error("You can only delete your own leave requests");

    // Restore balance if approved
    if (leave.status === "approved") {
      const user = await ctx.db.get(leave.userId);
      if (user) {
        if (leave.type === "paid") await ctx.db.patch(leave.userId, { paidLeaveBalance: (user.paidLeaveBalance ?? 0) + leave.days });
        else if (leave.type === "sick") await ctx.db.patch(leave.userId, { sickLeaveBalance: (user.sickLeaveBalance ?? 0) + leave.days });
        else if (leave.type === "family") await ctx.db.patch(leave.userId, { familyLeaveBalance: (user.familyLeaveBalance ?? 0) + leave.days });
      }
    }

    if (isAdmin && !isOwner) {
      await ctx.db.insert("notifications", {
        organizationId: leave.organizationId,
        userId: leave.userId,
        type: "leave_request",
        title: "🗑️ Leave Deleted",
        message: `Your ${leave.type} leave (${leave.startDate} → ${leave.endDate}) was deleted by ${requester.name}.`,
        isRead: false,
        relatedId: leaveId,
        createdAt: Date.now(),
      });
    }

    await ctx.db.delete(leaveId);
    return leaveId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FORCE DELETE LEAVE — superadmin only (for cleanup)
// ─────────────────────────────────────────────────────────────────────────────
export const forceDeleteLeave = mutation({
  args: {
    leaveId: v.id("leaveRequests"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, { leaveId, requesterId }) => {
    const leave = await ctx.db.get(leaveId);
    if (!leave) throw new Error("Leave request not found");

    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error("Requester not found");

    // Only superadmin can force delete
    const SUPERADMIN_EMAIL = "romangulanyan@gmail.com";
    if (requester.email.toLowerCase() !== SUPERADMIN_EMAIL) {
      throw new Error("Only superadmin can force delete leaves");
    }

    // Delete without any checks or notifications
    await ctx.db.delete(leaveId);
    return leaveId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET LEAVE STATS — scoped to org
// ─────────────────────────────────────────────────────────────────────────────
export const getLeaveStats = query({
  args: { requesterId: v.id("users") },
  handler: async (ctx, { requesterId }) => {
    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error("Requester not found");

    // Superadmin sees stats across all organizations
    const SUPERADMIN_EMAIL = "romangulanyan@gmail.com";
    let all;
    if (requester.email.toLowerCase() === SUPERADMIN_EMAIL) {
      all = await ctx.db.query("leaveRequests").collect();
    } else {
      if (!requester.organizationId) throw new Error("User does not belong to an organization");
      all = await ctx.db
        .query("leaveRequests")
        .withIndex("by_org", (q) => q.eq("organizationId", requester.organizationId))
        .collect();
    }

    const pending = all.filter((l) => l.status === "pending").length;
    const approved = all.filter((l) => l.status === "approved").length;
    const rejected = all.filter((l) => l.status === "rejected").length;
    const today = new Date().toISOString().split("T")[0];
    const onLeaveToday = all.filter(
      (l) => l.status === "approved" && l.startDate <= today && l.endDate >= today
    ).length;

    return { total: all.length, pending, approved, rejected, onLeaveToday };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET UNREAD LEAVE REQUESTS COUNT
// ─────────────────────────────────────────────────────────────────────────────
export const getUnreadCount = query({
  args: { requesterId: v.id("users") },
  handler: async (ctx, { requesterId }) => {
    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error("Requester not found");

    // Superadmin sees all unread across all organizations
    const SUPERADMIN_EMAIL = "romangulanyan@gmail.com";
    let unread: number;
    if (requester.email.toLowerCase() === SUPERADMIN_EMAIL) {
      const allLeaves = await ctx.db.query("leaveRequests").collect();
      // Treat missing isRead as false (old records before field was added)
      unread = allLeaves.filter((l) => (l.isRead === false || l.isRead === undefined) && l.status === "pending").length;
    } else {
      if (!requester.organizationId) throw new Error("User does not belong to an organization");
      const orgLeaves = await ctx.db
        .query("leaveRequests")
        .withIndex("by_org", (q) =>
          q.eq("organizationId", requester.organizationId)
        )
        .collect();
      // Treat missing isRead as false (old records before field was added)
      unread = orgLeaves.filter((l) => (l.isRead === false || l.isRead === undefined) && l.status === "pending").length;
    }

    return unread;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK LEAVE REQUEST AS READ
// ─────────────────────────────────────────────────────────────────────────────
export const markLeaveAsRead = mutation({
  args: { leaveId: v.id("leaveRequests") },
  handler: async (ctx, { leaveId }) => {
    const leave = await ctx.db.get(leaveId);
    if (!leave) throw new Error("Leave request not found");
    
    await ctx.db.patch(leaveId, { isRead: true });
    return leaveId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK ALL LEAVE REQUESTS AS READ (for an organization)
// ─────────────────────────────────────────────────────────────────────────────
export const markAllLeavesAsRead = mutation({
  args: { requesterId: v.id("users") },
  handler: async (ctx, { requesterId }) => {
    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error("Requester not found");
    if (!requester.organizationId && requester.email.toLowerCase() !== "romangulanyan@gmail.com") {
      throw new Error("User does not belong to an organization");
    }

    // Superadmin can mark all as read
    const SUPERADMIN_EMAIL = "romangulanyan@gmail.com";
    let unreadLeaves;
    if (requester.email.toLowerCase() === SUPERADMIN_EMAIL) {
      const allLeaves = await ctx.db.query("leaveRequests").collect();
      unreadLeaves = allLeaves.filter((l) => (l.isRead === false || l.isRead === undefined));
    } else {
      const leaves = await ctx.db
        .query("leaveRequests")
        .withIndex("by_org", (q) =>
          q.eq("organizationId", requester.organizationId!)
        )
        .collect();
      unreadLeaves = leaves.filter((l) => (l.isRead === false || l.isRead === undefined));
    }

    for (const leave of unreadLeaves) {
      await ctx.db.patch(leave._id, { isRead: true });
    }

    return unreadLeaves.length;
  },
});
