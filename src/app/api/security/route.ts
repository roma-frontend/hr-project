import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { user };
}

async function requireAdmin() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { user: auth.user, profile };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'get-face-descriptor': {
        const userId = searchParams.get('userId');

        if (!userId) {
          return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const supabaseService = createServiceClient();
        const { data, error } = await supabaseService
          .from('users')
          .select('face_descriptor, face_image_url, face_registered_at')
          .eq('id', userId)
          .maybeSingle();

        if (error || !data) {
          return NextResponse.json({ data: null });
        }

        return NextResponse.json({
          data: {
            faceDescriptor: data.face_descriptor,
            faceImageUrl: data.face_image_url,
            faceRegisteredAt: data.face_registered_at,
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Security API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const supabaseService = createServiceClient();
    const body = await request.json();
    const { action, userId } = body;

    switch (action) {
      case 'remove-face-registration': {
        if (!userId) {
          return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const { error } = await supabaseService
          .from('users')
          .update({
            face_descriptor: null,
            face_image_url: null,
            face_registered_at: null,
          })
          .eq('id', userId);

        if (error) {
          throw error;
        }

        return NextResponse.json({ success: true });
      }

      case 'toggle-setting': {
        const { key, enabled, updatedBy } = body;

        if (!key || updatedBy === undefined) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data: existingSetting } = await supabaseService
          .from('security_settings')
          .select('*')
          .eq('key', key)
          .maybeSingle();

        let result;
        if (existingSetting) {
          const { data, error } = await supabaseService
            .from('security_settings')
            .update({
              enabled,
              updated_by: updatedBy,
              updated_at: Date.now(),
            })
            .eq('key', key)
            .select()
            .maybeSingle();

          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
          }
          result = data;
        } else {
          const { data, error } = await supabaseService
            .from('security_settings')
            .insert({
              key,
              enabled,
              updated_by: updatedBy,
              updated_at: Date.now(),
            })
            .select()
            .maybeSingle();

          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
          }
          result = data;
        }

        return NextResponse.json({ data: result, success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Security POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
