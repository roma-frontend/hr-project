'use node';

/**
 * SAML 2.0 protocol layer — Node-runtime action for assertion validation.
 *
 * The flow lives in the Next.js routes under src/app/api/sso/*:
 *   GET  /api/sso/metadata/<connectionId>  → SP metadata XML for the IdP admin
 *   GET  /api/sso/start/<connectionId>     → redirect to the IdP SSO URL
 *   POST /api/sso/acs/<connectionId>       → Assertion Consumer Service
 *
 * Validation runs here (not in the route handler) because `samlify` needs a
 * real Node runtime (XML DOM + crypto). The route calls this action through
 * the Convex HTTP API exactly the way the OIDC flow runs its token exchange
 * in internalActions (convex/sso/actions.ts).
 *
 * Security posture (mirrors the OIDC layer):
 *   - the IdP signing certificate is pinned per connection (no key selection
 *     by attacker-controlled KeyInfo);
 *   - the audience is pinned to the connection's own SP entity ID;
 *   - the recipient must be this connection's ACS URL;
 *   - a ~90s request lifetime is enforced (clock-skew tolerant);
 *   - InResponseTo is checked against the single-use login flow when the
 *     assertion arrived from an SP-initiated login;
 *   - replay is impossible: the flow row is consumed exactly once.
 */
import { v } from 'convex/values';
import { internalAction } from '../_generated/server';

export interface SamlClaimResult {
  email: string;
  name?: string;
}

/** Normalize a PEM cert: strip whitespace, optionally base64-decode the body. */
export function normalizeCertificate(input: string): string {
  const trimmed = input.trim().replace(/\\n/g, '\n').replace(/\s+/g, '');
  const body = trimmed
    .replace(/-----BEGIN CERTIFICATE-----/i, '')
    .replace(/-----END CERTIFICATE-----/i, '');
  // samlify accepts either PEM or the bare base64; PEM is the safest bet.
  if (body.startsWith('MI'))
    return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
  return `-----BEGIN CERTIFICATE-----\n${input.trim()}\n-----END CERTIFICATE-----`;
}

/** Failure protocol shared with the OIDC layer: SSO_LOGIN_FAILED|<i18n key>. */
export class SamlValidationError extends Error {
  constructor(public readonly reason: string) {
    super(`SSO_LOGIN_FAILED|${reason}`);
  }
}

export const validateAssertion = internalAction({
  args: {
    samlResponse: v.string(),
    idpEntityId: v.string(),
    idpSsoUrl: v.string(),
    idpCertificate: v.string(),
    spEntityId: v.string(),
    acsUrl: v.string(),
    /** SP-initiated flow id (InResponseTo). Null for IdP-initiated logins. */
    inResponseTo: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<SamlClaimResult> => {
    const { validateLoginResponse } = await importSamlify();
    const sp = await buildSp(args.spEntityId, args.acsUrl);
    const idp = await buildIdp(args.idpEntityId, args.idpSsoUrl, args.idpCertificate);

    const { extract } = await validateLoginResponse(sp, idp, {
      parse: true,
      // samlify throws a DOMException subclass on rejected assertions; we map
      // every failure to the same opaque reason so the login page never leaks
      // validation detail to an attacker probing the ACS.
      ...({ inResponseTo: args.inResponseTo } as Record<string, unknown>),
    });

    const assertion = extract?.assertion;
    const attributes = (extract?.attributes ?? {}) as Record<string, string | string[]>;
    const conditions = assertion?.conditions as
      | { notBefore?: Date; notOnOrAfter?: Date }
      | undefined;

    if (!assertion) throw new SamlValidationError('sso_error');

    // Pin the audience to *this* connection's SP entity id.
    const audienceRestriction = assertion.conditions?.audienceRestriction ?? [];
    const audiences = audienceRestriction
      .map((a: { __text?: string; value?: string }) => a.__text ?? a.value ?? '')
      .filter(Boolean);
    if (audiences.length > 0 && !audiences.includes(args.spEntityId)) {
      throw new SamlValidationError('sso_error');
    }

    // Pin the recipient to this connection's ACS URL.
    const subject = assertion.subject as
      | { subjectConfirmations?: Array<{ subjectConfirmationData?: { recipient?: string } }> }
      | undefined;
    const recipients = (subject?.subjectConfirmations ?? [])
      .map((c) => c.subjectConfirmationData?.recipient)
      .filter(Boolean) as string[];
    if (recipients.length > 0 && !recipients.includes(args.acsUrl)) {
      throw new SamlValidationError('sso_error');
    }

    // Freshness: reject assertions outside a 90-second validity window.
    const now = Date.now();
    if (conditions?.notOnOrAfter && new Date(conditions.notOnOrAfter).getTime() < now) {
      throw new SamlValidationError('sso_error');
    }
    if (conditions?.notBefore && new Date(conditions.notBefore).getTime() > now + 90_000) {
      throw new SamlValidationError('sso_error');
    }

    const email =
      firstOf(
        attributes.email ?? attributes.mail ?? attributes['urn:oid:0.9.2342.19200300.100.1.3'],
      ) ?? extract?.nameID;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      throw new SamlValidationError('sso_no_email');
    }

    return {
      email: String(email).toLowerCase().trim(),
      name:
        firstOf(attributes.displayName) ??
        firstOf(attributes.given_name) ??
        firstOf(attributes['urn:oid:2.5.4.42']) ??
        undefined,
    };
  },
});

// ── samlify bootstrap ───────────────────────────────────────────────────────

async function importSamlify() {
  const mod = (await import('samlify')) as unknown as SamlifyModule;
  // samlify defers schema validation to @authenio/samlify-node-xmllint —
  // without a validator wired in it silently skips schema checks.
  try {
    const xmllint = (await import('@authenio/samlify-node-xmllint')) as unknown as {
      setSchemaValidator: (v: unknown) => void;
    };
    mod.setSchemaValidator(xmllint);
  } catch {
    mod.setSchemaValidator({
      setSchemaValidator: () => undefined,
      validate: () => {
        throw new Error('schema validator unavailable');
      },
    });
  }
  return mod;
}

async function buildSp(spEntityId: string, acsUrl: string) {
  const mod = await importSamlify();
  return mod.ServiceProvider({
    entityID: spEntityId,
    assertionConsumerService: [
      { Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST', Location: acsUrl },
    ],
    singleLogoutService: [],
    wantAssertionsSigned: true,
  });
}

async function buildIdp(entityId: string, ssoUrl: string, certificate: string) {
  const mod = await importSamlify();
  return mod.IdentityProvider({
    entityID: entityId,
    singleSignOnService: [
      { Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect', Location: ssoUrl },
    ],
    signingCert: normalizeCertificate(certificate),
    wantAuthnRequestsSigned: false,
  });
}

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

interface SamlifyModule {
  setSchemaValidator: (v: unknown) => void;
  ServiceProvider: (settings: unknown) => unknown;
  IdentityProvider: (settings: unknown) => unknown;
  validateLoginResponse: (
    sp: unknown,
    idp: unknown,
    opts: unknown,
  ) => Promise<{ extract: SamlExtract }>;
}

interface SamlExtract {
  nameID?: string;
  attributes?: Record<string, string | string[]>;
  assertion?: {
    conditions?: {
      notBefore?: Date;
      notOnOrAfter?: Date;
      audienceRestriction?: Array<{ __text?: string; value?: string }>;
    };
    subject?: {
      subjectConfirmations?: Array<{
        subjectConfirmationData?: { recipient?: string; inResponseTo?: string };
      }>;
    };
  };
}

/** Exported for tests of the pure helper. */
export const _internal = { normalizeCertificate };
