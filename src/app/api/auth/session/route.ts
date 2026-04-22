import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        employee_type,
        department,
        position,
        phone,
        avatar_url,
        presence_status,
        is_active,
        is_approved,
        organization_id,
        organizations!inner (
          id,
          name,
          slug
        )
      `)
      .eq('email', data.user?.email || '')
      .maybeSingle();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        avatar: userProfile.avatar_url,
        department: userProfile.department,
        position: userProfile.position,
        employeeType: userProfile.employee_type,
        organizationId: userProfile.organization_id,
        organizationSlug: userProfile.organizations?.slug,
        organizationName: userProfile.organizations?.name,
        isApproved: userProfile.is_approved,
        phone: userProfile.phone,
        presenceStatus: userProfile.presence_status,
      },
    });
  } catch (error) {
    console.error('[auth/session] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
