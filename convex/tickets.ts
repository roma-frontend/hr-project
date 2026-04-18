/**
 * 🎫 SUPPORT TICKETS - Unified ticket system for superadmin
 * Create, manage, and resolve support tickets across all organizations
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getTranslation, getUserLocale } from "./translations";

// ─── CREATE TICKET ───────────────────────────────────────────────────────────
export const createTicket = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    createdBy: v.id("users"),
    title: v.string(),
    description: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    category: v.union(
      v.literal("technical"),
      v.literal("billing"),
      v.literal("access"),
      v.literal("feature_request"),
      v.literal("bug"),
      v.literal("other")
    ),
    relatedLeaveId: v.optional(v.id("leaveRequests")),
    relatedDriverRequestId: v.optional(v.id("driverRequests")),
    relatedTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Generate ticket number: SUP-YYYYMMDD-XXXX
    const datePart = (new Date(now).toISOString().split('T')[0] || '').replace(/-/g, '');
    const ticketsToday = await ctx.db
      .query("supportTickets")
      .withIndex("by_created")
      .filter((q) => q.gte(q.field("createdAt"), new Date(datePart).getTime()))
      .collect();
    const seqNum = String(ticketsToday.length + 1).padStart(4, '0');
    const ticketNumber = `SUP-${datePart}-${seqNum}`;

    // Calculate SLA deadline based on priority
    const slaHours = {
      critical: 4,
      high: 12,
      medium: 24,
      low: 48,
    };
    const slaDeadline = now + (slaHours[args.priority] * 60 * 60 * 1000);

    const ticketId = await ctx.db.insert("supportTickets", {
      organizationId: args.organizationId,
      ticketNumber,
      title: args.title,
      description: args.description,
      priority: args.priority,
      status: "open",
      category: args.category,
      createdBy: args.createdBy,
      assignedTo: undefined,
      relatedLeaveId: args.relatedLeaveId,
      relatedDriverRequestId: args.relatedDriverRequestId,
      relatedTaskId: args.relatedTaskId,
      slaDeadline,
      firstResponseAt: undefined,
      resolution: undefined,
      resolvedAt: undefined,
      resolvedBy: undefined,
      closedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Create initial comment from description
    await ctx.db.insert("ticketComments", {
      ticketId,
      organizationId: args.organizationId,
      authorId: args.createdBy,
      message: args.description,
      isInternal: false,
      createdAt: now,
      updatedAt: now,
    });

    // Notify superadmins
    const superadmins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "superadmin"))
      .collect();

    for (const admin of superadmins) {
      await ctx.db.insert("notifications", {
        organizationId: args.organizationId,
        userId: admin._id,
        type: "system",
        title: `🎫 Новый тикет: ${ticketNumber}`,
        message: `${args.title} (Приоритет: ${args.priority})`,
        isRead: false,
        relatedId: `support_ticket:${ticketId}`,
        createdAt: now,
      });
    }

    return { ticketId, ticketNumber };
  },
});

// ─── GET ALL TICKETS ─────────────────────────────────────────────────────────
export const getAllTickets = query({
  args: {
    status: v.optional(v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("waiting_customer"),
      v.literal("resolved"),
      v.literal("closed")
    )),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    )),
    organizationId: v.optional(v.id("organizations")),
    assignedTo: v.optional(v.id("users")),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let tickets = await ctx.db.query("supportTickets").collect();

    // Apply filters
    if (args.status) {
      tickets = tickets.filter((t) => t.status === args.status);
    }
    if (args.priority) {
      tickets = tickets.filter((t) => t.priority === args.priority);
    }
    if (args.organizationId) {
      tickets = tickets.filter((t) => t.organizationId === args.organizationId);
    }
    if (args.assignedTo) {
      tickets = tickets.filter((t) => t.assignedTo === args.assignedTo);
    }

    // Sort by priority (critical first) then by createdAt (newest first)
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    tickets.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt - a.createdAt;
    });

    // Apply limit and cursor for pagination
    if (args.cursor) {
      tickets = tickets.slice(args.cursor);
    }
    if (args.limit) {
      tickets = tickets.slice(0, args.limit);
    }

    // Enrich with user data
    const enrichedTickets = await Promise.all(
      tickets.map(async (ticket) => {
        const creator = await ctx.db.get(ticket.createdBy);
        const assignee = ticket.assignedTo ? await ctx.db.get(ticket.assignedTo) : null;
        const org = ticket.organizationId ? await ctx.db.get(ticket.organizationId) : null;
        
        // Count comments
        const comments = await ctx.db
          .query("ticketComments")
          .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
          .collect();

        return {
          ...ticket,
          creatorName: creator?.name || "Unknown",
          creatorEmail: creator?.email || "",
          creatorAvatar: creator?.avatarUrl,
          assigneeName: assignee?.name || null,
          assigneeAvatar: assignee?.avatarUrl,
          organizationName: org?.name || null,
          commentCount: comments.length,
          isOverdue: ticket.status !== "closed" && ticket.slaDeadline && Date.now() > ticket.slaDeadline,
        };
      })
    );

    return enrichedTickets;
  },
});

// ─── GET TICKET BY ID ────────────────────────────────────────────────────────
export const getTicketById = query({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;

    const creator = await ctx.db.get(ticket.createdBy);
    const assignee = ticket.assignedTo ? await ctx.db.get(ticket.assignedTo) : null;
    const org = ticket.organizationId ? await ctx.db.get(ticket.organizationId) : null;
    const comments = await ctx.db
      .query("ticketComments")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
      .collect();

    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        return {
          ...comment,
          authorName: author?.name || "Unknown",
          authorAvatar: author?.avatarUrl,
          authorRole: author?.role,
        };
      })
    );

    return {
      ...ticket,
      creatorName: creator?.name || "Unknown",
      creatorEmail: creator?.email || "",
      creatorAvatar: creator?.avatarUrl,
      assigneeName: assignee?.name || null,
      assigneeAvatar: assignee?.avatarUrl,
      organizationName: org?.name || null,
      comments: enrichedComments.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

// ─── GET TICKETS DASHBOARD STATS ─────────────────────────────────────────────
export const getTicketStats = query({
  args: {},
  handler: async (ctx) => {
    const tickets = await ctx.db.query("supportTickets").collect();
    const now = Date.now();

    const stats = {
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      inProgress: tickets.filter((t) => t.status === "in_progress").length,
      waitingCustomer: tickets.filter((t) => t.status === "waiting_customer").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      closed: tickets.filter((t) => t.status === "closed").length,
      critical: tickets.filter((t) => t.priority === "critical" && t.status !== "closed").length,
      high: tickets.filter((t) => t.priority === "high" && t.status !== "closed").length,
      overdue: tickets.filter((t) => 
        t.status !== "closed" && t.slaDeadline && now > t.slaDeadline
      ).length,
    };

    // Calculate average response time (for tickets with firstResponseAt)
    const respondedTickets = tickets.filter((t) => t.firstResponseAt);
    const avgResponseTime = respondedTickets.length > 0
      ? respondedTickets.reduce((sum, t) => sum + (t.firstResponseAt! - t.createdAt), 0) / respondedTickets.length
      : 0;

    // Calculate resolution rate
    const resolutionRate = stats.total > 0
      ? (stats.resolved + stats.closed) / stats.total * 100
      : 0;

    // Tickets by category
    const byCategory = tickets.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      ...stats,
      avgResponseTime: Math.round(avgResponseTime / (1000 * 60 * 60) * 10) / 10, // hours
      resolutionRate: Math.round(resolutionRate * 10) / 10,
      byCategory,
    };
  },
});

// ─── UPDATE TICKET STATUS ────────────────────────────────────────────────────
export const updateTicketStatus = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("waiting_customer"),
      v.literal("resolved"),
      v.literal("closed")
    ),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const now = Date.now();
    const updates: any = {
      status: args.status,
      updatedAt: now,
    };

    // Set first response time if transitioning from open
    if (ticket.status === "open" && !ticket.firstResponseAt) {
      updates.firstResponseAt = now;
    }

    // Set resolved time if transitioning to resolved
    if (args.status === "resolved") {
      updates.resolvedAt = now;
      updates.resolvedBy = args.userId;
    }

    // Set closed time if transitioning to closed
    if (args.status === "closed") {
      updates.closedAt = now;
    }

    await ctx.db.patch(args.ticketId, updates);

    // Notify creator
    await ctx.db.insert("notifications", {
      organizationId: ticket.organizationId,
      userId: ticket.createdBy,
      type: "system",
      title: `🎫 Статус тикета обновлен: ${ticket.ticketNumber}`,
      message: `Новый статус: ${args.status}`,
      isRead: false,
      relatedId: `support_ticket:${args.ticketId}`,
      createdAt: now,
    });

    return args.ticketId;
  },
});

// ─── ASSIGN TICKET ───────────────────────────────────────────────────────────
export const assignTicket = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    assignedTo: v.optional(v.id("users")),
    userId: v.id("users"), // Who is making the assignment
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");

    await ctx.db.patch(args.ticketId, {
      assignedTo: args.assignedTo,
      updatedAt: Date.now(),
    });

    // Notify assignee
    if (args.assignedTo) {
      await ctx.db.insert("notifications", {
        organizationId: ticket.organizationId,
        userId: args.assignedTo,
        type: "system",
        title: `🎫 Вам назначен тикет: ${ticket.ticketNumber}`,
        message: ticket.title,
        isRead: false,
        relatedId: `support_ticket:${args.ticketId}`,
        createdAt: Date.now(),
      });
    }

    return args.ticketId;
  },
});

// ─── ADD TICKET COMMENT ──────────────────────────────────────────────────────
export const addTicketComment = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    authorId: v.id("users"),
    message: v.string(),
    isInternal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const now = Date.now();
    const commentId = await ctx.db.insert("ticketComments", {
      ticketId: args.ticketId,
      organizationId: ticket.organizationId,
      authorId: args.authorId,
      message: args.message,
      isInternal: args.isInternal,
      createdAt: now,
      updatedAt: now,
    });

    // Update ticket timestamp
    await ctx.db.patch(args.ticketId, {
      updatedAt: now,
    });

    // Notify ticket creator if comment is not internal
    if (!args.isInternal && args.authorId !== ticket.createdBy) {
      await ctx.db.insert("notifications", {
        organizationId: ticket.organizationId,
        userId: ticket.createdBy,
        type: "system",
        title: `💬 Новый комментарий в тикете: ${ticket.ticketNumber}`,
        message: args.message.slice(0, 100),
        isRead: false,
        relatedId: `support_ticket:${args.ticketId}`,
        createdAt: now,
      });
    }

    return commentId;
  },
});

// ─── RESOLVE TICKET ──────────────────────────────────────────────────────────
export const resolveTicket = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    resolution: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const now = Date.now();

    await ctx.db.patch(args.ticketId, {
      status: "resolved",
      resolution: args.resolution,
      resolvedAt: now,
      resolvedBy: args.userId,
      updatedAt: now,
    });

    // Notify creator
    await ctx.db.insert("notifications", {
      organizationId: ticket.organizationId,
      userId: ticket.createdBy,
      type: "system",
      title: `✅ Тикет решен: ${ticket.ticketNumber}`,
      message: args.resolution,
      isRead: false,
      relatedId: `support_ticket:${args.ticketId}`,
      createdAt: now,
    });

    return args.ticketId;
  },
});

// ─── BULK UPDATE TICKETS ─────────────────────────────────────────────────────
export const bulkUpdateTickets = mutation({
  args: {
    ticketIds: v.array(v.id("supportTickets")),
    status: v.optional(v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("waiting_customer"),
      v.literal("resolved"),
      v.literal("closed")
    )),
    assignedTo: v.optional(v.optional(v.id("users"))),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let success = 0;
    let failed = 0;

    const results = await Promise.allSettled(
      args.ticketIds.map(async (ticketId) => {
        const ticket = await ctx.db.get(ticketId);
        if (!ticket) throw new Error("Ticket not found");

        const updates: any = { updatedAt: now };
        if (args.status) updates.status = args.status;
        if (args.assignedTo !== undefined) updates.assignedTo = args.assignedTo;

        await ctx.db.patch(ticketId, updates);
        success++;
      })
    );

    failed = results.filter((r) => r.status === "rejected").length;

    return { success, failed };
  },
});

// ─── GET MY TICKETS ──────────────────────────────────────────────────────────
export const getMyTickets = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const tickets = await ctx.db.query("supportTickets").collect();
    
    // Filter tickets where user is creator or assignee
    const myTickets = tickets.filter(
      (t) => t.createdBy === args.userId || t.assignedTo === args.userId
    );

    // Sort by createdAt descending
    myTickets.sort((a, b) => b.createdAt - a.createdAt);

    // Enrich with basic data
    return await Promise.all(
      myTickets.map(async (ticket) => {
        const creator = await ctx.db.get(ticket.createdBy);
        return {
          ...ticket,
          creatorName: creator?.name || "Unknown",
          isOverdue: ticket.status !== "closed" && ticket.slaDeadline && Date.now() > ticket.slaDeadline,
        };
      })
    );
  },
});

// ─── CREATE TICKET CHAT ──────────────────────────────────────────────────────
export const createTicketChat = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    superadminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    console.log(`[createTicketChat] START - ticketId: ${args.ticketId}, superadminId: ${args.superadminId}`);
    
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      console.error(`[createTicketChat] Ticket not found: ${args.ticketId}`);
      throw new Error("Ticket not found");
    }
    console.log(`[createTicketChat] Ticket found: ${ticket._id}, chatId: ${ticket.chatId}`);

    // Verify user is superadmin
    const superadmin = await ctx.db.get(args.superadminId);
    console.log(`[createTicketChat] Superadmin: ${superadmin?._id}, role: ${superadmin?.role}, orgId: ${superadmin?.organizationId}`);
    
    if (!superadmin || superadmin.role !== "superadmin") {
      console.error(`[createTicketChat] User is not superadmin: role=${superadmin?.role}`);
      throw new Error("Only superadmins can create ticket chats");
    }

    // Check if chat already exists
    if (ticket.chatId) {
      console.error(`[createTicketChat] Chat already exists: ${ticket.chatId}`);
      throw new Error("Chat already exists for this ticket");
    }

    const now = Date.now();

    // Get organization
    const org = ticket.organizationId ? await ctx.db.get(ticket.organizationId) : null;
    const orgName = org?.name || "Organization";

    // Get ticket creator to determine organization
    const creator = await ctx.db.get(ticket.createdBy);
    const creatorName = creator?.name || "Unknown";

    // Determine organization ID for chat
    // Priority: ticket's org > creator's org > superadmin's org
    const chatOrgId = ticket.organizationId || creator?.organizationId || superadmin.organizationId;
    console.log(`[createTicketChat] Ticket orgId: ${ticket.organizationId}, Creator orgId: ${creator?.organizationId}, Superadmin orgId: ${superadmin.organizationId}, Using: ${chatOrgId || 'undefined'}`);

    // Generate smart chat name based on ticket
    const chatName = `🎫 ${ticket.ticketNumber}: ${ticket.title}`;

    // Create group conversation
    const chatId = await ctx.db.insert("chatConversations", {
      organizationId: chatOrgId,
      type: "group",
      name: chatName,
      description: `Support chat for ticket ${ticket.ticketNumber}\nPriority: ${ticket.priority}\nCategory: ${ticket.category}`,
      createdBy: args.superadminId,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`[createTicketChat] Created conversation ${chatId} with orgId: ${chatOrgId || 'undefined'}`);

    // Add superadmin as owner (check if already exists)
    const existingSuperadminMember = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", chatId).eq("userId", args.superadminId)
      )
      .first();

    if (existingSuperadminMember) {
      await ctx.db.patch(existingSuperadminMember._id, {
        role: "owner",
        unreadCount: 0,
        isMuted: false,
        isDeleted: false,
        deletedAt: undefined,
      });
      console.log(`[createTicketChat] Superadmin ${args.superadminId} already exists, updated membership`);
    } else {
      await ctx.db.insert("chatMembers", {
        conversationId: chatId,
        userId: args.superadminId,
        organizationId: chatOrgId,
        role: "owner",
        unreadCount: 0,
        isMuted: false,
        joinedAt: now,
      });
      console.log(`[createTicketChat] Added superadmin ${args.superadminId} as owner of chat ${chatId}`);
    }

    // Add ticket creator as member (check if already exists)
    const existingCreatorMember = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", chatId).eq("userId", ticket.createdBy)
      )
      .first();

    if (existingCreatorMember) {
      await ctx.db.patch(existingCreatorMember._id, {
        role: "member",
        unreadCount: 0,
        isMuted: false,
        isDeleted: false,
        deletedAt: undefined,
      });
      console.log(`[createTicketChat] Ticket creator ${ticket.createdBy} already exists, updated membership`);
    } else {
      await ctx.db.insert("chatMembers", {
        conversationId: chatId,
        userId: ticket.createdBy,
        organizationId: chatOrgId,
        role: "member",
        unreadCount: 0,
        isMuted: false,
        joinedAt: now,
      });
      console.log(`[createTicketChat] Added ticket creator ${ticket.createdBy} as member of chat ${chatId}`);
    }

    // Add ticket assignee if exists (check if already exists)
    if (ticket.assignedTo) {
      const assigneeId = ticket.assignedTo;
      const existingAssigneeMember = await ctx.db
        .query("chatMembers")
        .withIndex("by_conversation_user", (q) =>
          q.eq("conversationId", chatId).eq("userId", assigneeId)
        )
        .first();

      if (existingAssigneeMember) {
        await ctx.db.patch(existingAssigneeMember._id, {
          role: "member",
          unreadCount: 0,
          isMuted: false,
          isDeleted: false,
          deletedAt: undefined,
        });
        console.log(`[createTicketChat] Assignee ${assigneeId} already exists, updated membership`);
      } else {
        await ctx.db.insert("chatMembers", {
          conversationId: chatId,
          userId: assigneeId,
          organizationId: chatOrgId,
          role: "member",
          unreadCount: 0,
          isMuted: false,
          joinedAt: now,
        });
        console.log(`[createTicketChat] Added assignee ${assigneeId} as member of chat ${chatId}`);
      }
    }

    // Add system message about chat creation (translated based on creator's language)
    const creatorLocale = getUserLocale(creator?.language);
    const systemMessage = getTranslation(creatorLocale, 'ticket.chatCreated', {
      ticketNumber: ticket.ticketNumber,
    });
    
    await ctx.db.insert("chatMessages", {
      conversationId: chatId,
      organizationId: chatOrgId,
      senderId: args.superadminId,
      type: "system",
      content: systemMessage,
      createdAt: now,
    });

    // Update ticket with chatId (but NOT chatActivated yet)
    await ctx.db.patch(args.ticketId, {
      chatId,
      updatedAt: now,
    });

    console.log(`[createTicketChat] Completed! chatId=${chatId}, orgId=${chatOrgId}, memberships added for superadmin, creator${ticket.assignedTo ? ', and assignee' : ''}`);
    return { chatId, chatName };
  },
});

// ─── ACTIVATE TICKET CHAT ────────────────────────────────────────────────────
export const activateTicketChat = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    superadminId: v.id("users"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (!ticket.chatId) throw new Error("Chat not created yet");
    if (ticket.chatActivated) throw new Error("Chat already activated");

    // Verify user is superadmin
    const superadmin = await ctx.db.get(args.superadminId);
    if (!superadmin || superadmin.role !== "superadmin") {
      throw new Error("Only superadmins can activate ticket chats");
    }

    const now = Date.now();

    // Determine org ID - use ticket's org, or creator's org as fallback
    const creator = await ctx.db.get(ticket.createdBy);
    const chatOrgId = ticket.organizationId || creator?.organizationId || superadmin.organizationId;
    console.log(`[activateTicketChat] Ticket orgId: ${ticket.organizationId}, Creator orgId: ${creator?.organizationId}, Superadmin orgId: ${superadmin.organizationId}, Using: ${chatOrgId || 'undefined'}`);

    // Send the first message from superadmin
    const messageId = await ctx.db.insert("chatMessages", {
      conversationId: ticket.chatId,
      organizationId: chatOrgId,
      senderId: args.superadminId,
      type: "text",
      content: args.message,
      createdAt: now,
    });

    // Update conversation's last message metadata
    const preview = args.message.length > 60 ? args.message.slice(0, 60) + "..." : args.message;
    await ctx.db.patch(ticket.chatId, {
      lastMessageAt: now,
      lastMessageText: preview,
      lastMessageSenderId: args.superadminId,
      updatedAt: now,
    });

    // Mark chat as activated - now employee can see it
    await ctx.db.patch(args.ticketId, {
      chatActivated: true,
      updatedAt: now,
    });

    if (!ticket.chatId) throw new Error("Chat not created yet");

    // At this point, ticket.chatId is guaranteed to exist
    const chatId = ticket.chatId;

    // Increment unread count for ticket creator
    const creatorMember = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", chatId).eq("userId", ticket.createdBy)
      )
      .first();

    if (creatorMember) {
      await ctx.db.patch(creatorMember._id, {
        unreadCount: creatorMember.unreadCount + 1,
      });
    }

    // Notify ticket creator
    await ctx.db.insert("notifications", {
      organizationId: ticket.organizationId,
      userId: ticket.createdBy,
      type: "system",
      title: `💬 Новый ответ в чате тикета: ${ticket.ticketNumber}`,
      message: args.message.slice(0, 100),
      isRead: false,
      relatedId: `support_ticket:${args.ticketId}`,
      createdAt: now,
    });

    return { messageId, chatId };
  },
});

// ─── GET TICKET CHAT STATUS ──────────────────────────────────────────────────
export const getTicketChatStatus = query({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;

    return {
      chatId: ticket.chatId,
      chatActivated: ticket.chatActivated || false,
      hasChat: !!ticket.chatId,
    };
  },
});
