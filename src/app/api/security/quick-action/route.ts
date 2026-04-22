import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'superadmin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, profile, supabase: supabaseService };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;
    const { user: authUser, supabase: supabaseService } = auth;

    const { action, userId, reason, duration } = await req.json();

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, userId' },
        { status: 400 },
      );
    }

    if (!['suspend', 'unsuspend'].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'suspend' or 'unsuspend'" },
        { status: 400 },
      );
    }

    if (action === 'suspend' && !reason) {
      return NextResponse.json({ error: 'Reason is required for suspension' }, { status: 400 });
    }

    const now = Date.now();
    const suspendedUntil = duration ? now + (duration * 60 * 60 * 1000) : null;

    if (action === 'suspend') {
      const { data: updatedUser, error } = await supabaseService
        .from('users')
        .update({
          is_suspended: true,
          suspended_reason: reason,
          suspended_until: suspendedUntil,
          suspended_at: now,
          suspended_by: authUser.id,
        })
        .eq('id', userId)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `User suspended for ${duration || 24} hours`,
        data: updatedUser,
      });
    } else {
      const { data: updatedUser, error } = await supabaseService
        .from('users')
        .update({
          is_suspended: false,
          suspended_reason: null,
          suspended_until: null,
          suspended_at: null,
          suspended_by: null,
        })
        .eq('id', userId)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'User unsuspended successfully',
        data: updatedUser,
      });
    }
  } catch (error: any) {
    console.error('[Quick Action API Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform action' },
      { status: 500 },
    );
  }
}
