'use server';

import { cookies } from 'next/headers';
import { signJWT, verifyJWT, type JWTPayload } from '@/lib/jwt';

export async function updateSessionProfileAction(userId: string, name: string, email: string) {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get('hr-auth-token')?.value;

    console.log('[updateSessionProfileAction] Called with:', { userId, name, email });
    console.log('[updateSessionProfileAction] Cookie exists:', !!jwt);

    if (!jwt) {
      console.error('[updateSessionProfileAction] No JWT token found in cookie');
      console.log(
        '[updateSessionProfileAction] Available cookies:',
        cookieStore.getAll().map((c) => c.name),
      );
      throw new Error('Not authenticated - no token');
    }

    const payload = await verifyJWT(jwt);

    console.log('[updateSessionProfileAction] JWT payload:', payload);

    if (!payload) {
      console.error('[updateSessionProfileAction] Invalid JWT payload');
      throw new Error('Invalid token');
    }

    if (payload.userId !== userId) {
      console.error('[updateSessionProfileAction] User ID mismatch', {
        payloadUserId: payload.userId,
        requestUserId: userId,
      });
      throw new Error('Unauthorized - user ID mismatch');
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
    } as JWTPayload);

    console.log('[updateSessionProfileAction] New JWT created, length:', newJwt.length);

    cookieStore.set('hr-auth-token', newJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    console.log('[updateSessionProfileAction] Cookie set successfully');
    console.log('[updateSessionProfileAction] Success');

    return { success: true };
  } catch (error) {
    console.error('[updateSessionProfileAction] Error:', error);
    throw error;
  }
}
