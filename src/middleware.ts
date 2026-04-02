import { type NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, isBlocked, blockKey } from '@/lib/redis'

// ═══════════════════════════════════════════════════════════════
// SECURITY CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const SECURITY_CONFIG = {
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 500,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_BLOCK_DURATION: 15 * 60 * 1000, // 15 minutes
  DDOS_THRESHOLD: 200,
  SUSPICIOUS_PATHS: ['/admin/php', '/wp-admin', '/phpmyadmin', '/.env', '/.git', '/config'],
} as const;

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/attendance',
  '/employees',
  '/leaves',
  '/analytics',
  '/reports',
  '/tasks',
  '/calendar',
  '/approvals',
  '/settings',
  '/profile',
  '/admin',
  '/superadmin',
  '/ai-site-editor',
] as const;

// Auth routes
const AUTH_ROUTES = ['/login', '/register'] as const;

// Public routes that should NOT redirect authenticated users
const PUBLIC_ROUTES = ['/', '/contact', '/privacy', '/terms', '/test-i18n'] as const;

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0].trim() || realIP || 'unknown';
}

function isSuspiciousPath(pathname: string): boolean {
  return SECURITY_CONFIG.SUSPICIOUS_PATHS.some(path =>
    pathname.toLowerCase().includes(path.toLowerCase())
  );
}

/**
 * Generate a nonce for CSP script-src to replace unsafe-eval.
 * In production, this nonce allows only scripts tagged with it.
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

/**
 * SINGLE SOURCE OF TRUTH for all security headers.
 * These are NOT duplicated in next.config.js headers().
 */
function addSecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  // Content-Security-Policy — uses nonce instead of unsafe-eval
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com https://js.stripe.com https://maps.googleapis.com https://*.sentry.io https://*.vercel.app https://*.vercel-scripts.com`,
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob: https://*.tile.openstreetmap.org https://unpkg.com",
      "connect-src 'self' https://*.convex.cloud https://*.googleapis.com https://api.groq.com https://api.openai.com https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://*.metered.live https://*.metered.ca https://*.vercel.app https://*.vercel-scripts.com wss://*.convex.cloud https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org",
      "frame-src 'self' https://js.stripe.com https://accounts.google.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "manifest-src 'self'",
    ].join('; ')
  );

  // Pass nonce to the app via header (for Next.js Script components)
  response.headers.set('x-nonce', nonce);

  // Transport security
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Prevent clickjacking — DENY (not SAMEORIGIN)
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // XSS Protection (legacy but still useful)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), interest-cohort=()');

  // Remove X-Powered-By
  response.headers.delete('X-Powered-By');

  return response;
}

// ═══════════════════════════════════════════════════════════════
// MAIN MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIP(request);

  // 1. Check blocked IPs (persistent via Redis)
  const isIpBlocked = await isBlocked(`ip:${ip}`);
  if (isIpBlocked && !pathname.startsWith('/api/')) {
    return new NextResponse('Access Denied', { status: 403 });
  }

  // 2. Check suspicious paths - block IP persistently via Redis
  if (isSuspiciousPath(pathname)) {
    try {
      await blockKey(`ip:${ip}`, 24 * 60 * 60 * 1000, 'Suspicious path access attempt');
    } catch (_error) {
      // Redis error - continue without blocking
    }
    return new NextResponse('Not Found', { status: 404 });
  }

  // 3. Rate Limiting with Redis (with fallback)
  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimit(ip, SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS, SECURITY_CONFIG.RATE_LIMIT_WINDOW);
  } catch (_error) {
    // Fallback: allow request if Redis is unavailable
    rateLimitResult = { allowed: true, remaining: 100, resetAt: Date.now() };
  }
  if (!rateLimitResult.allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toUTCString(),
      },
    });
  }

  // 4. DDoS Protection (check request volume) - block IP persistently via Redis
  if (rateLimitResult.remaining < SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS - SECURITY_CONFIG.DDOS_THRESHOLD) {
    try {
      await blockKey(`ip:${ip}`, 60 * 60 * 1000, 'Potential DDoS attack');
    } catch (_error) {
      // Redis error - continue without blocking
    }
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  // 5. Brute Force Protection for login with Redis
  if (pathname === '/login' || pathname === '/api/auth/signin') {
    try {
      const blocked = await isBlocked(`login:${ip}`);
      if (blocked) {
        return new NextResponse(
          JSON.stringify({
            error: 'Too many login attempts',
            message: 'Blocked for 15 minutes',
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (_error) {
      // Continue without blocking if Redis is unavailable
    }
  }

  // 6. SQL Injection check in query params - block IP persistently via Redis
  if (pathname.startsWith('/api/')) {
    const url = new URL(request.url);
    const suspiciousPatterns = [
      /(\bSELECT\b|\bUNION\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b)/gi,
      /<script[^>]*>.*?<\/script>/gi,
    ];

    for (const [, value] of url.searchParams.entries()) {
      if (suspiciousPatterns.some(pattern => pattern.test(value))) {
        try {
          await blockKey(`ip:${ip}`, 24 * 60 * 60 * 1000, 'SQL/XSS injection attempt');
        } catch (_error) {
          // Redis error - continue without blocking
        }
        return new NextResponse('Bad Request', { status: 400 });
      }
    }
  }

  // 7. Auth logic
  const token = request.cookies.get('hr-auth-token')?.value;
  const nextAuthToken = request.cookies.get('next-auth.session-token')?.value ||
                        request.cookies.get('__Secure-next-auth.session-token')?.value;

  const isAuthRoute = AUTH_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));

  // If user is authenticated and visits auth routes (/login, /register)
  if (isAuthRoute && (token || nextAuthToken)) {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');

    if (from && from.startsWith('/') && !from.startsWith('/login') && !from.startsWith('/register')) {
      return NextResponse.redirect(new URL(from, request.url));
    }

    return NextResponse.next();
  }

  // If user is authenticated and visits public page — allow (no redirect)
  if (isPublicRoute && (token || nextAuthToken)) {
    return NextResponse.next();
  }

  // Block access to protected routes without authentication
  if (isProtectedRoute && !token && !nextAuthToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 8. Role-based access control is handled CLIENT-SIDE by each page component
  // The middleware only handles authentication gating (step 7 above), NOT authorization.

  // 9. Generate nonce and add security headers
  const nonce = generateNonce();
  const response = NextResponse.next();
  return addSecurityHeaders(response, nonce);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|icon.svg|robots.txt|sitemap.xml|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|json)$).*)',
  ],
}