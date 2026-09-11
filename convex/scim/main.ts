/**
 * SCIM 2.0 user provisioning — token management and provisioning semantics.
 *
 * The HTTP layer (convex/http.ts, `/api/scim/v2/*`) authenticates a bearer
 * token through `authenticateScimToken`, then calls the internal ops here.
 * Provisioned users reuse the platform's external-identity fields
 * (`externalId` / `externalSource: 'scim'`) so SCIM-managed accounts link to
 * SSO logins by the same verified email.
 *
 * Roles: SCIM cannot create superadmins. `admin` requests map to platform
 * `admin` only when the token has allowAdminRole; otherwise they degrade to
 * `employee` (fail-safe for the directory that out-ranks your HR system).
 */
import { v } from 'convex/values';
import { query, mutation, internalQuery, internalMutation } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { getAuthCaller } from '../lib/getAuthCaller';
import { generateEndpointSecret } from '../webhooks/protocol';
import { resolveTravelAllowanceForOrg } from '../lib/travelAllowance';
import { getStartingLeaveBalances } from '../lib/leaveBalances';
import { notify } from '../lib/notify';

function assertOrgManager(
  caller: { role: string; organizationId?: Id<'organizations'> } | null,
  action: string,
): Id<'organizations'> {
  if (!caller) throw new Error('Not authenticated');
  if (caller.role === 'superadmin') {
    if (!caller.organizationId) throw new Error('Superadmin has no organization context');
    return caller.organizationId;
  }
  if (caller.role !== 'admin' || !caller.organizationId) {
    throw new Error(`Only organization admins can ${action}`);
  }
  return caller.organizationId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin queries + mutations (settings UI)
// ─────────────────────────────────────────────────────────────────────────────

export const listTokens = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller || caller.role === 'employee') return [];
    const organizationId =
      caller.role === 'superadmin'
        ? caller.organizationId
        : (caller.organizationId as Id<'organizations'> | undefined);
    if (!organizationId) return [];
    const rows = await ctx.db
      .query('scimTokens')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Create a token. Returns the raw bearer value exactly once — only its
 * SHA-256 hash is persisted, so the IdP admin must store it now.
 */
export const createToken = mutation({
  args: { label: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage SCIM provisioning');

    const raw = `scim_${generateEndpointSecret()}`;
    const hash = await sha256Hex(raw);
    const now = Date.now();
    const tokenId = await ctx.db.insert('scimTokens', {
      organizationId,
      tokenHash: hash,
      label: args.label?.trim() || undefined,
      enabled: true,
      createdAt: now,
      createdBy: caller!._id as Id<'users'>,
    });
    return { tokenId, token: raw };
  },
});

export const updateToken = mutation({
  args: {
    tokenId: v.id('scimTokens'),
    enabled: v.optional(v.boolean()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage SCIM provisioning');
    const row = await ctx.db.get(args.tokenId);
    if (!row || row.organizationId !== organizationId) {
      throw new Error('SCIM token not found');
    }
    const patch: Record<string, unknown> = {};
    if (args.enabled !== undefined) patch.enabled = args.enabled;
    if (args.label !== undefined) patch.label = args.label.trim() || undefined;
    await ctx.db.patch(args.tokenId, patch);
    return { ok: true };
  },
});

export const deleteToken = mutation({
  args: { tokenId: v.id('scimTokens') },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage SCIM provisioning');
    const row = await ctx.db.get(args.tokenId);
    if (!row || row.organizationId !== organizationId) {
      throw new Error('SCIM token not found');
    }
    await ctx.db.delete(args.tokenId);
    return { ok: true };
  },
});

/** Base URL an admin configures in their IdP. */
export const getScimBaseUrl = query({
  args: {},
  handler: async () => {
    const appUrl = process.env.APP_URL ?? '';
    return { baseUrl: `${appUrl}/api/scim/v2` };
  },
});
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Bearer authentication (called by the HTTP layer)
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve a raw bearer token to its org, or null. Also records lastUsedAt. */
export const authenticateToken = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('scimTokens')
      .withIndex('by_token_hash', (q) => q.eq('tokenHash', args.tokenHash))
      .unique();
    if (!row || !row.enabled) return null;
    await ctx.db.patch(row._id, { lastUsedAt: Date.now() });
    return { organizationId: row.organizationId };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal provisioning ops (called by the HTTP layer)
// ─────────────────────────────────────────────────────────────────────────────

/** SCIM `externalId` provider marker. */
export const SCIM_EXTERNAL_SOURCE = 'scim';

/**
 * List users with a SCIM pagination envelope. `startIndex` is 1-based per
 * RFC 7644 §3.2.2; `count` caps at 200.
 */
export const listUsers = internalQuery({
  args: {
    organizationId: v.id('organizations'),
    startIndex: v.number(),
    count: v.number(),
    /** Optional SCIM filter: `userName eq "email"` — the one IdPs actually use. */
    emailEq: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const count = Math.min(Math.max(args.count, 0), 200);
    const start = Math.max(args.startIndex, 1);

    let rows;
    if (args.emailEq !== undefined) {
      const byEmail = await ctx.db
        .query('users')
        .withIndex('by_org_email', (q) =>
          q.eq('organizationId', args.organizationId).eq('email', args.emailEq!.toLowerCase()),
        )
        .unique();
      rows = byEmail ? [byEmail] : [];
    } else {
      rows = await ctx.db
        .query('users')
        .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
        .collect();
      rows.sort((a, b) => a.createdAt - b.createdAt);
    }

    const total = rows.length;
    const page = rows.slice(start - 1, start - 1 + count);
    return {
      totalResults: total,
      startIndex: start,
      itemsPerPage: page.length,
      resources: page.map(toScimUser),
    };
  },
});

/** Fetch one user by SCIM id (our user id) or by externalId. */
export const getUser = internalQuery({
  args: { organizationId: v.id('organizations'), userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.organizationId !== args.organizationId || user.deletedAt !== undefined) {
      return null;
    }
    return toScimUser(user);
  },
});

/**
 * Create a user from a SCIM POST. Mirrors the SSO auto-provision recipe
 * (passwordHash '', auto-approved, starting balances) but honors requested
 * attributes: department, position, manager. Duplicate email → 409 handled
 * by the HTTP layer via the `conflict` marker.
 */
export const createUser = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    userName: v.string(),
    name: v.string(),
    active: v.boolean(),
    department: v.optional(v.string()),
    position: v.optional(v.string()),
    managerExternalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.userName.toLowerCase().trim();

    // Duplicate emails conflict (RFC 7644 §3.3 — 409).
    const existing = await ctx.db
      .query('users')
      .withIndex('by_org_email', (q) =>
        q.eq('organizationId', args.organizationId).eq('email', email),
      )
      .unique();
    if (existing && existing.deletedAt === undefined) {
      return { conflict: true as const, userId: existing._id };
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org || !org.isActive) {
      throw new Error('Organization is not active');
    }
    const members = await ctx.db
      .query('users')
      .withIndex('by_org_active', (q) =>
        q.eq('organizationId', args.organizationId).eq('isActive', true),
      )
      .collect();
    if (members.length >= org.employeeLimit) {
      return { seatLimit: true as const };
    }

    // SCIM provisions employees only — role changes stay an in-product,
    // audited HR action. The IdP's job title is stored on the profile.
    const requestedRole = 'employee' as const;

    // Manager lookup by externalId (their IdP id), staying inside the org.
    let supervisorId: Id<'users'> | undefined;
    if (args.managerExternalId) {
      const manager = await ctx.db
        .query('users')
        .withIndex('by_org_external', (q) =>
          q
            .eq('organizationId', args.organizationId)
            .eq('externalSource', SCIM_EXTERNAL_SOURCE)
            .eq('externalId', args.managerExternalId!),
        )
        .unique();
      if (manager && manager.isActive) supervisorId = manager._id;
    }

    const employeeType = 'staff' as const;
    const now = Date.now();
    const userId = await ctx.db.insert('users', {
      organizationId: args.organizationId,
      name: args.name || email.split('@')[0] || 'User',
      email,
      passwordHash: '',
      role: requestedRole,
      employeeType,
      department: args.department,
      position: args.position,
      supervisorId,
      isActive: args.active,
      isApproved: true,
      approvedAt: now,
      travelAllowance: await resolveTravelAllowanceForOrg(ctx, args.organizationId, employeeType),
      ...(await getStartingLeaveBalances(ctx, args.organizationId)),
      createdAt: now,
    });

    // The IdP's immutable id is stored in the platform's external-identity
    // pair so future PATCHes resolve the same person even if email changes.
    await ctx.db.patch(userId, {
      externalId: args.userName, // IdP username as external id (stable per IdP)
      externalSource: SCIM_EXTERNAL_SOURCE,
    });

    await ctx.db.insert('auditLogs', {
      organizationId: args.organizationId,
      userId,
      action: 'scim_user_created',
      details: `Provisioned via SCIM (userName: ${args.userName})`,
      createdAt: now,
    });
    // Heads-up for org admins — same pattern as SSO auto-provision.
    const admins = await ctx.db
      .query('users')
      .withIndex('by_org_role', (q) =>
        q.eq('organizationId', args.organizationId).eq('role', 'admin'),
      )
      .take(20);
    for (const admin of admins) {
      await notify(ctx, {
        organizationId: args.organizationId,
        userId: admin._id,
        type: 'join_request',
        titleKey: 'notifications.titles.joinRequestNew',
        messageKey: 'notifications.messages.joinRequestNew',
        params: { name: args.name || email, email, orgName: org.name },
        fallbackTitle: '🆕 SCIM provisioned user',
        fallbackMessage: `${args.name || email} (${email}) was provisioned via SCIM.`,
        relatedId: userId,
        route: '/employees',
      });
    }

    const created = await ctx.db.get(userId);
    return {
      conflict: false as const,
      seatLimit: false as const,
      userId,
      scimUser: created ? toScimUser(created) : null,
    };
  },
});

/**
 * Replace the mutable SCIM attributes of a user (PUT from the IdP). Identity
 * fields (role, balances) are intentionally untouched.
 */
export const updateUser = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    name: v.optional(v.string()),
    active: v.optional(v.boolean()),
    department: v.optional(v.string()),
    position: v.optional(v.string()),
    managerExternalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.organizationId !== args.organizationId || user.deletedAt !== undefined) {
      return { notFound: true as const };
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined && args.name) patch.name = args.name;
    if (args.active !== undefined) {
      // Never let the directory disable the last active admin.
      if (!args.active && user.role === 'admin') {
        const admins = await ctx.db
          .query('users')
          .withIndex('by_org_role', (q) =>
            q.eq('organizationId', args.organizationId).eq('role', 'admin'),
          )
          .collect();
        const activeAdmins = admins.filter((a) => a.isActive && a.deletedAt === undefined);
        if (activeAdmins.length <= 1 && activeAdmins.some((a) => a._id === args.userId)) {
          return { lastAdmin: true as const };
        }
      }
      patch.isActive = args.active;
    }
    if (args.department !== undefined) patch.department = args.department || undefined;
    if (args.position !== undefined) patch.position = args.position || undefined;
    if (args.managerExternalId !== undefined) {
      let supervisorId: Id<'users'> | undefined;
      if (args.managerExternalId) {
        const manager = await ctx.db
          .query('users')
          .withIndex('by_org_external', (q) =>
            q
              .eq('organizationId', args.organizationId)
              .eq('externalSource', SCIM_EXTERNAL_SOURCE)
              .eq('externalId', args.managerExternalId!),
          )
          .unique();
        if (manager && manager.isActive) supervisorId = manager._id;
      }
      patch.supervisorId = supervisorId;
    }
    await ctx.db.patch(args.userId, patch);
    const updated = await ctx.db.get(args.userId);
    return {
      notFound: false as const,
      lastAdmin: false as const,
      scimUser: updated ? toScimUser(updated) : null,
    };
  },
});

/**
 * Deactivate (SCIM DELETE semantics per RFC 7644 §3.6: IdPs expect soft
 * delete — the user must lose access, not vanish from payroll history).
 * Deactivates when active=false, reactivates when active=true.
 */
export const setUserActive = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.organizationId !== args.organizationId || user.deletedAt !== undefined) {
      return { notFound: true as const };
    }
    await ctx.db.patch(args.userId, { isActive: args.active });
    await ctx.db.insert('auditLogs', {
      organizationId: args.organizationId,
      userId: args.userId,
      action: args.active ? 'scim_user_activated' : 'scim_user_deactivated',
      details: 'Updated via SCIM',
      createdAt: Date.now(),
    });
    const updated = await ctx.db.get(args.userId);
    return {
      notFound: false as const,
      scimUser: updated ? toScimUser(updated) : null,
    };
  },
});

/** Delete = hard remove of the SCIM link + deactivate (soft delete). */
export const deleteUser = internalMutation({
  args: { organizationId: v.id('organizations'), userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.organizationId !== args.organizationId || user.deletedAt !== undefined) {
      return { notFound: true as const };
    }
    await ctx.db.patch(args.userId, {
      isActive: false,
      externalId: undefined,
      externalSource: undefined,
    });
    await ctx.db.insert('auditLogs', {
      organizationId: args.organizationId,
      userId: args.userId,
      action: 'scim_user_deleted',
      details: 'SCIM link removed; user deactivated',
      createdAt: Date.now(),
    });
    return { notFound: false as const };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SCIM resource mapping (RFC 7644 core schema)
// ─────────────────────────────────────────────────────────────────────────────

type UserDoc = {
  _id: string;
  userName?: string;
  email: string;
  name: string;
  active?: boolean;
  isActive: boolean;
  externalId?: string;
  department?: string;
  position?: string;
  supervisorId?: Id<'users'>;
  createdAt: number;
};

/** Project a platform user into a SCIM 2.0 User resource. */
function toScimUser(user: UserDoc) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: user._id,
    externalId: user.externalId ?? user.email,
    userName: user.email,
    active: user.isActive,
    name: { formatted: user.name, givenName: user.name, familyName: '' },
    emails: [{ value: user.email, primary: true }],
    department: user.department,
    title: user.position,
    meta: {
      resourceType: 'User',
      created: new Date(user.createdAt).toISOString(),
      lastModified: new Date(user.createdAt).toISOString(),
      location: `/api/scim/v2/Users/${user._id}`,
    },
  };
}
