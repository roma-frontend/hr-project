/**
 * Outbound webhooks — admin CRUD and the delivery engine.
 *
 * Additive-only module (Phase 2): nothing here changes existing tables.
 * Gated by the same org-admin RBAC as the SSO module (assertOrgManager);
 * entitlements gating arrives with the `apiAccess` module leaving `coming`.
 *
 * Delivery model:
 *   emitEvent (mutation, called by product modules)
 *     → creates pending delivery rows + schedules the worker
 *   deliverPending (internal action, also run by the hourly cron)
 *     → POSTs signed envelopes, records outcomes, applies backoff
 */
import { v } from 'convex/values';
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from '../_generated/server';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { getAuthCaller } from '../lib/getAuthCaller';
import {
  WEBHOOK_EVENT_TYPES,
  RETRY_DELAYS_MS,
  MAX_CONSECUTIVE_FAILURES,
  DELIVERY_RETENTION_MS,
  OUTBOUND_SIGNATURE_HEADER,
  OUTBOUND_TIMESTAMP_HEADER,
  OUTBOUND_EVENT_HEADER,
  signPayload,
  buildEnvelope,
  generateEndpointSecret,
  isValidEndpointUrl,
  normalizeEventSubscription,
} from './protocol';

function assertOrgManager(
  caller: { role: string; organizationId?: Id<'organizations'> } | null,
  action: string,
): Id<'organizations'> {
  if (!caller) throw new Error('Not authenticated');
  if (caller.role === 'superadmin') {
    if (!caller.organizationId) throw new Error('Superadmin has no organization context');
    return caller.organizationId;
  }
  if (caller.role !== 'admin' || !caller.organizationId) {
    throw new Error(`Only organization admins can ${action}`);
  }
  return caller.organizationId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin queries
// ─────────────────────────────────────────────────────────────────────────────

/** List endpoints for the settings UI. Secrets are never returned. */
export const listEndpoints = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller || caller.role === 'employee') return [];
    const organizationId =
      caller.role === 'superadmin'
        ? caller.organizationId
        : (caller.organizationId as Id<'organizations'> | undefined);
    if (!organizationId) return [];
    const rows = await ctx.db
      .query('webhookEndpoints')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ secret, ...rest }) => ({
        ...rest,
        secretHint: secret ? `••••••••${secret.slice(-4)}` : undefined,
      }));
  },
});

/** Recent deliveries for the admin UI (latest 50). */
export const listDeliveries = query({
  args: { endpointId: v.optional(v.id('webhookEndpoints')) },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller || caller.role === 'employee') return [];
    const organizationId =
      caller.role === 'superadmin'
        ? caller.organizationId
        : (caller.organizationId as Id<'organizations'> | undefined);
    if (!organizationId) return [];
    if (args.endpointId) {
      const rows = await ctx.db
        .query('webhookDeliveries')
        .withIndex('by_endpoint_time', (q) => q.eq('endpointId', args.endpointId!))
        .order('desc')
        .take(50);
      // Defense in depth: the endpoint filter must still belong to the caller's org.
      const endpoint = await ctx.db.get(args.endpointId);
      if (!endpoint || endpoint.organizationId !== organizationId) return [];
      return rows;
    }
    return ctx.db
      .query('webhookDeliveries')
      .withIndex('by_org_time', (q) => q.eq('organizationId', organizationId))
      .order('desc')
      .take(50);
  },
});

/** Event catalogue for the subscribe picker. */
export const listEventTypes = query({
  args: {},
  handler: async () => [...WEBHOOK_EVENT_TYPES],
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin mutations
// ─────────────────────────────────────────────────────────────────────────────

export const createEndpoint = mutation({
  args: {
    label: v.optional(v.string()),
    url: v.string(),
    events: v.array(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage webhook endpoints');

    if (!isValidEndpointUrl(args.url)) {
      throw new Error('Webhook URL must be a valid https:// URL');
    }
    const events = normalizeEventSubscription(args.events);

    const now = Date.now();
    return ctx.db.insert('webhookEndpoints', {
      organizationId,
      label: args.label?.trim() || undefined,
      url: args.url.trim(),
      events,
      secret: generateEndpointSecret(),
      enabled: args.enabled ?? true,
      consecutiveFailures: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: caller!._id as Id<'users'>,
    });
  },
});

export const updateEndpoint = mutation({
  args: {
    endpointId: v.id('webhookEndpoints'),
    label: v.optional(v.string()),
    url: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage webhook endpoints');
    const endpoint = await ctx.db.get(args.endpointId);
    if (!endpoint || endpoint.organizationId !== organizationId) {
      throw new Error('Webhook endpoint not found');
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.label !== undefined) patch.label = args.label.trim() || undefined;
    if (args.url !== undefined) {
      if (!isValidEndpointUrl(args.url)) {
        throw new Error('Webhook URL must be a valid https:// URL');
      }
      patch.url = args.url.trim();
    }
    if (args.events !== undefined) patch.events = normalizeEventSubscription(args.events);
    if (args.enabled !== undefined) {
      patch.enabled = args.enabled;
      // A manual re-enable resets the failure counter and health state.
      if (args.enabled) {
        patch.consecutiveFailures = 0;
        patch.lastStatus = undefined;
      }
    }
    await ctx.db.patch(args.endpointId, patch);
    return { ok: true };
  },
});

export const deleteEndpoint = mutation({
  args: { endpointId: v.id('webhookEndpoints') },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage webhook endpoints');
    const endpoint = await ctx.db.get(args.endpointId);
    if (!endpoint || endpoint.organizationId !== organizationId) {
      throw new Error('Webhook endpoint not found');
    }
    await ctx.db.delete(args.endpointId);
    return { ok: true };
  },
});

/** Rotate the signing secret; the old one stops working immediately. */
export const rotateSecret = mutation({
  args: { endpointId: v.id('webhookEndpoints') },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage webhook endpoints');
    const endpoint = await ctx.db.get(args.endpointId);
    if (!endpoint || endpoint.organizationId !== organizationId) {
      throw new Error('Webhook endpoint not found');
    }
    const secret = generateEndpointSecret();
    await ctx.db.patch(args.endpointId, { secret, updatedAt: Date.now() });
    // The secret is returned exactly once — the UI shows it in a dialog.
    return { secret };
  },
});

/**
 * Queue a `webhook.test` delivery so an admin can verify an endpoint works.
 *
 * Goes through the same signed-delivery engine as real events (same envelope,
 * same headers, same retry/health bookkeeping), so a green test is a genuine
 * end-to-end proof: reachable URL, 2xx response, valid signature scheme.
 *
 * Disabled endpoints are allowed — verifying a broken endpoint is exactly when
 * you need a test — but the delivery is marked dead by the worker unless the
 * admin re-enables first. `webhook.test` is not part of the subscription
 * catalogue on purpose: test deliveries always reach their endpoint.
 */
export const sendTestDelivery = mutation({
  args: { endpointId: v.id('webhookEndpoints') },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage webhook endpoints');
    const endpoint = await ctx.db.get(args.endpointId);
    if (!endpoint || endpoint.organizationId !== organizationId) {
      throw new Error('Webhook endpoint not found');
    }

    const now = Date.now();
    const deliveryId = await ctx.db.insert('webhookDeliveries', {
      organizationId,
      endpointId: args.endpointId,
      eventType: 'webhook.test',
      status: 'pending',
      attempt: 0,
      payload: buildEnvelope({
        eventType: 'webhook.test',
        orgId: organizationId,
        deliveryId: 'pending',
        data: {
          test: true,
          message: 'This is a test delivery from the webhooks settings page.',
          triggeredBy: caller!.name,
          triggeredByEmail: caller!.email,
        },
        occurredAt: now,
      }),
      createdAt: now,
    });
    // Rebuild with the real delivery id, mirroring emitEvent.
    await ctx.db.patch(deliveryId, {
      payload: buildEnvelope({
        eventType: 'webhook.test',
        orgId: organizationId,
        deliveryId,
        data: {
          test: true,
          message: 'This is a test delivery from the webhooks settings page.',
          triggeredBy: caller!.name,
          triggeredByEmail: caller!.email,
        },
        occurredAt: now,
      }),
    });
    await ctx.scheduler.runAfter(0, internal.webhooks.main.deliverPending, {});
    return { deliveryId };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Emission (called by product mutations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fan an event out to every matching enabled endpoint. Runs entirely inside
 * the calling mutation's transaction: endpoint fan-out writes are rolled back
 * atomically if the source mutation fails, and the worker is scheduled after
 * commit via the scheduler (transactions cannot await HTTP).
 */
export const emitEvent = internalMutation({
  args: {
    eventType: v.string(),
    organizationId: v.id('organizations'),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const endpoints = await ctx.db
      .query('webhookEndpoints')
      .withIndex('by_org_enabled', (q) =>
        q.eq('organizationId', args.organizationId).eq('enabled', true),
      )
      .collect();
    const matching = endpoints.filter(
      (e) => e.events.length === 0 || e.events.includes(args.eventType),
    );
    if (matching.length === 0) return { queued: 0 };

    const now = Date.now();
    for (const endpoint of matching) {
      const deliveryId = await ctx.db.insert('webhookDeliveries', {
        organizationId: args.organizationId,
        endpointId: endpoint._id,
        eventType: args.eventType,
        status: 'pending',
        attempt: 0,
        payload: buildEnvelope({
          eventType: args.eventType,
          orgId: args.organizationId,
          deliveryId: 'pending',
          data: args.data,
          occurredAt: now,
        }),
        createdAt: now,
      });
      // Rebuild the payload now that we have a real delivery id for correlation.
      await ctx.db.patch(deliveryId, {
        payload: buildEnvelope({
          eventType: args.eventType,
          orgId: args.organizationId,
          deliveryId,
          data: args.data,
          occurredAt: now,
        }),
      });
    }
    // Fire the worker after the transaction commits.
    await ctx.scheduler.runAfter(0, internal.webhooks.main.deliverPending, {});
    return { queued: matching.length };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Delivery worker
// ─────────────────────────────────────────────────────────────────────────────

/** Claim args for the worker's internal query. */
const PENDING_BATCH = 20;

/** Read pending/due deliveries (internal — no auth: the scheduler calls it). */
export const getDueDeliveries = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query('webhookDeliveries')
      .withIndex('by_status_next', (q) => q.eq('status', 'pending'))
      .order('asc')
      .take(PENDING_BATCH);
    return rows.filter((r) => r.nextAttemptAt === undefined || r.nextAttemptAt <= now);
  },
});

/** InternalMutation can't run actions; the worker is an action that POSTs. */
export const deliverPending = internalAction({
  args: {},
  handler: async (ctx) => {
    const due = await ctx.runQuery(internal.webhooks.main.getDueDeliveries, {});
    for (const delivery of due) {
      const endpoint: {
        url: string;
        secret: string;
        enabled: boolean;
        consecutiveFailures?: number;
      } | null = await ctx.runQuery(internal.webhooks.main.getEndpointForDelivery, {
        endpointId: delivery.endpointId,
      });
      if (!endpoint || !endpoint.enabled) {
        await ctx.runMutation(internal.webhooks.main.recordDeliveryOutcome, {
          deliveryId: delivery._id,
          outcome: {
            status: 'dead',
            attempt: delivery.attempt,
            error: 'Endpoint removed or disabled',
          },
        });
        continue;
      }

      const body = delivery.payload;
      const timestampSeconds = Math.floor(Date.now() / 1000).toString();
      const signature = await signPayload(endpoint.secret, timestampSeconds, body);

      let responseStatus: number | undefined;
      let errorText: string | undefined;
      let ok = false;
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [OUTBOUND_SIGNATURE_HEADER]: signature,
            [OUTBOUND_TIMESTAMP_HEADER]: timestampSeconds,
            [OUTBOUND_EVENT_HEADER]: delivery.eventType,
          },
          body,
        });
        responseStatus = response.status;
        ok = response.ok;
        if (!ok) errorText = `HTTP ${response.status}`;
      } catch (e) {
        errorText = e instanceof Error ? e.message : 'Network error';
      }

      const attempt = delivery.attempt + 1;
      if (ok) {
        await ctx.runMutation(internal.webhooks.main.recordDeliveryOutcome, {
          deliveryId: delivery._id,
          outcome: { status: 'success', attempt, responseStatus, deliveredAt: Date.now() },
        });
        await ctx.runMutation(internal.webhooks.main.recordEndpointHealth, {
          endpointId: delivery.endpointId,
          ok: true,
        });
      } else {
        const delay =
          RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ??
          RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
        const dead = attempt >= RETRY_DELAYS_MS.length - 1;
        await ctx.runMutation(internal.webhooks.main.recordDeliveryOutcome, {
          deliveryId: delivery._id,
          outcome: {
            status: dead ? 'dead' : 'pending',
            attempt,
            responseStatus,
            error: errorText,
            nextAttemptAt: dead ? undefined : Date.now() + delay,
          },
        });
        await ctx.runMutation(internal.webhooks.main.recordEndpointHealth, {
          endpointId: delivery.endpointId,
          ok: false,
        });
      }
    }
    // If more work may remain, re-schedule ourselves (bounded by batch size).
    if (due.length === PENDING_BATCH) {
      await ctx.scheduler.runAfter(1_000, internal.webhooks.main.deliverPending, {});
    }
  },
});

/** Endpoint projection for the worker (internal). */
export const getEndpointForDelivery = internalQuery({
  args: { endpointId: v.id('webhookEndpoints') },
  handler: async (ctx, args) => {
    const endpoint = await ctx.db.get(args.endpointId);
    if (!endpoint) return null;
    return {
      url: endpoint.url,
      secret: endpoint.secret,
      enabled: endpoint.enabled,
      consecutiveFailures: endpoint.consecutiveFailures,
    };
  },
});

/** Persist a delivery attempt outcome (internal). */
export const recordDeliveryOutcome = internalMutation({
  args: {
    deliveryId: v.id('webhookDeliveries'),
    outcome: v.object({
      status: v.union(v.literal('success'), v.literal('pending'), v.literal('dead')),
      attempt: v.number(),
      responseStatus: v.optional(v.number()),
      error: v.optional(v.string()),
      nextAttemptAt: v.optional(v.number()),
      deliveredAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deliveryId, {
      status: args.outcome.status,
      attempt: args.outcome.attempt,
      responseStatus: args.outcome.responseStatus,
      error: args.outcome.error,
      nextAttemptAt: args.outcome.nextAttemptAt,
      deliveredAt: args.outcome.deliveredAt,
    });
  },
});

/** Track endpoint health; auto-disable after too many consecutive failures. */
export const recordEndpointHealth = internalMutation({
  args: { endpointId: v.id('webhookEndpoints'), ok: v.boolean() },
  handler: async (ctx, args) => {
    const endpoint = await ctx.db.get(args.endpointId);
    if (!endpoint) return;
    if (args.ok) {
      await ctx.db.patch(args.endpointId, {
        lastStatus: 'success',
        lastAttemptAt: Date.now(),
        consecutiveFailures: 0,
      });
      return;
    }
    const failures = (endpoint.consecutiveFailures ?? 0) + 1;
    const patch: Record<string, unknown> = {
      lastStatus: 'failed',
      lastAttemptAt: Date.now(),
      consecutiveFailures: failures,
    };
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      patch.enabled = false;
    }
    await ctx.db.patch(args.endpointId, patch);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance (runs via the operator cron dispatcher)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Purge deliveries past the retention window. Registered as the
 * `webhook-delivery-maintenance` job in crons.ts / the Scheduled Ops console.
 */
export const purgeOldDeliveries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - DELIVERY_RETENTION_MS;
    const old = await ctx.db
      .query('webhookDeliveries')
      .withIndex('by_status_next', (q) => q.eq('status', 'dead'))
      .collect();
    const byOrg = await ctx.db
      .query('webhookDeliveries')
      .withIndex('by_status_next', (q) => q.eq('status', 'success'))
      .collect();
    let purged = 0;
    for (const row of [...old, ...byOrg]) {
      if (row.createdAt < cutoff) {
        await ctx.db.delete(row._id);
        purged += 1;
      }
    }
    return { purged };
  },
});
