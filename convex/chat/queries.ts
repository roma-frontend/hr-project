import { v } from 'convex/values';
import { query } from '../_generated/server';
import type { Id, Doc } from '../_generated/dataModel';
import { getUsersWithLeaveStatus } from './presence';
import { SUPERADMIN_EMAIL } from '../lib/auth';

// ─── CONVERSATIONS ────────────────────────────────────────────────────────────

/**
 * Get all conversations for a user in their organization
 * OPTIMIZED: Batch loading eliminates N+1 queries
 * - Single batch load for all conversations
 * - Single batch load for all members
 * - Single batch load for all users
 * - Single batch load for all leaves
 */
export const getMyConversations = query({
  args: {
    userId: v.id('users'),
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    // Step 1: Get all memberships for this user
    const memberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    // Step 2: Batch load all conversations
    const conversationIds = memberships.map((m) => m.conversationId);
    const conversations = await Promise.all(conversationIds.map((id) => ctx.db.get(id)));

    // Step 3: Filter valid conversations (same org, not deleted)
    const validConvs = conversations.filter((conv, idx) => {
      const membership = memberships[idx];
      if (!conv) return false;
      if (membership?.isDeleted) return false;
      if (conv.organizationId !== args.organizationId) return false;
      return true;
    });

    const validMemberships = memberships.filter((m, idx) => validConvs[idx] !== null);
    const filteredConvs = validConvs.filter(Boolean) as Array<{
      _id: Id<'chatConversations'>;
      type: 'direct' | 'group';
      createdBy: Id<'users'>;
      organizationId: Id<'organizations'>;
      lastMessageAt?: number;
      createdAt: number;
      isPinned?: boolean;
    }>;

    // Step 4: Load ALL chat members first (needed to find DM participants)
    const allChatMembers = await ctx.db.query('chatMembers').collect();

    // Step 5: Collect all user IDs that we need to load (including DM other-participants)
    const allUserIds = new Set<Id<'users'>>();

    filteredConvs.forEach((conv) => {
      allUserIds.add(conv.createdBy);

      // For DMs: also add the other participant so their name is resolved
      if (conv.type === 'direct') {
        const members = allChatMembers.filter((m) => m.conversationId === conv._id);
        const otherMember = members.find((m) => m.userId !== args.userId);
        if (otherMember) {
          allUserIds.add(otherMember.userId);
        }
      }
    });

    // Step 6: Batch load all users with leave status
    const usersWithLeaveStatus = await getUsersWithLeaveStatus(ctx, Array.from(allUserIds));
    const userMap = usersWithLeaveStatus.userMap;
    const userStatusMap = usersWithLeaveStatus.result;

    // Step 7: Build group members map
    const groupConvs = filteredConvs.filter((c) => c.type === 'group');

    const groupMembersMap = new Map<
      Id<'chatConversations'>,
      Array<{
        _id: Id<'chatMembers'>;
        userId: Id<'users'>;
        conversationId: Id<'chatConversations'>;
      }>
    >();
    groupConvs.forEach((conv) => {
      const members = allChatMembers.filter((m) => m.conversationId === conv._id);
      groupMembersMap.set(conv._id, members);
    });

    // Collect all group member user IDs
    const groupMemberUserIds = new Set<Id<'users'>>();
    Array.from(groupMembersMap.values())
      .flat()
      .forEach((m) => groupMemberUserIds.add(m.userId));

    // Load group member users
    const groupMemberUsers = await getUsersWithLeaveStatus(ctx, Array.from(groupMemberUserIds));
    const groupMemberUserMap = groupMemberUsers.userMap;

    // Step 8: Build result with pre-loaded data
    const conversationsWithDetails = filteredConvs.map((conv, idx) => {
      const membership = validMemberships[idx];

      // For DMs: get other user
      let otherUser = null;
      if (conv.type === 'direct') {
        const allMembers = allChatMembers.filter((m) => m.conversationId === conv._id);
        const otherMember = allMembers.find((m) => m.userId !== args.userId);
        if (otherMember) {
          const status = userStatusMap.get(otherMember.userId);
          otherUser = {
            _id: otherMember.userId,
            name: userMap.get(otherMember.userId)?.name || 'Unknown',
            avatarUrl: userMap.get(otherMember.userId)?.avatarUrl,
            presenceStatus: status?.presenceStatus || 'available',
          };
        }
      }

      // For groups: build members list
      let members: Array<{
        userId: Id<'users'>;
        user: { name: string; avatarUrl?: string } | null;
      }> = [];
      if (conv.type === 'group') {
        const groupMembers = groupMembersMap.get(conv._id) || [];
        members = groupMembers.map((m) => ({
          userId: m.userId,
          user: groupMemberUserMap.get(m.userId)
            ? {
                name: groupMemberUserMap.get(m.userId)!.name,
                avatarUrl: groupMemberUserMap.get(m.userId)!.avatarUrl,
              }
            : null,
        }));
      }

      const memberCount = conv.type === 'group' ? groupMembersMap.get(conv._id)?.length || 0 : 2;

      return {
        ...conv,
        membership,
        otherUser,
        memberCount,
        members,
      };
    });

    // Step 9: Sort (pinned first, then by last message time)
    return conversationsWithDetails.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt);
    });
  },
});

/** Get all members of a conversation */
export const getConversationMembers = query({
  args: { conversationId: v.id('chatConversations') },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
      .collect();

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0] || '';

    return Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        let effectivePresenceStatus = user?.presenceStatus ?? 'available';

        // Check if user has an approved leave today
        if (user && today) {
          const approvedLeaves = await ctx.db
            .query('leaveRequests')
            .withIndex('by_user', (q) => q.eq('userId', user._id))
            .filter((q) => q.eq(q.field('status'), 'approved'))
            .collect();

          const hasActiveLeave = approvedLeaves.some((leave) => {
            return leave.startDate <= today && today <= leave.endDate;
          });

          if (hasActiveLeave) {
            effectivePresenceStatus = 'out_of_office';
          }
        }

        return {
          ...m,
          user: user
            ? {
                _id: user._id,
                name: user.name,
                avatarUrl: user.avatarUrl,
                presenceStatus: effectivePresenceStatus,
                department: user.department,
                position: user.position,
              }
            : null,
        };
      }),
    );
  },
});

/** Get messages for a conversation (paginated, newest last) */
export const getMessages = query({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    // Verify membership
    const membership = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId),
      )
      .first();
    if (!membership) {
      return [];
    }

    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_conversation_created', (q) => q.eq('conversationId', args.conversationId))
      .order('desc')
      .take(limit);

    // Enrich with sender info, filter out messages deleted for this user
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        // If this user deleted the message for themselves, skip it
        const deletedForUsers: Id<'users'>[] =
          (msg.deletedForUsers as Id<'users'>[] | undefined) ?? [];
        if (deletedForUsers.includes(args.userId)) return null;

        const sender = await ctx.db.get(msg.senderId);
        return {
          ...msg,
          readBy: (msg.readBy as Array<{ userId: Id<'users'>; readAt: number }> | undefined) ?? [],
          sender: sender
            ? {
                _id: sender._id,
                name: sender.name,
                avatarUrl: sender.avatarUrl,
              }
            : null,
        };
      }),
    );

    return enriched.filter(Boolean).reverse() as typeof enriched;
  },
});

/** Get total unread count across all conversations (excludes deleted/archived per-user) */
export const getTotalUnread = query({
  args: {
    userId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
    // Only count memberships that are not deleted/archived
    // If organizationId provided, filter by org
    return memberships
      .filter((m) => {
        if (m.isDeleted || m.isArchived) return false;
        if (args.organizationId && m.organizationId !== args.organizationId) return false;
        return true;
      })
      .reduce((sum, m) => sum + (m.unreadCount ?? 0), 0);
  },
});

export const getTypingUsers = query({
  args: {
    conversationId: v.id('chatConversations'),
    currentUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 5000; // 5 seconds TTL
    const typing = await ctx.db
      .query('chatTyping')
      .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
      .collect();

    const active = typing.filter((t) => t.userId !== args.currentUserId && t.updatedAt > cutoff);

    return Promise.all(
      active.map(async (t) => {
        const user = await ctx.db.get(t.userId);
        return { userId: t.userId, name: user?.name ?? 'Someone' };
      }),
    );
  },
});

/** Search messages in a conversation */
export const searchMessages = query({
  args: {
    conversationId: v.id('chatConversations'),
    userId: v.id('users'),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('chatMembers')
      .withIndex('by_conversation_user', (q) =>
        q.eq('conversationId', args.conversationId).eq('userId', args.userId),
      )
      .first();
    if (!membership) return [];

    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
      .collect();

    const q = args.query.toLowerCase();
    return messages.filter((m) => !m.isDeleted && m.content.toLowerCase().includes(q)).slice(-20);
  },
});

/** Get pinned messages in a conversation */
export const getPinnedMessages = query({
  args: { conversationId: v.id('chatConversations') },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_pinned', (q) =>
        q.eq('conversationId', args.conversationId).eq('isPinned', true),
      )
      .collect();

    return Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        return {
          ...msg,
          sender: sender ? { name: sender.name, avatarUrl: sender.avatarUrl } : null,
        };
      }),
    );
  },
});

/** Get thread replies for a message */
export const getThreadReplies = query({
  args: { parentMessageId: v.id('chatMessages') },
  handler: async (ctx, args) => {
    const replies = await ctx.db
      .query('chatMessages')
      .filter((q) => q.eq(q.field('parentMessageId'), args.parentMessageId))
      .order('asc')
      .collect();
    return Promise.all(
      replies.map(async (r) => {
        const sender = await ctx.db.get(r.senderId);
        return {
          ...r,
          sender: sender
            ? { _id: sender._id, name: sender.name, avatarUrl: sender.avatarUrl }
            : null,
        };
      }),
    );
  },
});

/** Get scheduled messages for a user */
export const getScheduledMessages = query({
  args: { conversationId: v.id('chatConversations'), senderId: v.id('users') },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query('chatMessages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', args.conversationId))
      .collect();
    return msgs.filter((m) => m.senderId === args.senderId && m.scheduledFor && !m.isSent);
  },
});

// ─── CONVERSATION FILTERS ────────────────────────────────────────────────────────────

/** Get only unread conversations */
export const getUnreadConversations = query({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query('chatMembers')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), args.userId),
          q.eq(q.field('organizationId'), args.organizationId),
          q.gt(q.field('unreadCount'), 0),
        ),
      )
      .collect();

    // Filter out per-user deleted/archived memberships
    const activeMembers = members.filter((m) => !m.isDeleted && !m.isArchived);
    const convIds = activeMembers.map((m) => m.conversationId);
    const convs = await Promise.all(convIds.map((id) => ctx.db.get(id)));

    return convs
      .filter((c): c is typeof c & { _id: Id<'chatConversations'> } => c !== null)
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** Get only group conversations */
export const getGroupConversations = query({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query('chatMembers')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), args.userId),
          q.eq(q.field('organizationId'), args.organizationId),
        ),
      )
      .collect();

    // Filter out per-user deleted/archived memberships
    const activeMembers = members.filter((m) => !m.isDeleted && !m.isArchived);

    const convs = await Promise.all(activeMembers.map((m) => ctx.db.get(m.conversationId)));

    return convs
      .filter(
        (c): c is typeof c & { _id: Id<'chatConversations'> } => c !== null && c.type === 'group',
      )
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** Get pinned conversations */
export const getPinnedConversations = query({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query('chatMembers')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), args.userId),
          q.eq(q.field('organizationId'), args.organizationId),
        ),
      )
      .collect();

    // Filter out members who have per-user deleted this conversation
    const activeMembers = members.filter((m) => !m.isDeleted);

    const convs = await Promise.all(activeMembers.map((m) => ctx.db.get(m.conversationId)));

    return convs
      .filter((c): c is typeof c & { _id: Id<'chatConversations'> } => c !== null && !!c.isPinned)
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** Get archived conversations */
export const getArchivedConversations = query({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query('chatMembers')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), args.userId),
          q.eq(q.field('organizationId'), args.organizationId),
        ),
      )
      .collect();

    // Only show conversations archived by this user (per-user) and not deleted
    const archivedMembers = members.filter((m) => m.isArchived && !m.isDeleted);

    const convs = await Promise.all(archivedMembers.map((m) => ctx.db.get(m.conversationId)));

    return convs
      .filter((c): c is typeof c & { _id: Id<'chatConversations'> } => c !== null)
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** Get all org users for new conversation / mention picker */
export const getOrgUsers = query({
  args: {
    organizationId: v.id('organizations'),
    currentUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query('users')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0] || '';

    return await Promise.all(
      users
        .filter(
          (u) =>
            u._id !== args.currentUserId &&
            u.isActive &&
            u.isApproved &&
            u.email !== SUPERADMIN_EMAIL,
        )
        .map(async (u) => {
          // Check if user has an approved leave today
          let effectivePresenceStatus = u.presenceStatus ?? 'available';

          const approvedLeaves = await ctx.db
            .query('leaveRequests')
            .withIndex('by_user', (q) => q.eq('userId', u._id))
            .filter((q) => q.eq(q.field('status'), 'approved'))
            .collect();

          const hasActiveLeave = approvedLeaves.some((leave) => {
            return leave.startDate <= today && today <= leave.endDate;
          });

          if (hasActiveLeave) {
            effectivePresenceStatus = 'out_of_office';
          }

          return {
            _id: u._id,
            name: u.name,
            avatarUrl: u.avatarUrl,
            department: u.department,
            position: u.position,
            presenceStatus: effectivePresenceStatus,
            organizationId: u.organizationId,
          };
        }),
    );
  },
});

/** Get all service broadcasts for an organization */
export const getServiceBroadcasts = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    // Get System Announcements conversation
    const systemAnnouncements = await ctx.db
      .query('chatConversations')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .filter((q) =>
        q.and(
          q.eq(q.field('type'), 'group'),
          q.eq(q.field('name'), 'System Announcements'),
          q.eq(q.field('isDeleted'), false),
        ),
      )
      .first();

    if (!systemAnnouncements) {
      return [];
    }

    // Get all service broadcast messages
    const broadcasts = await ctx.db
      .query('chatMessages')
      .withIndex('by_conversation', (q) => q.eq('conversationId', systemAnnouncements._id))
      .filter((q) => q.eq(q.field('isServiceBroadcast'), true))
      .collect();

    // Get sender info for each broadcast
    const enriched = await Promise.all(
      broadcasts.map(async (b) => {
        const sender = await ctx.db.get(b.senderId);
        return {
          _id: b._id,
          title: b.broadcastTitle || 'Announcement',
          icon: b.broadcastIcon || 'ℹ️',
          content: b.content,
          createdAt: b.createdAt,
          senderName: sender?.name || 'Unknown',
          senderEmail: sender?.email || 'unknown',
        };
      }),
    );

    // Sort by creation date descending (newest first)
    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET UNREAD MESSAGE COUNT — for badge display
// ─────────────────────────────────────────────────────────────────────────────
export const getUnreadMessageCount = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    let total = 0;
    for (const m of memberships) {
      if (m.isDeleted) continue;
      total += m.unreadCount || 0;
    }
    return total;
  },
});
