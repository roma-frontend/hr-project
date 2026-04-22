import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-utils';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const leaveId: string = body.leaveId ?? '';
    const requesterId: string = auth.user.id;

    const supabase = await createClient();

    const { data: requesterUser } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', requesterId)
      .maybeSingle();

    if (!requesterUser) {
      return NextResponse.json({ success: false, message: 'Requester not found' });
    }

    const { data: targetLeave, error: fetchError } = await supabase
      .from('leave_requests')
      .select('id, userid, organization_id, type, start_date, end_date, total_days, reason, status, comment, reviewed_by, review_comment, reviewed_at, created_at, updated_at')
      .eq('id', leaveId)
      .maybeSingle();

    if (fetchError || !targetLeave) {
      return NextResponse.json({
        success: false,
        message: `Leave with ID ${leaveId} not found.`,
      });
    }

    const isAdmin = requesterUser.role === 'admin';
    const isOwner = targetLeave.userid === requesterId;
    const isSameOrg = targetLeave.organization_id === requesterUser.organization_id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({
        success: false,
        message: 'You can only delete your own leave requests.',
      });
    }

    if (!isSameOrg && !isAdmin) {
      return NextResponse.json({
        success: false,
        message: 'You can only delete leave requests from your organization.',
      });
    }

    const { data: ownerUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', targetLeave.userid)
      .maybeSingle();

    const ownerName = ownerUser?.name ?? 'Employee';

    const { error: deleteError } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', targetLeave.id);

    if (deleteError) {
      return NextResponse.json({
        success: false,
        message: `Failed to delete leave: ${deleteError.message}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `${isAdmin && !isOwner ? `${ownerName}'s` : 'Your'} ${targetLeave.type} leave (${targetLeave.start_date} → ${targetLeave.end_date}) has been deleted.${targetLeave.status === 'approved' ? ' Leave balance restored.' : ''}`,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message ?? 'Failed to delete leave',
    });
  }
}
