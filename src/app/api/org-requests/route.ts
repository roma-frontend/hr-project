import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  requestOrganization,
  createStarterOrganization,
} from '@/lib/server/organizations';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseService = createServiceClient();

    const { data: userProfile } = await supabaseService
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile || !['admin', 'superadmin'].includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'get-all') {
      const status = searchParams.get('status');

      let query = supabaseService
        .from('organization_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status as 'pending' | 'approved' | 'rejected');
      }

      const { data: requests } = await query;

      const mapped = (requests || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        requestedName: r.requested_name,
        requestedSlug: r.requested_slug,
        requestedPlan: r.requested_plan,
        requesterName: r.requester_name,
        requesterEmail: r.requester_email,
        requesterPhone: r.requester_phone,
        industry: r.industry,
        teamSize: r.team_size,
        country: r.country,
        description: r.description,
        rejectionReason: r.rejection_reason,
        createdAt: r.created_at,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
      }));

      return NextResponse.json({ data: mapped });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Org Requests API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'request-org') {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const body = await req.json();
      const {
        name,
        slug,
        email,
        password,
        userName,
        phone,
        plan,
        country,
        industry,
        teamSize,
        description,
      } = body;

      if (!name || !slug || !email || !password || !userName || !plan) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      await requestOrganization({
        name,
        slug,
        email,
        password,
        userName,
        phone,
        plan,
        country,
        industry,
        teamSize,
        description,
      });

      return NextResponse.json({ data: { success: true } });
    }

    if (action === 'create-starter-org') {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const body = await req.json();
      const {
        name,
        slug,
        email,
        password,
        userName,
        phone,
        country,
        industry,
      } = body;

      if (!name || !slug || !email || !password || !userName) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const result = await createStarterOrganization({
        name,
        slug,
        email,
        password,
        userName,
        phone,
        country,
        industry,
      });

      return NextResponse.json({ data: result });
    }

    if (action === 'approve') {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const supabaseService = createServiceClient();

      const { data: userProfile } = await supabaseService
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!userProfile || !['admin', 'superadmin'].includes(userProfile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const body = await req.json();
      const { requestId } = body;

      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
      }

      const { data: request } = await supabaseService
        .from('organization_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      if (request.status !== 'pending') {
        return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
      }

      const now = Date.now();

      const { data: org, error: orgError } = await supabaseService
        .from('organizations')
        .insert({
          name: request.requested_name,
          slug: request.requested_slug,
          plan: request.requested_plan,
          is_active: true,
          created_by_superadmin: userProfile.role === 'superadmin',
          country: request.country,
          industry: request.industry,
          created_at: now,
          updated_at: now,
        })
        .select()
        .maybeSingle();

      if (orgError) {
        return NextResponse.json({ error: orgError.message }, { status: 500 });
      }

      if (!org) {
        return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
      }

      return NextResponse.json({ data: { success: true, organization_id: org.id } });
    }

    if (action === 'reject') {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const supabaseService = createServiceClient();

      const { data: userProfile } = await supabaseService
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!userProfile || !['admin', 'superadmin'].includes(userProfile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const body = await req.json();
      const { requestId, reason } = body;

      if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
      }

      const { data: request } = await supabaseService
        .from('organization_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      if (request.status !== 'pending') {
        return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
      }

      const now = Date.now();

      const { error } = await supabaseService
        .from('organization_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: now,
          rejection_reason: reason || null,
        })
        .eq('id', requestId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data: { success: true } });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Org Requests API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
