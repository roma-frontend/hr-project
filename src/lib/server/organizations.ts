import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Organization = Database['public']['Tables']['organizations']['Row'];
type User = Database['public']['Tables']['users']['Row'];
type OrganizationInvite = Database['public']['Tables']['organization_invites']['Row'];

const SUPERADMIN_EMAIL = 'romangulanyan@gmail.com';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

const SUPABASE_URL = supabaseUrl as string;
const SUPABASE_SERVICE_KEY = supabaseServiceKey as string;

const PLAN_EMPLOYEE_LIMITS: Record<string, number> = {
  starter: 10,
  professional: 50,
  enterprise: 999999,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function verifySuperadmin(userId: string): Promise<User> {
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: user, error } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) throw new Error('User not found');
  if (user.email.toLowerCase() !== SUPERADMIN_EMAIL) {
    throw new Error('Only the superadmin can perform this action');
  }
  return user;
}

async function verifyOrgAdmin(userId: string): Promise<User> {
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: user, error } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) throw new Error('User not found');
  if (user.role !== 'admin' && user.email.toLowerCase() !== SUPERADMIN_EMAIL) {
    throw new Error('Only org admins can perform this action');
  }
  return user;
}

function normalizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── SUPERADMIN: Create Organization ──────────────────────────────────────────

export async function createOrganization(args: {
  superadminUserId: string;
  name: string;
  slug: string;
  plan: 'starter' | 'professional' | 'enterprise';
  timezone?: string;
  country?: string;
  industry?: string;
}) {
  await verifySuperadmin(args.superadminUserId);

  const slug = normalizeSlug(args.slug);
  if (!slug) throw new Error('Invalid organization slug');

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );

  const { data: existing } = await supabaseService
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) throw new Error(`Organization with slug "${slug}" already exists`);

  const { data, error } = await supabaseService
    .from('organizations')
    .insert({
      name: args.name,
      slug,
      plan: args.plan,
      is_active: true,
      created_by_superadmin: true,
      timezone: args.timezone ?? 'UTC',
      country: args.country,
      industry: args.industry,
      employee_limit: PLAN_EMPLOYEE_LIMITS[args.plan],
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Failed to create organization');
  return { orgId: data.id, slug: data.slug };
}

// ── SUPERADMIN: List All Organizations ───────────────────────────────────────

export async function listAllOrganizations(callerUserId: string) {
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: caller } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', callerUserId)
    .maybeSingle();

  if (!caller || caller.email.toLowerCase() !== SUPERADMIN_EMAIL) return [];

  const { data: orgs, error } = await supabaseService
    .from('organizations')
    .select('*');

  if (error) throw error;

  return Promise.all(
    (orgs || []).map(async (org) => {
      const { data: employees } = await supabaseService
        .from('users')
        .select('*')
        .eq('organization_id', org.id);

      const filteredEmployees = (employees || []).filter(
        (e) => e.role !== 'superadmin'
      );

      return {
        ...org,
        employeeCount: filteredEmployees.length,
      };
    })
  );
}

// ── SUPERADMIN: Get All Organizations (enriched) ─────────────────────────────

export async function getAllOrganizations(superadminUserId?: string) {
  if (superadminUserId) {
    await verifySuperadmin(superadminUserId);
  }

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: orgs, error } = await supabaseService
    .from('organizations')
    .select('*');

  if (error) throw error;

  return Promise.all(
    (orgs || []).map(async (org) => {
      const { data: employees } = await supabaseService
        .from('users')
        .select('*')
        .eq('organization_id', org.id);

      const filteredEmployees = (employees || []).filter(
        (e) => e.role !== 'superadmin'
      );
      const admins = filteredEmployees.filter((u) => u.role === 'admin');
      const activeCount = filteredEmployees.filter(
        (u) => u.is_active && u.is_approved
      ).length;

      return {
        ...org,
        totalEmployees: filteredEmployees.length,
        activeEmployees: activeCount,
        adminNames: admins.map((a) => a.name),
        memberCount: filteredEmployees.length,
      };
    })
  );
}

// ── SUPERADMIN: Update Organization ──────────────────────────────────────────

export async function updateOrganization(args: {
  superadminUserId: string;
  organizationId: string;
  name?: string;
  plan?: 'starter' | 'professional' | 'enterprise';
  isActive?: boolean;
  timezone?: string;
  country?: string;
  industry?: string;
}) {
  await verifySuperadmin(args.superadminUserId);

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const updates: any = {
    updated_at: Math.floor(Date.now() / 1000),
  };

  if (args.name !== undefined) updates.name = args.name;
  if (args.plan !== undefined) {
    updates.plan = args.plan;
    updates.employee_limit = PLAN_EMPLOYEE_LIMITS[args.plan];
  }
  if (args.isActive !== undefined) updates.is_active = args.isActive;
  if (args.timezone !== undefined) updates.timezone = args.timezone;
  if (args.country !== undefined) updates.country = args.country;
  if (args.industry !== undefined) updates.industry = args.industry;

  const { data, error } = await supabaseService
    .from('organizations')
    .update(updates)
    .eq('id', args.organizationId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Failed to update organization');
  return data.id;
}

// ── SUPERADMIN: Assign Org Admin ─────────────────────────────────────────────

export async function assignOrgAdmin(args: {
  superadminUserId: string;
  userId: string;
  organizationId: string;
}) {
  await verifySuperadmin(args.superadminUserId);

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: user, error: userError } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', args.userId)
    .maybeSingle();

  if (userError || !user) throw new Error('User not found');

  const { error } = await supabaseService
    .from('users')
    .update({
      organization_id: args.organizationId,
      role: 'admin',
      is_approved: true,
      approved_at: Math.floor(Date.now() / 1000),
    })
    .eq('id', args.userId);

  if (error) throw error;
  return user.id;
}

// ── Get Organization By ID (access controlled) ───────────────────────────────

export async function getOrganizationById(args: {
  callerUserId: string;
  organizationId: string;
}) {
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: caller, error: callerError } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', args.callerUserId)
    .maybeSingle();

  if (callerError || !caller) throw new Error('User not found');

  const { data: org, error: orgError } = await supabaseService
    .from('organizations')
    .select('*')
    .eq('id', args.organizationId)
    .maybeSingle();

  if (orgError || !org) throw new Error('Organization not found');

  const isSuperadmin = caller.email.toLowerCase() === SUPERADMIN_EMAIL;
  const isOwnOrg =
    caller.organization_id === args.organizationId && caller.role === 'admin';

  if (!isSuperadmin && !isOwnOrg) {
    throw new Error("You don't have access to this organization");
  }

  const { data: members } = await supabaseService
    .from('users')
    .select('*')
    .eq('organization_id', args.organizationId);

  const filteredMembers = (members || []).filter(
    (m) => m.role !== 'superadmin'
  );

  return {
    ...org,
    employeeCount: filteredMembers.length,
  };
}

// ── SUPERADMIN: Get Org Members ──────────────────────────────────────────────

export async function getOrgMembers(args: {
  superadminUserId: string;
  organizationId: string;
  cursor?: string;
  limit?: number;
}) {
  const DEFAULT_LIMIT = 50;
  const MAX_LIMIT = 100;
  const effectiveLimit = Math.min(args.limit || DEFAULT_LIMIT, MAX_LIMIT);

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );

  const { data: caller, error: callerError } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', args.superadminUserId)
    .maybeSingle();

  if (callerError || !caller) throw new Error('User not found');

  const isSuperadmin = caller.email.toLowerCase() === SUPERADMIN_EMAIL || caller.role === 'superadmin';
  const isOrgAdmin = caller.organization_id === args.organizationId && (caller.role === 'admin' || isSuperadmin);

  if (!isSuperadmin && !isOrgAdmin) {
    throw new Error('You do not have permission to view members of this organization');
  }

  const { data: org, error: orgError } = await supabaseService
    .from('organizations')
    .select('*')
    .eq('id', args.organizationId)
    .maybeSingle();

  if (orgError || !org) throw new Error('Organization not found');

  let query = supabaseService
    .from('users')
    .select(
      'id, name, email, role, is_active, is_approved, department, position, avatar_url, created_at, supervisorid, employee_type, phone, travel_allowance, paid_leave_balance, sick_leave_balance, family_leave_balance'
    )
    .eq('organization_id', args.organizationId);

  if (args.cursor) {
    query = query.gt('id', args.cursor);
  }

  const { data: members, error } = await query.limit(effectiveLimit + 1);

  if (error) throw error;

  const filteredMembers = (members || []).filter(
    (m) => m.role !== 'superadmin' && m.email?.toLowerCase() !== SUPERADMIN_EMAIL
  );

  const mapped = filteredMembers.slice(0, effectiveLimit).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    isActive: m.is_active,
    isApproved: m.is_approved,
    department: m.department,
    position: m.position,
    avatarUrl: m.avatar_url,
    createdAt: m.created_at,
    supervisorid: m.supervisorid,
    employeeType: m.employee_type,
    phone: m.phone,
    travelAllowance: m.travel_allowance,
    paidLeaveBalance: m.paid_leave_balance,
    sickLeaveBalance: m.sick_leave_balance,
    familyLeaveBalance: m.family_leave_balance,
  }));

  return mapped;
}

// ── SUPERADMIN: Remove Org Admin ─────────────────────────────────────────────

export async function removeOrgAdmin(args: {
  superadminUserId: string;
  userId: string;
}) {
  await verifySuperadmin(args.superadminUserId);

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: user, error: userError } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', args.userId)
    .maybeSingle();

  if (userError || !user) throw new Error('User not found');
  if (user.role !== 'admin') throw new Error('User is not an admin');

  const { error } = await supabaseService
    .from('users')
    .update({ role: 'employee' })
    .eq('id', args.userId);

  if (error) throw error;
  return user.id;
}

// ── PUBLIC: Search Organizations ─────────────────────────────────────────────

export async function searchOrganizations(searchQuery: string) {
  if (!searchQuery || searchQuery.trim().length < 2) return [];

  const q = searchQuery.toLowerCase().trim();
  const supabase = await createClient();

  const { data: bySlug } = await supabase
    .from('organizations')
    .select('id, name, slug, industry, plan')
    .eq('slug', q);

  const { data: allActive } = await supabase
    .from('organizations')
    .select('id, name, slug, industry, plan')
    .eq('is_active', true);

  const byName = (allActive || []).filter(
    (org) =>
      org.name.toLowerCase().includes(q) || org.slug.includes(q)
  );

  const merged = [...(bySlug || []), ...byName];
  const seen = new Set<string>();
  const result = merged.filter((org) => {
    if (seen.has(org.id)) return false;
    seen.add(org.id);
    return true;
  });

  return result.slice(0, 5);
}

// ── PUBLIC: Get Organization By Slug ─────────────────────────────────────────

export async function getOrganizationBySlug(slug: string) {
  const supabase = await createClient();
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, slug, industry, plan, is_active')
    .eq('slug', slug.toLowerCase())
    .maybeSingle();

  if (error || !org || !org.is_active) return null;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    industry: org.industry,
    plan: org.plan,
  };
}

// ── EMPLOYEE: Request To Join Organization ───────────────────────────────────

export async function requestToJoinOrganization(args: {
  organizationId: string;
  requestedByEmail: string;
  requestedByName: string;
}) {
  const supabase = await createClient();

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', args.organizationId)
    .maybeSingle();

  if (orgError || !org || !org.is_active) {
    throw new Error('Organization not found or inactive');
  }

  const { data: existingInvites } = await supabase
    .from('organization_invites')
    .select('*')
    .eq('requested_by_email', args.requestedByEmail);

  const alreadyPending = (existingInvites || []).find(
    (inv) =>
      inv.organization_id === args.organizationId && inv.status === 'pending'
  );

  if (alreadyPending) {
    throw new Error('You already have a pending request for this organization');
  }

  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', args.requestedByEmail)
    .maybeSingle();

  if (
    existingUser &&
    existingUser.organization_id === args.organizationId
  ) {
    throw new Error('You are already a member of this organization');
  }

  const now = Math.floor(Date.now() / 1000);

  const { data: invite, error: inviteError } = await supabase
    .from('organization_invites')
    .insert({
      organization_id: args.organizationId,
      requested_by_email: args.requestedByEmail,
      requested_by_name: args.requestedByName,
      requested_at: now,
      status: 'pending',
      created_at: now,
    })
    .select()
    .maybeSingle();

  if (inviteError) throw inviteError;
  if (!invite) throw new Error('Failed to create invite');

    // Notify org admins
  const { data: admins } = await supabase
    .from('users')
    .select('*')
    .eq('organization_id', args.organizationId)
    .eq('role', 'admin');

  for (const admin of admins || []) {
    await supabase.from('notifications').insert({
      organization_id: args.organizationId,
      userid: admin.id,
      type: 'join_request',
      title: '🙋 New Join Request',
      message: `${args.requestedByName} (${args.requestedByEmail}) wants to join ${org.name}.`,
      is_read: false,
      relatedid: invite.id,
      created_at: now,
    });
  }

  return invite.id;
}

// ── ORG ADMIN: Get Join Requests ─────────────────────────────────────────────

export async function getJoinRequests(args: {
  adminId: string;
  status?: 'pending' | 'approved' | 'rejected';
}) {
  const admin = await verifyOrgAdmin(args.adminId);
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );

  if (!admin.organization_id && admin.role === 'admin') {
    return [];
  }

  const orgId = admin.organization_id;
  let query = supabaseService.from('organization_invites').select('*');

  if (!orgId) {
    if (args.status) {
      query = query.eq('status', args.status);
    }
  } else {
    query = query.eq('organization_id', orgId);
    if (args.status) {
      query = query.eq('status', args.status);
    }
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ── ORG ADMIN: Approve Join Request ──────────────────────────────────────────

export async function approveJoinRequest(args: {
  adminId: string;
  inviteId: string;
  role: 'employee' | 'supervisor';
  department?: string;
  position?: string;
  passwordHash: string;
}) {
  const admin = await verifyOrgAdmin(args.adminId);
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );

  const { data: invite, error: inviteError } = await supabaseService
    .from('organization_invites')
    .select('*')
    .eq('id', args.inviteId)
    .maybeSingle();

  if (inviteError || !invite) throw new Error('Invite not found');
  if (invite.status !== 'pending') {
    throw new Error('This request has already been reviewed');
  }

  if (!admin.organization_id) {
    throw new Error('Admin must belong to an organization');
  }

  if (invite.organization_id !== admin.organization_id) {
    throw new Error('This request belongs to a different organization');
  }

  const { data: org, error: orgError } = await supabaseService
    .from('organizations')
    .select('*')
    .eq('id', invite.organization_id)
    .maybeSingle();

  if (orgError || !org) throw new Error('Organization not found');

  const { data: currentCount } = await supabaseService
    .from('users')
    .select('id')
    .eq('organization_id', invite.organization_id)
    .eq('is_active', true);

  if ((currentCount || []).length >= org.employee_limit) {
    throw new Error(
      `Employee limit reached (${org.employee_limit}). Upgrade your plan to add more employees.`
    );
  }

  const { data: existingUser } = await supabaseService
    .from('users')
    .select('*')
    .eq('email', invite.requested_by_email.toLowerCase())
    .maybeSingle();

  const now = Math.floor(Date.now() / 1000);
  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    const { error } = await supabaseService
      .from('users')
      .update({
        organization_id: invite.organization_id,
        role: args.role,
        employee_type: 'staff',
        department: args.department,
        position: args.position,
        is_active: true,
        is_approved: true,
        approved_by: args.adminId,
        approved_at: now,
        travel_allowance: 20000,
        paid_leave_balance: 24,
        sick_leave_balance: 10,
        family_leave_balance: 5,
      })
      .eq('id', existingUser.id);

    if (error) throw error;
  } else {
    const { data: newUser, error } = await supabaseService
      .from('users')
      .insert({
        organization_id: invite.organization_id,
        name: invite.requested_by_name,
        email: invite.requested_by_email,
        password_hash: args.passwordHash,
        role: args.role,
        employee_type: 'staff',
        department: args.department,
        position: args.position,
        is_active: true,
        is_approved: true,
        approved_by: args.adminId,
        approved_at: now,
        travel_allowance: 20000,
        paid_leave_balance: 24,
        sick_leave_balance: 10,
        family_leave_balance: 5,
        created_at: now,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!newUser) throw new Error('Failed to create user');
    userId = newUser.id;
  }

  await supabaseService
    .from('organization_invites')
    .update({
      status: 'approved',
      reviewed_by: args.adminId,
      reviewed_at: now,
      userid: userId,
    })
    .eq('id', args.inviteId);

  await supabaseService.from('notifications').insert({
    organization_id: invite.organization_id,
    userid: userId,
    type: 'join_approved',
    title: `✅ Welcome to ${org.name}!`,
    message: `Your request to join ${org.name} has been approved by ${admin.name}. You can now log in.`,
    is_read: false,
    relatedid: userId,
    created_at: now,
  });

  return { userId, inviteId: args.inviteId };
}

// ── ORG ADMIN: Reject Join Request ───────────────────────────────────────────

export async function rejectJoinRequest(args: {
  adminId: string;
  inviteId: string;
  reason?: string;
}) {
  const admin = await verifyOrgAdmin(args.adminId);
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );

  const { data: invite, error: inviteError } = await supabaseService
    .from('organization_invites')
    .select('*')
    .eq('id', args.inviteId)
    .maybeSingle();

  if (inviteError || !invite) throw new Error('Invite not found');
  if (invite.status !== 'pending') {
    throw new Error('This request has already been reviewed');
  }

  if (!admin.organization_id) {
    throw new Error('Admin must belong to an organization');
  }

  if (invite.organization_id !== admin.organization_id) {
    throw new Error('This request belongs to a different organization');
  }

  const now = Math.floor(Date.now() / 1000);
  const { error } = await supabaseService
    .from('organization_invites')
    .update({
      status: 'rejected',
      reviewed_by: args.adminId,
      reviewed_at: now,
      rejection_reason: args.reason,
    })
    .eq('id', args.inviteId);

  if (error) throw error;
  return args.inviteId;
}

// ── ORG ADMIN: Generate Invite Token ─────────────────────────────────────────

export async function generateInviteToken(args: {
  adminId: string;
  inviteEmail?: string;
  expiryHours?: number;
}) {
  const admin = await verifyOrgAdmin(args.adminId);

  if (!admin.organization_id) {
    throw new Error('Admin must belong to an organization');
  }

  const token = Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2)
  ).join('');

  const expiryHours = args.expiryHours ?? 72;
  const expiry = Date.now() + expiryHours * 60 * 60 * 1000;
  const now = Math.floor(Date.now() / 1000);

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data, error } = await supabaseService
    .from('organization_invites')
    .insert({
      organization_id: admin.organization_id,
      requested_by_email: args.inviteEmail ?? '',
      requested_by_name: '',
      requested_at: now,
      status: 'pending',
      invite_token: token,
      invite_email: args.inviteEmail,
      invite_expiry: expiry,
      created_at: now,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Failed to create invite');
  return { token, inviteId: data.id, expiresAt: expiry };
}

// ── PUBLIC: Validate Invite Token ────────────────────────────────────────────

export async function validateInviteToken(token: string) {
  const supabase = await createClient();
  const { data: invite, error } = await supabase
    .from('organization_invites')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();

  if (error || !invite) return { valid: false, reason: 'Token not found' };
  if (invite.status === 'approved') return { valid: false, reason: 'Already used' };
  if (invite.invite_expiry && invite.invite_expiry < Date.now()) {
    return { valid: false, reason: 'Token expired' };
  }

  if (!invite.organization_id) {
    return { valid: false, reason: 'Invite has no organization' };
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', invite.organization_id)
    .maybeSingle();

  if (orgError || !org || !org.is_active) {
    return { valid: false, reason: 'Organization inactive' };
  }

  return {
    valid: true,
    organizationId: invite.organization_id,
    organizationName: org.name,
    organizationSlug: org.slug,
    prefilledEmail: invite.invite_email,
    inviteId: invite.id,
  };
}

// ── Get My Organization ──────────────────────────────────────────────────────

export async function getMyOrganization(userId: string) {
  const supabase = await createClient();
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user || !user.organization_id) return null;

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', user.organization_id)
    .maybeSingle();

  if (orgError) return null;
  return org;
}

// ── Get Pending Join Request Count ───────────────────────────────────────────

export async function getPendingJoinRequestCount(adminId: string) {
  const supabase = await createClient();
  const { data: admin, error: adminError } = await supabase
    .from('users')
    .select('*')
    .eq('id', adminId)
    .maybeSingle();

  if (
    adminError ||
    !admin ||
    (admin.role !== 'admin' && admin.email.toLowerCase() !== SUPERADMIN_EMAIL)
  ) {
    return 0;
  }

  if (!admin.organization_id) return 0;

  const { data: pending, error } = await supabase
    .from('organization_invites')
    .select('id')
    .eq('organization_id', admin.organization_id)
    .eq('status', 'pending');

  if (error) return 0;
  return (pending || []).length;
}

// ── SUPERADMIN: Remove Member From Organization ──────────────────────────────

export async function removeMemberFromOrganization(args: {
  superadminUserId: string;
  userId: string;
}) {
  await verifySuperadmin(args.superadminUserId);

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: user, error: userError } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', args.userId)
    .maybeSingle();

  if (userError || !user) throw new Error('User not found');

  if (
    user.email.toLowerCase() === SUPERADMIN_EMAIL ||
    user.role === 'superadmin'
  ) {
    throw new Error('Cannot remove the superadmin from any organization');
  }

  const { error } = await supabaseService
    .from('users')
    .update({
      organization_id: null,
      is_active: false,
    })
    .eq('id', args.userId);

  if (error) throw error;
  return user.id;
}

// ── Get Organizations For Picker ─────────────────────────────────────────────

export async function getOrganizationsForPicker(userId: string | undefined) {
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );

  if (!userId) {
    const { data: orgs, error } = await supabaseService
      .from('organizations')
      .select('id, name, slug, industry, logo_url, country')
      .eq('is_active', true);

    if (error) throw error;
    return (orgs || []).map((org: any) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      industry: org.industry || undefined,
      logoUrl: org.logo_url || undefined,
      country: org.country || undefined,
    }));
  }

  const { data: user, error: userError } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) {
    const { data: orgs, error } = await supabaseService
      .from('organizations')
      .select('id, name, slug, industry, logo_url, country')
      .eq('is_active', true);

    if (error) throw error;
    return (orgs || []).map((org: any) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      industry: org.industry || undefined,
      logoUrl: org.logo_url || undefined,
      country: org.country || undefined,
    }));
  }

  if (user.email.toLowerCase() === SUPERADMIN_EMAIL) {
    const { data: orgs, error } = await supabaseService
      .from('organizations')
      .select('id, name, slug, industry, logo_url, country')
      .eq('is_active', true);

    if (error) throw error;
    return (orgs || []).map((org: any) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      industry: org.industry || undefined,
      logoUrl: org.logo_url || undefined,
      country: org.country || undefined,
    }));
  }

  if (!user.organization_id) {
    const { data: orgs, error } = await supabaseService
      .from('organizations')
      .select('id, name, slug, industry, logo_url, country')
      .eq('is_active', true);

    if (error) throw error;
    return (orgs || []).map((org: any) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      industry: org.industry || undefined,
      logoUrl: org.logo_url || undefined,
      country: org.country || undefined,
    }));
  }

  const { data: org, error } = await supabaseService
    .from('organizations')
    .select('id, name, slug, industry, logo_url, country')
    .eq('id', user.organization_id)
    .maybeSingle();

  if (error || !org) return [];
  return [{
    id: org.id,
    name: org.name,
    slug: org.slug,
    industry: org.industry || undefined,
    logoUrl: org.logo_url || undefined,
    country: org.country || undefined,
  }];
}

// ── SUPERADMIN: Assign User as Org Admin ──────────────────────────────────────

export async function assignUserAsOrgAdmin(args: {
  superadminUserId: string;
  userEmail: string;
  organizationId: string;
}) {
  await verifySuperadmin(args.superadminUserId);

  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );
  const { data: user, error: userError } = await supabaseService
    .from('users')
    .select('*')
    .eq('email', args.userEmail.toLowerCase())
    .maybeSingle();

  if (userError || !user) {
    throw new Error(`User with email ${args.userEmail} not found`);
  }

  const { data: org, error: orgError } = await supabaseService
    .from('organizations')
    .select('*')
    .eq('id', args.organizationId)
    .maybeSingle();

  if (orgError || !org) {
    throw new Error('Organization not found');
  }

  const { error } = await supabaseService
    .from('users')
    .update({
      organization_id: args.organizationId,
      role: 'admin',
      updated_at: Math.floor(Date.now() / 1000),
    })
    .eq('id', user.id);

  if (error) throw error;
  return {
    userId: user.id,
    email: args.userEmail,
    role: 'admin',
    organizationId: args.organizationId,
  };
}

// ── Organization Requests ────────────────────────────────────────────────────

export async function requestOrganization(args: {
  name: string;
  slug: string;
  email: string;
  password: string;
  userName: string;
  phone?: string;
  plan: 'professional' | 'enterprise';
  country?: string;
  industry?: string;
  teamSize?: string;
  description?: string;
}) {
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );

  const { data: existing } = await supabaseService
    .from('organization_requests')
    .select('id')
    .eq('requester_email', args.email)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    throw new Error('You already have a pending request');
  }

  const { error } = await supabaseService
    .from('organization_requests')
    .insert({
      requested_name: args.name,
      requested_slug: normalizeSlug(args.slug),
      requested_plan: args.plan,
      requester_name: args.userName,
      requester_email: args.email.toLowerCase(),
      requester_phone: args.phone,
      industry: args.industry,
      team_size: args.teamSize,
      country: args.country,
      description: args.description,
      status: 'pending',
      created_at: Math.floor(Date.now() / 1000),
    });

  if (error) throw error;
  return { success: true };
}

export async function createStarterOrganization(args: {
  name: string;
  slug: string;
  email: string;
  password: string;
  userName: string;
  phone?: string;
  country?: string;
  industry?: string;
}) {
  const supabaseService = createSupabaseClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
  );

  const slug = normalizeSlug(args.slug);
  if (!slug) throw new Error('Invalid organization slug');

  const { data: existingOrg } = await supabaseService
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existingOrg) {
    throw new Error(`Organization with slug "${slug}" already exists`);
  }

  const { data: org, error: orgError } = await supabaseService
    .from('organizations')
    .insert({
      name: args.name,
      slug,
      plan: 'starter',
      is_active: true,
      created_by_superadmin: false,
      timezone: 'UTC',
      country: args.country,
      industry: args.industry,
      employee_limit: PLAN_EMPLOYEE_LIMITS.starter,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    })
    .select()
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org) throw new Error('Failed to create organization');

  const { error: userError } = await supabaseService
    .from('users')
    .insert({
      name: args.userName,
      email: args.email.toLowerCase(),
      password_hash: args.password,
      role: 'admin',
      organization_id: org.id,
      is_active: true,
      is_approved: true,
      employee_type: 'staff',
      phone: args.phone,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    });

  if (userError) throw userError;
  return { success: true, organizationId: org.id };
}
