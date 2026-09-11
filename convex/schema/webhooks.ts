import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Outbound webhooks — Phase 2 of the integration rollout.
 *
 * Additive-only module: nothing here changes existing tables or flows. An
 * org admin registers an HTTPS endpoint (see convex/webhooks/main.ts), and
 * product mutations fire `emitEvent` (convex/webhooks/emit.ts) after their
 * success path; deliveries are attempted by an internal action with
 * exponential backoff and audited in `webhookDeliveries`.
 *
 * Signing mirrors the inbound Lucky Carrot scheme (hex HMAC-SHA256 over
 * `<timestamp>.<body>`) so consumers can reuse one verification recipe.
 */
export const webhooks = {
  /**
   * One row per registered consumer endpoint. Secrets live in Convex DB the
   * same way integration tokens and SSO client secrets already do — access is
   * gated by org-admin RBAC and the secret is NEVER returned by queries
   * (only a masked hint for the admin UI).
   */
  webhookEndpoints: defineTable({
    organizationId: v.id('organizations'),
    /** Admin-facing label, e.g. "Zapier — recruiting". */
    label: v.optional(v.string()),
    /** Must be https:// — plain HTTP endpoints are rejected at creation. */
    url: v.string(),
    /**
     * Event types this endpoint receives (subset of WEBHOOK_EVENT_TYPES).
     * An empty array means "all events".
     */
    events: v.array(v.string()),
    /** 256-bit hex HMAC key — never exposed via API. */
    secret: v.string(),
    enabled: v.boolean(),
    /** Last delivery outcome for the admin UI health column. */
    lastStatus: v.optional(v.union(v.literal('success'), v.literal('failed'))),
    lastAttemptAt: v.optional(v.number()),
    /** Disabled automatically after this many consecutive failures. */
    consecutiveFailures: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.id('users')),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_enabled', ['organizationId', 'enabled']),

  /**
   * Delivery audit trail + retry queue. Rows are purged after 30 days by the
   * daily `webhook-delivery-maintenance` cron.
   */
  webhookDeliveries: defineTable({
    organizationId: v.id('organizations'),
    endpointId: v.id('webhookEndpoints'),
    eventType: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('success'),
      v.literal('failed'),
      v.literal('dead'),
    ),
    attempt: v.number(),
    /** HTTP status from the last attempt, when one was made. */
    responseStatus: v.optional(v.number()),
    error: v.optional(v.string()),
    /** Serialized JSON body exactly as (to be) delivered. */
    payload: v.string(),
    nextAttemptAt: v.optional(v.number()),
    createdAt: v.number(),
    deliveredAt: v.optional(v.number()),
  })
    .index('by_org_time', ['organizationId', 'createdAt'])
    .index('by_endpoint_time', ['endpointId', 'createdAt'])
    .index('by_status_next', ['status', 'nextAttemptAt']),
};
