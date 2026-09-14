/**
 * SAML 2.0 SP metadata — deployment-level document.
 *
 * GET /api/sso/metadata → XML with a CONNECTION_ID placeholder in the ACS URL.
 * Per-connection metadata (real ACS URL) lives at
 * /api/sso/metadata/<connectionId> — that is the URL IdP admins should use.
 */

import { NextResponse } from 'next/server';
import { buildMetadata } from './[connectionId]/route';

export const runtime = 'nodejs';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function GET() {
  return new NextResponse(buildMetadata(`${APP_URL}/api/sso/acs/CONNECTION_ID`), {
    headers: {
      'Content-Type': 'application/samlmetadata+xml',
      'Cache-Control': 'no-store',
    },
  });
}
