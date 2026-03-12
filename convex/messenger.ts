import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

const SUPERADMIN_EMAIL = "romangulanyan@gmail.com";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get user's organizationId from DB
// ─────────────────────────────────────────────────────────────────────────────
async function getUserOrgId(ctx: QueryCtx, userId: Id<"users">): Promise<Id<"organizations">> {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  if (!user.organizationId) throw new Error("User has no organization");
  return user.organizationId;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET MY CONVERSATIONS — sorted by lastMessageAt, with unread counts
// Uses chatConversations + chatMembers (shared with desktop)
// ─────────────────────────────────────────────────────────────────────────────
export const getMyConversations = query({
  args: { 
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations"))
  },
  handler: async (ctx, { userId, organizationId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return [];

    // For superadmin without org, get all memberships
    const memberships = await ctx.db
      .query("chatMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const conversations = await Promise.all(
      memberships
        .filter((m) => !m.isDeleted)
        .map(async (m) => {
          const conv = await ctx.db.get(m.conversationId);
          if (!conv || conv.isDeleted) return null;

          // For org-scoped users, only show their org conversations
          if (user.organizationId && conv.organizationId !== user.organizationId) return null;

          // For DMs: get other user's info
          let otherUser = null;
          if (conv.type === "direct") {
            const allMembers = await ctx.db
              .query("chatMembers")
              .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
              .collect();
            const otherMember = allMembers.find((mm) => mm.userId !== userId);
            if (otherMember) {
              const u = await ctx.db.get(otherMember.userId);
              if (u) {
                otherUser = { _id: u._id, name: u.name, avatarUrl: u.avatarUrl, presenceStatus: u.presenceStatus };
              }
            }
          }

          return {
            ...conv,
            unreadCount: m.unreadCount,
            isMuted: m.isMuted,
            lastReadAt: m.lastReadAt,
            otherUser,
            // Map desktop fields to what ConversationList expects
            lastMessagePreview: conv.lastMessageText
              ? (conv.lastMessageSenderId
                ? conv.lastMessageText
                : conv.lastMessageText)
              : undefined,
          };
        })
    );

    return conversations
      .filter(Boolean)
      .sort((a, b) => {
        if (a!.isPinned && !b!.isPinned) return -1;
        if (!a!.isPinned && b!.isPinned) return 1;
        return (b!.lastMessageAt ?? b!.createdAt) - (a!.lastMessageAt ?? a!.createdAt);
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET CONVERSATION MESSAGES — uses chatMessages
// ─────────────────────────────────────────────────────────────────────────────
export const getConversationMessages = query({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!membership) return [];

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("desc")
      .take(50);

    const enriched = await Promise.all(
      messages.map(async (m) => {
        // Skip messages deleted for this user
        const deletedForUsers: Id<"users">[] = (m.deletedForUsers as Id<"users">[] | undefined) ?? [];
        if (deletedForUsers.includes(userId)) return null;

        const sender = await ctx.db.get(m.senderId);
        return {
          ...m,
          senderName: sender?.name ?? "Unknown",
          senderAvatarUrl: sender?.avatarUrl,
          readBy: (m.readBy as Array<{ userId: string; readAt: number }> | undefined) ?? [],
        };
      })
    );

    return enriched.filter(Boolean).reverse();
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET CONVERSATION INFO — participants + metadata
// ─────────────────────────────────────────────────────────────────────────────
export const getConversationInfo = query({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!membership) throw new Error("Not a member");

    const conv = await ctx.db.get(conversationId);
    if (!conv) throw new Error("Conversation not found");

    const members = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();

    const enrichedParticipants = await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          ...m,
          // Map to expected shape
          userId: m.userId,
          userName: user?.name ?? "Unknown",
          userAvatarUrl: user?.avatarUrl,
          userEmail: user?.email,
          userRole: user?.role,
          userDepartment: user?.department,
        };
      })
    );

    return {
      ...conv,
      // Map desktop type to mobile type for UI compat
      type: conv.type === "direct" ? "personal" as const : "group" as const,
      participants: enrichedParticipants,
      myRole: membership.role,
      isMuted: membership.isMuted,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET OR CREATE DM — 1-on-1 chat using chatConversations
// ─────────────────────────────────────────────────────────────────────────────
export const getOrCreatePersonalConversation = mutation({
  args: {
    userId: v.id("users"),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, { userId, otherUserId }) => {
    if (userId === otherUserId) throw new Error("Cannot create conversation with yourself");

    const orgId = await getUserOrgId(ctx, userId);
    const ids = [userId, otherUserId].sort();
    const dmKey = ids.join("_");

    // Check existing DM
    const existing = await ctx.db
      .query("chatConversations")
      .withIndex("by_dm_key", (q) => q.eq("dmKey", dmKey))
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    const convId = await ctx.db.insert("chatConversations", {
      organizationId: orgId,
      type: "direct",
      createdBy: userId,
      dmKey,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("chatMembers", {
      conversationId: convId,
      userId,
      organizationId: orgId,
      role: "member",
      unreadCount: 0,
      isMuted: false,
      joinedAt: now,
    });

    await ctx.db.insert("chatMembers", {
      conversationId: convId,
      userId: otherUserId,
      organizationId: orgId,
      role: "member",
      unreadCount: 0,
      isMuted: false,
      joinedAt: now,
    });

    return convId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET UNREAD MESSAGE COUNT — total badge
// ─────────────────────────────────────────────────────────────────────────────
export const getUnreadMessageCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query("chatMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let total = 0;
    for (const m of memberships) {
      if (m.isMuted || m.isDeleted) continue;
      total += m.unreadCount;
    }
    return total;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET TOTAL UNREAD — unified version matching web signature
// ─────────────────────────────────────────────────────────────────────────────
export const getTotalUnread = query({
  args: { 
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations"))
  },
  handler: async (ctx, { userId, organizationId }) => {
    const memberships = await ctx.db
      .query("chatMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let total = 0;
    for (const m of memberships) {
      if (m.isMuted || m.isDeleted) continue;
      total += m.unreadCount;
    }
    return total;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SEND MESSAGE — uses chatMessages
// ─────────────────────────────────────────────────────────────────────────────
export const sendMessage = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    senderId: v.id("users"),
    type: v.union(v.literal("text"), v.literal("file"), v.literal("image"), v.literal("system")),
    content: v.string(),
    mentions: v.optional(v.array(v.id("users"))),
    attachments: v.optional(v.array(v.object({
      url: v.string(),
      name: v.string(),
      type: v.string(),
      size: v.number(),
    }))),
    replyToId: v.optional(v.id("chatMessages")),
    poll: v.optional(v.object({
      question: v.string(),
      options: v.array(v.object({
        id: v.string(),
        text: v.string(),
        votes: v.array(v.id("users")),
      })),
      closedAt: v.optional(v.number()),
    })),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.senderId)
      )
      .first();
    if (!membership) throw new Error("Not a member");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");

    const now = Date.now();

    // Resolve reply preview
    let replyToContent: string | undefined;
    let replyToSenderName: string | undefined;
    if (args.replyToId) {
      const replyMsg = await ctx.db.get(args.replyToId);
      if (replyMsg) {
        replyToContent = replyMsg.content.slice(0, 100);
        const replyUser = await ctx.db.get(replyMsg.senderId);
        replyToSenderName = replyUser?.name;
      }
    }

    const messageId = await ctx.db.insert("chatMessages", {
      conversationId: args.conversationId,
      organizationId: conv.organizationId,
      senderId: args.senderId,
      type: args.type,
      content: args.content,
      attachments: args.attachments,
      replyToId: args.replyToId,
      replyToContent,
      replyToSenderName,
      mentionedUserIds: args.mentions,
      poll: args.poll,
      createdAt: now,
    });

    // Update conversation last message
    const preview = args.content.length > 60 ? args.content.slice(0, 60) + "…" : args.content;
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessageText: preview,
      lastMessageSenderId: args.senderId,
      updatedAt: now,
    });

    // Increment unread for other members + stamp readBy delivered
    const members = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const recipientIds = members
      .filter((m) => m.userId !== args.senderId)
      .map((m) => ({ userId: m.userId, readAt: -1 }));

    if (recipientIds.length > 0) {
      await ctx.db.patch(messageId, { readBy: recipientIds });
    }

    await Promise.all(
      members
        .filter((m) => m.userId !== args.senderId && !m.isMuted)
        .map((m) => {
          const patch: Record<string, any> = { unreadCount: m.unreadCount + 1 };
          if (m.isDeleted) {
            patch.isDeleted = false;
            patch.deletedAt = undefined;
          }
          return ctx.db.patch(m._id, patch);
        })
    );

    // Mention notifications
    if (args.mentions && args.mentions.length > 0) {
      const sender = await ctx.db.get(args.senderId);
      for (const mentionedId of args.mentions) {
        if (mentionedId === args.senderId) continue;
        await ctx.db.insert("notifications", {
          organizationId: conv.organizationId,
          userId: mentionedId,
          type: "message_mention",
          title: "💬 You were mentioned",
          message: `${sender?.name ?? "Someone"} mentioned you: "${args.content.slice(0, 80)}"`,
          isRead: false,
          relatedId: args.conversationId,
          createdAt: now,
        });
      }
    }

    return messageId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE GROUP CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────
export const createGroupConversation = mutation({
  args: {
    creatorId: v.id("users"),
    name: v.string(),
    participantIds: v.array(v.id("users")),
  },
  handler: async (ctx, { creatorId, name, participantIds }) => {
    const orgId = await getUserOrgId(ctx, creatorId);
    const now = Date.now();

    const convId = await ctx.db.insert("chatConversations", {
      organizationId: orgId,
      type: "group",
      name,
      createdBy: creatorId,
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as owner
    await ctx.db.insert("chatMembers", {
      conversationId: convId,
      userId: creatorId,
      organizationId: orgId,
      role: "owner",
      unreadCount: 0,
      isMuted: false,
      joinedAt: now,
    });

    // Add participants
    const uniqueIds = [...new Set(participantIds.filter((id) => id !== creatorId))];
    for (const uid of uniqueIds) {
      await ctx.db.insert("chatMembers", {
        conversationId: convId,
        userId: uid,
        organizationId: orgId,
        role: "member",
        unreadCount: 0,
        isMuted: false,
        joinedAt: now,
      });
    }

    // System message
    const creator = await ctx.db.get(creatorId);
    await ctx.db.insert("chatMessages", {
      conversationId: convId,
      organizationId: orgId,
      senderId: creatorId,
      type: "system",
      content: `${creator?.name ?? "Someone"} created the group "${name}"`,
      createdAt: now,
    });

    return convId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ADD PARTICIPANTS
// ─────────────────────────────────────────────────────────────────────────────
export const addParticipants = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    adminUserId: v.id("users"),
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, { conversationId, adminUserId, userIds }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv || conv.type !== "group") throw new Error("Not a group conversation");

    const adminM = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", adminUserId)
      )
      .first();
    if (!adminM || (adminM.role !== "owner" && adminM.role !== "admin")) throw new Error("Not authorized");

    const now = Date.now();
    const admin = await ctx.db.get(adminUserId);
    const addedNames: string[] = [];

    for (const uid of userIds) {
      const existing = await ctx.db
        .query("chatMembers")
        .withIndex("by_conversation_user", (q) =>
          q.eq("conversationId", conversationId).eq("userId", uid)
        )
        .first();
      if (existing) continue;

      await ctx.db.insert("chatMembers", {
        conversationId,
        userId: uid,
        organizationId: conv.organizationId,
        role: "member",
        unreadCount: 0,
        isMuted: false,
        joinedAt: now,
      });

      const user = await ctx.db.get(uid);
      if (user) addedNames.push(user.name);
    }

    if (addedNames.length > 0) {
      await ctx.db.insert("chatMessages", {
        conversationId,
        organizationId: conv.organizationId,
        senderId: adminUserId,
        type: "system",
        content: `${admin?.name ?? "Admin"} added ${addedNames.join(", ")}`,
        createdAt: now,
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE PARTICIPANT
// ─────────────────────────────────────────────────────────────────────────────
export const removeParticipant = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    adminUserId: v.id("users"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, { conversationId, adminUserId, targetUserId }) => {
    const adminM = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", adminUserId)
      )
      .first();
    if (!adminM || (adminM.role !== "owner" && adminM.role !== "admin")) throw new Error("Not authorized");

    const targetM = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", targetUserId)
      )
      .first();
    if (!targetM) throw new Error("User is not a member");

    await ctx.db.delete(targetM._id);

    const conv = await ctx.db.get(conversationId);
    const admin = await ctx.db.get(adminUserId);
    const target = await ctx.db.get(targetUserId);
    if (conv) {
      await ctx.db.insert("chatMessages", {
        conversationId,
        organizationId: conv.organizationId,
        senderId: adminUserId,
        type: "system",
        content: `${admin?.name ?? "Admin"} removed ${target?.name ?? "a member"}`,
        createdAt: Date.now(),
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────
export const leaveConversation = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!membership) return;

    await ctx.db.delete(membership._id);

    const conv = await ctx.db.get(conversationId);
    const user = await ctx.db.get(userId);
    if (conv) {
      await ctx.db.insert("chatMessages", {
        conversationId,
        organizationId: conv.organizationId,
        senderId: userId,
        type: "system",
        content: `${user?.name ?? "A member"} left the group`,
        createdAt: Date.now(),
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE CONVERSATION — name
// ─────────────────────────────────────────────────────────────────────────────
export const updateConversation = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, userId, name }) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) throw new Error("Not authorized");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (name !== undefined) patch.name = name;
    await ctx.db.patch(conversationId, patch);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK CONVERSATION READ
// ─────────────────────────────────────────────────────────────────────────────
export const markConversationRead = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!membership) return;

    const now = Date.now();
    await ctx.db.patch(membership._id, { lastReadAt: now, unreadCount: 0 });

    // Stamp readBy on recent unread messages
    const recent = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("desc")
      .take(20);

    for (const msg of recent) {
      if (msg.senderId === userId) continue;
      const readBy: Array<{ userId: Id<"users">; readAt: number }> = (msg.readBy as any) ?? [];
      const existing = readBy.find((r) => r.userId === userId);
      if (existing && existing.readAt > 0) continue; // Already read
      // Update delivered (-1) to read, or add new entry
      const updated = readBy.filter((r) => r.userId !== userId);
      updated.push({ userId, readAt: now });
      await ctx.db.patch(msg._id, { readBy: updated });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE MESSAGE — soft delete
// ─────────────────────────────────────────────────────────────────────────────
export const deleteMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    userId: v.id("users"),
  },
  handler: async (ctx, { messageId, userId }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");
    if (message.senderId !== userId) throw new Error("Can only delete your own messages");

    await ctx.db.patch(messageId, { isDeleted: true, deletedAt: Date.now() });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE MUTE
// ─────────────────────────────────────────────────────────────────────────────
export const toggleMute = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!membership) throw new Error("Not a member");

    await ctx.db.patch(membership._id, { isMuted: !membership.isMuted });
    return !membership.isMuted;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE REACTION
// ─────────────────────────────────────────────────────────────────────────────
function emojiToKey(emoji: string): string {
  return [...emoji].map((c) => "u" + c.codePointAt(0)!.toString(16)).join("_");
}

export const toggleReaction = mutation({
  args: {
    messageId: v.id("chatMessages"),
    userId: v.id("users"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    const emojiKey = emojiToKey(args.emoji);
    const reactions: Record<string, string[]> = (msg.reactions as any) ?? {};
    const users = reactions[emojiKey] ?? [];
    const idx = users.indexOf(args.userId);

    if (idx >= 0) {
      users.splice(idx, 1);
      if (users.length === 0) delete reactions[emojiKey];
      else reactions[emojiKey] = users;
    } else {
      reactions[emojiKey] = [...users, args.userId];
    }

    await ctx.db.patch(args.messageId, {
      reactions: Object.keys(reactions).length > 0 ? reactions : undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SET TYPING
// ─────────────────────────────────────────────────────────────────────────────
export const setTyping = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chatTyping")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.userId)
      )
      .first();

    if (args.isTyping) {
      if (existing) {
        await ctx.db.patch(existing._id, { updatedAt: Date.now() });
      } else {
        const orgId = await getUserOrgId(ctx, args.userId);
        await ctx.db.insert("chatTyping", {
          conversationId: args.conversationId,
          userId: args.userId,
          organizationId: orgId,
          updatedAt: Date.now(),
        });
      }
    } else {
      if (existing) await ctx.db.delete(existing._id);
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET TYPING USERS
// ─────────────────────────────────────────────────────────────────────────────
export const getTypingUsers = query({
  args: {
    conversationId: v.id("chatConversations"),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 5000;
    const typing = await ctx.db
      .query("chatTyping")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const active = typing.filter(
      (t) => t.userId !== args.currentUserId && t.updatedAt > cutoff
    );

    return Promise.all(
      active.map(async (t) => {
        const user = await ctx.db.get(t.userId);
        return { userId: t.userId, name: user?.name ?? "Someone" };
      })
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SEND THREAD REPLY
// ─────────────────────────────────────────────────────────────────────────────
export const sendThreadReply = mutation({
  args: {
    parentMessageId: v.id("chatMessages"),
    conversationId: v.id("chatConversations"),
    senderId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");

    const now = Date.now();
    const replyId = await ctx.db.insert("chatMessages", {
      conversationId: args.conversationId,
      organizationId: conv.organizationId,
      senderId: args.senderId,
      type: "text",
      content: args.content,
      parentMessageId: args.parentMessageId,
      createdAt: now,
    });

    const parent = await ctx.db.get(args.parentMessageId);
    if (parent) {
      await ctx.db.patch(args.parentMessageId, {
        threadCount: (parent.threadCount ?? 0) + 1,
        threadLastAt: now,
      });
    }

    const sender = await ctx.db.get(args.senderId);
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessageText: `${sender?.name ?? "Someone"}: ${args.content.slice(0, 60)}`,
      lastMessageSenderId: args.senderId,
      updatedAt: now,
    });

    return replyId;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET THREAD REPLIES
// ─────────────────────────────────────────────────────────────────────────────
export const getThreadReplies = query({
  args: { parentMessageId: v.id("chatMessages") },
  handler: async (ctx, args) => {
    const replies = await ctx.db
      .query("chatMessages")
      .filter((q) => q.eq(q.field("parentMessageId"), args.parentMessageId))
      .order("asc")
      .collect();

    return Promise.all(
      replies
        .filter((r) => !r.isDeleted)
        .map(async (r) => {
          const sender = await ctx.db.get(r.senderId);
          return {
            ...r,
            senderName: sender?.name ?? "Unknown",
            senderAvatarUrl: sender?.avatarUrl,
          };
        })
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PIN MESSAGE
// ─────────────────────────────────────────────────────────────────────────────
export const pinMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    userId: v.id("users"),
    pin: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      isPinned: args.pin,
      pinnedBy: args.pin ? args.userId : undefined,
      pinnedAt: args.pin ? Date.now() : undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET PINNED MESSAGES
// ─────────────────────────────────────────────────────────────────────────────
export const getPinnedMessages = query({
  args: { conversationId: v.id("chatConversations") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_pinned", (q) =>
        q.eq("conversationId", args.conversationId).eq("isPinned", true)
      )
      .collect();

    return Promise.all(
      messages
        .filter((m) => !m.isDeleted)
        .map(async (msg) => {
          const sender = await ctx.db.get(msg.senderId);
          return {
            ...msg,
            senderName: sender?.name ?? "Unknown",
            senderAvatarUrl: sender?.avatarUrl,
          };
        })
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH MESSAGES
// ─────────────────────────────────────────────────────────────────────────────
export const searchMessages = query({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.userId)
      )
      .first();
    if (!membership) return [];

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const q = args.query.toLowerCase();
    const matches = messages
      .filter((m) => !m.isDeleted && m.content.toLowerCase().includes(q))
      .slice(-20);

    return Promise.all(
      matches.map(async (m) => {
        const sender = await ctx.db.get(m.senderId);
        return {
          ...m,
          senderName: sender?.name ?? "Unknown",
          senderAvatarUrl: sender?.avatarUrl,
        };
      })
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// EDIT MESSAGE
// ─────────────────────────────────────────────────────────────────────────────
export const editMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    userId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, { messageId, userId, content }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");
    if (message.senderId !== userId) throw new Error("Can only edit your own messages");

    await ctx.db.patch(messageId, {
      content,
      isEdited: true,
      editedAt: Date.now(),
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Alias for backward compat
// ─────────────────────────────────────────────────────────────────────────────
export const markMessagesRead = markConversationRead;

// ─────────────────────────────────────────────────────────────────────────────
// CALLS - Audio/Video calling using WebRTC (similar to web version)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start a call in a conversation
 * Creates a call record and notifies participants
 */
export const startCall = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    initiatorId: v.id("users"),
    callType: v.union(v.literal("audio"), v.literal("video")),
  },
  handler: async (ctx, { conversationId, initiatorId, callType }) => {
    const conv = await ctx.db.get(conversationId);
    if (!conv) throw new Error("Conversation not found");

    const initiator = await ctx.db.get(initiatorId);
    if (!initiator) throw new Error("Initiator not found");

    const now = Date.now();
    const callId = await ctx.db.insert("chatMessages", {
      conversationId,
      organizationId: conv.organizationId,
      senderId: initiatorId,
      type: "call",
      content: `${initiator.name} started a ${callType} call`,
      callType,
      callStatus: "missed", // Will be updated when answered
      createdAt: now,
    });

    // Set initiator status to "in_call"
    await ctx.db.patch(initiatorId, { presenceStatus: "in_call" });

    return { callId, conversationId };
  },
});

/**
 * Answer an incoming call
 */
export const answerCall = mutation({
  args: {
    callMessageId: v.id("chatMessages"),
    userId: v.id("users"),
  },
  handler: async (ctx, { callMessageId, userId }) => {
    const call = await ctx.db.get(callMessageId);
    if (!call) throw new Error("Call not found");

    // Update call status to answered
    await ctx.db.patch(callMessageId, {
      callStatus: "answered",
      content: `Call answered`,
    });

    // Set user status to "in_call"
    await ctx.db.patch(userId, { presenceStatus: "in_call" });

    return callMessageId;
  },
});

/**
 * End a call
 */
export const endCall = mutation({
  args: {
    callMessageId: v.id("chatMessages"),
    userId: v.id("users"),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, { callMessageId, userId, duration }) => {
    const call = await ctx.db.get(callMessageId);
    if (!call) throw new Error("Call not found");

    // Update call with duration
    const patch: Record<string, any> = {
      callDuration: duration,
      content: `Call ended (${duration ? Math.floor(duration / 60) : 0}m ${duration ? duration % 60 : 0}s)`,
    };

    await ctx.db.patch(callMessageId, patch);

    // Reset user status to "available"
    await ctx.db.patch(userId, { presenceStatus: "available" });

    return callMessageId;
  },
});

/**
 * Decline an incoming call
 */
export const declineCall = mutation({
  args: {
    callMessageId: v.id("chatMessages"),
    userId: v.id("users"),
  },
  handler: async (ctx, { callMessageId, userId }) => {
    const call = await ctx.db.get(callMessageId);
    if (!call) throw new Error("Call not found");

    await ctx.db.patch(callMessageId, {
      callStatus: "declined",
      content: `Call declined`,
    });

    // Reset initiator status
    await ctx.db.patch(call.senderId, { presenceStatus: "available" });

    return callMessageId;
  },
});

/**
 * Get active call info for a conversation
 */
export const getActiveCall = query({
  args: {
    conversationId: v.id("chatConversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(5);

    // Find the most recent call message that's still active
    const activeCall = messages.find(
      (m) => m.type === "call" && (m.callStatus === "answered" || m.callStatus === "missed")
    );

    if (!activeCall) return null;

    const initiator = await ctx.db.get(activeCall.senderId);

    return {
      callId: activeCall._id,
      conversationId,
      type: activeCall.callType,
      initiatorId: activeCall.senderId,
      initiatorName: initiator?.name ?? "Unknown",
      status: activeCall.callStatus,
      createdAt: activeCall.createdAt,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PIN CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────
export const pinConversation = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
    pin: v.boolean(),
  },
  handler: async (ctx, { conversationId, userId, pin }) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!membership) throw new Error("Not a member");

    await ctx.db.patch(conversationId, { isPinned: pin });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────
export const archiveConversation = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
    archive: v.boolean(),
  },
  handler: async (ctx, { conversationId, userId, archive }) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!membership) throw new Error("Not a member");

    await ctx.db.patch(conversationId, { isArchived: archive });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CONVERSATION (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteConversation = mutation({
  args: {
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const membership = await ctx.db
      .query("chatMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!membership) throw new Error("Not a member");

    await ctx.db.patch(membership._id, {
      isDeleted: true,
      deletedAt: Date.now(),
    });
  },
});

/**
 * Get incoming calls for a user
 */
export const getIncomingCalls = query({
  args: {
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { userId, organizationId }) => {
    // Get all conversations for this user
    const memberships = await ctx.db
      .query("chatMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Find active calls in these conversations
    for (const membership of memberships) {
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", membership.conversationId))
        .order("desc")
        .take(3);

      const incomingCall = messages.find(
        (m) => m.type === "call" && m.senderId !== userId && m.callStatus === "missed"
      );

      if (incomingCall) {
        const initiator = await ctx.db.get(incomingCall.senderId);
        return {
          callId: incomingCall._id,
          conversationId: incomingCall.conversationId,
          type: incomingCall.callType,
          initiatorId: incomingCall.senderId,
          initiatorName: initiator?.name ?? "Unknown",
          status: incomingCall.callStatus,
          createdAt: incomingCall.createdAt,
        };
      }
    }

    return null;
  },
});
