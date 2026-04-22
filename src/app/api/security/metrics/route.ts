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
    const hours = parseInt(searchParams.get('hours') || '24');

    const now = Date.now();
    const since = now - hours * 60 * 60 * 1000;

    const { count: total } = await supabaseService
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since);

    const { count: failed } = await supabaseService
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('success', false)
      .gte('created_at', since);

    const { data: highRiskData } = await supabaseService
      .from('login_attempts')
      .select('risk_score')
      .gte('created_at', since)
      .gte('risk_score', 60);

    const { data: suspicious } = await supabaseService
      .from('login_attempts')
      .select('email, success, method, ip, risk_score, risk_factors, blocked_reason, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      stats: {
        total: total || 0,
        failed: failed || 0,
        highRisk: highRiskData?.length || 0,
        suspicious: (suspicious || []).map((s) => ({
          email: s.email,
          success: s.success,
          method: s.method,
          ip: s.ip,
          riskScore: s.risk_score ? Number(s.risk_score) : undefined,
          riskFactors: s.risk_factors as string[],
          blockedReason: s.blocked_reason,
          createdAt: s.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('[Login Stats API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
