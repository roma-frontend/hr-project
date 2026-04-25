import { v } from 'convex/values';
import { query } from '../_generated/server';
import type { Id, Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { MAX_PAGE_SIZE } from '../pagination';
import { SUPERADMIN_EMAIL } from '../lib/auth';

// ── Helper: Get user ID from email or userId ────────────────────────────────
async function getUserIdIdentityOrEmail(
  ctx: QueryCtx,
  email?: string,
  userId?: Id<'users'>,
): Promise<Id<'users'> | null> {
  // If userId provided, return it
  if (userId) return userId;

  // Try to get identity from Convex auth
  const identity = await ctx.auth.getUserIdentity();
  if (identity?.email) {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!.toLowerCase()))
      .first();
    return user?._id || null;
  }

  // Try email parameter
  if (email) {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
      .first();
    return user?._id || null;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL USERS — scoped to caller's organization
// ─────────────────────────────────────────────────────────────────────────────
export const getAllUsers = query({
  args: {
    requesterId: v.id('users'),
    cursor: v.optional(v.id('users')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { requesterId, cursor, limit }) => {
    const DEFAULT_LIMIT = 50;
    const MAX_LIMIT = 100;
    const effectiveLimit = Math.min(limit || DEFAULT_LIMIT, MAX_LIMIT);

    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error('Requester not found');

    // Superadmin sees all users across all orgs (with org info)
    if (requester.email.toLowerCase() === SUPERADMIN_EMAIL) {
      let query = ctx.db.query('users').order('desc');
      if (cursor) {
        query = (query as any).startAfter(cursor);
      }
      return await query.take(effectiveLimit + 1);
    }

    // Everyone else only sees their organization
    if (!requester.organizationId) {
      throw new Error('User does not belong to an organization');
    }

    let query = ctx.db
      .query('users')
      .withIndex('by_org', (q) => q.eq('organizationId', requester.organizationId))
      .filter((q) => q.eq(q.field('isActive'), true));

    if (cursor) {
      query = (query as any).startAfter(cursor);
    }

    return await query.take(effectiveLimit + 1);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET USERS BY ORGANIZATION ID — for adding members from specific orgs
// ─────────────────────────────────────────────────────────────────────────────
export const getUsersByOrganizationId = query({
  args: {
    requesterId: v.id('users'),
    organizationId: v.id('organizations'),
    cursor: v.optional(v.id('users')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { requesterId, organizationId, cursor, limit }) => {
    const DEFAULT_LIMIT = 50;
    const MAX_LIMIT = 100;
    const effectiveLimit = Math.min(limit || DEFAULT_LIMIT, MAX_LIMIT);

    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error('Requester not found');

    // Superadmin can query any org; regular users can only query their own
    const isSuperadmin = requester.email.toLowerCase() === SUPERADMIN_EMAIL;
    if (!isSuperadmin && requester.organizationId !== organizationId) {
      throw new Error('Access denied: cross-organization access is not allowed');
    }

    let query = ctx.db
      .query('users')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .filter((q) => q.eq(q.field('isActive'), true));

    if (cursor) {
      query = (query as any).startAfter(cursor);
    }

    return await query.take(effectiveLimit + 1);
  },
});

// Alias for mobile compatibility
export const getUsersByOrganization = getUsersByOrganizationId;

// ─────────────────────────────────────────────────────────────────────────────
// GET CURRENT USER — for client-side auth state
// ─────────────────────────────────────────────────────────────────────────────
export const getCurrentUser = query({
  args: {
    email: v.optional(v.string()),
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, { email, userId }) => {
    // Try to get identity from Convex auth first
    const identity = await ctx.auth.getUserIdentity();

    const userEmail = identity?.email || email;

    let user;

    // If userId provided, get user directly
    if (userId) {
      user = await ctx.db.get(userId);
    } else if (userEmail) {
      user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', userEmail.toLowerCase()))
        .first();
    }

    if (!user) return null;

    // Get organization data
    let organizationSlug: string | undefined;
    let organizationName: string | undefined;

    if (user.organizationId) {
      const org = await ctx.db.get(user.organizationId);
      if (org) {
        organizationSlug = org.slug;
        organizationName = org.name;
      }
    }

    return {
      ...user,
      organizationSlug,
      organizationName,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET USER BY EMAIL — only within same org
// ─────────────────────────────────────────────────────────────────────────────
export const getUserByEmail = query({
  args: { email: v.string(), requesterId: v.optional(v.id('users')) },
  handler: async (ctx, { email, requesterId }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
      .unique();

    if (!user) return null;

    // If requester provided, verify same org
    if (requesterId) {
      const requester = await ctx.db.get(requesterId);
      if (
        requester &&
        requester.organizationId !== user.organizationId &&
        requester.email.toLowerCase() !== SUPERADMIN_EMAIL
      ) {
        return null;
      }
    }

    return user;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET USER BY ID — only within same org
// ─────────────────────────────────────────────────────────────────────────────
export const getUserById = query({
  args: { userId: v.id('users'), requesterId: v.optional(v.id('users')) },
  handler: async (ctx, { userId, requesterId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;

    if (requesterId) {
      const requester = await ctx.db.get(requesterId);
      if (
        requester &&
        requester.organizationId !== user.organizationId &&
        requester.email.toLowerCase() !== SUPERADMIN_EMAIL
      ) {
        throw new Error('Access denied: cross-organization access is not allowed');
      }
    }

    return user;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET SUPERVISORS — scoped to org
// ─────────────────────────────────────────────────────────────────────────────
export const getSupervisors = query({
  args: {
    requesterId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, { requesterId, organizationId }) => {
    const requester = await ctx.db.get(requesterId);
    if (!requester) throw new Error('Not found');

    // Determine target org: explicit param > requester's own org
    const targetOrgId = organizationId ?? requester.organizationId;

    if (!targetOrgId) return [];

    const supervisors = await ctx.db
      .query('users')
      .withIndex('by_org_role', (q) => q.eq('organizationId', targetOrgId).eq('role', 'supervisor'))
      .take(MAX_PAGE_SIZE);

    const admins = await ctx.db
      .query('users')
      .withIndex('by_org_role', (q) => q.eq('organizationId', targetOrgId).eq('role', 'admin'))
      .take(MAX_PAGE_SIZE);

    return [...supervisors, ...admins]
      .filter((u) => u.isActive)
      .map((u) => ({ _id: u._id, name: u.name, role: u.role, email: u.email }));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET USERS BY ROLE — scoped to org, for driver registration
// ─────────────────────────────────────────────────────────────────────────────
export const getUsersByRole = query({
  args: {
    organizationId: v.id('organizations'),
    role: v.union(
      v.literal('superadmin'),
      v.literal('admin'),
      v.literal('supervisor'),
      v.literal('employee'),
      v.literal('driver'),
    ),
  },
  handler: async (ctx, { organizationId, role }) => {
    const users = await ctx.db
      .query('users')
      .withIndex('by_org_role', (q) => q.eq('organizationId', organizationId).eq('role', role))
      .filter((q) => q.eq(q.field('isActive'), true))
      .take(MAX_PAGE_SIZE);

    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      department: u.department,
      position: u.position,
    }));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET PENDING APPROVAL USERS — scoped to org
// ─────────────────────────────────────────────────────────────────────────────
export const getPendingApprovalUsers = query({
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    const admin = await ctx.db.get(adminId);
    if (!admin || (admin.role !== 'admin' && admin.email.toLowerCase() !== SUPERADMIN_EMAIL)) {
      throw new Error('Only org admins can view pending users');
    }

    // Superadmin sees all pending users across all orgs
    if (admin.email.toLowerCase() === SUPERADMIN_EMAIL) {
      const allUsers = await ctx.db.query('users').order('desc').take(MAX_PAGE_SIZE);
      return allUsers.filter((u) => !u.isApproved);
    }

    if (!admin.organizationId) return [];

    return await ctx.db
      .query('users')
      .withIndex('by_org_approval', (q) =>
        q.eq('organizationId', admin.organizationId).eq('isApproved', false),
      )
      .take(MAX_PAGE_SIZE);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET AUDIT LOGS — scoped to org
// ─────────────────────────────────────────────────────────────────────────────
export const getAuditLogs = query({
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    const admin = await ctx.db.get(adminId);
    if (!admin || (admin.role !== 'admin' && admin.email.toLowerCase() !== SUPERADMIN_EMAIL)) {
      throw new Error('Only org admins can view audit logs');
    }

    return await ctx.db
      .query('auditLogs')
      .withIndex('by_org', (q) => q.eq('organizationId', admin.organizationId))
      .order('desc')
      .take(200);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET EFFECTIVE PRESENCE STATUS (with active leave check)
// ─────────────────────────────────────────────────────────────────────────────
export const getEffectivePresenceStatus = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error('User not found');

    // Get all approved leaves for this user
    const approvedLeaves = await ctx.db
      .query('leaveRequests')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('status'), 'approved'))
      .take(MAX_PAGE_SIZE);

    // Check if any leave is active today
    const today = new Date().toISOString().split('T')[0] || '';
    const hasActiveLeave = approvedLeaves.some((leave) => {
      const startDate = leave.startDate;
      const endDate = leave.endDate;
      return startDate <= today && today <= endDate;
    });

    const effectiveStatus = hasActiveLeave ? 'out_of_office' : (user.presenceStatus ?? 'available');

    return {
      userId,
      presenceStatus: user.presenceStatus ?? 'available',
      effectivePresenceStatus: effectiveStatus,
      hasActiveLeave,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET WEBAUTHN CREDENTIALS
// ─────────────────────────────────────────────────────────────────────────────
export const getWebauthnCredentials = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('webauthnCredentials')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(MAX_PAGE_SIZE);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET WEBAUTHN CREDENTIAL BY ID
// ─────────────────────────────────────────────────────────────────────────────
export const getWebauthnCredential = query({
  args: { credentialId: v.string() },
  handler: async (ctx, { credentialId }) => {
    return await ctx.db
      .query('webauthnCredentials')
      .withIndex('by_credential_id', (q) => q.eq('credentialId', credentialId))
      .unique();
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CHECK FACE ID STATUS
// ─────────────────────────────────────────────────────────────────────────────
export const checkFaceIdStatus = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
      .first();

    if (!user) {
      return { blocked: false, attempts: 0 };
    }

    return {
      blocked: user.faceIdBlocked || false,
      attempts: user.faceIdFailedAttempts || 0,
      blockedAt: user.faceIdBlockedAt,
      lastAttempt: user.faceIdLastAttempt,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// LIST ALL USERS - SCOPED TO ORGANIZATION
// ─────────────────────────────────────────────────────────────────────────────
export const listAll = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const currentUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email!))
      .first();

    if (!currentUser) return [];

    // Superadmin sees all users across all organizations
    if (currentUser.email.toLowerCase() === SUPERADMIN_EMAIL) {
      return await ctx.db.query('users').take(MAX_PAGE_SIZE);
    }

    // Admin sees only users from their organization
    if (currentUser.role === 'admin') {
      if (!currentUser.organizationId) return [];

      return await ctx.db
        .query('users')
        .withIndex('by_org', (q) => q.eq('organizationId', currentUser.organizationId))
        .take(MAX_PAGE_SIZE);
    }

    return [];
  },
});
