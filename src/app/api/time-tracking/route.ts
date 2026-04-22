import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseService = createServiceClient();
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type');

    if (type === 'today-status') {
      const today = new Date().toISOString().split('T')[0];
      const { data: record } = await supabaseService
        .from('time_tracking')
        .select('*')
        .eq('userid', user.id)
        .eq('date', today as string)
        .maybeSingle();

      if (!record) {
        return NextResponse.json({ data: null });
      }

      return NextResponse.json({
        data: {
          id: record.id,
          status: record.status,
          checkInTime: record.check_in_time,
          checkOutTime: record.check_out_time,
          totalWorkedMinutes: record.total_worked_minutes,
          isLate: record.is_late,
          lateMinutes: record.late_minutes,
          isEarlyLeave: record.is_early_leave,
          earlyLeaveMinutes: record.early_leave_minutes,
          overtimeMinutes: record.overtime_minutes,
        },
      });
    }

    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');

    if (!employeeId || !month) {
      return NextResponse.json({ error: 'employeeId and month are required' }, { status: 400 });
    }

    const monthStart = new Date(`${month}-01T00:00:00`).getTime();
    const monthEnd = new Date(
      new Date(monthStart).getFullYear(),
      new Date(monthStart).getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ).getTime();

    const { data: timeEntries } = await supabaseService
      .from('time_tracking')
      .select('*')
      .eq('userid', employeeId)
      .gte('check_in_time', monthStart)
      .lte('check_in_time', monthEnd);

    let totalDays = 0;
    let totalWorkedHours = 0;
    let lateDays = 0;
    let earlyLeaveDays = 0;

    if (timeEntries) {
      totalDays = timeEntries.filter((e: any) => e.check_in_time).length;
      totalWorkedHours = timeEntries.reduce(
        (sum: number, e: any) => sum + (e.total_worked_minutes || 0) / 60,
        0,
      );
      lateDays = timeEntries.filter((e: any) => e.is_late).length;
      earlyLeaveDays = timeEntries.filter((e: any) => e.is_early_leave).length;
    }

    const punctualityRate = totalDays > 0 ? Math.round(((totalDays - lateDays) / totalDays) * 100) : 100;

    return NextResponse.json({
      data: {
        totalDays,
        totalWorkedHours: Math.round(totalWorkedHours * 10) / 10,
        punctualityRate,
        lateDays,
        earlyLeaveDays,
      },
    });
  } catch (error) {
    console.error('[Time Tracking API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseService = createServiceClient();
    const body = await req.json();
    const { type } = body;

    if (type === 'check-in') {
      const today = new Date().toISOString().split('T')[0];
      const now = Date.now();

      // Atomic upsert: try to insert, and if conflict on (userid, date), return existing
      const { data: record, error } = await supabaseService
        .from('time_tracking')
        .insert({
          userid: user.id as string,
          date: today as string,
          status: 'checked_in',
          check_in_time: now,
          is_late: false,
          late_minutes: 0,
          created_at: now,
          updated_at: now,
        })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'Already checked in today' }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!record) {
        return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
      }

      const workHoursStart = '09:00';
      const [expectedHour, expectedMinute] = workHoursStart.split(':').map(Number);
      const expectedTime = new Date();
      expectedTime.setHours(expectedHour as number, expectedMinute as number, 0, 0);
      const isLate = now > expectedTime.getTime();
      const lateMinutes = isLate ? Math.floor((now - expectedTime.getTime()) / 60000) : 0;

      // Update late status separately to avoid race condition
      if (isLate || lateMinutes > 0) {
        await supabaseService
          .from('time_tracking')
          .update({
            is_late: isLate,
            late_minutes: 0,
          })
          .eq('id', record.id);
      }

      return NextResponse.json({
        data: {
          id: record.id,
          status: record.status,
          checkInTime: record.check_in_time,
          isLate: record.is_late,
          lateMinutes: record.late_minutes,
        },
      });
    }

    if (type === 'check-out') {
      const today = new Date().toISOString().split('T')[0];
      const now = Date.now();

      const { data: existing, error: fetchError } = await supabaseService
        .from('time_tracking')
        .select('*')
        .eq('userid', user.id)
        .eq('date', today as string)
        .maybeSingle();

      if (fetchError || !existing) {
        return NextResponse.json({ error: 'No check-in record found for today' }, { status: 400 });
      }

      if (existing.check_out_time) {
        return NextResponse.json({ error: 'Already checked out today' }, { status: 400 });
      }

      const workHoursEnd = '17:00';
      const [expectedHour, expectedMinute] = workHoursEnd.split(':').map(Number);
      const expectedEndTime = new Date();
      expectedEndTime.setHours(expectedHour as number, expectedMinute as number, 0, 0);
      const isEarlyLeave = now < expectedEndTime.getTime();
      const earlyLeaveMinutes = isEarlyLeave ? Math.floor((expectedEndTime.getTime() - now) / 60000) : 0;

      const totalWorkedMinutes = Math.floor((now - (existing.check_in_time as number)) / 60000);
      const standardWorkMinutes = 8 * 60;
      const overtimeMinutes = totalWorkedMinutes > standardWorkMinutes ? totalWorkedMinutes - standardWorkMinutes : 0;

      // Atomic update: only update if check_out_time is still null (prevents race condition)
      const { data: record, error } = await supabaseService
        .from('time_tracking')
        .update({
          check_out_time: now,
          total_worked_minutes: totalWorkedMinutes,
          is_early_leave: isEarlyLeave,
          early_leave_minutes: earlyLeaveMinutes,
          overtime_minutes: overtimeMinutes,
          status: 'checked_out',
          updated_at: now,
        })
        .eq('id', existing.id)
        .is('check_out_time', null)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: 'Already checked out today' }, { status: 400 });
      }

      if (!record) {
        return NextResponse.json({ error: 'Failed to check out' }, { status: 500 });
      }

      return NextResponse.json({
        data: {
          id: record.id,
          status: record.status,
          checkInTime: existing.check_in_time,
          checkOutTime: record.check_out_time,
          totalWorkedMinutes: record.total_worked_minutes,
          isEarlyLeave: record.is_early_leave,
          earlyLeaveMinutes: record.early_leave_minutes,
          overtimeMinutes: record.overtime_minutes,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('[Time Tracking API Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
