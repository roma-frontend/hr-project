import { cookies } from 'next/headers';
import { verifyJWT, type JWTPayload } from '@/lib/jwt';

/**
 * Server-side auth helper for React Server Components.
 * Reads the auth cookie and returns the verified user payload.
 * Returns null if not authenticated.
 */
export async function getServerUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('hr-auth-token') ?? cookieStore.get('oauth-session');
  if (!token?.value) return null;
  return verifyJWT(token.value);
}
