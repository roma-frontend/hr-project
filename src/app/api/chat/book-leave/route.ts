import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-utils';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { organizationId, type, startDate, endDate, days, reason } = await req.json();
    const userId = auth.user.id;

    if (!userId || !organizationId || !type || !startDate || !endDate || !days || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // ═══════════════════════════════════════════════════════════════
    // CONFLICT DETECTION — Check for overlapping leaves
    // ═══════════════════════════════════════════════════════════════
    const { data: existingLeaves } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('userid', userId)
      .in('status', ['pending', 'approved'])
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (existingLeaves && existingLeaves.length > 0) {
      const personalConflict = existingLeaves[0];
      if (personalConflict) {
        const conflictEndDate = personalConflict.end_date;
        if (!conflictEndDate) {
          return NextResponse.json({
            success: false,
            conflict: true,
            message: `You already have a ${personalConflict.type} leave with status: "${personalConflict.status}".`,
          });
        }
        const conflictEnd = new Date(conflictEndDate);
        if (isNaN(conflictEnd.getTime())) {
          return NextResponse.json({
            success: false,
            conflict: true,
            message: `You already have a ${personalConflict.type} leave with status: "${personalConflict.status}".`,
          });
        }
        conflictEnd.setDate(conflictEnd.getDate() + 1);
        const suggestedStart = conflictEnd.toISOString().split('T')[0];
        const suggestedEnd = new Date(conflictEnd);
        suggestedEnd.setDate(suggestedEnd.getDate() + days - 1);
        const suggestedEndStr = suggestedEnd.toISOString().split('T')[0];

        return NextResponse.json({
          success: false,
          conflict: true,
          message: `You already have a ${personalConflict.type} leave (${personalConflict.start_date} → ${personalConflict.end_date}) with status: "${personalConflict.status}". 💡 Suggested alternative: ${suggestedStart} → ${suggestedEndStr}`,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CHECK LEAVE BALANCE
    // ═══════════════════════════════════════════════════════════════
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (type === 'paid' && (user.paid_leave_balance ?? 0) < days) {
      return NextResponse.json({
        success: false,
        conflict: true,
        message: `You don't have enough paid leave balance. Available: ${user.paid_leave_balance ?? 0} days, requested: ${days} days.`,
      });
    }
    if (type === 'sick' && (user.sick_leave_balance ?? 0) < days) {
      return NextResponse.json({
        success: false,
        conflict: true,
        message: `You don't have enough sick leave balance. Available: ${user.sick_leave_balance ?? 0} days, requested: ${days} days.`,
      });
    }
    if (type === 'family' && (user.family_leave_balance ?? 0) < days) {
      return NextResponse.json({
        success: false,
        conflict: true,
        message: `You don't have enough family leave balance. Available: ${user.family_leave_balance ?? 0} days, requested: ${days} days.`,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE LEAVE REQUEST
    // ═══════════════════════════════════════════════════════════════
    const { data: leave, error } = await supabase
      .from('leave_requests')
      .insert({
        userid: userId,
        organization_id: organizationId,
        type,
        start_date: startDate,
        end_date: endDate,
        total_days: days,
        reason,
        comment: 'Submitted via AI Assistant',
        status: 'pending',
      })
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!leave) {
      throw new Error('Failed to create leave request');
    }

    return NextResponse.json({
      success: true,
      leaveId: leave.id,
      message: `✅ Your ${type} leave request for ${days} day(s) (${startDate} → ${endDate}) has been submitted and sent to admin for approval!`,
      hasWarnings: false,
      conflicts: [],
    });
  } catch (error) {
    console.error('Book leave error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create leave request' },
      { status: 500 },
    );
  }
}
