import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { email, name, avatarUrl } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({
        userId: existingUser.id,
        created: false,
      });
    }

    const finalName = name?.trim() || email.split('@')[0] || 'User';
    const now = Math.floor(Date.now() / 1000);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email,
        name: finalName,
        password_hash: 'oauth',
        role: 'employee',
        employee_type: 'staff',
        is_active: true,
        is_approved: false,
        travel_allowance: 0,
        paid_leave_balance: 20,
        sick_leave_balance: 10,
        family_leave_balance: 5,
        avatar_url: avatarUrl,
        created_at: now,
        updated_at: now,
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!newUser) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      userId: newUser.id,
      created: true,
    });
  } catch (error) {
    console.error('[auth/oauth-session] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
