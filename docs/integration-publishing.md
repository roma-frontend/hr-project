# Publishing the integrations (partner directories)

What it takes to go from "the catalog says Slack/Zapier/Make/n8n" to "a customer
finds Strata _inside_ Slack/Zapier and installs it in two clicks".

Two different kinds of work live here, and only the first can be done in this
repo:

- **Packaging** (shipped, in `integrations/`): the app definitions the vendor
  platforms review — Zapier CLI app, Slack manifest.
- **Accounts and review** (not code): vendor developer accounts, app review,
  screenshots, support contact, an OAuth client per platform.

## Status

| Platform                        | Packaging                                              | Can a customer connect today?                           | What is left                                                         |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------- |
| **Zapier**                      | `integrations/zapier` (REST hooks)                     | Yes — via "Webhooks by Zapier" or the marketplace entry | `zapier register/push`, trigger test, directory review               |
| **Make / n8n / Power Automate** | generic webhook in the catalog                         | Yes — generic webhook                                   | Publishing to _their_ directories (community node / partner program) |
| **Slack**                       | `integrations/slack/manifest.json` (Incoming Webhooks) | Yes — paste the webhook URL                             | App Directory submission                                             |
| **Microsoft Teams**             | —                                                      | Yes — incoming webhook URL                              | Teams app package (`manifest.json` + icons) for the Teams store      |
| **Google Chat**                 | —                                                      | Yes — incoming webhook URL                              | Google Workspace Marketplace listing                                 |

## What the platform already provides to these partners

Shipped and documented in [`docs/webhooks.md`](./webhooks.md):

- `POST /api/v1/webhooks` — a partner registers its callback URL itself
  (`webhooks:write` scope). This is what makes a Zapier app possible without an
  admin copying URLs by hand.
- `GET /api/v1/webhooks` — list, `webhooks:read`.
- `DELETE /api/v1/webhooks/{id}` — unsubscribe, scoped to the key's tenant.
- Signed deliveries (HMAC-SHA256), retries with backoff, a delivery log, and a
  stable `x-webhook-id` so the receiver can deduplicate a redelivery.
- `appId` on the endpoint, so the marketplace's "Connected" badge survives a
  rename in Settings → Webhooks.

## Zapier — step by step

```bash
cd integrations/zapier
npm install
npx zapier login
npx zapier register "Strata"   # commit the generated .zapierapprc
npx zapier test
npx zapier push
```

Then: dashboard → **Trigger test** with a real tenant key (scopes
`webhooks:write`, `leaves:read`) → verify the event arrives → fill in the
listing → submit for review. `integrations/zapier/README.md` has the details and
the known limits (no create/search actions, by design).

## Slack — step by step

1. <https://api.slack.com/apps> → **Create New App** → **From an app manifest** →
   paste `integrations/slack/manifest.json`.
2. Install on a test workspace, create the channel webhook, paste it into Strata.
3. Confirm a `leave.requested` shows up in the channel.
4. Submit to the App Directory (icon, screenshots, category _HR & Team
   Management_, support contact).

Slash commands and a channel picker need an inbound events endpoint and a
bot-token delivery target — see the table in `integrations/slack/README.md`.

## Rules this runbook follows

- **No directory listing before the flow works end to end.** A published app that
  errors on install is worse than no listing: the review is public and the
  support cost lands on us.
- **One listing per platform, not per module.** A customer installs "Strata",
  then picks the events they care about — 15 separate apps would flood every
  directory with duplicates.
- **The listing copy is the same copy as `/integrations`**, so the promise in the
  directory and the product cannot drift.
