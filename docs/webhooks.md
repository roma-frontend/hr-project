# Outbound webhooks (Strata → your endpoint)

Reference for the delivery engine in `convex/webhooks/`. Configure endpoints in
**Settings → Webhooks** (admins only) or install one from the in-app marketplace
(`/marketplace`). Each endpoint gets its own HMAC secret, event subscription and
delivery log.

Everything below is implemented in `convex/webhooks/protocol.ts` (pure helpers)
and `convex/webhooks/main.ts` (emission, delivery, retries, health).

---

## 1. Request

```
POST <your https url>
content-type: application/json
x-webhook-signature: <hex HMAC-SHA256>
x-webhook-timestamp: <unix seconds>
x-webhook-event: leave.approved
x-webhook-id: <delivery id>
x-webhook-attempt: 1
```

| Header                | Meaning                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| `x-webhook-signature` | Hex HMAC-SHA256 of `` `${timestamp}.${rawBody}` `` with the endpoint secret |
| `x-webhook-timestamp` | Unix seconds used in the signed string                                      |
| `x-webhook-event`     | Event type (`leave.approved`, `employee.created`, …)                        |
| `x-webhook-id`        | **Stable delivery id, identical on every retry** — dedupe on this           |
| `x-webhook-attempt`   | 1-based attempt counter, for logs only                                      |

Requirements on your side: a public **https** endpoint (plain HTTP is rejected
when the endpoint is created), answering **2xx** for success within the request
timeout. Anything else (non-2xx, timeout, DNS/TLS failure) counts as a failure.

### Body

```json
{
  "event": "leave.approved",
  "organizationId": "…",
  "deliveryId": "…",
  "occurredAt": 1767225600000,
  "data": {}
}
```

`deliveryId` carries the same value as the `x-webhook-id` header, so consumers
that only read the body can still deduplicate.

---

## 2. Verify a delivery

The signed string is `` `${timestamp}.${rawBody}` `` — verify against the **raw**
body, before JSON parsing, or the signature will not match.

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function isValidDelivery(
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
): boolean {
  const timestamp = headers['x-webhook-timestamp'];
  const received = headers['x-webhook-signature'];
  if (!timestamp || !received) return false;

  // Reject stale replays (5 minutes is the usual window).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(received, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
```

### Deduplicate

A retry repeats the same `x-webhook-id`, so a receiver that stores processed ids
(Redis/UNIQUE column with a TTL of a few days) turns at-least-once delivery into
effectively-once:

```ts
if (await seenRecently(headers['x-webhook-id'])) return res.status(200).end();
```

---

## 3. Retries and health

| Attempt | Delay before it |
| ------- | --------------- |
| 1       | immediate       |
| 2       | 1 min           |
| 3       | 5 min           |
| 4       | 30 min          |
| 5       | 2 h             |

- After the last attempt the delivery is marked `dead` (visible in the delivery
  log, not retried again).
- **20 consecutive failed deliveries** auto-disable the endpoint — it stops
  receiving events until an admin re-enables it, so one broken consumer cannot
  keep a queue busy forever.
- Successful deliveries reset the consecutive-failure counter.
- Delivery rows (payload + status + response code) are kept for 30 days, then
  purged by the daily `webhook-delivery-maintenance` job.

Admins can send a test delivery from **Settings → Webhooks**; it goes through
the same signing, retry and logging path with `x-webhook-event: webhook.test`.

---

## 4. Event types

`leave.requested`, `leave.approved`, `leave.rejected`, `leave.cancelled`,
`employee.created`, `employee.updated`, `employee.deactivated`,
`attendance.clock_in`, `attendance.clock_out`, `task.created`, `task.completed`,
`expense.submitted`, `expense.approved`, `expense.rejected`, `document.signed`.

An endpoint with an empty subscription list receives every event type.

---

## 5. Marketplace installs

Marketplace entries of kind `webhook` (Slack, Microsoft Teams, Google Chat,
Discord, Zapier, Make, n8n, Power Automate, custom webhook, tasks, attendance
kiosk) install by creating an endpoint here, tagged with the app id
(`webhookEndpoints.appId`). That id — not the label — is what marks the app as
connected, so renaming the endpoint in Settings → Webhooks no longer resets the
badge in the directory.
