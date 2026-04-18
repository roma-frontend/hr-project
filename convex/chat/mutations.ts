import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

/**
 * Convert emoji to ASCII-safe key format using Unicode code points
 * Example: 👍 → "u1f44d", ❤️ → "u2764_ufe0f"
 */
function emojiToKey(emoji: string): string {
  const codePoints: string[] = [];
  for (const char of emoji) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined) {
      codePoints.push('u' + codePoint.toString(16).toLowerCase());
    }
  }
  return codePoints.join('_');
}

// ─── CONVERSATIONS ────────────────────────────────────────────────────────────

/** Get or create a direct message conversation between two users */
export const getOrCreateDM = mutation({
  args: {
    organizationId: v.optional(v.id('organizations')),
    currentUserId: v.id('users'),
    targetUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const ids = [args.currentUserId, args.targetUserId].sort();
    const dmKey = ids.join('_');

    const existing = await ctx.db
      .query('chatConversations')
      .withIndex('by_dm_key', (q) => q.eq('dmKey', dmKey))
      .first();

    if (existing) return existing._id;

    const now = Date.now();
    const convId = await ctx.db.insert('chatConversations', {
      organizationId: args.organizationId,
      type: 'direct',
      createdBy: args.currentUserId,
      dmKey,
      createdAt: now,
      updatedAt: now,
    });

    // Add both members
    await ctx.db.insert('chatMembers', {
      conversationId: convId,
      userId: args.currentUserId,
      organizationId: args.organizationId,
      role: 'member',
      unreadCount: 0,
      isMuted: false,
      joinedAt: now,
    });
    await ctx.db.insert('chatMembers', {
      conversationId: convId,
      userId: args.targetUserId,
      organizationId: args.organizationId,
      role: 'member',
      unreadCount: 0,
      isMuted: false,
      joinedAt: now,
    });

    return convId;
  },
});

/** Create a group conversation */
export const createGroup = mutation({
  args: {
    organizationId: v.optional(v.id('organizations')),
    createdBy: v.id('users'),
    name: v.string(),
    description: v.optional(v.string()),
    memberIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const convId = await ctx.db.insert('chatConversations', {
      organizationId: args.organizationId,
      type: 'group',
      name: args.name,
      description: args.description,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as owner
    await ctx.db.insert('chatMembers', {
      conversationId: convId,
      userId: args.createdBy,
      organizationId: args.organizationId,
      role: 'owner',
      unreadCount: 0,
      isMuted: false,
      joinedAt: now,
    });

    // Add other members
    for (const uid of args.memberIds) {
      if (uid === args.createdBy) continue;
      await ctx.db.insert('chatMembers', {
        conversationId: convId,
        userId: uid,
        organizationId: args.organizationId,
        role: 'member',
        unreadCount: 0,
        isMuted: false,
        joinedAt: now,
      });
    }

    // System message
    await ctx.db.insert('chatMessages', {
      conversationId: convId,
      organizationId: args.organizationId,
      senderId: args.createdBy,
      type: 'system',
      content: `Group "${args.name}" was created`,
      createdAt: now,
    });

    return convId;
  },
});

/** Update group info */
export const updateGroup = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId),
      )
      .first();
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new Error('Not authorized');
    }
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    await ctx.db.patch(args.conversationId, updates);
  },
});

/** Add member to group */
export const addMember = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    requesterId: v.id('users'),
    userId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId),
      )
      .first();
    if (existing) return;

    const now = Date.now();
    await ctx.db.insert('chatMembers', {
      conversationId: args.conversationId,
      userId: args.userId,
      organizationId: args.organizationId,
      role: 'member',
      unreadCount: 0,
      isMuted: false,
      joinedAt: now,
    });

    const user = await ctx.db.get(args.userId);
    await ctx.db.insert('chatMessages', {
      conversationId: args.conversationId,
      organizationId: args.organizationId,
      senderId: args.requesterId,
      type: 'system',
      content: `${user?.name ?? 'Someone'} was added to the group`,
      createdAt: now,
    });
  },
});

/** Leave / remove from group */
export const leaveConversation = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId),
      )
      .first();
    if (!membership) return;
    await ctx.db.delete(membership._id);

    const user = await ctx.db.get(args.userId);
    const conv = await ctx.db.get(args.conversationId);
    if (conv) {
      await ctx.db.insert('chatMessages', {
        conversationId: args.conversationId,
        organizationId: conv.organizationId as Id<'organizations'>,
        senderId: args.userId,
        type: 'system',
        content: `${user?.name ?? 'Someone'} left the group`,
        createdAt: Date.now(),
      });
    }
  },
});

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

/** Send a message */
export const sendMessage = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    senderId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    type: v.union(
      v.literal('text'),
      v.literal('image'),
      v.literal('file'),
      v.literal('audio'),
      v.literal('system'),
      v.literal('call'),
    ),
    content: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          url: v.string(),
          name: v.string(),
          type: v.string(),
          size: v.number(),
        }),
      ),
    ),
    replyToId: v.optional(v.id('chatMessages')),
    mentionedUserIds: v.optional(v.array(v.id('users'))),
    poll: v.optional(
      v.object({
        question: v.string(),
        options: v.array(
          v.object({
            id: v.string(),
            text: v.string(),
            votes: v.array(v.id('users')),
          }),
        ),
        closedAt: v.optional(v.number()),
      }),
    ),
    audioDuration: v.optional(v.number()), // Duration in seconds for voice messages
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if trying to send to System Announcements channel
    const conversation = await ctx.db.get(args.conversationId);
    if (conversation?.name === 'System Announcements') {
      const sender = await ctx.db.get(args.senderId);
      if (!sender || sender.role !== 'superadmin') {
        throw new Error('Only superadmin can send messages to System Announcements channel');
      }
    }

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

    const msgId = await ctx.db.insert('chatMessages', {
      conversationId: args.conversationId,
      organizationId: args.organizationId,
      senderId: args.senderId,
      type: args.type,
      content: args.content,
      attachments: args.attachments,
      replyToId: args.replyToId,
      replyToContent,
      replyToSenderName,
      mentionedUserIds: args.mentionedUserIds,
      poll: args.poll,
      callDuration: args.audioDuration, // Reuse for voice message duration
      createdAt: now,
    });

    // Update conversation last message
    const preview = args.content.length > 60 ? args.content.slice(0, 60) + '…' : args.content;
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessageText: preview,
      lastMessageSenderId: args.senderId,
      updatedAt: now,
    });

    // Increment unread counts for all members except sender
    // Also stamp readBy with readAt:-1 (delivered) for each online recipient
    const members = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
      .collect();

    const recipientIds: Array<{ userId: Id<'users'>; readAt: number }> = members
      .filter((m) => m.userId !== args.senderId)
      .map((m) => ({ userId: m.userId, readAt: -1 }));

    // Patch readBy on the new message with delivered stamps
    if (recipientIds.length > 0) {
      await ctx.db.patch(msgId, { readBy: recipientIds });
    }

    await Promise.all(
      members
        .filter((m) => m.userId !== args.senderId && !m.isMuted)
        .map((m) => {
          // Don't increment unreadCount if user just marked conversation as read in the last 500ms
          const recentlyRead = m.lastReadAt && now - m.lastReadAt < 500;
          if (recentlyRead) {
            return Promise.resolve();
          }
          // If the member had soft-deleted this conversation, restore it so they see the new message
          const patch: Record<string, number | boolean | undefined> = {
            unreadCount: m.unreadCount + 1,
          };
          if (m.isDeleted) {
            patch.isDeleted = false;
            patch.deletedAt = undefined;
          }
          return ctx.db.patch(m._id, patch);
        }),
    );

    // Send notification for mentions
    if (args.mentionedUserIds && args.mentionedUserIds.length > 0) {
      const sender = await ctx.db.get(args.senderId);
      for (const mentionedId of args.mentionedUserIds) {
        if (mentionedId === args.senderId) continue;
        await ctx.db.insert('notifications', {
          organizationId: args.organizationId,
          userId: mentionedId,
          type: 'system',
          title: `${sender?.name ?? 'Someone'} mentioned you`,
          message: args.content.slice(0, 100),
          isRead: false,
          relatedId: args.conversationId,
          createdAt: now,
        });
      }
    }

    return msgId;
  },
});

/** Edit a message */
export const editMessage = mutation({
  args: {
    messageId: v.id('chatMessages'),
    userId: v.id('users'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.senderId !== args.userId) throw new Error('Not authorized');
    await ctx.db.patch(args.messageId, {
      content: args.content,
      isEdited: true,
      editedAt: Date.now(),
    });
  },
});

/** Delete a message only for the requesting user (hide from their view). For senders, can also delete for everyone within 5 minutes */
export const deleteMessage = mutation({
  args: {
    messageId: v.id('chatMessages'),
    userId: v.id('users'),
    deleteForEveryone: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) {
      throw new Error('Message not found');
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isSuperadmin = user.role === 'superadmin';

    // If deleteForEveryone flag is set, sender can delete for everyone within 5 minutes (or superadmin anytime)
    if (args.deleteForEveryone) {
      // Superadmin can delete ANY message without time limit
      if (isSuperadmin) {
        await ctx.db.patch(args.messageId, {
          isDeleted: true,
          deletedAt: Date.now(),
          content: 'This message was deleted',
        });
        return;
      }

      // Regular messages: only sender (within 5 minutes)
      if (msg.senderId !== args.userId) {
        throw new Error('Not authorized');
      }

      const fiveMin = 5 * 60 * 1000;
      const timeSinceCreation = Date.now() - msg.createdAt;
      if (timeSinceCreation > fiveMin) {
        throw new Error('Cannot delete after 5 minutes');
      }

      // Fully delete for everyone
      await ctx.db.patch(args.messageId, {
        isDeleted: true,
        deletedAt: Date.now(),
        content: 'This message was deleted',
      });
    } else {
      // Delete only for current user
      const existing: Id<'users'>[] = (msg.deletedForUsers as Id<'users'>[] | undefined) ?? [];
      if (!existing.includes(args.userId)) {
        await ctx.db.patch(args.messageId, {
          deletedForUsers: [...existing, args.userId],
        });
      }
    }
  },
});

/** Delete a message only for the requesting user (hide from their view) */
export const deleteMessageForMe = mutation({
  args: {
    messageId: v.id('chatMessages'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error('Message not found');
    const existing: Id<'users'>[] = (msg.deletedForUsers as Id<'users'>[] | undefined) ?? [];
    if (!existing.includes(args.userId)) {
      await ctx.db.patch(args.messageId, {
        deletedForUsers: [...existing, args.userId],
      });
    }
  },
});

/** Toggle reaction on a message */
export const toggleReaction = mutation({
  args: {
    messageId: v.id('chatMessages'),
    userId: v.id('users'),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error('Message not found');

    // Sanitize emoji: trim whitespace
    const sanitizedEmoji = args.emoji.trim();

    if (!sanitizedEmoji) {
      throw new Error('Invalid emoji');
    }

    // Convert emoji to ASCII-safe key since Convex doesn't allow non-ASCII field names
    const emojiKey = emojiToKey(sanitizedEmoji);

    // Get existing reactions - safely handle potentially malformed data
    const rawReactions = msg.reactions;
    const reactions: Record<string, Id<'users'>[]> = {};

    // Clean up existing reactions - migrate old emoji keys to new format if needed
    if (rawReactions && typeof rawReactions === 'object') {
      for (const [key, value] of Object.entries(rawReactions)) {
        // Try to detect if this is already an old-format emoji key (contains non-ASCII)
        // If so, try to convert it, otherwise assume it's already in new format
        const safeKey = key;
        try {
          // If key contains non-ASCII chars, it's an old format - skip it
          if (!/^[a-z0-9_]+$/.test(key)) {
            continue;
          }
        } catch {
          continue;
        }

        if (safeKey && Array.isArray(value) && value.length > 0) {
          reactions[safeKey] = value as Id<'users'>[];
        }
      }
    }

    // Toggle the reaction using the ASCII-safe key
    const users = reactions[emojiKey] ?? [];
    const idx = users.indexOf(args.userId);

    if (idx >= 0) {
      users.splice(idx, 1);
    } else {
      users.push(args.userId);
    }

    if (users.length === 0) {
      delete reactions[emojiKey];
    } else {
      reactions[emojiKey] = users;
    }

    await ctx.db.patch(args.messageId, { reactions });
  },
});

/** Pin / unpin a message */
export const pinMessage = mutation({
  args: {
    messageId: v.id('chatMessages'),
    userId: v.id('users'),
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

/** Mark conversation as read for a user + stamp readBy on recent messages */
export const markAsRead = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId),
      )
      .first();
    if (!membership) return;
    const now = Date.now();
    await ctx.db.patch(membership._id, {
      unreadCount: 0,
      lastReadAt: now,
    });

    // Stamp readBy on the last 20 messages not sent by this user
    const recent = await ctx.db
      .query('chatMessages')
      .withIndex('by_conversation_created', (q) => q.eq('conversationId', args.conversationId))
      .order('desc')
      .take(20);

    for (const msg of recent) {
      if (msg.senderId === args.userId) continue;
      const readBy: Array<{ userId: Id<'users'>; readAt: number }> =
        (msg.readBy as Array<{ userId: Id<'users'>; readAt: number }> | undefined) ?? [];
      if (readBy.some((r) => r.userId === args.userId)) continue;
      await ctx.db.patch(msg._id, {
        readBy: [...readBy, { userId: args.userId, readAt: now }],
      });
    }
  },
});

/** Mark a single sent message as delivered (called after sendMessage on the recipient side) */
export const markMessageDelivered = mutation({
  args: {
    messageId: v.id('chatMessages'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.senderId === args.userId) return;
    const readBy: Array<{ userId: Id<'users'>; readAt: number }> =
      (msg.readBy as Array<{ userId: Id<'users'>; readAt: number }> | undefined) ?? [];
    if (readBy.some((r) => r.userId === args.userId)) return;
    // We reuse readBy array but with readAt = 0 to mean "delivered not yet read"
    // Actually let's use a separate delivered approach: just stamp with readAt = -1
    await ctx.db.patch(args.messageId, {
      readBy: [...readBy, { userId: args.userId, readAt: -1 }],
    });
  },
});

// ─── TYPING INDICATORS ────────────────────────────────────────────────────────

export const setTyping = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('chatTyping')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId),
      )
      .first();

    if (args.isTyping) {
      if (existing) {
        await ctx.db.patch(existing._id, { updatedAt: Date.now() });
      } else {
        await ctx.db.insert('chatTyping', {
          conversationId: args.conversationId,
          userId: args.userId,
          organizationId: args.organizationId,
          updatedAt: Date.now(),
        });
      }
    } else {
      if (existing) await ctx.db.delete(existing._id);
    }
  },
});

// ─── POLLS ────────────────────────────────────────────────────────────────────

/** Vote on a poll */
export const votePoll = mutation({
  args: {
    messageId: v.id('chatMessages'),
    userId: v.id('users'),
    optionId: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg?.poll) throw new Error('No poll found');
    const poll = msg.poll as {
      question: string;
      options: Array<{ id: string; text: string; votes: Id<'users'>[] }>;
      closedAt?: number;
    };
    if (poll.closedAt && Date.now() > poll.closedAt) throw new Error('Poll closed');
    const options = poll.options.map((opt) => {
      // Remove user's vote from all options first (toggle)
      const votes = opt.votes.filter((v) => v !== args.userId);
      // Add vote to selected option
      if (opt.id === args.optionId) votes.push(args.userId);
      return { ...opt, votes };
    });
    await ctx.db.patch(args.messageId, { poll: { ...poll, options } });
  },
});

/** Close a poll */
export const closePoll = mutation({
  args: { messageId: v.id('chatMessages'), userId: v.id('users') },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg?.poll) throw new Error('No poll');
    if (msg.senderId !== args.userId) throw new Error('Not authorized');
    const poll = msg.poll as {
      question: string;
      options: Array<{ id: string; text: string; votes: Id<'users'>[] }>;
      closedAt?: number;
    };
    await ctx.db.patch(args.messageId, { poll: { ...poll, closedAt: Date.now() } });
  },
});

// ─── THREADS ──────────────────────────────────────────────────────────────────

/** Send a thread reply */
export const sendThreadReply = mutation({
  args: {
    parentMessageId: v.id('chatMessages'),
    conversationId: v.id('chatConversations'),
    senderId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const replyId = await ctx.db.insert('chatMessages', {
      conversationId: args.conversationId,
      organizationId: args.organizationId,
      senderId: args.senderId,
      type: 'text',
      content: args.content,
      parentMessageId: args.parentMessageId,
      createdAt: now,
    });
    // Increment thread count on parent
    const parent = await ctx.db.get(args.parentMessageId);
    if (parent) {
      await ctx.db.patch(args.parentMessageId, {
        threadCount: (parent.threadCount ?? 0) + 1,
        threadLastAt: now,
      });
    }
    return replyId;
  },
});

// ─── SCHEDULED MESSAGES ───────────────────────────────────────────────────────

/** Schedule a message to be sent later */
export const scheduleMessage = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    senderId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    content: v.string(),
    scheduledFor: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('chatMessages', {
      conversationId: args.conversationId,
      organizationId: args.organizationId,
      senderId: args.senderId,
      type: 'text',
      content: args.content,
      scheduledFor: args.scheduledFor,
      isSent: false,
      createdAt: Date.now(),
    });
  },
});

/** Cancel a scheduled message */
export const cancelScheduledMessage = mutation({
  args: { messageId: v.id('chatMessages'), userId: v.id('users') },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.senderId !== args.userId) throw new Error('Not authorized');
    await ctx.db.delete(args.messageId);
  },
});

/** Update link preview on a message */
export const setLinkPreview = mutation({
  args: {
    messageId: v.id('chatMessages'),
    preview: v.object({
      url: v.string(),
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      image: v.optional(v.string()),
      siteName: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { linkPreview: args.preview });
  },
});

// ─── CONVERSATION MANAGEMENT ─────────────────────────────────────────────────────────

/** Toggle pin status for a conversation */
export const togglePin = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error('Conversation not found');

    const member = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
      .filter((q) => q.eq(q.field('userId'), args.userId))
      .first();

    if (!member) throw new Error('Not a member of this conversation');

    await ctx.db.patch(args.conversationId, {
      isPinned: !conv.isPinned,
      updatedAt: Date.now(),
    });
    return !conv.isPinned;
  },
});

/** Soft delete a conversation (per-user — only hides it for the requesting user) */
export const deleteConversation = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error('Conversation not found');

    const member = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId),
      )
      .first();

    if (!member) throw new Error('Not a member of this conversation');

    // Mark as deleted for THIS user only & reset unread count
    await ctx.db.patch(member._id, {
      isDeleted: true,
      deletedAt: Date.now(),
      unreadCount: 0,
    });

    // Hide all existing messages from this user (clear chat history for them)
    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_conversation_created', (q) =>
        q.eq('conversationId', args.conversationId),
      )
      .collect();

    await Promise.all(
      messages.map(async (msg) => {
        const deletedForUsers: Id<'users'>[] =
          (msg.deletedForUsers as Id<'users'>[] | undefined) ?? [];
        if (!deletedForUsers.includes(args.userId)) {
          await ctx.db.patch(msg._id, {
            deletedForUsers: [...deletedForUsers, args.userId],
          });
        }
      }),
    );
  },
});


/** Restore a deleted conversation (per-user) */
export const restoreConversation = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error('Conversation not found');

    const member = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId),
      )
      .first();

    if (!member) throw new Error('Not a member of this conversation');

    // Reset per-user flags on chatMembers
    await ctx.db.patch(member._id, {
      isDeleted: false,
      deletedAt: undefined,
      isArchived: false,
    });

    // Also restore messages for this user
    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_conversation_created', (q) =>
        q.eq('conversationId', args.conversationId),
      )
      .collect();

    await Promise.all(
      messages.map(async (msg) => {
        const deletedForUsers: Id<'users'>[] =
          (msg.deletedForUsers as Id<'users'>[] | undefined) ?? [];
        if (deletedForUsers.includes(args.userId)) {
          await ctx.db.patch(msg._id, {
            deletedForUsers: deletedForUsers.filter((id) => id !== args.userId),
          });
        }
      }),
    );

    return { success: true };
  },
});

/** Archive or unarchive a conversation (per-user) */
export const toggleArchive = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error('Conversation not found');

    const member = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId),
      )
      .first();

    if (!member) throw new Error('Not a member of this conversation');

    const newArchived = !member.isArchived;
    await ctx.db.patch(member._id, {
      isArchived: newArchived,
    });
    return newArchived;
  },
});

/** Toggle mute status for current user */
export const toggleMute = mutation({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
      .filter((q) => q.eq(q.field('userId'), args.userId))
      .first();

    if (!member) throw new Error('Not a member of this conversation');

    await ctx.db.patch(member._id, {
      isMuted: !member.isMuted,
    });
    return !member.isMuted;
  },
});

// ─── SERVICE BROADCASTS ────────────────────────────────────────────────────────

/** Send a service broadcast message from superadmin to all users in organization */
export const sendServiceBroadcast = mutation({
  args: {
    organizationId: v.optional(v.id('organizations')),
    conversationId: v.id('chatConversations'),
    senderId: v.id('users'), // the superadmin user
    title: v.string(), // e.g. "System Maintenance"
    content: v.string(), // the announcement message
    icon: v.optional(v.string()), // emoji or icon, e.g. "⚠️", "ℹ️", "🔧"
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create the service broadcast message
    const msgId = await ctx.db.insert('chatMessages', {
      conversationId: args.conversationId,
      organizationId: args.organizationId,
      senderId: args.senderId,
      type: 'system',
      content: args.content,
      isServiceBroadcast: true,
      broadcastTitle: args.title,
      broadcastIcon: args.icon || 'ℹ️',
      createdAt: now,
    });

    // Update conversation last message
    const preview = args.content.length > 60 ? args.content.slice(0, 60) + '…' : args.content;
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessageText: `[${args.title}] ${preview}`,
      lastMessageSenderId: args.senderId,
      updatedAt: now,
    });

    // Add unread count for all members except sender
    const members = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
      .collect();

    for (const member of members) {
      if (member.userId !== args.senderId) {
        await ctx.db.patch(member._id, {
          unreadCount: (member.unreadCount || 0) + 1,
        });
      }
    }

    return msgId;
  },
});
