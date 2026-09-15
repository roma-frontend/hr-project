import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Customer API keys — the inbound half of the public API.
 *
 * The raw key is shown exactly once, at creation, and only its SHA-256 is
 * stored (same convention as `scimTokens`). A leaked database therefore yields
 * no usable credentials, and a lost key is rotated rather than recovered.
 *
 * Keys belong to an organization, never to a person: an integration must not
 * break because the employee who created it left. `createdBy` is kept for the
 * audit trail only.
 */
export const apiKeys = {
  apiKeys: defineTable({
    organizationId: v.id('organizations'),
    /** Human label so two keys in a list are distinguishable. */
    label: v.string(),
    /** SHA-256 hex of the raw key. Never the raw value. */
    keyHash: v.string(),
    /**
     * Leading characters of the raw key (`strata_ab12cd`), so a human can match
     * a key in the list to the one configured in their integration.
     */
    prefix: v.string(),
    /** Granted scopes, e.g. ['employees:read', 'leaves:read']. */
    scopes: v.array(v.string()),
    enabled: v.boolean(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdBy: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_hash', ['keyHash']),
};
