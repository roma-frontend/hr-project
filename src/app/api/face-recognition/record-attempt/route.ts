import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { recordFaceIdAttempt } from '@/lib/supabase/face';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseService = createServiceClient();

    const body = await request.json();
    const { userId, success } = body;

    if (!userId || typeof success !== 'boolean') {
      return NextResponse.json(
        { error: 'userId and success are required' },
        { status: 400 },
      );
    }

    if (userId !== user.id) {
      const { data: profile } = await supabaseService
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    await recordFaceIdAttempt(userId, success);

    const { data: foundUser } = await supabaseService
      .from('users')
      .select('faceid_failed_attempts, faceid_blocked')
      .eq('id', userId)
      .maybeSingle();

    return NextResponse.json({
      attempts: foundUser?.faceid_failed_attempts || 0,
      blocked: foundUser?.faceid_blocked || false,
    });
  } catch (error) {
    console.error('[face-recognition/record-attempt] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
