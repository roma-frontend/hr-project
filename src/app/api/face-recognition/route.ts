import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAllFaceDescriptors } from '@/lib/supabase/face';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, profile, supabase: supabaseService };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user: authUser, supabase: supabaseService } = auth;

    const faceData = await getAllFaceDescriptors();

    const userIds = faceData.map((f) => f.id);
    const { data: users } = await supabaseService
      .from('users')
      .select('id, name, email, organizations(name)')
      .in('id', userIds);

    const descriptors = faceData.map((face) => {
      const user = users?.find((u) => u.id === face.id);
      return {
        userId: face.id,
        name: user?.name || 'Unknown',
        email: user?.email || '',
        hasFaceData: true,
      };
    });

    return NextResponse.json(descriptors);
  } catch (error) {
    console.error('[face-recognition/descriptors] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
