# Strata → Zapier

A Zapier Platform CLI app that turns Strata events into Zap triggers. It is a
**REST hook** app: Zapier registers its catch URL through the public API v1
(`POST /api/v1/webhooks`) and Strata pushes the events.

This folder is not part of the web app build (see the `integrations/**` ignore in
`eslint.config.mjs`); it is the app bundle the Zapier CLI publishes.

## What it needs from the platform

Already shipped:

| Capability                                        | Where                  |
| ------------------------------------------------- | ---------------------- |
| `POST /api/v1/webhooks` — subscribe               | `convex/http.ts`       |
| `DELETE /api/v1/webhooks/{id}` — unsubscribe      | `convex/http.ts`       |
| `GET /api/v1/webhooks` — list                     | `convex/http.ts`       |
| `webhooks:read` / `webhooks:write` scopes         | `convex/lib/apiKey.ts` |
| Signed deliveries, retries, stable `x-webhook-id` | `convex/webhooks/`     |
| Protocol reference for the receiving side         | `docs/webhooks.md`     |

## Publish it

```bash
cd integrations/zapier
npm install
npx zapier login                # your Zapier developer account
npx zapier register "Strata"    # writes .zapierapprc (the app id) — commit that file
npx zapier test                 # unit tests in test/
npx zapier push                 # uploads version 1.0.0
```

Then, in the Zapier developer dashboard:

1. **Trigger test** — connect a real tenant API key with `webhooks:write`, enable
   the trigger, and confirm a `leave.requested` arrives in the Zap history.
2. **Version 1.0.0 review** — add the app description, category (HR & Team
   Management) and the logo/Zap templates Zapier asks for.
3. **Invite-only → public** — Zapier reviews the app (usually days, not hours)
   before it appears in the directory. Until then the invite link works for
   customers.

## Known limits

- No create/search actions: the public API v1 is read-only for people data, and
  Strata events are the write direction. An action would need a new write scope
  and an endpoint — that is a product decision, not a packaging one.
- The sample payload for the Zap editor comes from `GET /leaves`, so the key
  needs `leaves:read` for a pleasant editing experience.
