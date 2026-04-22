import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { requireAdmin } from '@/lib/api-utils';

// Opt out of static generation — uses request.url
export const revalidate = 0;

// GET /api/chat/weekly-digest
// Returns AI-generated weekly digest for admin
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const adminId = auth.user.id;

    const supabase = await createClient();

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday
    const weekStartStr = weekStart.toISOString().split('T')[0] || '';
    const weekEndStr = weekEnd.toISOString().split('T')[0] || '';

    // Get organizationId for admin
    const { data: adminUser } = await supabase.from('users').select('organization_id').eq('id', adminId).maybeSingle();
    const organizationId = adminUser?.organization_id;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Fetch all data in parallel
    const [allLeaves, allUsers, todayAttendance] = await Promise.all([
      supabase.from('leave_requests').select('*').eq('organization_id', organizationId || ''),
      supabase.from('users').select('*').eq('organization_id', organizationId || ''),
      supabase.from('time_tracking').select('*').eq('date', today.toISOString().split('T')[0] || ''),
    ]);

    const activeEmployees = (allUsers.data || []).filter((u: any) => u.is_active && u.role === 'employee');
    const pendingLeaves = (allLeaves.data || []).filter((l: any) => l.status === 'pending');

    // Who is on leave this week
    const onLeaveThisWeek = (allLeaves.data || []).filter(
      (l: any) => l.status === 'approved' && l.start_date <= weekEndStr && l.end_date >= weekStartStr,
    );

    // Late arrivals this week (from time tracking)
    const lateThisMonth: any[] = [];
    for (const emp of activeEmployees.slice(0, 20)) {
      try {
        const { data: history } = await supabase
          .from('time_tracking')
          .select('*')
          .eq('userid', emp.id)
          .gte('date', weekStartStr)
          .lte('date', weekEndStr);
        const lateCount = history?.filter((r: any) => r.is_late).length || 0;
        if (lateCount > 0) {
          lateThisMonth.push({ name: emp.name, lateCount });
        }
      } catch {
        /* skip */
      }
    }

    // Build context for AI
    const checkedIn = todayAttendance.data?.filter((t: any) => t.status === 'checked_in').length || 0;
    const checkedOut = todayAttendance.data?.filter((t: any) => t.status === 'checked_out').length || 0;
    const absent = activeEmployees.length - checkedIn - checkedOut;
    const lateToday = todayAttendance.data?.filter((t: any) => t.is_late).length || 0;
    const attendanceRate = activeEmployees.length > 0 ? Math.round((checkedIn / activeEmployees.length) * 100) : 0;

    const context = `
Today: ${today.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Week: ${weekStartStr} to ${weekEndStr}

TEAM SIZE: ${activeEmployees.length} active employees

ON LEAVE THIS WEEK (${onLeaveThisWeek.length}):
${
  onLeaveThisWeek
    .slice(0, 10)
    .map((l: any) => {
      const user = allUsers.data?.find((u: any) => u.id === l.userid);
      return `- ${user?.name ?? 'Unknown'}: ${l.type} leave (${l.start_date} → ${l.end_date})`;
    })
    .join('\n') || 'None'
}

PENDING APPROVAL (${pendingLeaves.length}):
${
  pendingLeaves
    .slice(0, 5)
    .map((l: any) => {
      const user = allUsers.data?.find((u: any) => u.id === l.userid);
      return `- ${user?.name ?? 'Unknown'}: ${l.total_days} day(s) ${l.type} leave (${l.start_date} → ${l.end_date})`;
    })
    .join('\n') || 'None'
}

LATE ARRIVALS THIS WEEK:
${lateThisMonth.length > 0 ? lateThisMonth.map((e) => `- ${e.name}: ${e.lateCount} late arrival(s)`).join('\n') : 'None recorded'}

TODAY'S ATTENDANCE:
- At work: ${checkedIn}
- Checked out: ${checkedOut}
- Absent: ${absent}
- Late today: ${lateToday}
- Attendance rate: ${attendanceRate}%
`;

    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: `You are an HR AI assistant. Generate a concise, professional weekly HR digest for the admin.
Use emojis to make it visually organized. Format it nicely with sections.
Keep it under 400 words. Include:
1. 📋 Quick Summary
2. 🏖 Who's on Leave This Week  
3. ⏳ Pending Approvals (urgent if any)
4. ⚠️ Attendance Alerts
5. 💡 AI Recommendation (one smart insight)

Data:
${context}`,
    });

    return NextResponse.json({
      digest: text,
      generatedAt: new Date().toISOString(),
      stats: {
        onLeave: onLeaveThisWeek.length,
        pending: pendingLeaves.length,
        lateToday: lateToday,
        attendanceRate: attendanceRate,
      },
    });
  } catch (error) {
    console.error('Weekly digest error:', error);
    return NextResponse.json({ error: 'Failed to generate digest' }, { status: 500 });
  }
}
