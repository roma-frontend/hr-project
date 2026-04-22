import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, profile, supabase: supabaseService };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { profile, supabase: supabaseService } = auth;

    const searchParams = req.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
    }

    if (profile.role !== 'superadmin' && profile.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: requests, error } = await supabaseService
      .from('organization_join_requests')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (requests || []).map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      requesterId: r.requester_id,
      requesterName: r.requester_name,
      requesterEmail: r.requester_email,
      requesterAvatar: r.requester_avatar,
      status: r.status,
      requestedAt: r.created_at,
      reviewedAt: r.reviewed_at,
      reviewerId: r.reviewed_by,
      rejectionReason: r.review_notes,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Join requests API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user: authUser, profile, supabase: supabaseService } = auth;

    const body = await req.json();
    const { action } = body;

    if (action === 'approve') {
      const { inviteId } = body;

      if (!inviteId) {
        return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 });
      }

      const { data: request } = await supabaseService
        .from('organization_join_requests')
        .select('organization_id')
        .eq('id', inviteId)
        .maybeSingle();

      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      if (profile.role !== 'superadmin' && profile.organization_id !== request.organization_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { data: updatedRequest, error } = await supabaseService
        .from('organization_join_requests')
        .update({
          status: 'approved',
          reviewed_by: authUser.id,
          reviewed_at: Date.now(),
        })
        .eq('id', inviteId)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!updatedRequest) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      return NextResponse.json({
        id: updatedRequest.id,
        organizationId: updatedRequest.organization_id,
        status: updatedRequest.status,
      });
    }

    if (action === 'reject') {
      const { inviteId, reason } = body;

      if (!inviteId) {
        return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 });
      }

      const { data: request } = await supabaseService
        .from('organization_join_requests')
        .select('organization_id')
        .eq('id', inviteId)
        .maybeSingle();

      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      if (profile.role !== 'superadmin' && profile.organization_id !== request.organization_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { data: updatedRequest, error } = await supabaseService
        .from('organization_join_requests')
        .update({
          status: 'rejected',
          reviewed_by: authUser.id,
          reviewed_at: Date.now(),
          review_notes: reason,
        })
        .eq('id', inviteId)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!updatedRequest) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      return NextResponse.json({
        id: updatedRequest.id,
        organizationId: updatedRequest.organization_id,
        status: updatedRequest.status,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Join requests API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
