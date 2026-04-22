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
import { createServerClient, type CookieOptions } from '@supabase/ssr';

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
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/oauth-session',
  '/api/auth/session',
  '/api/auth/callback',
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
  '/auth/callback',
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

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const response = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in middleware');
    return false;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

// ═══════════════════════════════════════════════════════════════
// SECURITY HEADERS
// ═══════════════════════════════════════════════════════════════
function applySecurityHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production';

  // Content Security Policy
  // SECURITY: In production, remove 'unsafe-eval' to prevent XSS attacks.
  // In development, keep it because React/Next.js requires eval() for debugging features.
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline' https://*.sentry.io https://vercel.live https://va.vercel-scripts.com https://vercel-analytics.vercel.app https://*.vitals.vercel-insights.com blob:"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://vercel.live https://va.vercel-scripts.com https://vercel-analytics.vercel.app https://*.vitals.vercel-insights.com blob: https://vitals.vercel-insights.com";

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' blob: data: https://res.cloudinary.com https://lh3.googleusercontent.com https://*.sentry.io https://vercel.live https://va.vercel-scripts.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.sentry.io https://vercel.live https://*.stripe.com https://*.js.stripe.com https://va.vercel-scripts.com https://vitals.vercel-insights.com wss://*.supabase.co wss://*.supabase.in wss://*.vercel.live",
      "worker-src 'self' blob:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );

  // HSTS — enforce HTTPS (skip localhost)
  if (isProduction && !request.nextUrl.hostname.includes('localhost')) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
  }

  // X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  response.headers.set('X-Frame-Options', 'DENY');

  // Referrer-Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=self, microphone=self, geolocation=self, fullscreen=self, clipboard-write=self, payment=(), usb=()',
  );

  // Remove Next.js powered-by header
  response.headers.delete('x-powered-by');

  return response;
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internal paths and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  ) {
    // Still apply security headers to API responses
    const response = NextResponse.next();
    return applySecurityHeaders(request, response);
  }

  // Public paths — no auth check needed
  if (isPublicPath(pathname)) {
    // If user is already authenticated and tries to access login/register, redirect to dashboard
    // BUT skip this redirect if maintenance mode is active (prevents infinite redirect loop)
    const isMaintenance = request.nextUrl.searchParams.get('maintenance') === 'true';
    const hasSession = await hasValidSession(request);

    // Only redirect from auth pages (login/register/forgot-password/reset-password) if already authenticated
    // Do NOT redirect from /auth/callback, /, or other public paths
    const isAuthPage = AUTH_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
    if (isAuthPage && hasSession && !isMaintenance) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    const response = NextResponse.next();
    return applySecurityHeaders(request, response);
  }

  // Protected paths — require auth
  if (isProtectedPath(pathname)) {
    const hasSession = await hasValidSession(request);

    if (!hasSession) {
      // Redirect to login with callback URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // All other paths — apply security headers
    const response = NextResponse.next();
    
    // Pass locale cookie to server components
    const localeCookie = request.cookies.get('NEXT_LOCALE');
    if (!localeCookie) {
      response.cookies.set('NEXT_LOCALE', 'en', {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
      });
    }
    
    return applySecurityHeaders(request, response);
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
