/**
 * Outbound webhook protocol layer — pure helpers, unit-testable without the
 * Convex runtime (mirrors convex/sso/protocol.ts).
 *
 * Signing mirrors the platform's inbound Lucky Carrot scheme (convex/
 * integrations.ts): hex HMAC-SHA256 over `<unixSeconds>.<body>`, delivered in
 * `x-webhook-signature` / `x-webhook-timestamp`. One verification recipe for
 * consumers, both directions.
 */

/** Every event type the platform can emit. Endpoints subscribe to a subset. */
export const WEBHOOK_EVENT_TYPES = [
  'leave.requested',
  'leave.approved',
  'leave.rejected',
  'leave.cancelled',
  'employee.created',
  'employee.updated',
  'employee.deactivated',
  'attendance.clock_in',
  'attendance.clock_out',
  'task.created',
  'task.completed',
  'expense.submitted',
  'expense.approved',
  'expense.rejected',
  'document.signed',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export function isWebhookEventType(value: string): value is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}

/** Delivery headers consumers can rely on. */
export const OUTBOUND_SIGNATURE_HEADER = 'x-webhook-signature';
export const OUTBOUND_TIMESTAMP_HEADER = 'x-webhook-timestamp';
export const OUTBOUND_EVENT_HEADER = 'x-webhook-event';

/** Backoff schedule for failed deliveries, in milliseconds. */
export const RETRY_DELAYS_MS = [0, 60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

/** Consecutive failures before an endpoint is auto-disabled. */
export const MAX_CONSECUTIVE_FAILURES = 20;

/** Deliveries older than this are purged by the maintenance cron. */
export const DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Hex HMAC-SHA256 over `<unixSeconds>.<body>` — matches the inbound scheme. */
export async function signPayload(
  secret: string,
  timestampSeconds: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestampSeconds}.${body}`),
  );
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build the delivery envelope. `event` is the platform event name, `data` the
 * domain payload, `orgId`/`deliveryId` correlation ids for the consumer.
 */
export function buildEnvelope(args: {
  eventType: string;
  orgId: string;
  deliveryId: string;
  data: unknown;
  occurredAt: number;
}): string {
  return JSON.stringify({
    event: args.eventType,
    organizationId: args.orgId,
    deliveryId: args.deliveryId,
    occurredAt: args.occurredAt,
    data: args.data,
  });
}

/** 256 bits of entropy, hex-encoded — the same shape the HMAC key expects. */
export function generateEndpointSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Only https:// endpoints are accepted (loopback never runs in Convex). */
export function isValidEndpointUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/** Mask a secret for admin display: show only the last 4 characters. */
export function maskSecret(secret: string): string {
  if (secret.length <= 4) return '••••';
  return `••••••••${secret.slice(-4)}`;
}

/** Validate the subscribed-event list; empty means "all events". */
export function normalizeEventSubscription(events: string[]): string[] {
  const cleaned = events.filter((e) => isWebhookEventType(e));
  return Array.from(new Set(cleaned));
}
