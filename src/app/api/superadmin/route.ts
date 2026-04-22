import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { serverT } from '@/lib/i18n/server-actions-i18n';

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: serverT('superadmin.api.unauthorized', 'Unauthorized') }, { status: 401 }) };

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'superadmin') {
    return { error: NextResponse.json({ error: serverT('superadmin.api.forbidden', 'Forbidden') }, { status: 403 }) };
  }
  return { user, profile, supabase: supabaseService };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;
    const { user, supabase: supabaseService } = auth;

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    switch (action) {
      case 'get-user-360': {
        const userId = searchParams.get('userId');
        if (!userId) {
          return NextResponse.json({ error: serverT('superadmin.api.missingUserId', 'Missing userId') }, { status: 400 });
        }

        const { data: userProfile } = await supabaseService
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!userProfile) {
            return NextResponse.json({ error: serverT('superadmin.api.userNotFound', 'User not found') }, { status: 404 });
        }

        let organization = null;
        if (userProfile.organization_id) {
          const { data: org } = await supabaseService
            .from('organizations')
            .select('*')
            .eq('id', userProfile.organization_id)
            .maybeSingle();
          organization = org;
        }

        const { data: leaves } = await supabaseService
          .from('leave_requests')
          .select('*')
          .eq('userid', userId)
          .order('created_at', { ascending: false });

        const { data: tasks } = await supabaseService
          .from('tasks')
          .select('*')
          .eq('assigned_to', userId)
          .order('created_at', { ascending: false });

        const { data: driverRequests } = await supabaseService
          .from('driver_requests')
          .select('*')
          .eq('requesterid', userId)
          .order('created_at', { ascending: false });

        const { data: supportTickets } = await supabaseService
          .from('tickets')
          .select('*')
          .eq('createdBy', userId)
          .order('createdAt', { ascending: false });

        const { data: loginAttempts } = await supabaseService
          .from('login_attempts')
          .select('*')
          .eq('userid', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        const { data: notifications } = await supabaseService
          .from('notifications')
          .select('*')
          .eq('userid', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        const { data: chatMessages } = await supabaseService
          .from('chat_messages')
          .select('*')
          .eq('senderid', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        const approvedLeaves = (leaves || []).filter((l: any) => l.status === 'approved');
        const pendingLeaves = (leaves || []).filter((l: any) => l.status === 'pending');
        const completedTasks = (tasks || []).filter((t: any) => t.status === 'completed');

        const stats = {
          totalLeaves: (leaves || []).length,
          pendingLeaves: pendingLeaves.length,
          approvedLeaves: approvedLeaves.length,
          totalTasks: (tasks || []).length,
          completedTasks: completedTasks.length,
          totalDriverRequests: (driverRequests || []).length,
          totalTickets: (supportTickets || []).length,
          totalLoginAttempts: (loginAttempts || []).length,
        };

        return NextResponse.json({
          data: {
            user: {
              id: userProfile.id,
              name: userProfile.name,
              email: userProfile.email,
              role: userProfile.role,
              department: userProfile.department,
              position: userProfile.position,
              phone: userProfile.phone,
              location: userProfile.location,
              dateOfBirth: userProfile.date_of_birth,
              avatarUrl: userProfile.avatar_url,
              isActive: userProfile.is_active,
              isApproved: userProfile.is_approved,
            },
            organization,
            leaves: (leaves || []).map((l: any) => ({
              id: l.id,
              type: l.type,
              startDate: l.start_date,
              endDate: l.end_date,
              totalDays: l.total_days,
              status: l.status,
              reason: l.reason,
              reviewComment: l.review_comment,
              reviewedBy: l.reviewed_by,
              createdAt: l.created_at,
            })),
            tasks: (tasks || []).map((t: any) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              deadline: t.deadline,
              createdAt: t.created_at,
            })),
            driverRequests: (driverRequests || []).map((d: any) => ({
              id: d.id,
              status: d.status,
              startTime: d.start_time,
              endTime: d.end_time,
              tripFrom: d.trip_from,
              tripTo: d.trip_to,
              tripPurpose: d.trip_purpose,
              driverId: d.driverid,
              requesterId: d.requesterid,
            })),
            supportTickets: (supportTickets || []).map((t: any) => ({
              id: t.id,
              ticketNumber: t.ticket_number,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              createdAt: t.created_at,
            })),
            stats,
            loginAttempts: loginAttempts || [],
            notifications: notifications || [],
            chatMessages: chatMessages || [],
          },
        });
      }

      case 'global-search': {
        const query = searchParams.get('query') || '';
        const limit = parseInt(searchParams.get('limit') || '20');

        if (query.length < 2) {
          return NextResponse.json({
            data: {
              users: [],
              organizations: [],
              leaveRequests: [],
              tasks: [],
              driverRequests: [],
              supportTickets: [],
              total: 0,
            },
          });
        }

        const searchPattern = `%${query}%`;

        const { data: users } = await supabaseService
          .from('users')
          .select('id, name, email, organization_id')
          .ilike('name', searchPattern)
          .limit(limit);

        const { data: organizations } = await supabaseService
          .from('organizations')
          .select('id, name, plan, slug')
          .ilike('name', searchPattern)
          .limit(limit);

        const { data: leaveRequests } = await supabaseService
          .from('leave_requests')
          .select(`
            id,
            userid,
            type,
            start_date,
            end_date,
            status,
            user:users!leave_requests_userid_fkey(name)
          `)
          .or(`type.ilike.${searchPattern}`)
          .limit(limit);

        const { data: tasks } = await supabaseService
          .from('tasks')
          .select('id, title, description, status, priority')
          .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
          .limit(limit);

        const { data: driverRequests } = await supabaseService
          .from('driver_requests')
          .select(`
            id,
            requesterid,
            status,
            trip_from,
            trip_to,
            trip_purpose,
            requester:users!driver_requests_requesterid_fkey(name)
          `)
          .ilike('status', searchPattern)
          .limit(limit);

        const { data: supportTickets } = await supabaseService
          .from('tickets')
          .select('id, title, description, status, priority')
          .or(`title.ilike.${searchPattern}`)
          .limit(limit);

        const mappedLeaveRequests = (leaveRequests || []).map((l: any) => ({
          id: l.id,
          userName: l.user?.name || 'Unknown',
          type: l.type,
          startDate: l.start_date,
          endDate: l.end_date,
          status: l.status,
        }));

        const mappedDriverRequests = (driverRequests || []).map((d: any) => ({
          id: d.id,
          requesterName: d.requester?.name || 'Unknown',
          status: d.status,
          tripFrom: d.trip_from,
          tripTo: d.trip_to,
          tripPurpose: d.trip_purpose,
        }));

        return NextResponse.json({
          data: {
            users: users || [],
            organizations: organizations || [],
            leaveRequests: mappedLeaveRequests,
            tasks: tasks || [],
            driverRequests: mappedDriverRequests,
            supportTickets: supportTickets || [],
            total: (users?.length || 0) + (organizations?.length || 0) +
                   (leaveRequests?.length || 0) + (tasks?.length || 0) +
                   (driverRequests?.length || 0) + (supportTickets?.length || 0),
          },
        });
      }

        default:
          return NextResponse.json({ error: serverT('superadmin.api.invalidAction', 'Invalid action') }, { status: 400 });
    }
  } catch (error) {
    console.error('[Superadmin API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : serverT('superadmin.api.internalServerError', 'Internal server error') },
      { status: 500 }
    );
  }
}
