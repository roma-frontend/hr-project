/**
 * @jest-environment node
 *
 * End-to-end verification of the SAML assertion-validation path
 * (convex/sso/samlActions.ts → samlify → @xmldom/xmldom → xml-crypto).
 *
 * Motivation: the 0.8.13 → 0.8.15 @xmldom/xmldom security upgrade touches
 * every XML node samlify touches (parsing, attribute normalization,
 * serialization before signing, c14n before signature verification). This
 * suite proves the full round trip still works — and that hostile inputs are
 * still rejected — *on the upgraded parser*, not against recorded fixtures:
 *
 *   1. SP (samlify) creates an AuthnRequest; the IdP (samlify, runtime-
 *      generated key) signs a login response for it; the real
 *      `validateAssertion` handler validates the response and maps claims.
 *   2. Tampering with the signed XML → rejected.
 *   3. A response whose KeyInfo does not match the pinned cert → rejected.
 *   4. Broken XML → rejected (xmldom parse path).
 *
 * The IdP key/certificate is generated at runtime with node-forge — nothing
 * secret is committed and every run signs with a fresh identity (CN marks it
 * clearly as a test credential). node environment because node-xmllint's
 * emscripten bundle does not export under jsdom.
 *
 * Pattern: convex-signatures.test.ts — mock `_generated/server`, call the
 * real action handler.
 */

import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import { createHash } from 'node:crypto';
import forge from 'node-forge';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../convex/_generated/server', () => ({
  internalAction: ({ handler }: any) => ({ handler, args: {} }),
  action: ({ handler }: any) => ({ handler, args: {} }),
  mutation: ({ handler }: any) => ({ handler, args: {} }),
  query: ({ handler }: any) => ({ handler, args: {} }),
  internalMutation: ({ handler }: any) => ({ handler, args: {} }),
  internalQuery: ({ handler }: any) => ({ handler, args: {} }),
}));

// ── Runtime test identity (fresh per run, clearly marked test-only) ─────────

function generateTestIdentity(): { certPem: string; keyPem: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber =
    '01' +
    createHash('sha256')
      .update(keys.publicKey.privateKey ?? '')
      .digest('hex')
      .slice(0, 30);
  cert.validity.notBefore = new Date(Date.now() - 24 * 3600 * 1000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  const attrs = [{ name: 'commonName', value: 'strata-saml-test-do-not-use' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{ name: 'basicConstraints', cA: false }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
  };
}

const TEST_IDENTITY = generateTestIdentity();
const TEST_CERT = TEST_IDENTITY.certPem;
const TEST_KEY = TEST_IDENTITY.keyPem;

// ── Fixed test parameters ────────────────────────────────────────────────────

const IDP_ENTITY = 'https://idp.example.am/saml/metadata';
const IDP_SSO = 'https://idp.example.am/saml/sso';
const SP_ENTITY = 'https://app.strata.example/saml/sp';
const ACS_URL = 'https://app.strata.example/api/sso/acs/conn-1';

const CONNECTION = {
  idpEntityId: IDP_ENTITY,
  idpSsoUrl: IDP_SSO,
  idpCertificate: TEST_CERT,
  spEntityId: SP_ENTITY,
  acsUrl: ACS_URL,
};

const EMAIL = 'jsmith@example.am';

// ── Harness ──────────────────────────────────────────────────────────────────

type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
let handler: Handler;

beforeAll(async () => {
  await jest.isolateModulesAsync(async () => {
    const mod = await import('../../convex/sso/samlActions');
    handler = (mod.validateAssertion as unknown as { handler: Handler }).handler;
    expect(typeof handler).toBe('function');
  });
});

/** Build SP/IdP the same way the production action does (pinned cert). */
async function buildEntities(idpKey: string) {
  const samlify = (await import('samlify')) as unknown as {
    setSchemaValidator: (v: unknown) => void;
    ServiceProvider: (s: unknown) => unknown;
    IdentityProvider: (s: unknown) => unknown;
  };
  const xmllint = await import('@authenio/samlify-node-xmllint');
  samlify.setSchemaValidator(xmllint);

  const sp = samlify.ServiceProvider({
    entityID: SP_ENTITY,
    assertionConsumerService: [
      { Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST', Location: ACS_URL },
    ],
    singleLogoutService: [],
    wantAssertionsSigned: true,
  });

  const idp = samlify.IdentityProvider({
    entityID: IDP_ENTITY,
    singleSignOnService: [
      { Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect', Location: IDP_SSO },
    ],
    signingCert: TEST_CERT,
    privateKey: idpKey,
    wantAuthnRequestsSigned: false,
  });

  return { sp, idp };
}

/**
 * SP-initiated round trip, the exact flow production serves:
 *   1. SP creates an AuthnRequest.
 *   2. IdP parses it and builds a signed login response.
 *   3. (caller) validates the response through the production handler.
 */
async function createSignedResponse(idpKey: string): Promise<string> {
  const { sp, idp } = await buildEntities(idpKey);

  const loginReq = (await (
    sp as {
      createLoginRequest: (
        idp: unknown,
        binding: string,
      ) => Promise<{ id: string; context: string }>;
    }
  ).createLoginRequest(idp, 'redirect')) as { id: string; context: string };

  // Parse the AuthnRequest through the IdP, like a real IdP, so the response
  // carries the matching InResponseTo (schema requires a non-empty NCName).
  const url = new URL(loginReq.context);
  const requestInfo = await (
    idp as {
      parseLoginRequest: (
        sp: unknown,
        binding: string,
        req: { query: Record<string, string> },
      ) => Promise<unknown>;
    }
  ).parseLoginRequest(sp, 'redirect', {
    query: { SAMLRequest: url.searchParams.get('SAMLRequest') ?? '' },
  });

  const ctx = (await (
    idp as {
      createLoginResponse: (
        sp: unknown,
        requestInfo: unknown,
        binding: string,
        user: Record<string, string>,
      ) => Promise<{ context: string }>;
    }
  ).createLoginResponse(sp, requestInfo, 'post', {
    email: EMAIL,
  })) as { context: string };
  expect(typeof ctx.context).toBe('string');
  expect(ctx.context.length).toBeGreaterThan(256);
  return ctx.context;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SAML validateAssertion round trip on @xmldom/xmldom 0.8.15', () => {
  it('accepts a genuinely signed response and extracts the email claim', async () => {
    const samlResponse = await createSignedResponse(TEST_KEY);

    const claims = (await handler(null, { samlResponse, ...CONNECTION })) as {
      email: string;
      name?: string;
    };

    expect(claims.email).toBe(EMAIL);
  });

  it('rejects a response tampered after signing', async () => {
    const samlResponse = await createSignedResponse(TEST_KEY);

    // Change the NameID inside the signed assertion: any byte change must
    // break the enveloped signature over the assertion.
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf8');
    const tampered = decoded.replace(EMAIL, 'mallory@evil.example');
    expect(tampered).not.toBe(decoded);

    await expect(
      handler(null, { samlResponse: Buffer.from(tampered).toString('base64'), ...CONNECTION }),
    ).rejects.toThrow(/SSO_LOGIN_FAILED\|/);
  });

  it('rejects a response whose KeyInfo certificate does not match the pinned cert', async () => {
    const samlResponse = await createSignedResponse(TEST_KEY);

    // Pin a *different* (structurally valid) certificate on the connection:
    // samlify must refuse because KeyInfo ≠ metadata cert.
    const otherIdentity = generateTestIdentity();
    await expect(
      handler(null, {
        samlResponse,
        ...CONNECTION,
        idpCertificate: otherIdentity.certPem,
      }),
    ).rejects.toThrow(/SSO_LOGIN_FAILED\|/);
  });

  it('rejects structurally broken XML', async () => {
    const garbage = Buffer.from('<samlp:Response><unclosed>', 'utf8').toString('base64');

    await expect(handler(null, { samlResponse: garbage, ...CONNECTION })).rejects.toThrow(
      /SSO_LOGIN_FAILED\|/,
    );
  });

  it('normalizes PEM, bare base64, CRLF and escaped-\\n certificate input identically', async () => {
    let normalizeCertificate!: (s: string) => string;
    await jest.isolateModulesAsync(async () => {
      const mod = (await import('../../convex/sso/samlActions')) as unknown as {
        _internal: { normalizeCertificate: (s: string) => string };
      };
      normalizeCertificate = mod._internal.normalizeCertificate;
    });

    const bare = TEST_CERT.replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s+/g, '');

    const fromPem = normalizeCertificate(TEST_CERT);
    const fromBare = normalizeCertificate(bare);
    const crlfPem = TEST_CERT.replace(/\n/g, '\r\n');
    const escapedPem = TEST_CERT.replace(/\n/g, '\\n');

    expect(fromPem).toContain('-----BEGIN CERTIFICATE-----');
    // Exactly one PEM envelope — the historical double-wrap bug.
    expect(fromPem.match(/BEGIN CERTIFICATE/g)).toHaveLength(1);
    expect(fromBare).toBe(fromPem);
    expect(normalizeCertificate(crlfPem)).toBe(fromPem);
    expect(normalizeCertificate(escapedPem)).toBe(fromPem);
    // Never double-wrap when already PEM.
    expect(normalizeCertificate(fromPem)).toBe(fromPem);
  });
});
