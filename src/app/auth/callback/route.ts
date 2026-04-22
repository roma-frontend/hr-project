import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Database } from '@/lib/supabase/database.types';

export async function GET(request: Request) {
  const { searchParams, origin, hash } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const errorParam = searchParams.get('error');

  console.log('[auth/callback] URL:', request.url);
  console.log('[auth/callback] Code:', code ? 'present' : 'missing');
  console.log('[auth/callback] Hash:', hash);
  console.log('[auth/callback] Error param:', errorParam);

  // Handle OAuth errors from provider
  if (errorParam) {
    console.error('[auth/callback] OAuth error:', errorParam);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorParam)}`);
  }

  // Handle hash fragment tokens (Supabase OAuth implicit flow)
  if (hash && hash.includes('access_token')) {
    console.log('[auth/callback] Got hash fragment tokens, redirecting to handle...');
    // The client-side will handle hash fragment tokens via Supabase's detectSessionInUrl
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (!code) {
    console.error('[auth/callback] No code provided');
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  try {
    const supabase = await createClient();
    console.log('[auth/callback] Exchanging code for session...');
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession error:', error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    console.log('[auth/callback] Session exchanged successfully');

    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      console.log('[auth/callback] User:', user.id, user.email);
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[auth/callback] Missing Supabase environment variables');
        return NextResponse.redirect(`${origin}/login?error=server_config`);
      }

      const supabaseService = createSupabaseClient<Database>(
        supabaseUrl,
        supabaseServiceKey
      );

      // Check if profile exists by ID first
      const { data: existingProfile, error: profileError } = await supabaseService
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[auth/callback] Profile check error:', profileError);
      }

      if (!existingProfile) {
        console.log('[auth/callback] Profile not found, checking by email...');
        
        // Check by email as fallback
        const { data: existingByEmail, error: emailError } = await supabaseService
          .from('users')
          .select('*')
          .eq('email', user.email ?? '')
          .maybeSingle();

        if (emailError) {
          console.error('[auth/callback] Email check error:', emailError);
        }

        if (existingByEmail) {
          console.log('[auth/callback] Found existing profile by email, linking...');
          // Link existing profile to this auth user
          const { error: updateError } = await supabaseService
            .from('users')
            .update({ id: user.id })
            .eq('id', existingByEmail.id);
          
          if (updateError) {
            console.error('[auth/callback] Profile link error:', updateError);
          }
        } else {
          console.log('[auth/callback] Creating new profile...');
          
          // Create new profile
          const { data: org } = await supabaseService
            .from('organizations')
            .select('id')
            .limit(1)
            .maybeSingle();

          const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
          const userRole = user.email === 'romangulanyan@gmail.com' ? 'superadmin' : 'employee';

          const { error: insertError } = await supabaseService.from('users').insert({
            id: user.id,
            organization_id: org?.id || null,
            name: userName,
            email: user.email ?? '',
            password_hash: 'oauth_managed',
            role: userRole,
            employee_type: 'staff',
            is_active: true,
            is_approved: true,
            travel_allowance: userRole === 'superadmin' ? 9999 : 0,
            paid_leave_balance: userRole === 'superadmin' ? 999 : 0,
            sick_leave_balance: userRole === 'superadmin' ? 999 : 0,
            family_leave_balance: userRole === 'superadmin' ? 999 : 0,
            created_at: Math.floor(Date.now() / 1000),
            presence_status: 'available',
          });

          if (insertError) {
            console.error('[auth/callback] Profile creation error:', insertError);
          } else {
            console.log('[auth/callback] Profile created successfully');
          }
        }
      } else {
        console.log('[auth/callback] Profile already exists');
      }
    }

    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';

    console.log('[auth/callback] Redirecting to:', isLocalEnv ? `${origin}${next}` : `https://${forwardedHost}${next}`);

    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    }
  } catch (error) {
    console.error('[auth/callback] Unexpected error:', error);
    return NextResponse.redirect(`${origin}/login?error=unexpected_error`);
  }
}
