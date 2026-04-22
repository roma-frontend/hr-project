import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseService = createServiceClient();

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    switch (action) {
      case 'get-analytics-overview': {
        const organizationId = searchParams.get('organizationId');

        let usersQuery = supabaseService
          .from('users')
          .select('*')
          .neq('role', 'superadmin');

        let leavesQuery = supabaseService
          .from('leave_requests')
          .select('*');

        if (organizationId) {
          usersQuery = usersQuery.eq('organization_id', organizationId);
          leavesQuery = leavesQuery.eq('organization_id', organizationId);
        }

        const [{ data: users }, { data: leaves }] = await Promise.all([
          usersQuery,
          leavesQuery,
        ]);

        const filteredUsers = (users || []).filter((u) => u.is_active);
        const totalEmployees = filteredUsers.length;
        const pendingApprovals = filteredUsers.filter((u) => !u.is_approved).length;

        const totalLeaves = (leaves || []).length;
        const pendingLeaves = (leaves || []).filter((l) => l.status === 'pending').length;
        const approvedLeaves = (leaves || []).filter((l) => l.status === 'approved').length;

        const approvedWithTime = (leaves || []).filter(
          (l) => l.status === 'approved' && l.reviewed_at && l.created_at
        );
        const avgApprovalTime =
          approvedWithTime.length > 0
            ? approvedWithTime.reduce(
                (sum, l) => sum + (l.reviewed_at! - l.created_at) / (1000 * 60 * 60),
                0
              ) / approvedWithTime.length
            : 0;

        return NextResponse.json({
          data: {
            totalEmployees,
            pendingApprovals,
            totalLeaves,
            pendingLeaves,
            approvedLeaves,
            avgApprovalTime: Math.round(avgApprovalTime * 10) / 10,
            users: users || [],
            leaves: leaves || [],
          },
        });
      }

      case 'get-department-stats': {
        const organizationId = searchParams.get('organizationId');

        let query = supabaseService
          .from('users')
          .select('*')
          .neq('role', 'superadmin');

        if (organizationId) {
          query = query.eq('organization_id', organizationId);
        }

        const { data: users } = await query;

        const stats = (users || []).reduce(
          (acc, user) => {
            const dept = user.department || 'Unassigned';
            if (!acc[dept]) {
              acc[dept] = {
                department: dept,
                employees: 0,
                totalPaidLeave: 0,
                totalSickLeave: 0,
                totalFamilyLeave: 0,
                avgPaidLeave: 0,
                avgSickLeave: 0,
                avgFamilyLeave: 0,
              };
            }
            acc[dept].employees += 1;
            acc[dept].totalPaidLeave += user.paid_leave_balance || 0;
            acc[dept].totalSickLeave += user.sick_leave_balance || 0;
            acc[dept].totalFamilyLeave += user.family_leave_balance || 0;
            return acc;
          },
          {} as Record<string, any>
        );

        Object.values(stats).forEach((dept: any) => {
          const count = dept.employees;
          dept.avgPaidLeave = count > 0 ? Math.round(dept.totalPaidLeave / count) : 0;
          dept.avgSickLeave = count > 0 ? Math.round(dept.totalSickLeave / count) : 0;
          dept.avgFamilyLeave = count > 0 ? Math.round(dept.totalFamilyLeave / count) : 0;
        });

        return NextResponse.json({ data: Object.values(stats) });
      }

      case 'get-leave-trends': {
        const organizationId = searchParams.get('organizationId');

        let query = supabaseService
          .from('leave_requests')
          .select('*');

        if (organizationId) {
          query = query.eq('organization_id', organizationId);
        }

        const { data: leaves } = await query;

        const now = Date.now();
        const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000;

        const recentLeaves = (leaves || []).filter((l) => l.created_at >= sixMonthsAgo);

        return NextResponse.json({ data: recentLeaves });
      }

      case 'get-user-analytics': {
        const userId = searchParams.get('userId');
        if (!userId) {
          return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const { data: userData } = await supabaseService
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!userData) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { data: userLeaves } = await supabaseService
          .from('leave_requests')
          .select('*')
          .eq('userid', userId);

        const totalDaysTaken = (userLeaves || [])
          .filter((l) => l.status === 'approved')
          .reduce((sum, l) => sum + (l.total_days || 0), 0);

        const pendingDays = (userLeaves || [])
          .filter((l) => l.status === 'pending')
          .reduce((sum, l) => sum + (l.total_days || 0), 0);

        const leavesByType = (userLeaves || []).reduce(
          (acc, leave) => {
            acc[leave.type] = (acc[leave.type] || 0) + (leave.status === 'approved' ? leave.total_days : 0);
            return acc;
          },
          {} as Record<string, number>
        );

        return NextResponse.json({
          data: {
            user: userData,
            totalDaysTaken,
            pendingDays,
            leavesByType,
            userLeaves: userLeaves || [],
            balances: {
              paid: userData.paid_leave_balance,
              sick: userData.sick_leave_balance,
              family: userData.family_leave_balance,
            },
          },
        });
      }

      case 'get-team-calendar': {
        const organizationId = searchParams.get('organizationId');

        let query = supabaseService
          .from('leave_requests')
          .select('*')
          .eq('status', 'approved');

        if (organizationId) {
          query = query.eq('organization_id', organizationId);
        }

        const { data: leaves } = await query;

        const now = Date.now();
        const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;

        const upcomingLeaves = (leaves || []).filter((l) => {
          const startDate = new Date(l.start_date).getTime();
          const endDate = new Date(l.end_date).getTime();
          return startDate <= thirtyDaysFromNow && endDate >= now;
        });

        const userIds = [...new Set(upcomingLeaves.map((l) => l.userid))];
        const { data: users } = userIds.length > 0
          ? await supabaseService
              .from('users')
              .select('id, name, department')
              .in('id', userIds)
          : { data: [] };

        const userMap = new Map((users || []).map((u) => [u.id, u]));

        const enrichedLeaves = upcomingLeaves.map((leave) => ({
          ...leave,
          userName: userMap.get(leave.userid)?.name || 'Unknown',
          userDepartment: userMap.get(leave.userid)?.department,
        }));

        return NextResponse.json({ data: enrichedLeaves });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Analytics API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
