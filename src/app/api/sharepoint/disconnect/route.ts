import { NextRequest, NextResponse } from 'next/server';
import { validateRestrictedOrgFromRequest } from '@/lib/restricted-org';
import { requireAuth } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const validation = await validateRestrictedOrgFromRequest(request);

  if (!validation.allowed) {
    return NextResponse.json(validation.body, { status: validation.status });
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set('sharepoint_access_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  });

  response.cookies.set('sharepoint_refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  });

  return response;
}
