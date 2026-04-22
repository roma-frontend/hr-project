'use server';

import { cookies } from 'next/headers';
import { signJWT, verifyJWT } from '@/lib/jwt';
import { log } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { serverT } from '@/lib/i18n/server-actions-i18n';

async function registerUser(name: string, email: string, password: string, phone?: string, organizationId?: string, inviteToken?: string) {
  const supabase = await createClient();
  
  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    throw new Error(serverT('actions.auth.emailExists', 'An account with this email already exists. Please login instead.'));
  }
  
  // Sign up user with Supabase Auth
  // The trigger will automatically create a profile in public.users
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      data: { 
        name,
        phone: phone || undefined,
        organization_id: organizationId || undefined,
        invite_token: inviteToken || undefined,
      },
    },
  });

  if (authError) {
    throw new Error(authError.message);
  }

  if (!authData.user) {
    throw new Error(serverT('actions.auth.failedCreateUser', 'Failed to create user'));
  }

  // Wait a moment for the trigger to create the profile
  await new Promise(resolve => setTimeout(resolve, 500));

  // Fetch the profile that was created by the trigger
  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!userProfile) {
    // Profile might not have been created yet, try by email
    const { data: profileByEmail } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!profileByEmail) {
      throw new Error(serverT('actions.auth.profileNotCreated', 'User profile was not created. Please contact support.'));
    }
  }

  // All users are auto-approved in Supabase (approval flow handled separately)
  const needsApproval = !inviteToken;

  return {
    userId: authData.user.id,
    name,
    email,
    role: userProfile?.role || 'employee',
    organizationId: organizationId || null,
    organizationSlug: null,
    organizationName: null,
    department: null,
    position: null,
    employeeType: 'staff',
    avatarUrl: null,
    needsApproval,
  };
}

async function loginUser(email: string, password: string, isFaceLogin: boolean = false) {
  const supabase = await createClient();
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    throw new Error(authError.message);
  }

  if (!authData.user) {
    throw new Error(serverT('actions.auth.authenticationFailed', 'Authentication failed'));
  }

  // Get user profile from database - try by ID first (primary key)
  let { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  // Fallback: try by email
  if (!user) {
    const { data: userByEmail } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    user = userByEmail;
  }

  if (!user) {
    throw new Error(serverT('actions.auth.profileNotFound', 'User profile not found. Please contact support.'));
  }

  // Get organization info if needed
  let orgSlug = null;
  let orgName = null;
  if (user.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('slug, name')
      .eq('id', user.organization_id)
      .maybeSingle();
    if (org) {
      orgSlug = org.slug;
      orgName = org.name;
    }
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id,
    organizationSlug: orgSlug,
    organizationName: orgName,
    department: user.department,
    position: user.position,
    employeeType: user.employee_type,
    avatarUrl: user.avatar_url,
    isApproved: user.is_approved,
  };
}

export async function registerAction(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const phone = formData.get('phone') as string | undefined;
  const organizationId = formData.get('organizationId') as string | undefined;
  const inviteToken = formData.get('inviteToken') as string | undefined;

  if (!name || !email || !password) throw new Error(serverT('actions.auth.allFieldsRequired', 'All fields required'));
  if (password.length < 8) throw new Error(serverT('actions.auth.passwordMinLength', 'Password must be at least 8 characters'));

  const result = await registerUser(name, email, password, phone, organizationId, inviteToken);

  // If user needs approval, don't auto-login
  if (result.needsApproval) {
    return {
      success: true,
      role: result.role,
      needsApproval: true,
      message:
        serverT('actions.auth.accountPendingApproval', 'Your account has been created and is pending admin approval. You will be notified once approved.'),
    };
  }

  // Auto-login after register (for admin users)
  const sessionToken = crypto.randomUUID();
  const sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

  const loginResult = await loginUser(email, password);

  const jwt = await signJWT({
    userId: loginResult.userId,
    name: loginResult.name,
    email: loginResult.email,
    role: loginResult.role,
    organizationId: loginResult.organizationId,
    organizationSlug: loginResult.organizationSlug,
    organizationName: loginResult.organizationName,
    department: loginResult.department,
    position: loginResult.position,
    employeeType: loginResult.employeeType,
    avatar: loginResult.avatarUrl,
  });

  const cookieStore = await cookies();
  cookieStore.set('hr-auth-token', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
  cookieStore.set('hr-session-token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return {
    success: true,
    role: result.role,
    needsApproval: false,
    userId: loginResult.userId,
    name: loginResult.name,
    email: loginResult.email,
    department: loginResult.department,
    position: loginResult.position,
    employeeType: loginResult.employeeType,
    avatar: loginResult.avatarUrl,
  };
}

export async function loginAction(
  formData: FormData | { email: string; password: string; isFaceLogin?: boolean },
) {
  let email: string = '';
  let password: string;
  let isFaceLogin = false;

  try {
    const endTimer = log.time('User Login');

    log.info('Login action initiated', {
      action: 'login',
      inputType: formData instanceof FormData ? 'FormData' : 'Object',
    });

    if (formData instanceof FormData) {
      email = formData.get('email') as string;
      password = formData.get('password') as string;
    } else {
      email = formData.email;
      password = formData.password;
      isFaceLogin = formData.isFaceLogin || false;
    }

    log.debug('Login credentials parsed', {
      email,
      hasPassword: !!password,
      isFaceLogin,
    });

    // For Face ID login, we don't need password validation
    if (!isFaceLogin && (!email || !password)) {
      throw new Error(serverT('actions.auth.emailPasswordRequired', 'Email and password required'));
    }

    const sessionToken = crypto.randomUUID();
    const sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

    log.api.call('POST', 'auth:login', { email, isFaceLogin });

    let result;
    try {
      result = await loginUser(email, password, isFaceLogin);

      log.debug('Raw Supabase login result', {
        result,
        keys: Object.keys(result),
        types: Object.fromEntries(Object.entries(result).map(([k, v]) => [k, typeof v])),
      });

      log.api.response('POST', 'auth:login', 200, {
        userId: result.userId,
        role: result.role,
      });
    } catch (loginError: any) {
      log.error('Supabase auth:login failed', loginError, {
        email,
        isFaceLogin,
        errorMessage: loginError?.message,
        errorName: loginError?.name,
      });
      // Re-throw with a cleaner message
      throw new Error(loginError?.message || serverT('actions.auth.authenticationFailed', 'Authentication failed'));
    }

    log.debug('Creating JWT token', { userId: result.userId, name: result.name });

    const jwt = await signJWT({
      userId: result.userId,
      name: result.name,
      email: result.email,
      role: result.role,
    organizationId: result.organizationId,
    organizationSlug: result.organizationSlug,
    organizationName: result.organizationName,
    department: result.department,
    position: result.position,
    employeeType: result.employeeType,
    avatar: result.avatarUrl,
  });

  log.debug('JWT token created successfully');

    log.debug('Setting authentication cookies');

    const cookieStore = await cookies();
    cookieStore.set('hr-auth-token', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    cookieStore.set('hr-session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    log.user('User logged in successfully', {
      userId: result.userId,
      email: result.email,
      role: result.role,
      isFaceLogin,
    });

    // Auto-unlock Face ID after successful email/password login
    if (!isFaceLogin) {
      try {
        log.debug('Auto-unlocking Face ID after password login', { userId: result.userId });
        const supabase = await createClient();
        await supabase
          .from('users')
          .update({
            faceid_blocked: false,
            faceid_blocked_at: null,
            faceid_failed_attempts: 0,
          })
          .eq('id', result.userId);
        log.info('Face ID auto-unlocked successfully', { userId: result.userId });
      } catch (error) {
        log.error(
          'Failed to auto-unlock Face ID',
          error instanceof Error ? error : new Error(String(error)),
          {
            userId: result.userId,
          },
        );
        // Don't fail login if Face ID unlock fails
      }
    }

    endTimer();

    // Return ONLY success flag to avoid serialization issues
    // Client will get user data from the JWT cookie via getSessionAction
    log.debug('Login successful, cookies set');

    return { success: true };
  } catch (error: any) {
    log.error('Login action failed', error, {
      action: 'login',
      email,
      isFaceLogin,
    });
    throw error;
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('hr-session-token')?.value;
  const jwt = cookieStore.get('hr-auth-token')?.value;

  if (jwt) {
    try {
      const payload = await verifyJWT(jwt);
      if (payload && sessionToken) {
        // Update session expiry in Supabase
        const supabase = await createClient();
        await supabase
          .from('users')
          .update({
            session_token: null,
            session_expiry: null,
          })
          .eq('id', payload.userId);
      }
    } catch {}
  }

  cookieStore.delete('hr-auth-token');
  cookieStore.delete('hr-session-token');
}

export async function getSessionAction() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get('hr-auth-token')?.value;
  if (!jwt) return null;
  return await verifyJWT(jwt);
}

export async function updateSessionProfileAction(userId: string, name: string, email: string) {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get('hr-auth-token')?.value;

    if (!jwt) {
      throw new Error(serverT('actions.auth.notAuthenticated', 'Not authenticated'));
    }

    const payload = await verifyJWT(jwt);

    if (!payload) {
      throw new Error(serverT('actions.auth.invalidToken', 'Invalid token'));
    }

    if (payload.userId !== userId) {
      throw new Error(serverT('actions.auth.unauthorized', 'Unauthorized'));
    }

    const newJwt = await signJWT({
      userId: payload.userId,
      name,
      email,
      role: payload.role,
    organizationId: payload.organizationId,
    organizationSlug: payload.organizationSlug,
    organizationName: payload.organizationName,
    department: payload.department,
    position: payload.position,
    employeeType: payload.employeeType,
    avatar: payload.avatar,
  });

  cookieStore.set('hr-auth-token', newJwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return { success: true };
} catch (error) {
  throw error;
}
}

export async function updateSessionAvatarAction(userId: string, avatarUrl: string) {
  const cookieStore = await cookies();
  const jwt = cookieStore.get('hr-auth-token')?.value;
  if (!jwt) throw new Error(serverT('actions.auth.notAuthenticated', 'Not authenticated'));

  const payload = await verifyJWT(jwt);
  if (!payload || payload.userId !== userId) throw new Error(serverT('actions.auth.unauthorized', 'Unauthorized'));

  // Update JWT with new avatar
  const newJwt = await signJWT({
    userId: payload.userId,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId,
    organizationSlug: payload.organizationSlug,
    organizationName: payload.organizationName,
    department: payload.department,
    position: payload.position,
    employeeType: payload.employeeType,
    avatar: avatarUrl,
  });

  cookieStore.set('hr-auth-token', newJwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return { success: true, avatar: avatarUrl };
}

/**
 * Ensures the superadmin account always exists in the database.
 * Call this on app startup or during first-time setup.
 */
export async function ensureSuperadminExists() {
  const SUPERADMIN_EMAIL = 'romangulanyan@gmail.com';
  const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;

  if (!SUPERADMIN_PASSWORD) {
    console.error('[ensureSuperadminExists] SUPERADMIN_PASSWORD environment variable is not set');
    return { success: false, error: 'Superadmin password not configured' };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[ensureSuperadminExists] Supabase environment variables are not set');
    return { success: false, error: 'Supabase configuration missing' };
  }

  // Create service role client to bypass RLS
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        get() { return undefined; },
        set() {},
        remove() {},
      },
    }
  );

  // Check if superadmin user exists
  const { data: superadmin } = await supabase
    .from('users')
    .select('id, email, role, is_active, is_approved')
    .eq('email', SUPERADMIN_EMAIL)
    .maybeSingle();

  if (!superadmin) {
    // Create superadmin user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
      options: {
        data: {
          name: 'Roman Gulanyan',
          role: 'superadmin',
        },
      },
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (authData.user) {
      // Update the user profile with superadmin role
      const { error: updateError } = await supabase
        .from('users')
        .update({
          organization_id: null,
          role: 'superadmin',
          employee_type: 'staff',
          is_active: true,
          is_approved: true,
          travel_allowance: 9999,
          paid_leave_balance: 999,
          sick_leave_balance: 999,
          family_leave_balance: 999,
        })
        .eq('id', authData.user.id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true, userId: authData.user.id };
    }
  }

  // Superadmin already exists, ensure it has correct permissions
  if (superadmin && superadmin.role !== 'superadmin') {
    const { error: updateError } = await supabase
      .from('users')
      .update({
        role: 'superadmin',
        is_active: true,
        is_approved: true,
      })
      .eq('email', SUPERADMIN_EMAIL);

    if (updateError) {
      return { success: false, error: updateError.message };
    }
  }

  // Always ensure name and other fields are correct for existing superadmin
  const { error: updateError } = await supabase
    .from('users')
    .update({
      name: 'Roman Gulanyan',
      role: 'superadmin',
      is_active: true,
      is_approved: true,
      travel_allowance: 9999,
      paid_leave_balance: 999,
      sick_leave_balance: 999,
      family_leave_balance: 999,
    })
    .eq('email', SUPERADMIN_EMAIL);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true, userId: superadmin?.id };
}
