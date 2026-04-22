import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  createOrganization,
  listAllOrganizations,
  getAllOrganizations,
  updateOrganization,
  assignOrgAdmin,
  getOrganizationById,
  getOrgMembers,
  removeOrgAdmin,
  searchOrganizations,
  getOrganizationBySlug,
  requestToJoinOrganization,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  generateInviteToken,
  validateInviteToken,
  getMyOrganization,
  getPendingJoinRequestCount,
  removeMemberFromOrganization,
  getOrganizationsForPicker,
  assignUserAsOrgAdmin,
} from '@/lib/server/organizations';
import {
  listAllWithSubscriptions,
  createManualSubscription,
  cancelSubscription,
} from '@/lib/server/subscriptions';

const SUPERADMIN_EMAIL = 'romangulanyan@gmail.com';

async function ensureUserProfile(user: any) {
  const supabaseService = createServiceClient();

  const { data: existingProfile } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfile) return existingProfile;

  if (user.email?.toLowerCase() === SUPERADMIN_EMAIL) {
    const { data: inserted, error } = await supabaseService
      .from('users')
      .insert({
        id: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.name || 'Superadmin',
        email: user.email,
        password_hash: 'oauth_managed',
        role: 'superadmin',
        employee_type: 'staff',
        is_active: true,
        is_approved: true,
        travel_allowance: 9999,
        paid_leave_balance: 999,
        sick_leave_balance: 999,
        family_leave_balance: 999,
        created_at: Math.floor(Date.now() / 1000),
        presence_status: 'available',
      })
      .select()
      .maybeSingle();

    if (error) throw new Error(`Failed to create superadmin profile: ${error.message}`);
    console.log('[org] Auto-created superadmin profile:', user.id);
    return inserted;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'get-for-picker') {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let userId: string | undefined;
      if (user) {
        const userProfile = await ensureUserProfile(user);
        userId = userProfile?.id;
      }

      const orgs = await getOrganizationsForPicker(userId);
      return NextResponse.json({ data: orgs });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await ensureUserProfile(user);

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    switch (action) {
      case 'list-all': {
        const orgs = await listAllOrganizations(userProfile.id);
        return NextResponse.json({ data: orgs });
      }

      case 'get-all': {
        const orgs = await getAllOrganizations(
          userProfile.role === 'superadmin' ? userProfile.id : undefined
        );
        return NextResponse.json({ data: orgs });
      }

      case 'get-by-id': {
        const organizationId = searchParams.get('organizationId');
        if (!organizationId) {
          return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
        }
        const org = await getOrganizationById({
          callerUserId: userProfile.id,
          organizationId,
        });
        return NextResponse.json({ data: org });
      }

      case 'get-members': {
        const organizationId = searchParams.get('organizationId');
        if (!organizationId) {
          return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
        }
        const members = await getOrgMembers({
          superadminUserId: userProfile.id,
          organizationId,
          cursor: searchParams.get('cursor') || undefined,
          limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
        });
        return NextResponse.json({ data: members });
      }

      case 'search': {
        const query = searchParams.get('q');
        if (!query) {
          return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
        }
        const results = await searchOrganizations(query);
        return NextResponse.json({ data: results });
      }

      case 'get-by-slug': {
        const slug = searchParams.get('slug');
        if (!slug) {
          return NextResponse.json({ error: 'Slug parameter is required' }, { status: 400 });
        }
        const org = await getOrganizationBySlug(slug);
        return NextResponse.json({ data: org });
      }

      case 'get-join-requests': {
        const requests = await getJoinRequests({
          adminId: userProfile.id,
          status: (searchParams.get('status') as any) || undefined,
        });
        return NextResponse.json({ data: requests });
      }

      case 'get-my-org': {
        const org = await getMyOrganization(userProfile.id);
        return NextResponse.json({ data: org });
      }

      case 'get-pending-count': {
        const count = await getPendingJoinRequestCount(userProfile.id);
        return NextResponse.json({ data: count });
      }

      case 'get-for-picker': {
        const orgs = await getOrganizationsForPicker(userProfile.id);
        return NextResponse.json({ data: orgs });
      }

      case 'validate-invite': {
        const token = searchParams.get('token');
        if (!token) {
          return NextResponse.json({ error: 'Token parameter is required' }, { status: 400 });
        }
        const result = await validateInviteToken(token);
        return NextResponse.json({ data: result });
      }

      case 'list-subscriptions': {
        const subs = await listAllWithSubscriptions(userProfile.id);
        return NextResponse.json({ data: subs });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[org/GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await ensureUserProfile(user);

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const action = request.nextUrl.searchParams.get('action');

    switch (action) {
      case 'create': {
        const result = await createOrganization({
          superadminUserId: userProfile.id,
          name: body.name,
          slug: body.slug,
          plan: body.plan,
          timezone: body.timezone,
          country: body.country,
          industry: body.industry,
        });
        return NextResponse.json({ data: result }, { status: 201 });
      }

      case 'update': {
        const result = await updateOrganization({
          superadminUserId: userProfile.id,
          organizationId: body.organization_id,
          name: body.name,
          plan: body.plan,
          isActive: body.isActive,
          timezone: body.timezone,
          country: body.country,
          industry: body.industry,
        });
        return NextResponse.json({ data: result });
      }

      case 'assign-admin': {
        const result = await assignOrgAdmin({
          superadminUserId: userProfile.id,
          userId: body.userId,
          organizationId: body.organization_id,
        });
        return NextResponse.json({ data: result });
      }

      case 'remove-admin': {
        const result = await removeOrgAdmin({
          superadminUserId: userProfile.id,
          userId: body.userId,
        });
        return NextResponse.json({ data: result });
      }

      case 'request-join': {
        const result = await requestToJoinOrganization({
          organizationId: body.organization_id,
          requestedByEmail: body.requestedByEmail,
          requestedByName: body.requestedByName,
        });
        return NextResponse.json({ data: result }, { status: 201 });
      }

      case 'approve-request': {
        const result = await approveJoinRequest({
          adminId: userProfile.id,
          inviteId: body.inviteId,
          role: body.role,
          department: body.department,
          position: body.position,
          passwordHash: body.passwordHash,
        });
        return NextResponse.json({ data: result });
      }

      case 'reject-request': {
        const result = await rejectJoinRequest({
          adminId: userProfile.id,
          inviteId: body.inviteId,
          reason: body.reason,
        });
        return NextResponse.json({ data: result });
      }

      case 'generate-invite': {
        const result = await generateInviteToken({
          adminId: userProfile.id,
          inviteEmail: body.inviteEmail,
          expiryHours: body.expiryHours,
        });
        return NextResponse.json({ data: result });
      }

      case 'remove-member': {
        const result = await removeMemberFromOrganization({
          superadminUserId: userProfile.id,
          userId: body.userId,
        });
        return NextResponse.json({ data: result });
      }

      case 'create-manual-subscription': {
        const result = await createManualSubscription({
          superadminUserId: userProfile.id,
          organizationId: body.organization_id,
          plan: body.plan,
          customPrice: body.customPrice,
          notes: body.notes,
        });
        return NextResponse.json({ data: result }, { status: 201 });
      }

      case 'cancel-subscription': {
        const result = await cancelSubscription({
          superadminUserId: userProfile.id,
          subscriptionId: body.subscriptionId,
        });
        return NextResponse.json({ data: result });
      }

      case 'assign-user-as-admin': {
        const result = await assignUserAsOrgAdmin({
          superadminUserId: userProfile.id,
          userEmail: body.userEmail,
          organizationId: body.organization_id,
        });
        return NextResponse.json({ data: result });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[org/POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
