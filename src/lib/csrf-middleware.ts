import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrfFromRequest, requiresCsrfProtection } from '@/lib/csrf';

/**
 * CSRF protection middleware for API routes
 * Usage: Apply to all POST/PUT/DELETE/PATCH requests
 */
export function withCsrfProtection(
  handler: (req: NextRequest) => Promise<Response | NextResponse>,
) {
  return async (req: NextRequest): Promise<Response | NextResponse> => {
    // Skip GET requests - they don't modify state
    if (req.method === 'GET') {
      return handler(req);
    }

    // Check if method requires CSRF protection
    if (!requiresCsrfProtection(req.method)) {
      return handler(req);
    }

    // Allow internal requests (from same origin)
    const referer = req.headers.get('referer');
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');

    if (!referer && !origin) {
      return new NextResponse(JSON.stringify({ error: 'CSRF validation failed: Missing origin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify origin matches
    if (origin && !origin.includes(host || '')) {
      return new NextResponse(JSON.stringify({ error: 'CSRF validation failed: Invalid origin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify CSRF token
    const isValid = verifyCsrfFromRequest(req);
    if (!isValid) {
      return new NextResponse(JSON.stringify({ error: 'CSRF validation failed: Invalid token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // CSRF validation passed, proceed to handler
    return handler(req);
  };
}
