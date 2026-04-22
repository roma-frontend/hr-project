import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const supabaseService = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type');

    const { data: userProfile } = await supabaseService
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isSuperadmin = userProfile.role === 'superadmin';

    if (type === 'security-stats' && isSuperadmin) {
      const hours = 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data: attempts } = await supabaseService
        .from('login_attempts')
        .select('*')
        .gte('created_at', since);

      const total = attempts?.length || 0;
      const failed = attempts?.filter((a: any) => !a.success).length || 0;
      const blocked = attempts?.filter((a: any) => a.blocked_reason).length || 0;
      const highRisk = attempts?.filter((a: any) => (a.risk_score || 0) >= 60).length || 0;

      return NextResponse.json({
        total,
        failed,
        blocked,
        highRisk,
      });
    }

    if (type === 'leaves') {
      let query = supabaseService.from('leave_requests').select('*').order('created_at', { ascending: false });

      if (!isSuperadmin && userProfile.organization_id) {
        query = query.eq('organization_id', userProfile.organization_id);
      }

      const { data: leaves } = await query;

      const { data: users } = await supabaseService.from('users').select('id, name, avatar_url, role');

      const enrichedLeaves = (leaves || []).map((leave: any) => {
        const user = users?.find((u: any) => u.id === leave.userid);
        return {
          ...leave,
          id: leave.id,
          userId: leave.userid,
          userName: user?.name || 'Unknown',
          userAvatar: user?.avatar_url,
          startDate: leave.start_date,
          endDate: leave.end_date,
          createdAt: leave.created_at,
        };
      });

      return NextResponse.json(enrichedLeaves);
    }

    if (type === 'users') {
      let query = supabaseService.from('users').select('*');

      if (!isSuperadmin && userProfile.organization_id) {
        query = query.eq('organization_id', userProfile.organization_id);
      }

      const { data: users } = await query;

      const filteredUsers = (users || [])
        .filter((u: any) => u.role !== 'superadmin')
        .map((u: any) => ({
          ...u,
          id: u.id,
          organization_id: u.organization_id,
          isActive: u.is_active,
          isApproved: u.is_approved,
          paidLeaveBalance: u.paid_leave_balance || 0,
          sickLeaveBalance: u.sick_leave_balance || 0,
          familyLeaveBalance: u.family_leave_balance || 0,
        }));

      return NextResponse.json(filteredUsers);
    }

    if (type === 'user-leaves' && user.id) {
      const { data: userLeaves } = await supabaseService
        .from('leave_requests')
        .select('*')
        .eq('userid', user.id)
        .order('created_at', { ascending: false });

      const enriched = (userLeaves || []).map((l: any) => ({
        ...l,
        id: l.id,
        userId: l.userid,
        startDate: l.start_date,
        endDate: l.end_date,
        createdAt: l.created_at,
      }));

      return NextResponse.json(enriched);
    }

    if (type === 'user-data' && user.id) {
      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();

      if (!userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

        const mapped = {
          ...userData,
          id: userData.id,
          organizationId: userData.organization_id,
        paidLeaveBalance: userData.paid_leave_balance || 0,
        sickLeaveBalance: userData.sick_leave_balance || 0,
        familyLeaveBalance: userData.family_leave_balance || 0,
        lastLoginAt: userData.last_login_at,
        createdAt: userData.created_at,
      };

      return NextResponse.json(mapped);
    }

    if (type === 'latest-rating' && user.id) {
      const { data: rating } = await supabase
        .from('supervisor_ratings')
        .select('*')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!rating) {
        return NextResponse.json(null);
      }

      const { data: supervisor } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', rating.supervisorid)
        .maybeSingle();

      const mapped = {
        ...rating,
        id: rating.id,
        employeeId: rating.employee_id,
        supervisorId: rating.supervisorid,
        overallRating: rating.overall_rating,
        qualityOfWork: rating.quality_of_work,
        areasForImprovement: rating.areas_for_improvement,
        generalComments: rating.general_comments,
        ratingPeriod: rating.rating_period,
        supervisor,
      };

      return NextResponse.json(mapped);
    }

    if (type === 'monthly-stats' && user.id) {
      const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

      const { data: records } = await supabase
        .from('time_tracking')
        .select('*')
        .eq('userid', user.id);

      const monthRecords = (records || []).filter((r: any) => r.date.startsWith(month));

      const totalDays = monthRecords.length;
      const lateDays = monthRecords.filter((r: any) => r.is_late).length;
      const earlyLeaveDays = monthRecords.filter((r: any) => r.is_early_leave).length;
      const totalWorkedMinutes = monthRecords.reduce(
        (sum: number, r: any) => sum + (r.total_worked_minutes || 0),
        0
      );
      const totalOvertimeMinutes = monthRecords.reduce(
        (sum: number, r: any) => sum + (r.overtime_minutes || 0),
        0
      );

      const stats = {
        totalDays,
        lateDays,
        earlyLeaveDays,
        totalWorkedHours: (totalWorkedMinutes / 60).toFixed(1),
        totalOvertimeHours: (totalOvertimeMinutes / 60).toFixed(1),
        averageWorkHours: totalDays > 0 ? (totalWorkedMinutes / 60 / totalDays).toFixed(1) : '0',
        punctualityRate:
          totalDays > 0 ? (((totalDays - lateDays) / totalDays) * 100).toFixed(1) : '100',
      };

      return NextResponse.json(stats);
    }

    if (type === 'user-analytics' && user.id) {
      const { data: userLeaves } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('userid', user.id);

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const totalDaysTaken = (userLeaves || [])
        .filter((l: any) => l.status === 'approved')
        .reduce((sum: number, l: any) => sum + (l.total_days || 0), 0);

      const pendingDays = (userLeaves || [])
        .filter((l: any) => l.status === 'pending')
        .reduce((sum: number, l: any) => sum + (l.total_days || 0), 0);

      const leavesByType = (userLeaves || []).reduce(
        (acc: any, leave: any) => {
          const type = leave.type;
          acc[type] = (acc[type] || 0) + (leave.status === 'approved' ? leave.total_days : 0);
          return acc;
        },
        {} as Record<string, number>
      );

      const analytics = {
        user: userData,
        totalDaysTaken,
        pendingDays,
        leavesByType,
        userLeaves: (userLeaves || []).map((l: any) => ({
          ...l,
          id: l.id,
          userId: l.userid,
          startDate: l.start_date,
          endDate: l.end_date,
          createdAt: l.created_at,
        })),
        balances: {
          paid: userData?.paid_leave_balance || 0,
          sick: userData?.sick_leave_balance || 0,
          family: userData?.family_leave_balance || 0,
        },
      };

      return NextResponse.json(analytics);
    }

    if (type === 'monthly-stats-attendance' && user.id) {
      const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

      const { data: records } = await supabase
        .from('time_tracking')
        .select('*')
        .eq('userid', user.id);

      const monthRecords = (records || []).filter((r: any) => r.date.startsWith(month));

      const totalDays = monthRecords.length;
      const lateDays = monthRecords.filter((r: any) => r.is_late).length;
      const earlyLeaveDays = monthRecords.filter((r: any) => r.is_early_leave).length;
      const totalWorkedMinutes = monthRecords.reduce(
        (sum: number, r: any) => sum + (r.total_worked_minutes || 0),
        0
      );
      const totalOvertimeMinutes = monthRecords.reduce(
        (sum: number, r: any) => sum + (r.overtime_minutes || 0),
        0
      );

      const stats = {
        totalDays,
        lateDays,
        earlyLeaveDays,
        totalWorkedHours: (totalWorkedMinutes / 60).toFixed(1),
        totalOvertimeHours: (totalOvertimeMinutes / 60).toFixed(1),
        averageWorkHours: totalDays > 0 ? (totalWorkedMinutes / 60 / totalDays).toFixed(1) : '0',
        punctualityRate:
          totalDays > 0 ? (((totalDays - lateDays) / totalDays) * 100).toFixed(1) : '100',
      };

      return NextResponse.json(stats);
    }

    if (type === 'user-history' && user.id) {
      const limit = parseInt(searchParams.get('limit') || '10');

      const { data: records } = await supabase
        .from('time_tracking')
        .select('*')
        .eq('userid', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      const mapped = (records || []).map((r: any) => ({
        ...r,
        id: r.id,
        userId: r.userid,
        checkInTime: r.check_in_time,
        checkOutTime: r.check_out_time,
        totalWorkedMinutes: r.total_worked_minutes,
        isLate: r.is_late,
        lateMinutes: r.late_minutes,
        isEarlyLeave: r.is_early_leave,
        earlyLeaveMinutes: r.early_leave_minutes,
        overtimeMinutes: r.overtime_minutes,
        createdAt: r.created_at,
      }));

      return NextResponse.json(mapped);
    }

    if (type === 'employee-history') {
      const userId = searchParams.get('userId');
      const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
      }

      const { data: records } = await supabase
        .from('time_tracking')
        .select('*')
        .eq('userid', userId);

      const filtered = (records || []).filter((r: any) => r.date.startsWith(month));
      const sorted = filtered.sort((a: any, b: any) => b.date.localeCompare(a.date));

      const mapped = sorted.map((r: any) => ({
        ...r,
        id: r.id,
        userId: r.userid,
        checkInTime: r.check_in_time,
        checkOutTime: r.check_out_time,
        totalWorkedMinutes: r.total_worked_minutes,
        isLate: r.is_late,
        lateMinutes: r.late_minutes,
        isEarlyLeave: r.is_early_leave,
        earlyLeaveMinutes: r.early_leave_minutes,
        overtimeMinutes: r.overtime_minutes,
        createdAt: r.created_at,
      }));

      return NextResponse.json(mapped);
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
