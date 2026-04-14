// @ts-nocheck - Convex API types cause TS2589 in complex module graphs
import { v } from 'convex/values';
import { query } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { api } from '../_generated/api';

// Isolate API references at module level
const superadminApi = api.superadmin;

// ─── GLOBAL SEARCH ───────────────────────────────────────────────────────────
export const globalSearch = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const searchQuery = args.query.toLowerCase().trim();
    const limit = args.limit || 10;

    if (searchQuery.length < 2) {
      return {
        users: [],
        organizations: [],
        leaveRequests: [],
        driverRequests: [],
        tasks: [],
        supportTickets: [],
        total: 0,
      };
    }

    // Parallel search across all tables
    const [users, organizations, leaveRequests, driverRequests, tasks, supportTickets] =
      await Promise.all([
        // Search users by email and name
        ctx.db
          .query('users')
          .withIndex('by_email')
          .filter((q) => q.eq(q.field('email'), searchQuery))
          .collect(),

        // Search organizations by slug and name
        ctx.db
          .query('organizations')
          .withIndex('by_slug')
          .filter((q) => q.eq(q.field('slug'), searchQuery))
          .collect(),

        // Search leave requests
        ctx.db.query('leaveRequests').withIndex('by_status').collect(),

        // Search driver requests
        ctx.db.query('driverRequests').collect(),

        // Search tasks
        ctx.db.query('tasks').collect(),

        // Search support tickets
        ctx.db
          .query('supportTickets')
          .withIndex('by_ticket_number')
          .filter((q) => q.eq(q.field('ticketNumber'), args.query))
          .collect(),
      ]);

    // Filter and enrich results
    const filteredUsers = users
      .filter(
        (u) =>
          u.email.toLowerCase().includes(searchQuery) || u.name.toLowerCase().includes(searchQuery),
      )
      .slice(0, limit);

    const filteredOrgs = organizations
      .filter(
        (o) =>
          o.name.toLowerCase().includes(searchQuery) || o.slug.toLowerCase().includes(searchQuery),
      )
      .slice(0, limit);

    // Enrich leave requests with user data
    const enrichedLeaves = await Promise.all(
      leaveRequests
        .filter((l) => {
          const startDate = l.startDate.includes(searchQuery);
          const endDate = l.endDate.includes(searchQuery);
          return startDate || endDate;
        })
        .slice(0, limit)
        .map(async (leave) => {
          const user = await ctx.db.get(leave.userId);
          return {
            ...leave,
            userName: user?.name || 'Unknown',
            userEmail: user?.email || '',
            userAvatar: user?.avatarUrl,
          };
        }),
    );

    // Enrich driver requests
    const enrichedDrivers = await Promise.all(
      driverRequests
        .filter((d) => {
          const from = d.tripInfo?.from?.toLowerCase().includes(searchQuery);
          const to = d.tripInfo?.to?.toLowerCase().includes(searchQuery);
          const purpose = d.tripInfo?.purpose?.toLowerCase().includes(searchQuery);
          return from || to || purpose;
        })
        .slice(0, limit)
        .map(async (request) => {
          const requester = await ctx.db.get(request.requesterId);
          const driver = await ctx.db.get(request.driverId);
          const driverUser = driver ? await ctx.db.get(driver.userId) : null;
          return {
            ...request,
            requesterName: requester?.name || 'Unknown',
            requesterEmail: requester?.email || '',
            driverName: driverUser?.name || 'Unknown',
          };
        }),
    );

    // Enrich tasks
    const enrichedTasks = await Promise.all(
      tasks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(searchQuery) ||
            t.description?.toLowerCase().includes(searchQuery),
        )
        .slice(0, limit)
        .map(async (task) => {
          const assignee = task.assignedTo ? await ctx.db.get(task.assignedTo) : null;
          const creator = await ctx.db.get(task.assignedBy);
          return {
            ...task,
            assigneeName: assignee?.name || 'Unknown',
            creatorName: creator?.name || 'Unknown',
          };
        }),
    );

    // Enrich tickets
    const enrichedTickets = await Promise.all(
      supportTickets
        .filter(
          (t) =>
            t.title.toLowerCase().includes(searchQuery) ||
            t.description.toLowerCase().includes(searchQuery) ||
            t.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .slice(0, limit)
        .map(async (ticket) => {
          const creator = await ctx.db.get(ticket.createdBy);
          const assignee = ticket.assignedTo ? await ctx.db.get(ticket.assignedTo) : null;
          return {
            ...ticket,
            creatorName: creator?.name || 'Unknown',
            creatorEmail: creator?.email || '',
            assigneeName: assignee?.name || null,
          };
        }),
    );

    return {
      users: filteredUsers,
      organizations: filteredOrgs,
      leaveRequests: enrichedLeaves,
      driverRequests: enrichedDrivers,
      tasks: enrichedTasks,
      supportTickets: enrichedTickets,
      total:
        filteredUsers.length +
        filteredOrgs.length +
        enrichedLeaves.length +
        enrichedDrivers.length +
        enrichedTasks.length +
        enrichedTickets.length,
    };
  },
});

/**
 * Quick search for Command Palette (Cmd+K)
 * Returns top 5 results for each category
 */
export const quickSearch = query({
  args: { query: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const fullResults = await ctx.runQuery(superadminApi.globalSearch, {
      query: args.query,
      limit: 5,
    });

    // Format for quick display
    return {
      users: fullResults.users.map((u: any) => ({
        id: u._id,
        type: 'user' as const,
        title: u.name,
        subtitle: u.email,
        organization: u.organizationId,
        icon: '👤',
      })),
      organizations: fullResults.organizations.map((o: any) => ({
        id: o._id,
        type: 'organization' as const,
        title: o.name,
        subtitle: `${o.plan} • ${o.slug}`,
        icon: '🏢',
      })),
      leaveRequests: fullResults.leaveRequests.map((l: any) => ({
        id: l._id,
        type: 'leave' as const,
        title: `${l.userName} - ${l.type}`,
        subtitle: `${l.startDate} → ${l.endDate} • ${l.status}`,
        icon: '📅',
      })),
      tasks: fullResults.tasks.map((t: any) => ({
        id: t._id,
        type: 'task' as const,
        title: t.title,
        subtitle: `${t.status} • ${t.priority}`,
        icon: '✅',
      })),
      tickets: fullResults.supportTickets.map((t: any) => ({
        id: t._id,
        type: 'ticket' as const,
        title: t.ticketNumber,
        subtitle: t.title,
        icon: '🎫',
      })),
    };
  },
});

/**
 * Search users by email prefix (for typeahead)
 */
export const searchUsersByPrefix = query({
  args: { prefix: v.string(), organizationId: v.optional(v.id('organizations')) },
  handler: async (ctx, args) => {
    const prefix = args.prefix.toLowerCase();

    if (args.organizationId) {
      const users = await ctx.db
        .query('users')
        .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
        .collect();

      return users
        .filter(
          (u) =>
            u.email.toLowerCase().startsWith(prefix) || u.name.toLowerCase().startsWith(prefix),
        )
        .slice(0, 10)
        .map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          avatarUrl: u.avatarUrl,
        }));
    } else {
      // Global search for superadmin
      const allUsers = await ctx.db.query('users').collect();

      return allUsers
        .filter(
          (u) =>
            u.email.toLowerCase().startsWith(prefix) || u.name.toLowerCase().startsWith(prefix),
        )
        .slice(0, 10)
        .map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          organizationId: u.organizationId,
          avatarUrl: u.avatarUrl,
        }));
    }
  },
});
