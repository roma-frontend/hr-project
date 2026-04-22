import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

const SUPABASE_URL = supabaseUrl as string;
const SUPABASE_SERVICE_KEY = supabaseServiceKey as string;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user: authUser } = auth;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (action === 'get-today-stats') {
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartMs = todayStart.getTime();

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekStartMs = weekStart.getTime();

      const { data: todayTracking } = await supabase
        .from('time_tracking')
        .select('*')
        .eq('userid', authUser.id)
        .gte('checkin_time', todayStartMs)
        .order('checkin_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      let hoursWorkedToday = 0;
      if (todayTracking && todayTracking.total_worked_minutes) {
        hoursWorkedToday = todayTracking.total_worked_minutes / 60;
      }

      const { data: weekTracking } = await supabase
        .from('time_tracking')
        .select('*')
        .eq('userid', authUser.id)
        .gte('checkin_time', weekStartMs);

      let hoursWorkedWeek = 0;
      if (weekTracking) {
        weekTracking.forEach((tt: any) => {
          if (tt.total_worked_minutes) {
            hoursWorkedWeek += tt.total_worked_minutes / 60;
          }
        });
      }

      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('assignedto', authUser.id);

      const completedTasksToday =
        allTasks?.filter(
          (t: any) => t.status === 'completed' && t.updated_at && t.updated_at >= todayStartMs,
        ).length || 0;

      const completedTasksWeek =
        allTasks?.filter(
          (t: any) => t.status === 'completed' && t.updated_at && t.updated_at >= weekStartMs,
        ).length || 0;

      const totalTasksWeek =
        allTasks?.filter((t: any) => t.created_at && t.created_at >= weekStartMs).length || 0;

      const todayEnd = todayStart.getTime() + 24 * 60 * 60 * 1000;
      const todayDeadlines =
        allTasks?.filter(
          (t: any) =>
            t.deadline &&
            t.deadline >= todayStartMs &&
            t.deadline < todayEnd &&
            t.status !== 'completed',
        ).length || 0;

      const weeklyGoalTarget = 40;
      const weeklyGoalProgress = Math.min(100, (hoursWorkedWeek / weeklyGoalTarget) * 100);

      return NextResponse.json({
        data: {
          hoursWorkedToday: Math.round(hoursWorkedToday * 10) / 10,
          hoursWorkedWeek: Math.round(hoursWorkedWeek * 10) / 10,
          completedTasksToday,
          completedTasksWeek,
          totalTasksWeek,
          todayDeadlines,
          weeklyGoalProgress: Math.round(weeklyGoalProgress),
          isClockedIn: !!todayTracking && todayTracking.status === 'checked_in',
        },
      });
    }

    if (action === 'get-today-tasks') {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('assignedto', authUser.id)
        .neq('status', 'completed');

      if (!tasks) {
        return NextResponse.json({ data: [] });
      }

      const priorityMap: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
      const sorted = tasks.sort((a: any, b: any) => {
        const priorityDiff = (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;

        if (a.deadline && b.deadline) return a.deadline - b.deadline;
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return 0;
      });

      return NextResponse.json({ data: sorted.slice(0, 3) });
    }

    if (action === 'get-team-presence') {
      const { data: userProfile } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', authUser.id)
        .maybeSingle();

      const organizationId = userProfile?.organization_id;

      if (!organizationId) {
        return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
      }

      const { data: users } = await supabase
        .from('users')
        .select('id, name, avatar_url, presence_status, department, role, is_active')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .neq('role', 'superadmin')
        .not('presence_status', 'is', null)
        .limit(10);

      if (!users) {
        return NextResponse.json({ data: [] });
      }

      const today = new Date().toISOString().split('T')[0] || '';

      const onlineUsers = await Promise.all(
        users.map(async (u: any) => {
          let effectivePresenceStatus = u.presence_status;

          const { data: approvedLeaves } = await supabase
            .from('leave_requests')
            .select('*')
            .eq('userid', u.id)
            .eq('status', 'approved');

          const hasActiveLeave = approvedLeaves?.some((leave: any) => {
            return leave.start_date <= today && today <= leave.end_date;
          });

          if (hasActiveLeave) {
            effectivePresenceStatus = 'out_of_office';
          }

          return {
            id: u.id,
            name: u.name,
            avatarUrl: u.avatar_url,
            presenceStatus: effectivePresenceStatus,
            department: u.department,
            role: u.role,
          };
        }),
      );

      return NextResponse.json({ data: onlineUsers });
    }

    if (action === 'get-active-pomodoro') {
      const { data: session } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('userid', authUser.id)
        .eq('completed', false)
        .eq('interrupted', false)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({ data: session || null });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Productivity API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user: authUser } = auth;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const body = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (action === 'start-pomodoro') {
      const { duration, taskId } = body;

      if (!duration) {
        return NextResponse.json({ error: 'duration is required' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .insert({
          userid: authUser.id,
          taskid: taskId || null,
          start_time: Date.now(),
          duration: duration * 60 * 1000,
          end_time: Date.now() + duration * 60 * 1000,
          completed: false,
          interrupted: false,
        })
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      return NextResponse.json({ data });
    }

    if (action === 'complete-pomodoro') {
      const { sessionId } = body;

      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }

      const { data: session } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('userid', authUser.id)
        .maybeSingle();

      if (!session) {
        return NextResponse.json({ error: 'Session not found or not owned by user' }, { status: 404 });
      }

      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .update({
          completed: true,
          actual_end_time: Date.now(),
        })
        .eq('id', sessionId)
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      return NextResponse.json({ data });
    }

    if (action === 'interrupt-pomodoro') {
      const { sessionId } = body;

      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      }

      const { data: session } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('userid', authUser.id)
        .maybeSingle();

      if (!session) {
        return NextResponse.json({ error: 'Session not found or not owned by user' }, { status: 404 });
      }

      const { data, error } = await supabase
        .from('pomodoro_sessions')
        .update({
          interrupted: true,
          actual_end_time: Date.now(),
        })
        .eq('id', sessionId)
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      return NextResponse.json({ data });
    }

    if (action === 'update-presence') {
      const { presenceStatus } = body;

      if (!presenceStatus) {
        return NextResponse.json(
          { error: 'presenceStatus is required' },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from('users')
        .update({ presence_status: presenceStatus })
        .eq('id', authUser.id)
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Productivity API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
