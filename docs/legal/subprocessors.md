# Subprocessor register

> **Source of truth:** `src/lib/subprocessors.ts`. The public page at
> `/subprocessors` renders that file: update the file, and the page follows. This
> document records _why_ each entry is on the list, which the page does not have
> room for.

Every entry below is a service this repository actually calls. The core set matches the
vendor register in `docs/soc2-type2-readiness.md` §2.4 — all eight are live dependencies in
`package.json`.

## Core platform — required for every tenant

| Vendor     | Declared in                                  | Purpose                                   | Region              |
| ---------- | -------------------------------------------- | ----------------------------------------- | ------------------- |
| Convex     | `convex/` (all application tables)           | Application database                      | EU (Frankfurt)      |
| Vercel     | `vercel.json` (`regions: ["fra1"]`)          | Hosting, CDN, server rendering            | EU (fra1)           |
| Sentry     | `@sentry/nextjs`                             | Error monitoring (payloads scrubbed)      | EU (Frankfurt)      |
| Upstash    | `@upstash/redis`                             | Rate limiting and short-lived cache keys  | EU (Frankfurt)      |
| Cloudinary | `src/actions/cloudinary.ts`                  | Uploads: avatars, CVs, attachments        | US / vendor-managed |
| Resend     | `convex/recruitmentEmails.ts`, auth mailers  | Transactional email                       | US / vendor-managed |
| Stripe     | `convex/subscriptions*.ts`, billing webhooks | Subscription billing                      | US / vendor-managed |
| LiveKit    | `@livekit/*`, `convex/meetings*.ts`          | Video/audio transport, only during a call | Vendor-managed      |

## Optional — dormant until the tenant enables the feature

| Vendor       | Enabled by                                    | Notes                                                |
| ------------ | --------------------------------------------- | ---------------------------------------------------- |
| Google       | Google sign-in, calendar sync, Gemini AI      | No data flows unless the tenant connects the account |
| Microsoft    | Entra sign-in/SSO, SharePoint library         | Configured per organisation in settings              |
| OpenAI       | AI assistant and meeting summaries            | Off unless the tenant turns the AI features on       |
| Telegram     | Telegram bot notifications                    | Requires an explicit bot token                       |
| imID         | Armenian e-ID login, signing and verification | National e-ID; per-organisation configuration        |
| Idram / ArCa | Local payment checkout                        | Only for tenants paying by local card/bank           |
| Lucky Carrot | Engagement integration                        | Two-way sync, only when the integration is enabled   |

## Change process

1. Adding or replacing a subprocessor requires a 30-day notice to customers (`SUBPROCESSOR_CHANGE_NOTICE_DAYS`).
2. Collect the vendor's SOC 2 / ISO report and record the report date
   (see `docs/soc2-type2-readiness.md` §2.4 — **still open**: the reports are published by
   all eight vendors but have not been collected into a vendor file).
3. Update `src/lib/subprocessors.ts` — the public page and the DPA annex follow from it.

## Open items

- Vendor SOC 2/ISO reports collected and dated (not yet done).
- Regions for Cloudinary, Resend and Stripe confirmed in writing for this deployment
  (currently the vendors' published defaults).
- A data residency statement for customers who require processing confined to Armenia or
  the EU.
