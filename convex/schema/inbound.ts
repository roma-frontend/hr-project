import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Inbound integrations — third parties POST *into* Strata.
 *
 * The outbound side (`webhooksEndpoints`, Settings → Webhooks) is a URL the
 * tenant controls. This is the mirror image: a per-tenant token that a device or
 * a SaaS product uses as its target URL. Two providers are wired:
 *
 *   - `device` — an attendance terminal (ZKTeco/Suprema ADMS-style push). A
 *     punch lands in `devicePunches` and is matched to an employee by табельный
 *     номер; HR reviews the row and promotes it into `timeTracking`. Nothing
 *     reaches payroll without a person confirming it.
 *   - `jira` — a Jira webhook. An issue event becomes a task assigned to
 *     `defaultAssigneeId` (chosen when the token was created, so no guesswork).
 *
 * The token is stored as a SHA-256 hash only: a leaked database row must not be
 * a working credential, exactly like the API keys in `apiKeys`.
 */
export const inbound = {
  inboundTokens: defineTable({
    organizationId: v.id('organizations'),
    provider: v.union(v.literal('device'), v.literal('jira'), v.literal('generic')),
    /** Admin-facing name, e.g. "Turnstile — head office". */
    label: v.string(),
    /** SHA-256 of the secret in the URL; the secret itself is never stored. */
    tokenHash: v.string(),
    /** Last 4 characters, so an admin can tell two tokens apart. */
    tokenHint: v.string(),
    enabled: v.boolean(),
    /** Tasks created from this token are assigned here (Jira provider). */
    defaultAssigneeId: v.optional(v.id('users')),
    createdAt: v.number(),
    createdBy: v.id('users'),
    lastUsedAt: v.optional(v.number()),
    /** Last rejected/ignored payload reason — surfaced in the settings UI. */
    lastError: v.optional(v.string()),
    receivedCount: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_hash', ['tokenHash']),

  /**
   * Raw punches from attendance hardware, before anyone vouches for them.
   *
   * Deliberately not `timeTracking`: that table drives lateness, worked minutes,
   * overtime and therefore payroll. A device packet with a typo in a табельный
   * номер, a duplicated push or a clock set to the wrong year must not be able
   * to move money. HR promotes a row (see `promoteDevicePunch`) and only then
   * does it become a check-in/check-out.
   */
  devicePunches: defineTable({
    organizationId: v.id('organizations'),
    tokenId: v.id('inboundTokens'),
    /** What the terminal sent, before matching. */
    employeeNumberRaw: v.string(),
    /** Resolved employee, when the number matched somebody. */
    userId: v.optional(v.id('users')),
    punchAt: v.number(),
    direction: v.union(v.literal('in'), v.literal('out'), v.literal('unknown')),
    status: v.union(
      v.literal('pending'),
      v.literal('unmatched'),
      v.literal('imported'),
      v.literal('ignored'),
      v.literal('duplicate'),
    ),
    // Deliberately no denormalized employee name/email: a punch row should not
    // keep a copy of personal data a GDPR erase has to chase down. The link to
    // the employee is by id, and it disappears with them.
    /** Truncated original payload, for debugging a bad mapping. */
    raw: v.string(),
    note: v.optional(v.string()),
    /** Set when the punch was promoted into `timeTracking`. */
    timeTrackingId: v.optional(v.id('timeTracking')),
    createdAt: v.number(),
    reviewedBy: v.optional(v.id('users')),
    reviewedAt: v.optional(v.number()),
  })
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_org_time', ['organizationId', 'createdAt'])
    .index('by_token_time', ['tokenId', 'createdAt']),
};
