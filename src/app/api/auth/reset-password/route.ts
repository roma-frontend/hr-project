import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, PASSWORD_RESET_RATE_LIMIT } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  // Rate limiting: 3 requests per hour
  const rateLimitResponse = await applyRateLimit(req, PASSWORD_RESET_RATE_LIMIT, 'reset-password');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    // Verify the token is valid and not expired
    const supabase = await createClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, reset_password_token, reset_password_expiry')
      .eq('reset_password_token', token)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    if (!user.reset_password_expiry || Math.floor(Date.now() / 1000) > user.reset_password_expiry) {
      return NextResponse.json({ error: 'Reset token has expired' }, { status: 400 });
    }

    // Update password using Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Clear the reset token
    await supabase
      .from('users')
      .update({
        reset_password_token: null,
        reset_password_expiry: null,
      })
      .eq('id', user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Something went wrong';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
