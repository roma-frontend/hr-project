import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signJWT } from '@/lib/jwt';
import { log } from '@/lib/logger';
import { applyRateLimit, FACE_LOGIN_RATE_LIMIT } from '@/lib/rate-limit';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL environment variable is not set');
}

async function convexMutation(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: name, args }),
  });
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.errorMessage ?? 'Convex error');
  return data.value;
}

async function convexQuery(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: name, args }),
  });
  const data = await res.json();
  if (data.status === 'error') return null;
  return data.value;
}

export async function POST(request: NextRequest) {
  // Rate limiting: 10 attempts per 15 minutes
  const rateLimitResponse = await applyRateLimit(request, FACE_LOGIN_RATE_LIMIT, 'face-login');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { email, isFaceLogin } = body;

    log.info('Face Login API called', { email, isFaceLogin });

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const sessionToken = crypto.randomUUID();
    const sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

    // Call Convex login mutation
    const result = await convexMutation('auth:login', {
      email,
      password: '', // Empty password for Face ID login
      sessionToken,
      sessionExpiry,
      isFaceLogin: true,
    });

    log.debug('Convex login successful', { userId: result.userId });

    // Check maintenance mode — block non-superadmin login
    if (result.role !== 'superadmin' && result.organizationId) {
      const maintenanceData = await convexQuery('admin:getMaintenanceMode', {
        organizationId: result.organizationId,
      });
      if (maintenanceData?.isActive && maintenanceData.startTime <= Date.now()) {
        return NextResponse.json(
          { error: 'maintenance', organizationId: result.organizationId },
          { status: 503 },
        );
      }
    }

    // Create JWT
    const jwt = await signJWT({
      userId: result.userId,
      name: result.name,
      email: result.email,
      role: result.role,
      organizationId: result.organizationId,
      department: result.department,
      position: result.position,
      employeeType: result.employeeType,
      avatar: result.avatarUrl,
    });

    // Set cookies
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

    log.user('Face Login successful', { userId: result.userId, email });

    // Return success with session data so client can populate auth store
    return NextResponse.json({
      success: true,
      session: {
        userId: result.userId,
        name: result.name,
        email: result.email,
        role: result.role,
        organizationId: result.organizationId,
        department: result.department,
        position: result.position,
        employeeType: result.employeeType,
        avatar: result.avatarUrl,
      },
    });
  } catch (error: any) {
    log.error('Face Login API error', error);
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}
