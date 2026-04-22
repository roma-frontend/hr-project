import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { serverT } from '@/lib/i18n/server-actions-i18n';

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: serverT('superadmin.api.unauthorized', 'Unauthorized') }, { status: 401 }) };

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'superadmin') {
    return { error: NextResponse.json({ error: serverT('superadmin.api.forbidden', 'Forbidden') }, { status: 403 }) };
  }
  return { user, profile, supabase: supabaseService };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;
    const { user: authUser, supabase: supabaseService } = auth;

    const { action, leaveIds, comment } = await request.json();

    if (!action || !leaveIds) {
      return NextResponse.json(
        { error: serverT('superadmin.api.missingRequiredFields', 'Missing required fields') },
        { status: 400 },
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: serverT('superadmin.api.invalidAction', 'Invalid action') },
        { status: 400 },
      );
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    const approved: string[] = [];
    const errors: string[] = [];

    for (const leaveId of leaveIds) {
      const { error } = await supabaseService
        .from('leave_requests')
        .update({
          status,
          reviewed_at: Date.now(),
          reviewed_by: authUser.id,
          review_comment: action === 'reject' ? comment : null,
        })
        .eq('id', leaveId);

      if (error) {
        errors.push(`Failed to ${action} leave ${leaveId}: ${error.message}`);
      } else {
        approved.push(leaveId);
      }
    }

    return NextResponse.json({
      success: true,
      [action === 'approve' ? 'approved' : 'rejected']: approved,
      errors,
    });
  } catch (error) {
    console.error('[Bulk Actions API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
