import { NextResponse, NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/database.types';
import { applyRateLimit, LOGIN_RATE_LIMIT, handleFailedLogin } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(
      request,
      LOGIN_RATE_LIMIT,
      'login',
    );
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Create a fresh response object to collect cookies
    const response = new NextResponse();
    
    // Create SSR client to properly handle cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error: missing Supabase environment variables' },
        { status: 500 }
      );
    }

    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Set cookie on the response object
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value: '',
              ...options,
              maxAge: 0,
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      await handleFailedLogin(normalizedEmail, request);
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    const supabaseServiceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: missing Supabase environment variables' },
        { status: 500 }
      );
    }

    const supabaseService = createSupabaseClient<Database>(
      supabaseServiceUrl,
      supabaseServiceKey
    );

    // Use select('*') to bypass schema cache issues with camelCase columns
    let { data: users } = await supabaseService
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .limit(1);

    let user = users?.[0];

    // Fallback: try by email
    if (!user) {
      const { data: usersByEmail } = await supabaseService
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .order('created_at', { ascending: false })
        .limit(1);

      user = usersByEmail?.[0];
    }

    // If still no profile, create one
    if (!user && data.user) {
      const authUser = data.user;
      const userName = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';
      const userRole = authUser.user_metadata?.role || 'employee';
      const orgId = authUser.user_metadata?.organization_id || null;

      // Create user profile directly via insert
      const { data: insertedUsers, error: insertError } = await supabaseService
        .from('users')
        .insert({
          id: authUser.id,
          organization_id: orgId,
          name: userName,
          email: normalizedEmail,
          password_hash: 'auth_managed',
          role: userRole,
          employee_type: 'staff',
          is_active: true,
          is_approved: true,
          travel_allowance: userRole === 'superadmin' ? 9999 : 0,
          paid_leave_balance: userRole === 'superadmin' ? 999 : 0,
          sick_leave_balance: userRole === 'superadmin' ? 999 : 0,
          family_leave_balance: userRole === 'superadmin' ? 999 : 0,
          created_at: Date.now(),
          updated_at: Date.now(),
        })
        .select('*')
        .limit(1);

      if (insertError) {
        // If insert fails, try to fetch the profile
        const { data: fetchedUsers } = await supabaseService
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .limit(1);

        user = fetchedUsers?.[0];

        if (!user) {
          return NextResponse.json(
            { error: `Failed to create user profile: ${insertError.message}` },
            { status: 500 }
          );
        }
      } else {
        user = insertedUsers?.[0];
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found. Please contact support.' },
        { status: 404 }
      );
    }

    // Access organization_id from user object
    const orgId = user?.organization_id;

    // Get organization info
    let orgSlug = null;
    let orgName = null;
    if (orgId) {
      const { data: org } = await supabaseService
        .from('organizations')
        .select('id, name, slug')
        .eq('id', orgId)
        .maybeSingle();
      if (org) {
        orgSlug = org.slug;
        orgName = org.name;
      }
    }

    const responseData = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar_url,
        department: user.department,
        position: user.position,
        employeeType: user.employee_type,
        organization_id: orgId,
        organizationSlug: orgSlug,
        organizationName: orgName,
        isApproved: user.is_approved,
        phone: user.phone,
        presenceStatus: user.presence_status,
      },
      session: data.session,
    };

    // Create JSON response and copy cookies from SSR client
    const jsonResponse = NextResponse.json(responseData);
    
    // Copy all cookies from the SSR response to the JSON response
    response.cookies.getAll().forEach((cookie) => {
      jsonResponse.cookies.set(cookie);
    });

    return jsonResponse;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
