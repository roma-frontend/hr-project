/**
 * SAML 2.0 SP metadata — one metadata document per deployment.
 *
 * GET /api/sso/metadata            → ACS URL keeps a CONNECTION_ID placeholder
 * GET /api/sso/metadata/<connId>   → same XML with the connection's real ACS URL
 *
 * The SP entity ID is deployment-derived (`<app>/api/sso/metadata`) so the
 * same metadata works for every SAML connection; the ACS URL is per
 * connection (`<app>/api/sso/acs/<connectionId>`).
 *
 * Full flow:
 *   GET  /api/sso/start/<connectionId>  → 302 to the IdP
 *   POST /api/sso/acs/<connectionId>    → assertion consumer service
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export function spEntityId(): string {
  return `${APP_URL}/api/sso/metadata`;
}

export function buildMetadata(acsUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${spEntityId()}">
  <SPSSODescriptor
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="0"
      isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

/** Per-connection metadata: the ACS URL carries the real CONNECTION_ID. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  const acsUrl = `${APP_URL}/api/sso/acs/${encodeURIComponent(connectionId)}`;
  return new NextResponse(buildMetadata(acsUrl), {
    headers: {
      'Content-Type': 'application/samlmetadata+xml',
      'Cache-Control': 'no-store',
    },
  });
}
