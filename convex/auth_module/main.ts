import { v } from 'convex/values';
import { mutation, query } from '../_generated/server';

// ── Error Handler Helper ─────────────────────────────────────────────────────
/**
 * Wraps convex mutations/queries with error handling
 * Logs errors and rethrows with sanitized messages for security
 */
function wrapConvexError<T>(fn: () => T, operation: string): T {
  try {
    return fn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Convex Auth] ${operation} error:`, errorMessage);

    // Don't expose internal errors to client
    if (
      error instanceof Error &&
      !errorMessage.includes('Invalid') &&
      !errorMessage.includes('not found')
    ) {
      throw new Error(`Operation failed: ${operation}`);
    }
    throw error;
  }
}

// ── Constants ────────────────────────────────────────────────────────────────
const SUPERADMIN_EMAIL = 'romangulanyan@gmail.com';

/**
 * Check if a user is a superadmin.
 * Primary check: user.role === "superadmin"
 * Fallback: email match (for legacy compatibility)
 */
export function isSuperadmin(
  user:
    | {
        role?: string;
        email?: string;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  return user.role === 'superadmin' || user.email?.toLowerCase() === SUPERADMIN_EMAIL;
}

/**
 * Assert that a user is a superadmin, throw otherwise.
 */
export function assertSuperadmin(
  user:
    | {
        role?: string;
        email?: string;
      }
    | null
    | undefined,
  action: string = 'perform this action',
): void {
  if (!isSuperadmin(user)) {
    throw new Error(`Only superadmin can ${action}`);
  }
}

// ── Helper: build safe user return object ────────────────────────────────────
function safeUser(user: {
  _id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  department?: string;
  position?: string;
  employeeType: string;
  avatarUrl?: string;
  travelAllowance: number;
  isApproved: boolean;
}) {
  return {
    userId: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    department: user.department,
    position: user.position,
    employeeType: user.employeeType,
    avatarUrl: user.avatarUrl,
    travelAllowance: user.travelAllowance,
    isApproved: user.isApproved,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER — two paths:
//   1. Superadmin email → role=superadmin, no org needed (org assigned later)
//   2. Everyone else → must provide organizationId (join existing) or create new
// ─────────────────────────────────────────────────────────────────────────────
export const register = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(), // actually a hash from client
    phone: v.optional(v.string()),
    // Multi-tenant fields
    organizationId: v.optional(v.id('organizations')), // join existing org
    inviteToken: v.optional(v.string()), // from invite link
    // Superadmin-only: create first org
    createOrgName: v.optional(v.string()),
    createOrgSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return wrapConvexError(async () => {
      const email = args.email.toLowerCase().trim();
      const isSuperadmin = email === SUPERADMIN_EMAIL;

      // ── 1. Check email not already registered ──────────────────────────────
      const existing = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email))
        .unique();
      if (existing) throw new Error('Email already registered');

      // ── 2. Resolve organization ────────────────────────────────────────────
      let organizationId = args.organizationId;
      let isApproved = false;
      let role: 'superadmin' | 'admin' | 'employee' | 'supervisor' = 'employee';

      if (isSuperadmin) {
        // Superadmin path: create a special "platform" org or join first org
        role = 'superadmin';
        isApproved = true;

        // Superadmin must have an org (even a virtual one) — find or create
        const allOrgs = await ctx.db.query('organizations').collect();
        if (allOrgs.length === 0) {
          // Bootstrap: create the first platform organization
          if (!args.createOrgName || !args.createOrgSlug) {
            throw new Error('First registration requires organization name and slug');
          }
          const slug = args.createOrgSlug
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

          organizationId = await ctx.db.insert('organizations', {
            name: args.createOrgName,
            slug,
            plan: 'enterprise',
            isActive: true,
            createdBySuperadmin: true,
            timezone: 'UTC',
            employeeLimit: 999999,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } else {
          // Superadmin joins the first org by default
          const firstOrg = allOrgs[0];
          if (!firstOrg) {
            throw new Error('No organizations found');
          }
          organizationId = firstOrg._id;
        }
      } else {
        // Regular user path
        if (!organizationId && !args.inviteToken) {
          throw new Error('Please select an organization to join');
        }

        // Validate invite token if provided
        if (args.inviteToken) {
          const invite = await ctx.db
            .query('organizationInvites')
            .withIndex('by_token', (q) => q.eq('inviteToken', args.inviteToken!))
            .unique();

          if (!invite) throw new Error('Invalid invite link');
          if (invite.status === 'approved')
            throw new Error('This invite link has already been used');
          if (invite.inviteExpiry && invite.inviteExpiry < Date.now()) {
            throw new Error('This invite link has expired');
          }

          organizationId = invite.organizationId;

          // Mark invite as used
          await ctx.db.patch(invite._id, {
            status: 'approved',
            requestedByEmail: email,
            requestedByName: args.name,
            reviewedAt: Date.now(),
          });

          // Invited users are auto-approved
          isApproved = true;
        }

        if (!organizationId) throw new Error('Organization not found');

        // Verify org exists and is active
        const org = await ctx.db.get(organizationId);
        if (!org || !org.isActive) throw new Error('Organization is inactive or not found');

        // Check employee limit
        const currentMembers = await ctx.db
          .query('users')
          .withIndex('by_org_active', (q) =>
            q.eq('organizationId', organizationId!).eq('isActive', true),
          )
          .collect();
        if (isApproved && currentMembers.length >= org.employeeLimit) {
          throw new Error(
            `This organization has reached its employee limit (${org.employeeLimit}). Contact your administrator.`,
          );
        }

        // Check if first member of the org → becomes admin
        const orgMembers = await ctx.db
          .query('users')
          .withIndex('by_org', (q) => q.eq('organizationId', organizationId!))
          .collect();

        if (orgMembers.length === 0) {
          // First person in org → auto-admin, auto-approved
          role = 'admin';
          isApproved = true;
        }
      }

      if (!organizationId) throw new Error('Could not resolve organization');

      // ── 3. Create user ─────────────────────────────────────────────────────
      const userId = await ctx.db.insert('users', {
        organizationId,
        name: args.name,
        email,
        passwordHash: args.password,
        phone: args.phone,
        role,
        employeeType: 'staff',
        department: role === 'admin' || isSuperadmin ? 'Management' : undefined,
        position: role === 'admin' || isSuperadmin ? 'Administrator' : undefined,
        isActive: true,
        isApproved,
        approvedAt: isApproved ? Date.now() : undefined,
        travelAllowance: 20000,
        paidLeaveBalance: 24,
        sickLeaveBalance: 10,
        familyLeaveBalance: 5,
        createdAt: Date.now(),
      });

      // ── 4. Notify org admins if user needs approval ────────────────────────
      if (!isApproved) {
        const org = await ctx.db.get(organizationId);
        const admins = await ctx.db
          .query('users')
          .withIndex('by_org_role', (q) =>
            q.eq('organizationId', organizationId!).eq('role', 'admin'),
          )
          .collect();

        for (const admin of admins) {
          await ctx.db.insert('notifications', {
            organizationId,
            userId: admin._id,
            type: 'join_request',
            title: '🙋 New Join Request',
            message: `${args.name} (${email}) wants to join ${org?.name ?? 'your organization'}.`,
            isRead: false,
            relatedId: userId,
            createdAt: Date.now(),
          });
        }
      }

      return { userId, role, needsApproval: !isApproved, organizationId };
    }, 'register');
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN — validates credentials + organizationId scoping
// ─────────────────────────────────────────────────────────────────────────────
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    sessionToken: v.string(),
    sessionExpiry: v.number(),
    isFaceLogin: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { email, password: passwordHash, sessionToken, sessionExpiry, isFaceLogin },
  ) => {
    return wrapConvexError(async () => {
      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email.toLowerCase().trim()))
        .unique();

      if (!user) throw new Error('Invalid email or password');
      if (!user.isActive)
        throw new Error('Your account has been deactivated. Contact your administrator.');
      if (!user.isApproved) {
        throw new Error(
          'Your account is pending approval from your organization administrator. Please wait.',
        );
      }

      // Skip password check for Face ID login
      if (!isFaceLogin && user.passwordHash !== passwordHash) {
        throw new Error('Invalid email or password');
      }

      // Verify org is still active
      if (!user.organizationId) throw new Error('User has no organization');
      const org = await ctx.db.get(user.organizationId);
      if (!org || !org.isActive) {
        throw new Error('Your organization account is inactive. Contact support.');
      }

      await ctx.db.patch(user._id, {
        sessionToken,
        sessionExpiry,
        lastLoginAt: Date.now(),
      });

      return {
        ...safeUser(user as Parameters<typeof safeUser>[0]),
        organizationName: org.name,
        organizationSlug: org.slug,
        organizationPlan: org.plan,
      };
    }, 'login');
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
export const logout = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, {
      sessionToken: undefined,
      sessionExpiry: undefined,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY SESSION — returns user + org info
// ─────────────────────────────────────────────────────────────────────────────
export const verifySession = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_session_token', (q) => q.eq('sessionToken', sessionToken))
      .unique();
    if (!user) return null;
    if (user.sessionExpiry && user.sessionExpiry < Date.now()) return null;
    if (!user.organizationId) return null;

    const org = await ctx.db.get(user.organizationId);

    return {
      ...safeUser(user as Parameters<typeof safeUser>[0]),
      organizationName: org?.name,
      organizationSlug: org?.slug,
      organizationPlan: org?.plan,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET SESSION (alias)
// ─────────────────────────────────────────────────────────────────────────────
export const getSession = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_session_token', (q) => q.eq('sessionToken', sessionToken))
      .unique();
    if (!user) return null;
    if (user.sessionExpiry && user.sessionExpiry < Date.now()) return null;
    if (!user.organizationId) return null;

    const org = await ctx.db.get(user.organizationId);

    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: org?.name,
      organizationSlug: org?.slug,
      organizationPlan: org?.plan,
      department: user.department,
      position: user.position,
      employeeType: user.employeeType,
      avatar: user.avatarUrl,
      travelAllowance: user.travelAllowance,
      isApproved: user.isApproved,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST PASSWORD RESET
// ─────────────────────────────────────────────────────────────────────────────
export const requestPasswordReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email.toLowerCase().trim()))
      .unique();

    if (!user) return { success: true }; // prevent email enumeration

    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

    await ctx.db.patch(user._id, {
      resetPasswordToken: token,
      resetPasswordExpiry: expiry,
    });

    return { success: true, token, name: user.name, email: user.email };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────────────────────────────────────
export const resetPassword = mutation({
  args: { token: v.string(), newPassword: v.string() },
  handler: async (ctx, { token, newPassword }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_reset_token', (q) => q.eq('resetPasswordToken', token))
      .unique();

    if (!user) throw new Error('Invalid or expired reset token');
    if (!user.resetPasswordExpiry || user.resetPasswordExpiry < Date.now()) {
      throw new Error('Reset token has expired. Please request a new one.');
    }

    await ctx.db.patch(user._id, {
      passwordHash: newPassword,
      resetPasswordToken: undefined,
      resetPasswordExpiry: undefined,
      sessionToken: undefined,
    });

    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY RESET TOKEN
// ─────────────────────────────────────────────────────────────────────────────
export const verifyResetToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_reset_token', (q) => q.eq('resetPasswordToken', token))
      .unique();

    if (!user) return { valid: false };
    if (!user.resetPasswordExpiry || user.resetPasswordExpiry < Date.now()) {
      return { valid: false, expired: true };
    }

    return { valid: true, email: user.email, name: user.name };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD — authenticated user changes their own password
// ─────────────────────────────────────────────────────────────────────────────
export const changePassword = mutation({
  args: {
    userId: v.id('users'),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { userId, currentPassword, newPassword }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error('User not found');

    if (user.passwordHash !== currentPassword) {
      throw new Error('Current password is incorrect');
    }

    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    await ctx.db.patch(userId, {
      passwordHash: newPassword,
      sessionToken: undefined, // force re-login on other devices
    });

    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER WEBAUTHN CREDENTIAL
// ─────────────────────────────────────────────────────────────────────────────
export const registerWebauthn = mutation({
  args: {
    userId: v.id('users'),
    credentialId: v.string(),
    publicKey: v.string(),
    counter: v.number(),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('webauthnCredentials')
      .withIndex('by_credential_id', (q) => q.eq('credentialId', args.credentialId))
      .unique();
    if (existing) throw new Error('Credential already registered');

    return await ctx.db.insert('webauthnCredentials', {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET WEBAUTHN CREDENTIAL
// ─────────────────────────────────────────────────────────────────────────────
export const getWebauthnCredential = query({
  args: { credentialId: v.string() },
  handler: async (ctx, { credentialId }) => {
    const cred = await ctx.db
      .query('webauthnCredentials')
      .withIndex('by_credential_id', (q) => q.eq('credentialId', credentialId))
      .unique();
    if (!cred) return null;
    const user = await ctx.db.get(cred.userId);
    return { ...cred, user };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN VIA WEBAUTHN
// ─────────────────────────────────────────────────────────────────────────────
export const loginWebauthn = mutation({
  args: {
    credentialId: v.string(),
    counter: v.number(),
    sessionToken: v.string(),
    sessionExpiry: v.number(),
  },
  handler: async (ctx, { credentialId, counter, sessionToken, sessionExpiry }) => {
    const cred = await ctx.db
      .query('webauthnCredentials')
      .withIndex('by_credential_id', (q) => q.eq('credentialId', credentialId))
      .unique();
    if (!cred) throw new Error('Credential not found');

    const user = await ctx.db.get(cred.userId);
    if (!user) throw new Error('User not found');
    if (!user.isActive) throw new Error('Account is deactivated');
    if (!user.isApproved) throw new Error('Account pending approval');
    if (!user.organizationId) throw new Error('User has no organization');

    const org = await ctx.db.get(user.organizationId);
    if (!org || !org.isActive) throw new Error('Organization is inactive');

    // Replay attack prevention
    if (counter <= cred.counter) throw new Error('Invalid authenticator counter');
    await ctx.db.patch(cred._id, { counter, lastUsedAt: Date.now() });

    await ctx.db.patch(user._id, {
      sessionToken,
      sessionExpiry,
      lastLoginAt: Date.now(),
    });

    return {
      ...safeUser(user as Parameters<typeof safeUser>[0]),
      organizationName: org.name,
      organizationSlug: org.slug,
      organizationPlan: org.plan,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH LOGIN — for mobile app
// Finds existing user by email, creates session. If user doesn't exist,
// creates a new user (pending approval unless first in org).
// ─────────────────────────────────────────────────────────────────────────────
export const googleOAuthLogin = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    googleId: v.string(),
    sessionToken: v.string(),
    sessionExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // ── 1. Find existing user ──────────────────────────────────────────────
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();

    if (user) {
      // Existing user — validate
      if (!user.isActive)
        throw new Error('Your account has been deactivated. Contact your administrator.');
      if (!user.isApproved)
        throw new Error('Your account is pending approval from your organization administrator.');
      if (!user.organizationId) throw new Error('User has no organization');

      const org = await ctx.db.get(user.organizationId);
      if (!org || !org.isActive)
        throw new Error('Your organization account is inactive. Contact support.');

      // Update avatar if not set, and update session
      const patch: Record<string, string | number | undefined> = {
        sessionToken: args.sessionToken,
        sessionExpiry: args.sessionExpiry,
        lastLoginAt: Date.now(),
      };
      if (!user.avatarUrl && args.avatarUrl) {
        patch.avatarUrl = args.avatarUrl;
      }
      await ctx.db.patch(user._id, patch);

      return {
        isNewUser: false,
        needsApproval: false,
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId!,
        organizationName: org!.name,
        organizationSlug: org!.slug,
        organizationPlan: org!.plan,
        department: user.department,
        position: user.position,
        employeeType: user.employeeType,
        avatarUrl: user.avatarUrl ?? args.avatarUrl,
        travelAllowance: user.travelAllowance,
        isApproved: user.isApproved,
        phone: user.phone,
        paidLeaveBalance: user.paidLeaveBalance,
        sickLeaveBalance: user.sickLeaveBalance,
        familyLeaveBalance: user.familyLeaveBalance,
      };
    }

    // ── 2. New user — create account ───────────────────────────────────────
    const allOrgs = await ctx.db
      .query('organizations')
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();
    if (allOrgs.length === 0) {
      throw new Error('No active organizations found. Please contact administrator.');
    }

    const org = allOrgs[0];
    if (!org) {
      throw new Error('Organization not found');
    }
    const organizationId = org._id;

    // Check if first member → admin
    const orgMembers = await ctx.db
      .query('users')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .collect();

    const isFirstMember = orgMembers.length === 0;
    const role = isFirstMember ? 'admin' : 'employee';
    const isApproved = isFirstMember;

    const userId = await ctx.db.insert('users', {
      organizationId,
      name: args.name || email.split('@')[0] || 'User',
      email,
      passwordHash: '',
      avatarUrl: args.avatarUrl,
      role,
      employeeType: 'staff',
      isActive: true,
      isApproved,
      approvedAt: isApproved ? Date.now() : undefined,
      travelAllowance: 20000,
      paidLeaveBalance: 24,
      sickLeaveBalance: 10,
      familyLeaveBalance: 5,
      sessionToken: isApproved ? args.sessionToken : undefined,
      sessionExpiry: isApproved ? args.sessionExpiry : undefined,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
    });

    // Notify admins if needs approval
    if (!isApproved) {
      const admins = await ctx.db
        .query('users')
        .withIndex('by_org_role', (q) => q.eq('organizationId', organizationId).eq('role', 'admin'))
        .collect();

      for (const admin of admins) {
        await ctx.db.insert('notifications', {
          organizationId,
          userId: admin._id,
          type: 'join_request',
          title: '🙋 New Google Sign-Up',
          message: `${args.name} (${email}) signed up with Google and wants to join ${org.name || 'organization'}.`,
          isRead: false,
          relatedId: userId,
          createdAt: Date.now(),
        });
      }

      throw new Error(
        'Your account has been created and is pending approval from your organization administrator.',
      );
    }

    return {
      isNewUser: true,
      needsApproval: false,
      userId,
      name: args.name || email.split('@')[0] || 'User',
      email,
      role,
      organizationId,
      organizationName: org.name || 'Organization',
      organizationSlug: org.slug || 'org',
      organizationPlan: org.plan || 'free',
      department: undefined,
      position: undefined,
      employeeType: 'staff',
      avatarUrl: args.avatarUrl,
      travelAllowance: 20000,
      isApproved: true,
      phone: undefined,
      paidLeaveBalance: 24,
      sickLeaveBalance: 10,
      familyLeaveBalance: 5,
    };
  },
});
