import { NextRequest, NextResponse } from 'next/server';
import { getSharePointAuthUrl } from '@/lib/sharepoint-sync';
import { validateRestrictedOrgFromRequest } from '@/lib/restricted-org';
import { requireAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const validation = await validateRestrictedOrgFromRequest(request);

    if (!validation.allowed) {
      return NextResponse.json(validation.body, { status: validation.status });
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/sharepoint/callback`;
    const authUrl = getSharePointAuthUrl(redirectUri);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('SharePoint auth error:', error);
    return NextResponse.redirect(
      new URL(
        `/settings?sharepoint=error`,
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      ),
    );
  }
}
