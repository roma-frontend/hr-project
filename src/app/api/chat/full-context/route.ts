import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAuth } from '@/lib/api-utils';
import type { Tables } from '@/lib/supabase/database.types';

type UserRow = Tables<'users'>;
type LeaveRow = Tables<'leave_requests'>;
type TimeTrackingRow = Tables<'time_tracking'>;
type TaskRow = Tables<'tasks'>;

// Opt out of static generation — uses request.url
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const requesterId = auth.user.id;

    const supabaseService = createServiceClient();

    const { data: requesterUser } = await supabaseService.from('users').select('organization_id').eq('id', requesterId).maybeSingle();
    const organizationId = requesterUser?.organization_id;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const [users, leaves, todayAttendance, allTasks] = await Promise.all([
      supabaseService.from('users').select('*').eq('organization_id', organizationId),
      supabaseService.from('leave_requests').select('*').eq('organization_id', organizationId),
      supabaseService.from('time_tracking').select('*').eq('userid', requesterId || '').eq('date', new Date().toISOString().split('T')[0] || ''),
      supabaseService.from('tasks').select('*').eq('organization_id', organizationId),
    ]);

    const usersData: UserRow[] = users.data ?? [];
    const leavesData: LeaveRow[] = leaves.data ?? [];
    const attendanceData: TimeTrackingRow[] = todayAttendance.data ?? [];
    const tasksData: TaskRow[] = allTasks.data ?? [];

    // Build rich employee map with leave info
    // Filter out superadmins from employee data
    const filteredUsers = usersData.filter((u) => u.role !== 'superadmin');

    const employeeData = filteredUsers.map((u) => {
      const userLeaves = leavesData.filter((l) => l.userid === u.id);
      const todayRecord = attendanceData.find((t) => t.userid === u.id);

      const approvedLeaves = userLeaves.filter((l) => l.status === 'approved');
      const pendingLeaves = userLeaves.filter((l) => l.status === 'pending');

      // Current/upcoming leaves
      const now = new Date().toISOString().split('T')[0] || '';
      const activeLeave = approvedLeaves.find((l) => l.start_date <= now && l.end_date >= now);
      const upcomingLeaves = approvedLeaves
        .filter((l) => l.start_date > now)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 3);

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        position: u.position,
        employeeType: u.employee_type,
        // Today's attendance
        todayStatus: todayRecord
          ? {
              status: todayRecord.status,
              checkIn: todayRecord.check_in_time
                ? (() => {
                    const d = new Date(todayRecord.check_in_time);
                    return isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                  })()
                : null,
              checkOut: todayRecord.check_out_time
                ? (() => {
                    const d = new Date(todayRecord.check_out_time);
                    return isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                  })()
                : null,
              isLate: todayRecord.is_late,
              lateMinutes: todayRecord.late_minutes,
              workedHours: todayRecord.total_worked_minutes
                ? (todayRecord.total_worked_minutes / 60).toFixed(1)
                : null,
            }
          : null,
        // Leave balances
        leaveBalance: { paid: u.paid_leave_balance, sick: u.sick_leave_balance, family: u.family_leave_balance, unpaid: 30 },
        // Currently on leave — include real leaveId for edit/delete!
        currentLeave: activeLeave
          ? {
              leaveId: activeLeave.id,
              type: activeLeave.type,
              startDate: activeLeave.start_date,
              endDate: activeLeave.end_date,
              reason: activeLeave.reason,
              status: activeLeave.status,
            }
          : null,
        // Upcoming leaves — include real leaveId!
        upcomingLeaves: upcomingLeaves.map((l) => ({
          leaveId: l.id,
          type: l.type,
          startDate: l.start_date,
          endDate: l.end_date,
          totalDays: l.total_days,
          status: l.status,
        })),
        // Pending requests — include real leaveId!
        pendingLeaves: pendingLeaves.map((l) => ({
          leaveId: l.id,
          type: l.type,
          startDate: l.start_date,
          endDate: l.end_date,
          totalDays: l.total_days,
          status: l.status,
        })),
        // ALL leaves for this employee (for edit/delete)
        allLeaves: userLeaves.map((l) => ({
          leaveId: l.id,
          type: l.type,
          startDate: l.start_date,
          endDate: l.end_date,
          totalDays: l.total_days,
          status: l.status,
          reason: l.reason,
        })),
        // Leave history summary
        totalLeavesTaken: approvedLeaves.reduce((sum: number, l) => sum + (l.total_days ?? 0), 0),
        // Supervisor
        supervisorName: u.supervisorid
          ? (usersData.find((s) => s.id === u.supervisorid)?.name ?? null)
          : null,
        // Presence status
        presenceStatus: u.presence_status ?? 'available',
        // Tasks
        tasks: tasksData
          .filter((t) => t.assigned_to === u.id)
          .map((t) => ({
            taskId: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            deadline: t.deadline ? (() => { const d = new Date(t.deadline); return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]; })() : null,
            assignedBy:
              usersData.find((s) => s.id === t.assigned_by)?.name ?? 'Unknown',
          })),
      };
    });

    // Calendar events — all approved leaves next 90 days
    const now = new Date().toISOString().split('T')[0] || '';
    const in90Days =
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '';
    const calendarEvents = leavesData
      .filter((l) => l.status === 'approved' && l.end_date >= now && l.start_date <= in90Days)
      .map((l) => {
        const user = usersData.find((u) => u.id === l.userid);
        return {
          employee: user?.name ?? 'Unknown',
          department: user?.department ?? '',
          type: l.type,
          startDate: l.start_date,
          endDate: l.end_date,
          totalDays: l.total_days,
        };
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    // Today's attendance summary
    const presentToday = attendanceData.map((t) => {
      const user = usersData.find((u) => u.id === t.userid);
      return {
        name: user?.name ?? 'Unknown',
        department: user?.department ?? '',
        status: t.status,
        checkIn: t.check_in_time
          ? (() => {
              const d = new Date(t.check_in_time);
              return isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              });
            })()
          : null,
        checkOut: t.check_out_time
          ? (() => {
              const d = new Date(t.check_out_time);
              return isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              });
            })()
          : null,
        isLate: t.is_late,
        lateMinutes: t.late_minutes,
      };
    });

    return NextResponse.json({
      employees: employeeData,
      calendarEvents,
      todayAttendance: presentToday,
      totalEmployees: filteredUsers.length,
      currentlyAtWork: presentToday.filter((t) => t.status === 'checked_in').length,
      onLeaveToday: employeeData.filter((e) => e.currentLeave).length,
    });
  } catch (error) {
    console.error('Full context error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard context', employees: [], calendarEvents: [], todayAttendance: [] },
      { status: 500 }
    );
  }
}
