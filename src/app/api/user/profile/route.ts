import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api-utils';
import type { Database } from '@/lib/supabase/database.types';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user: authUser } = auth;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');

    // Only allow users to look up their own profile unless they're admin
    const lookupId = userId || email ? (userId || null) : authUser.id;
    const lookupEmail = email || null;

    console.log('[API /user/profile] Request:', { userId: lookupId, email: lookupEmail, authUserId: authUser.id });

    if (!lookupId && !lookupEmail) {
      return NextResponse.json({ error: 'userId or email required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: missing Supabase environment variables' },
        { status: 500 }
      );
    }

    const supabaseService = createClient<Database>(
      supabaseUrl,
      supabaseServiceKey
    );

    // First try by ID
    let { data: users, error: userError } = await supabaseService
      .from('users')
      .select('*')
      .eq('id', lookupId!)
      .limit(1);

    if (userError) {
      console.error('[API /user/profile] Error fetching by ID:', userError);
    }

    let user = users?.[0];
    console.log('[API /user/profile] User by ID:', user ? { id: user.id, name: user.name } : null);

    // Fallback: try by email
    if (!user && lookupEmail) {
      const { data: usersByEmail, error: emailError } = await supabaseService
        .from('users')
        .select('*')
        .eq('email', lookupEmail.toLowerCase().trim())
        .order('created_at', { ascending: false })
        .limit(1);

      if (emailError) {
        console.error('[API /user/profile] Error fetching by email:', emailError);
      }

      user = usersByEmail?.[0];
      console.log('[API /user/profile] User by email:', user ? { id: user.id, name: user.name } : null);
    }

    if (!user) {
      console.error('[API /user/profile] User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch organization if exists
    let org = null;
    if (user.organization_id) {
      const { data: orgData, error: orgError } = await supabaseService
        .from('organizations')
        .select('id, name, slug')
        .eq('id', user.organization_id)
        .maybeSingle();
      
      if (orgError) {
        console.error('[API /user/profile] Error fetching org:', orgError);
      }
      org = orgData;
    }

    console.log('[API /user/profile] Success:', { id: user.id, name: user.name, role: user.role });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
      department: user.department,
      position: user.position,
      employee_type: user.employee_type,
      organization_id: user.organization_id,
      organization: org,
      is_approved: user.is_approved,
      phone: user.phone,
      presence_status: user.presence_status,
    });
  } catch (error) {
    console.error('[API /user/profile] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
