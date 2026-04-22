import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export function methodNotAllowed(allowedMethods: string[]): NextResponse {
  return NextResponse.json(
    { error: `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}` },
    { status: 405, headers: { Allow: allowedMethods.join(', ') } }
  );
}

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { user };
}

export async function requireAdmin() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { user: auth.user, profile };
}

export async function requireSuperadmin() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabaseService = createServiceClient();
  const { data: profile } = await supabaseService
    .from('users')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { user: auth.user, profile };
}
