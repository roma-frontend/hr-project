import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signJWT } from '@/lib/jwt';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseService = createServiceClient();
    const { data: profile } = await supabaseService
      .from('users')
      .select('role, organization_id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, name, email, role, department, position, employeeType, avatar } = body;

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (role === 'superadmin' && profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmin can create superadmin sessions' }, { status: 403 });
    }

    const { data: targetUser } = await supabaseService
      .from('users')
      .select('id, organization_id')
      .eq('id', userId)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    if (profile.role !== 'superadmin' && targetUser.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Cannot create session for user outside your organization' }, { status: 403 });
    }

    const jwt = await signJWT({
      userId,
      name,
      email,
      role,
      department,
      position,
      employeeType,
      avatar,
    });

    const sessionToken = crypto.randomUUID();

    const cookieStore = await cookies();
    cookieStore.set('hr-auth-token', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    cookieStore.set('hr-session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
