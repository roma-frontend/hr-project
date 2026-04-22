import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { applyRateLimit, PASSWORD_RESET_RATE_LIMIT } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(req: NextRequest) {
  // Rate limiting: 3 requests per hour
  const rateLimitResponse = await applyRateLimit(req, PASSWORD_RESET_RATE_LIMIT, 'forgot-password');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    // SECURITY: Add timing attack mitigation — constant delay regardless of user existence
    const startTime = Date.now();

    // Check if user exists
    const supabase = await createClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', email)
      .maybeSingle();

    if (error || !user) {
      // Wait a fixed amount of time to prevent timing-based email enumeration
      const elapsed = Date.now() - startTime;
      const minDelay = 500; // minimum 500ms delay
      if (elapsed < minDelay) {
        await new Promise((r) => setTimeout(r, minDelay - elapsed));
      }
      return NextResponse.json({ success: true });
    }

    // Generate reset token
    const resetToken = crypto.randomUUID();
    const resetExpiry = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour in seconds

    // Store reset token in database
    await supabase
      .from('users')
      .update({
        reset_password_token: resetToken,
        reset_password_expiry: resetExpiry,
      })
      .eq('id', user.id);

    const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;

    // Send email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && !resendKey.includes('your_api_key')) {
      const resend = new Resend(resendKey);
      // Resend requires verified domain to send to arbitrary emails.
      // Until adb.org DNS records are verified, send to test email (account owner).
      const isDomainVerified = process.env.RESEND_DOMAIN_VERIFIED === 'true';
      const testEmail = process.env.RESEND_TEST_EMAIL;
      if (!isDomainVerified && !testEmail) {
        console.warn('[forgot-password] RESEND_DOMAIN_VERIFIED is not set to true and no RESEND_TEST_EMAIL configured. Password reset emails will not be sent.');
        // Still save the token so the user can reset once domain is verified
        const elapsed = Date.now() - startTime;
        const minDelay = 500;
        if (elapsed < minDelay) {
          await new Promise((r) => setTimeout(r, minDelay - elapsed));
        }
        return NextResponse.json({ success: true });
      }
      const toEmail = isDomainVerified ? user.email! : testEmail!;
      const fromEmail = isDomainVerified
        ? 'HR Office <hr@adb.org>'
        : 'HR Office <onboarding@resend.dev>';
      const subject = isDomainVerified
        ? 'Reset your HR Office password'
        : `[For ${user.email}] Password Reset - HR Office`;
      console.log('Sending email:', { from: fromEmail, to: toEmail, target: user.email });
      const sendResult = await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f14; margin: 0; padding: 40px 20px;">
            <div style="max-width: 480px; margin: 0 auto;">
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #2563eb, #0ea5e9); padding: 12px 20px; border-radius: 12px;">
                  <span style="color: white; font-weight: 700; font-size: 18px;">🏢 HR Office</span>
                </div>
              </div>

              <!-- Card -->
              <div style="background: #1a1a2e; border: 1px solid rgba(99,102,241,0.2); border-radius: 16px; padding: 40px 36px;">
                <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Reset your password</h1>
                <p style="color: #9ca3af; font-size: 15px; margin: 0 0 28px; line-height: 1.5;">
                  Hi ${user.name},<br><br>
                  We received a request to reset your password. Click the button below to choose a new one.
                </p>

                <!-- Button -->
                <a href="${resetLink}" style="display: block; text-align: center; background: linear-gradient(135deg, #2563eb, #0ea5e9); color: white; text-decoration: none; padding: 14px 24px; border-radius: 10px; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
                  Reset Password →
                </a>

                <!-- Warning -->
                <div style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.15); border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
                  <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.5;">
                    ⏱️ This link expires in <strong style="color: #93c5fd;">1 hour</strong>.<br>
                    If you didn't request this, you can safely ignore this email.
                  </p>
                </div>

                <!-- Link fallback -->
                <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.6;">
                  If the button doesn't work, copy and paste this link:<br>
                  <a href="${resetLink}" style="color: #2563eb; word-break: break-all;">${resetLink}</a>
                </p>
              </div>

              <!-- Footer -->
              <p style="text-align: center; color: #4b5563; font-size: 12px; margin-top: 24px;">
                © ${new Date().getFullYear()} HR Office • HR Management System
              </p>
            </div>
          </body>
          </html>
        `,
      });
      console.log('Resend result:', JSON.stringify(sendResult));
      if (sendResult.error) {
        console.error('Resend error:', sendResult.error);
        // Don't throw — token is still saved, user can try again or admin can resend
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    const msg = err instanceof Error ? err.message : 'Something went wrong';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
