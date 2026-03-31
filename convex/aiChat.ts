/**
 * AI Chat Conversations - Query functions
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

export const getConversations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("aiConversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    
    return conversations.map(conv => ({
      ...conv,
      messages: [] as Array<{ _id: Id<"aiMessages">; content: string; role: string }>, // Don't load all messages here
    }));
  },
});

export const getConversation = query({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
    
    return {
      ...conversation,
      messages,
    };
  },
});

export const getMessages = query({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();

    return messages;
  },
});

export const getFullContext = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get user data
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get organization
    const org = user.organizationId
      ? await ctx.db.get(user.organizationId)
      : null;

    // Get user's leave requests
    const leaves = await ctx.db
      .query("leaveRequests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get user's tasks
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_assigned_to", (q) => q.eq("assignedTo", args.userId))
      .collect();

    // Get team members (same organization)
    const teamMembers = user.organizationId
      ? await ctx.db
          .query("users")
          .withIndex("by_org", (q) => q.eq("organizationId", user.organizationId))
          .collect()
      : [];

    // Get attendance (time tracking)
    const attendance = await ctx.db
      .query("timeTracking")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(30);

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
      organization: org ? {
        name: org.name,
        plan: org.plan,
      } : null,
      leaves: leaves.map(l => ({
        id: l._id,
        type: l.type,
        startDate: l.startDate,
        endDate: l.endDate,
        status: l.status,
        reason: l.reason,
      })),
      tasks: tasks.map(t => ({
        id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.deadline,
      })),
      teamMembers: teamMembers.map(m => ({
        id: m._id,
        name: m.name,
        email: m.email,
        role: m.role,
        department: m.department,
      })),
      attendance: attendance.map(a => ({
        id: a._id,
        date: a.date,
        checkIn: a.checkInTime,
        checkOut: a.checkOutTime,
        status: a.status,
      })),
    };
  },
});
