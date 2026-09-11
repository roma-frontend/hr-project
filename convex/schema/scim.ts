import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * SCIM 2.0 provisioning — Phase 3 of the enterprise rollout.
 *
 * Additive-only module. An org admin creates a bearer token (see
 * convex/scim/main.ts) and points their IdP (Azure AD/Entra, Okta, Google
 * Workspace…) at the SCIM endpoints served by convex/http.ts under
 * `/api/scim/v2/`. Provisioned users reuse the platform's identity-linking
 * fields: `externalId` + `externalSource: 'scim'` (indexed `by_org_external`),
 * exactly the pair the Armsoft/Lucky-Carrot imports already use.
 */
export const scim = {
  /**
   * Bearer credential for an IdP's SCIM client. Only the SHA-256 hash of the
   * token is stored (raw value is shown exactly once at creation — the IdP
   * must save it). Tokens are revocable; disabling one stops all requests
   * that carry it immediately.
   */
  scimTokens: defineTable({
    organizationId: v.id('organizations'),
    /** Hex SHA-256 of the raw bearer token — the raw value is never stored. */
    tokenHash: v.string(),
    /** Admin-facing label, e.g. "Azure AD provisioning". */
    label: v.optional(v.string()),
    enabled: v.boolean(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
    createdBy: v.optional(v.id('users')),
  })
    .index('by_token_hash', ['tokenHash'])
    .index('by_org', ['organizationId']),
};
