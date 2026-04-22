import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAuth } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const userId = auth.user.id;

    const supabaseService = createServiceClient();

    const [user, userLeaves, allLeaves, timeHistory] = await Promise.all([
      supabaseService.from('users').select('*').eq('id', userId).maybeSingle(),
      supabaseService.from('leave_requests').select('*').eq('userid', userId),
      supabaseService.from('leave_requests').select('*').eq('organization_id', ((await supabaseService.from('users').select('organization_id').eq('id', userId).maybeSingle()).data?.organization_id) ?? ''),
      supabaseService.from('time_tracking').select('*').eq('userid', userId).order('date', { ascending: false }).limit(60),
    ]);

    if (!user.data) return NextResponse.json(null);

    const today = new Date();
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    const daysToEndOfYear = Math.ceil(
      (endOfYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    // ── 1. Balance Warning ────────────────────────────────────────────────
    let balanceWarning = '';
    const paidBalance = user.data.paid_leave_balance ?? 0;
    const sickBalance = user.data.sick_leave_balance ?? 0;

    if (paidBalance > 0 && paidBalance <= 5 && daysToEndOfYear <= 90) {
      balanceWarning = `You only have ${paidBalance} paid leave days left and they expire on Dec 31! Consider booking them soon.`;
    } else if (paidBalance > 10 && daysToEndOfYear <= 60) {
      balanceWarning = `You have ${paidBalance} unused paid leave days that expire Dec 31 (${daysToEndOfYear} days away). Book your vacation soon!`;
    } else if (paidBalance === 0) {
      balanceWarning = `Your paid leave balance is 0. You can still request unpaid leave or sick leave (${sickBalance} days remaining).`;
    }

    // ── 2. Attendance Patterns ────────────────────────────────────────────
    const patterns: string[] = [];

    if (timeHistory.data && timeHistory.data.length > 0) {
      // Count late arrivals
      const lateRecords = timeHistory.data.filter((r: any) => r.is_late);
      if (lateRecords.length >= 3) {
        // Check if late on specific days
        const dayNames = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        const lateDayCounts: Record<number, number> = {};
        lateRecords.forEach((r: any) => {
          const day = new Date(r.check_in_time).getDay();
          lateDayCounts[day] = (lateDayCounts[day] || 0) + 1;
        });
        const mostLateDay = Object.entries(lateDayCounts).sort((a, b) => b[1] - a[1])[0];
        if (mostLateDay && Number(mostLateDay[1]) >= 2) {
          patterns.push(
            `Frequent late arrivals on ${dayNames[Number(mostLateDay[0])]}s (${mostLateDay[1]} times recently)`,
          );
        } else {
          patterns.push(`${lateRecords.length} late arrivals in the past 2 months`);
        }
      }

      // Check early leave pattern
      const earlyLeaves = timeHistory.data.filter((r: any) => r.is_early_leave);
      if (earlyLeaves.length >= 3) {
        patterns.push(`${earlyLeaves.length} early departures recorded recently`);
      }
    }

    // Check sick leave pattern
    const sickLeaves = (userLeaves.data || []).filter((l: any) => l.type === 'sick');
    if (sickLeaves.length >= 3) {
      // Check if sick leaves cluster around specific days
      const sickDayCounts: Record<number, number> = {};
      sickLeaves.forEach((l: any) => {
        const day = new Date(l.start_date).getDay();
        sickDayCounts[day] = (sickDayCounts[day] || 0) + 1;
      });
      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const mostSickDay = Object.entries(sickDayCounts).sort((a, b) => b[1] - a[1])[0];
      if (mostSickDay && Number(mostSickDay[1]) >= 2) {
        patterns.push(
          `Sick leaves often start on ${dayNames[Number(mostSickDay[0])]}s — consider scheduling preventive check-ups`,
        );
      }
    }

    // ── 3. Team Conflicts (next 60 days) ─────────────────────────────────
    const teamConflicts: string[] = [];
    const next60Days = new Date(today);
    next60Days.setDate(next60Days.getDate() + 60);
    const todayStr = today.toISOString().split('T')[0] || '';
    const next60Str = next60Days.toISOString().split('T')[0] || '';

    const upcomingTeamLeaves = (allLeaves.data || []).filter((l: any) => {
      return (
        l.userid !== userId &&
        l.status === 'approved' &&
        l.end_date >= todayStr &&
        l.start_date <= next60Str
      );
    });

    // Group by date range
    upcomingTeamLeaves.slice(0, 5).forEach((l: any) => {
      teamConflicts.push(
        `${l.userName || 'Unknown'} (${l.userDepartment || 'Unknown dept'}) is on ${l.type} leave: ${l.start_date} → ${l.end_date}`,
      );
    });

    // ── 4. Best Dates (find weeks with no team conflicts) ─────────────────
    const bestDates: string[] = [];
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + 7); // Start from next week

    let foundGoodWeeks = 0;
    for (let i = 0; i < 90 && foundGoodWeeks < 4; i++) {
      const dateStr = checkDate.toISOString().split('T')[0] || '';
      const dayOfWeek = checkDate.getDay();

      // Only suggest Monday starts
      if (dayOfWeek === 1) {
        const weekEnd = new Date(checkDate);
        weekEnd.setDate(weekEnd.getDate() + 4); // Friday
        const weekEndStr = weekEnd.toISOString().split('T')[0] || '';

        // Check if anyone from team is on leave that week
        const conflict = upcomingTeamLeaves.some((l: any) => {
          return l.start_date <= weekEndStr && l.end_date >= dateStr;
        });

        if (!conflict) {
          const month = checkDate.toLocaleString('en', { month: 'long' });
          const day = checkDate.getDate();
          const endDay = weekEnd.getDate();
          bestDates.push(`${month} ${day}–${endDay} (full week, no team conflicts)`);
          foundGoodWeeks++;
        }
      }

      checkDate.setDate(checkDate.getDate() + 1);
    }

    return NextResponse.json({
      balanceWarning: balanceWarning || null,
      patterns: patterns.length > 0 ? patterns : null,
      teamConflicts: teamConflicts.length > 0 ? teamConflicts : null,
      bestDates: bestDates.length > 0 ? bestDates : null,
    });
  } catch (error) {
    console.error('Insights error:', error);
    return NextResponse.json(null);
  }
}
