/**
 * Approve all existing users — SUPERADMIN ONLY
 * Previously had NO authentication check!
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createClient } from '@/lib/supabase/server';

/**
 * Verify the user is a superadmin.
 */
async function verifySuperadmin(): Promise<{ userId: string; role: string } | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('hr-auth-token') || cookieStore.get('oauth-session');
    if (!sessionCookie) return null;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return null;

    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(sessionCookie.value, secret);

    if (payload.role !== 'superadmin') {
      console.warn('[Approve-All] Non-superadmin access attempt:', payload.role);
      return null;
    }

    return { userId: payload.sub as string, role: payload.role as string };
  } catch {
    return null;
  }
}

export async function POST() {
  // SECURITY: Require superadmin authentication
  const user = await verifySuperadmin();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized. Superadmin access required.' },
      { status: 401 },
    );
  }

  try {
    const supabase = await createClient();
    
    // Approve all users that are not yet approved
    const { data, error } = await supabase
      .from('users')
      .update({
        is_approved: true,
        approved_by: user.userId,
        approved_at: Date.now(),
      })
      .eq('is_approved', false)
      .select('id');

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ 
      success: true, 
      result: { approved: data?.length || 0 } 
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
