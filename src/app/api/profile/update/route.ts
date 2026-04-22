import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { signJWT, verifyJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cookieStore = await cookies();
    let jwt = cookieStore.get('hr-auth-token')?.value;

    if (!jwt) {
      const session = await auth();

      if (!session?.user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      jwt = await signJWT({
        userId: session.user.id,
        name: session.user.name || name,
        email: session.user.email || email,
        role: session.user.role || 'employee',
        department: session.user.department,
        position: session.user.position,
        employeeType: session.user.employeeType,
        avatar: session.user.avatar,
      });
    }

    if (!jwt) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyJWT(jwt);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // SECURITY: Only allow updating the authenticated user's own profile
    const newJwt = await signJWT({
      userId: payload.userId,
      name,
      email,
      role: payload.role,
      department: payload.department,
      position: payload.position,
      employeeType: payload.employeeType,
      avatar: payload.avatar,
    });

    // Persist profile changes to database
    const supabase = await createClient();
    const { error: updateError } = await supabase
      .from('users')
      .update({
        name,
        email,
      })
      .eq('id', payload.userId);

    if (updateError) {
      console.error('[/api/profile/update] Database update failed:', updateError.message);
      return NextResponse.json({ error: 'Failed to update profile in database' }, { status: 500 });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set('hr-auth-token', newJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[/api/profile/update] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
