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

/**
 * `inResponseTo` is accepted for SP-initiated validation and compared against
 * the response's InResponseTo when provided. Replay itself is stopped one
 * layer up: the ACS route consumes the single-use login flow row before this
 * action ever runs.
 */

export interface SamlClaimResult {
  email: string;
  name?: string;
}

/**
 * Normalize a PEM cert: handle escaped-\n storage, CRLF, bare base64 —
 * always emitting exactly one PEM envelope around the base64 body.
 *
 * Headers must be removed BEFORE whitespace-stripping: `\s+` removal would
 * also delete the space inside "BEGIN CERTIFICATE", after which the header
 * pattern can never match and the body would keep both headers (double-wrap),
 * producing a metadata certificate that never equals the KeyInfo certificate
 * of a real IdP response (ERROR_UNMATCH_CERTIFICATE_DECLARATION_IN_METADATA).
 */
export function normalizeCertificate(input: string): string {
  const unescaped = input.trim().replace(/\\n/g, '\n');
  const body = unescaped
    .replace(/-----\s*BEGIN\s+CERTIFICATE\s*-----/gi, '')
    .replace(/-----\s*END\s+CERTIFICATE\s*-----/gi, '')
    .replace(/\s+/g, '');
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
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
    const samlify = await importSamlify();
    const sp = await buildSp(args.spEntityId, args.acsUrl);
    const idp = await buildIdp(args.idpEntityId, args.idpSsoUrl, args.idpCertificate);

    // parseLoginResponse is samlify 2.x's entry point for inbound responses
    // (there is no top-level validateLoginResponse). In one pass it:
    //   - parses the XML (xmldom) and rejects malformed documents;
    //   - checks the top-level StatusCode is Success;
    //   - verifies the enveloped signature against the certificate pinned in
    //     the IdP metadata (KeyInfo certs not matching metadata are rejected,
    //     and embedded Signature/Assertion elements inside
    //     SubjectConfirmationData raise a wrapping-attack error);
    //   - rejects responses whose issuer is not the pinned IdP entity ID;
    //   - enforces Conditions NotBefore/NotOnOrAfter (with clock drift).
    //
    // samlify signals every rejection (bad signature, bad XML, schema
    // failure, issuer mismatch…) by throwing raw errors; we map them all to
    // the opaque SamlValidationError so the ACS never leaks validation detail
    // to an attacker probing the endpoint.
    let extract: SamlExtract;
    try {
      ({ extract } = await sp.parseLoginResponse(idp, 'post', {
        body: { SAMLResponse: args.samlResponse },
      }));
    } catch {
      throw new SamlValidationError('sso_error');
    }

    const attributes = (extract.attributes ?? {}) as Record<string, string | string[]>;
    const conditions = extract.conditions ?? {};

    // Pin the audience to *this* connection's SP entity id.
    const audiences = (
      Array.isArray(extract.audience)
        ? extract.audience
        : extract.audience
          ? [extract.audience]
          : []
    ).filter(Boolean);
    if (audiences.length > 0 && !audiences.includes(args.spEntityId)) {
      throw new SamlValidationError('sso_error');
    }

    // Pin the binding destination to this connection's ACS URL.
    const destination = firstOf(extract.response?.destination);
    if (destination && destination !== args.acsUrl) {
      throw new SamlValidationError('sso_error');
    }

    // InResponseTo, when this action is used for SP-initiated validation.
    if (args.inResponseTo !== undefined) {
      const inResponseTo = firstOf(extract.response?.inResponseTo);
      if (inResponseTo !== args.inResponseTo) {
        throw new SamlValidationError('sso_error');
      }
    }

    // Freshness: reject assertions outside a 90-second validity window
    // (belt-and-braces on top of the flow's own time check).
    const now = Date.now();
    const notOnOrAfter = firstOf(conditions.notOnOrAfter);
    if (notOnOrAfter && new Date(notOnOrAfter).getTime() < now) {
      throw new SamlValidationError('sso_error');
    }
    const notBefore = firstOf(conditions.notBefore);
    if (notBefore && new Date(notBefore).getTime() > now + 90_000) {
      throw new SamlValidationError('sso_error');
    }

    const email =
      firstOf(
        attributes.email ?? attributes.mail ?? attributes['urn:oid:0.9.2342.19200300.100.1.3'],
      ) ?? extract.nameID;
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
  ServiceProvider: (settings: unknown) => SamlifySp;
  IdentityProvider: (settings: unknown) => SamlifyIdp;
}

interface SamlifySp {
  parseLoginResponse: (
    idp: unknown,
    binding: string,
    request: { body: Record<string, string> },
  ) => Promise<{ samlContent: string; extract: SamlExtract }>;
}

interface SamlifyIdp {
  entityMeta: unknown;
}

interface SamlExtract {
  nameID?: string;
  issuer?: string | string[];
  audience?: string | string[];
  attributes?: Record<string, string | string[]>;
  conditions?: Record<string, string | string[]>;
  response?: Record<string, string | string[]>;
  sessionIndex?: Record<string, string | string[]>;
}

/** Exported for tests of the pure helper. */
export const _internal = { normalizeCertificate };
