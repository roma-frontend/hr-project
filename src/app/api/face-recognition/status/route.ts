import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkFaceIdStatus } from '@/lib/supabase/face';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseService = createServiceClient();

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { data: foundUser } = await supabaseService
      .from('users')
      .select('id, organization_id')
      .eq('email', email)
      .maybeSingle();

    if (!foundUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: requesterProfile } = await supabaseService
      .from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .maybeSingle();

    const _isSameOrg = requesterProfile?.organization_id === foundUser.organization_id;
    const isAdmin = requesterProfile && ['admin', 'superadmin'].includes(requesterProfile.role);

    if (foundUser.id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const status = await checkFaceIdStatus(foundUser.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error('[face-recognition/status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
