import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrfFromRequest, requiresCsrfProtection } from '@/lib/csrf';

/**
 * CSRF protection wrapper for API Route Handlers (App Router)
 * Apply to POST/PUT/DELETE/PATCH handlers
 */
export function withCsrfProtection(
  handler: (req: NextRequest) => Promise<Response | NextResponse | undefined>,
) {
  return async (req: NextRequest): Promise<Response | NextResponse> => {
    // Safe methods: skip CSRF
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      const res = await handler(req);
      return (
        res ??
        NextResponse.json(
          { error: 'Internal Server Error: No response returned from handler.' },
          { status: 500 },
        )
      );
    }

    // ✅ requiresCsrfProtection ждёт string -> передаём req.method
    if (requiresCsrfProtection(req.method)) {
      // ✅ verifyCsrfFromRequest ждёт Request -> передаём req
      const valid = verifyCsrfFromRequest(req);
      if (!valid) {
        return NextResponse.json(
          { error: 'CSRF validation failed: Invalid token' },
          { status: 403 },
        );
      }
    }

    const res = await handler(req);
    return (
      res ??
      NextResponse.json(
        { error: 'Internal Server Error: No response returned from handler.' },
        { status: 500 },
      )
    );
  };
}
