import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAuth } from '@/lib/api-utils';

// Opt out of static generation — uses cookies
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabaseService = createServiceClient();
    const userId = auth.user.id;

    const { data: userProfile } = await supabaseService
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Fetch user's leave data
    const { data: userLeaves } = await supabaseService
      .from('leave_requests')
      .select('*')
      .eq('userid', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate analytics manually
    const approvedLeaves = userLeaves?.filter((l: any) => l.status === 'approved') || [];
    const pendingLeaves = userLeaves?.filter((l: any) => l.status === 'pending') || [];
    const totalDaysTaken = approvedLeaves.reduce((sum: number, l: any) => sum + (l.total_days || 0), 0);
    const pendingDays = pendingLeaves.reduce((sum: number, l: any) => sum + (l.total_days || 0), 0);

    // Get team calendar
    const { data: teamCalendar } = await supabaseService
      .from('leave_requests')
      .select('*, users(name, department)')
      .eq('organization_id', userProfile.organization_id!)
      .eq('status', 'approved')
      .gte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true })
      .limit(20);

    // Build context for AI
    const context = {
      user: {
        id: userId,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        department: userProfile.department,
        organizationId: userProfile.organization_id,
      },
      leaveBalances: {
        paid: userProfile.paid_leave_balance || 0,
        sick: userProfile.sick_leave_balance || 0,
        family: userProfile.family_leave_balance || 0,
      },
      stats: {
        totalDaysTaken,
        pendingDays,
      },
      recentLeaves:
        userLeaves?.slice(0, 5).map((l: any) => ({
          type: l.type,
          startDate: l.start_date,
          endDate: l.end_date,
          status: l.status,
          totalDays: l.total_days,
        })) || [],
      teamAvailability:
        teamCalendar?.slice(0, 10).map((l: any) => ({
          userName: l.users?.name || 'Unknown',
          department: l.users?.department || '',
          startDate: l.start_date,
          endDate: l.end_date,
        })) || [],
    };

    return NextResponse.json(context);
  } catch (error) {
    console.error('Context error:', error);
    return NextResponse.json({ error: 'Failed to get context' }, { status: 500 });
  }
}
