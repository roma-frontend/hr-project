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

    const isAdminOrSupervisor = ['admin', 'supervisor', 'superadmin'].includes(userProfile.role);

    if (type === 'today-summary' && isAdminOrSupervisor) {
      const today = new Date().toISOString().split('T')[0];

      const { data: records } = await supabaseService
        .from('time_tracking')
        .select('*')
        .eq('date', today as string);

      let filteredRecords = records || [];
      if (userProfile.role !== 'superadmin' && userProfile.organization_id) {
        const { data: orgUsers } = await supabaseService
          .from('users')
          .select('id')
          .eq('organization_id', userProfile.organization_id);

        const orgUserIds = orgUsers?.map((u: any) => u.id) || [];
        filteredRecords = filteredRecords.filter((r: any) => orgUserIds.includes(r.userid));
      }

      const withUsers = await Promise.all(
        filteredRecords.map(async (record: any) => {
          const { data: emp } = await supabaseService
            .from('users')
            .select('id, name, email, department, position, role, avatar_url, face_image_url')
            .eq('id', record.userid)
            .maybeSingle();

          if (!emp) return null;
          if (emp.role === 'superadmin') return null;

          return {
            ...record,
            id: record.id,
            userId: record.userid,
            checkInTime: record.check_in_time,
            checkOutTime: record.check_out_time,
            totalWorkedMinutes: record.total_worked_minutes || 0,
            isLate: record.status === 'late',
            lateMinutes: 0,
            isEarlyLeave: record.status === 'half_day',
            earlyLeaveMinutes: 0,
            overtimeMinutes: 0,
            user: {
              id: emp.id,
              name: emp.name,
              email: emp.email,
              department: emp.department,
              position: emp.position,
              role: emp.role,
              avatarUrl: emp.avatar_url || emp.face_image_url,
            },
          };
        })
      );

      const sorted = withUsers.filter(Boolean).sort((a: any, b: any) => {
        const order: Record<string, number> = { present: 0, late: 1, half_day: 2, absent: 3 };
        return (order[a.status] || 0) - (order[b.status] || 0);
      });

      return NextResponse.json(sorted);
    }

    if (type === 'all-employees' && isAdminOrSupervisor) {
      const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

      let usersQuery = supabaseService
        .from('users')
        .select('*')
        .eq('is_active', true)
        .eq('role', 'employee');

      if (userProfile.role !== 'superadmin' && userProfile.organization_id) {
        usersQuery = usersQuery.eq('organization_id', userProfile.organization_id);
      }

      const { data: activeUsers } = await usersQuery;

      if (!activeUsers || activeUsers.length === 0) {
        return NextResponse.json([]);
      }

      const results = await Promise.all(
        activeUsers.map(async (user: any) => {
          const { data: records } = await supabaseService
            .from('time_tracking')
            .select('*')
            .eq('userid', user.id);

          const monthRecords = (records || []).filter((r: any) => r.date.startsWith(month));

          const totalDays = monthRecords.length;
          const lateDays = monthRecords.filter((r: any) => r.is_late).length;
          const absentDays = monthRecords.filter((r: any) => r.status === 'absent').length;
          const totalWorkedMinutes = monthRecords.reduce(
            (sum: number, r: any) => sum + (r.total_worked_minutes || 0),
            0
          );
          const punctualityRate =
            totalDays > 0 ? (((totalDays - lateDays) / totalDays) * 100).toFixed(0) : '100';

          let supervisor = null;
          if (user.supervisorid) {
            const { data: sup } = await supabaseService
              .from('users')
              .select('id, name')
              .eq('id', user.supervisorid)
              .maybeSingle();
            supervisor = sup;
          }

          const sortedRecords = (records || []).sort(
            (a: any, b: any) => b.check_in_time - a.check_in_time
          );
          const lastRecord = sortedRecords[0] || null;

          return {
            user: {
              id: user.id,
              name: user.name,
              position: user.position,
              department: user.department,
              avatarUrl: user.avatar_url || user.face_image_url,
              supervisorId: user.supervisorid,
            },
            supervisor,
            stats: {
              totalDays,
              lateDays,
              absentDays,
              punctualityRate,
              totalWorkedHours: (totalWorkedMinutes / 60).toFixed(1),
            },
            lastRecord: lastRecord
              ? {
                  ...lastRecord,
                  id: lastRecord.id,
                  userId: lastRecord.userid,
                  checkInTime: lastRecord.check_in_time,
                  checkOutTime: lastRecord.check_out_time,
                  totalWorkedMinutes: lastRecord.total_worked_minutes,
                  isLate: lastRecord.is_late,
                  lateMinutes: lastRecord.late_minutes,
                  isEarlyLeave: lastRecord.is_early_leave,
                  earlyLeaveMinutes: lastRecord.early_leave_minutes,
                  overtimeMinutes: lastRecord.overtime_minutes,
                  createdAt: lastRecord.created_at,
                }
              : null,
          };
        })
      );

      return NextResponse.json(results.sort((a: any, b: any) => a.user.name.localeCompare(b.user.name)));
    }

    if (type === 'needs-rating' && isAdminOrSupervisor) {
      const currentPeriod = new Date().toISOString().slice(0, 7);

      let usersQuery = supabaseService
        .from('users')
        .select('*')
        .eq('is_active', true)
        .neq('role', 'admin')
        .neq('role', 'superadmin');

      if (userProfile.role !== 'superadmin' && userProfile.organization_id) {
        usersQuery = usersQuery.eq('organization_id', userProfile.organization_id);
      }

      const { data: activeEmployees } = await usersQuery;

      if (!activeEmployees || activeEmployees.length === 0) {
        return NextResponse.json([]);
      }

      const needsRating = await Promise.all(
        activeEmployees.map(async (employee: any) => {
          const { data: rating } = await supabaseService
            .from('supervisor_ratings')
            .select('*')
            .eq('employee_id', employee.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const needsRatingThisMonth = !rating || rating.rating_period !== currentPeriod;

          return {
            employee: {
              id: employee.id,
              name: employee.name,
              position: employee.position,
              department: employee.department,
              avatarUrl: employee.avatar_url || employee.face_image_url,
            },
            lastRated: rating?.rating_period || 'Never',
            needsRating: needsRatingThisMonth,
          };
        })
      );

      return NextResponse.json(needsRating.filter((item: any) => item.needsRating));
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Attendance API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const supabaseService = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabaseService
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isAdminOrSupervisor = ['admin', 'supervisor', 'superadmin'].includes(userProfile.role);

    const body = await req.json();
    const { type } = body;

    if (type === 'create-rating') {
      const {
        employeeId,
        qualityOfWork,
        efficiency,
        teamwork,
        initiative,
        communication,
        reliability,
        strengths,
        areasForImprovement,
        generalComments,
        ratingPeriod,
      } = body;

      const ratings = [qualityOfWork, efficiency, teamwork, initiative, communication, reliability];

      if (ratings.some((r: number) => r < 1 || r > 5)) {
        return NextResponse.json(
          { error: 'All ratings must be between 1 and 5' },
          { status: 400 }
        );
      }

      const overallRating = ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length;
      const period = ratingPeriod || new Date().toISOString().slice(0, 7);

      const { data: rating, error } = await supabaseService
        .from('supervisor_ratings')
        .insert({
          employee_id: employeeId,
          supervisorid: user.id,
          rated_by: user.id,
          quality_of_work: qualityOfWork,
          efficiency,
          teamwork,
          initiative,
          communication,
          reliability,
          overall_rating: overallRating,
          strengths,
          areas_for_improvement: areasForImprovement,
          general_comments: generalComments,
          rating_period: period,
          created_at: Date.now(),
        })
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(rating);
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Attendance API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
