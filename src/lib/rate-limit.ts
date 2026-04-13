/**
 * Rate limiting helpers for API routes
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit, blockKey, getFailedLoginCount, logLoginAttempt } from '@/lib/redis';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

/**
 * Get client identifier for rate limiting (IP + fingerprint)
 */
function getClientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown';
  const userAgent = req.headers.get('user-agent') ?? '';
  // Hash the combination for privacy
  return `${ip}:${userAgent.slice(0, 64)}`;
}

/**
 * Apply rate limiting to a request
 * Returns null if allowed, or a 429 Response if rate limited
 */
export async function applyRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  context: string,
): Promise<NextResponse | null> {
  const key = `${context}:${getClientKey(req)}`;
  const { maxRequests, windowMs, blockDurationMs } = config;

  const result = await checkRateLimit(key, maxRequests, windowMs);

  if (!result.allowed) {
    // Auto-block if exceeded significantly
    if (blockDurationMs && result.remaining <= -maxRequests) {
      await blockKey(getClientKey(req), blockDurationMs, `Rate limit exceeded: ${context}`);
    }

    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: 'Too many requests',
        retryAfter,
        message: `Rate limit: ${maxRequests} requests per ${windowMs / 1000}s`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
          'X-RateLimit-Reset': String(result.resetAt),
        },
      },
    );
  }

  return null;
}

/**
 * Rate limit config for login attempts (strict)
 */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 5 attempts per 15 minutes
  blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
};

/**
 * Rate limit config for password reset (moderate)
 */
export const PASSWORD_RESET_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 3 attempts per hour
  blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
};

/**
 * Rate limit config for face login (moderate)
 */
export const FACE_LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 10 attempts per 15 minutes
  blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
};

/**
 * Rate limit config for general API (loose)
 */
export const GENERAL_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 15 * 60 * 1000, // 100 requests per 15 minutes
};

/**
 * Log failed login and track for auto-blocking
 */
export async function handleFailedLogin(
  email: string,
  req: NextRequest,
  riskScore?: number,
): Promise<void> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  await logLoginAttempt(email, ip, false, riskScore);

  // Check if we should auto-block
  const failedCount = await getFailedLoginCount(email, ip);
  if (failedCount >= 5) {
    await blockKey(
      `${email}:${ip}`,
      15 * 60 * 1000,
      `Too many failed login attempts (${failedCount})`,
    );
  }
}

export default {
  applyRateLimit,
  handleFailedLogin,
  LOGIN_RATE_LIMIT,
  PASSWORD_RESET_RATE_LIMIT,
  FACE_LOGIN_RATE_LIMIT,
  GENERAL_RATE_LIMIT,
};
