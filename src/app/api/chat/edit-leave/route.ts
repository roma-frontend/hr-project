import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-utils';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { leaveId, startDate, endDate, days, reason, type } = await req.json();
    const requesterId = auth.user.id;

    if (!leaveId) {
      return NextResponse.json(
        { success: false, message: 'Missing leaveId' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Get the leave to validate
    const { data: requesterUser } = await supabase.from('users').select('organization_id').eq('id', requesterId).maybeSingle();
    const organizationId = requesterUser?.organization_id;

    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('id, userid, status, start_date, end_date, type, reason, organization_id, created_at, updated_at, days, total_days, comment, reviewed_by, review_comment, reviewed_at')
      .eq('organization_id', organizationId || '');
    const leave = leaves?.find((l) => l.id === leaveId);

    if (!leave) {
      return NextResponse.json({ success: false, message: 'Leave request not found' });
    }

    // Get requester
    const { data: users } = await supabase
      .from('users')
      .select('id, name, role, organization_id')
      .eq('organization_id', organizationId || '');
    const requester = users?.find((u) => u.id === requesterId);

    if (!requester) {
      return NextResponse.json({ success: false, message: 'User not found' });
    }

    const isAdmin = requester.role === 'admin';
    const isOwner = leave.userid === requesterId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({
        success: false,
        message:
          "❌ You can only edit your own leave requests. You don't have permission to edit other employees' leaves.",
      });
    }

    if (!isAdmin && leave.status !== 'pending') {
      return NextResponse.json({
        success: false,
        message: `❌ Cannot edit this leave — it's already ${leave.status}. Only pending leaves can be edited by employees. Contact admin for changes.`,
      });
    }

    await supabase.from('leave_requests').update({
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate }),
      ...(days && { total_days: days }),
      ...(reason && { reason }),
      ...(type && { type }),
      updated_at: Date.now(),
    }).eq('id', leaveId);

    return NextResponse.json({
      success: true,
      message: `✅ Leave request updated successfully! ${isAdmin && !isOwner ? 'Employee has been notified.' : ''}`,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message ?? 'Failed to update leave request',
    });
  }
}
