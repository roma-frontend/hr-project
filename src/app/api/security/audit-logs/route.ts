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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const { data: logs, error } = await supabaseService
      .from('audit_logs')
      .select(
        `
        id,
        userid,
        action,
        details,
        ip,
        created_at,
        users!audit_logs_userid_fkey (name, email)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      logs: (logs || []).map((log) => {
        const user = log.users;
        return {
          id: log.id,
          userId: log.userid,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          action: log.action,
          details: log.details,
          ip: log.ip,
          createdAt: log.created_at,
        };
      }),
    });
  } catch (error) {
    console.error('[Audit Logs API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
