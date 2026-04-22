import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

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
    const { supabase: supabaseService } = auth;

    const { data: settings, error } = await supabaseService
      .from('security_settings')
      .select('*')
      .order('key', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      settings: (settings || []).map((s) => ({
        id: s.id,
        key: s.key,
        enabled: s.enabled,
        updatedAt: s.updated_at,
        description: s.description,
      })),
    });
  } catch (error) {
    console.error('[Security Settings API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user: authUser, supabase: supabaseService } = auth;

    const { key, enabled } = await request.json();

    if (!key || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const { data: setting, error } = await supabaseService
      .from('security_settings')
      .update({ enabled, updated_by: authUser.id, updated_at: Date.now() })
      .eq('key', key)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!setting) {
      return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      setting: {
        id: setting.id,
        key: setting.key,
        enabled: setting.enabled,
        updatedAt: setting.updated_at,
      },
    });
  } catch (error) {
    console.error('[Security Settings PATCH API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
