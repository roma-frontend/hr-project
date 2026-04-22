import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createClient } from '@/lib/supabase/server';

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return 999;
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - (b[i] ?? 0)) ** 2, 0));
}

/**
 * Verify JWT auth token.
 */
async function verifyAuth(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('hr-auth-token') || cookieStore.get('oauth-session');
    if (!token) return null;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return null;

    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token.value, secret);
    return payload.sub as string;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // SECURITY: Require authentication — user can only verify their own face
  const authenticatedUserId = await verifyAuth();
  if (!authenticatedUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId, descriptor } = await req.json();

    if (!userId || !descriptor) {
      return NextResponse.json({ error: 'Missing userId or descriptor' }, { status: 400 });
    }

    // SECURITY: Users can only verify their own face data
    if (userId !== authenticatedUserId) {
      return NextResponse.json({ error: 'Forbidden. You can only verify your own face data.' }, { status: 403 });
    }

    // Get stored face descriptor from Supabase
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('users')
      .select('face_descriptor')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.face_descriptor) {
      // No face registered → skip verification (allow)
      return NextResponse.json({ match: true, reason: 'no_face_registered' });
    }

    const storedDescriptor = profile.face_descriptor as number[];
    const distance = euclideanDistance(descriptor, storedDescriptor);
    const THRESHOLD = 0.5; // lower = stricter. 0.4-0.6 is typical

    return NextResponse.json({
      match: distance <= THRESHOLD,
      distance,
      threshold: THRESHOLD,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
