/**
 * 🛡️ SECURITY MIDDLEWARE
 *
 * Provides:
 * - Auth guard for protected routes
 * - Security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - Rate limiting hints
 * - Redirect logic for unauthenticated users
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// PUBLIC PATHS (no auth required)
// ═══════════════════════════════════════════════════════════════
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/register-org',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.svg',
  '/favicon-animated.svg',
  '/favicon-32x32.svg',
  '/favicon-16x16.svg',
  '/apple-touch-icon.svg',
  '/apple-touch-icon.png',
  '/site.webmanifest',
  '/opengraph-image',
  '/api/health',
  '/api/stripe/webhook',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/face-login',
  '/api/security/face-verify',
  '/api/security/log-event',
  '/api/chat',
  '/api/chat/context',
  '/api/chat/insights',
  '/api/chat/full-context',
  '/api/chat/conflict-check',
  '/api/chat/smart-reply',
  '/api/chat/create-task',
  '/api/chat/book-driver',
  '/api/chat/book-leave',
  '/api/chat/edit-leave',
  '/api/chat/delete-leave',
  '/api/chat/weekly-digest',
  '/api/chat/link-preview',
  '/api/drivers/available',
  '/api/events/scan-conflicts',
  '/_next',
];

// Static file extensions that don't need auth
const STATIC_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.css',
  '.js',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.map',
];

// Auth route patterns (login/register)
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

// Dashboard route patterns (require auth)
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/employees',
  '/leaves',
  '/tasks',
  '/attendance',
  '/analytics',
  '/reports',
  '/calendar',
  '/settings',
  '/profile',
  '/chat',
  '/security',
  '/superadmin',
  '/organizations',
  '/join-requests',
  '/org-requests',
  '/onboarding',
  '/help',
  '/drivers',
];

function isPublicPath(pathname: string): boolean {
  // Exact match
  if (PUBLIC_PATHS.includes(pathname)) return true;

  // Static files
  if (STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return true;

  // Auth routes (login, register) — public
  if (AUTH_PATHS.some((prefix) => pathname.startsWith(prefix))) return true;

  return false;
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function hasAuthCookie(request: NextRequest): boolean {
  return (
    request.cookies.has('hr-auth-token') || request.cookies.has('oauth-session')
  );
}

// ═══════════════════════════════════════════════════════════════
// SECURITY HEADERS
// ═══════════════════════════════════════════════════════════════
function applySecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy — removed unsafe-eval for better security
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.sentry.io https://vercel.live blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' blob: data: https://res.cloudinary.com https://lh3.googleusercontent.com https://*.sentry.io",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.convex.cloud https://*.convex.site https://*.sentry.io https://vercel.live https://*.stripe.com https://*.js.stripe.com wss://*.convex.cloud wss://*.vercel.live",
      "worker-src 'self' blob:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );

  // HSTS — enforce HTTPS
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload',
  );

  // X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  response.headers.set('X-Frame-Options', 'DENY');

  // Referrer-Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=self, microphone=self, geolocation=self, fullscreen=self, clipboard=self, payment=(), usb=()',
  );

  // Remove Next.js powered-by header
  response.headers.delete('x-powered-by');

  return response;
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internal paths and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  ) {
    // Still apply security headers to API responses
    const response = NextResponse.next();
    return applySecurityHeaders(response);
  }

  // Public paths — no auth check needed
  if (isPublicPath(pathname)) {
    // If user is already authenticated and tries to access login/register, redirect to dashboard
    if (AUTH_PATHS.some((prefix) => pathname.startsWith(prefix)) && hasAuthCookie(request)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    const response = NextResponse.next();
    return applySecurityHeaders(response);
  }

  // Protected paths — require auth
  if (isProtectedPath(pathname)) {
    if (!hasAuthCookie(request)) {
      // Redirect to login with callback URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // All other paths — apply security headers
  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (favicon.svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.svg|favicon-animated\\.svg|site\\.webmanifest).*)',
  ],
};
