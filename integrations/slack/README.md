# Strata → Slack

Strata posts into Slack through an **Incoming Webhook URL**: the admin adds the
app to a channel, copies the webhook URL, and pastes it into
`/marketplace` → Slack (or Settings → Webhooks). Deliveries then go out through
the standard engine — signed, retried, logged.

`manifest.json` is the Slack app definition that makes that URL available _from
the directory_ instead of from a hand-made app:

1. <https://api.slack.com/apps> → **Create New App** → **From an app manifest**.
2. Paste `manifest.json`, pick the workspace, create.
3. **Install to Workspace** on a test workspace, add a webhook to a channel, and
   paste the URL into Strata's marketplace to confirm end-to-end delivery.
4. Fill in the App Directory submission (icon, screenshots, category, support
   contact) and submit for review.

Manifest facts worth knowing:

- `settings.incoming_webhooks.incoming_webhooks_enabled: true` is what turns the
  feature on; the `incoming-webhook` bot scope is the corresponding OAuth scope.
- The app intentionally requests **no other scopes**: nothing is read from the
  workspace, so the review has nothing to justify beyond posting messages.
- `long_description` is omitted on purpose — Slack rejects a manifest whose
  `long_description` is shorter than 174 characters.

## What is still missing for a full Slack app

| Feature                          | Status                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Post to a channel (one-way)      | **works today** — incoming webhook URL                                                                                     |
| Slash commands (`/strata leave`) | needs an inbound Slack events endpoint (signature verification + URL challenge). The outbound-only engine cannot serve it. |
| Channel picker inside Strata     | needs a bot token (`chat:write`) and an OAuth install flow, i.e. a second delivery target type next to "URL".              |

Both gaps are engine work, not packaging: they need an inbound route and a
token-based delivery target. Until then the honest offering is "paste your
Incoming Webhook URL", which is exactly what the marketplace entry does.
