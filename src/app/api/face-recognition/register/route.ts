import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { registerFace } from '@/lib/supabase/face';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, faceDescriptor, faceImageUrl } = body;

    if (!userId || !faceDescriptor || !faceImageUrl) {
      return NextResponse.json(
        { error: 'userId, faceDescriptor, and faceImageUrl are required' },
        { status: 400 },
      );
    }

    if (userId !== authUser.id) {
      const supabaseService = createServiceClient();
      const { data: profile } = await supabaseService
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    await registerFace(userId, faceDescriptor, faceImageUrl);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[face-recognition/register] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
