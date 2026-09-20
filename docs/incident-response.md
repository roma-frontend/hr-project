# Incident response plan

> The tooling already exists — `emergencyIncidents`, the Superadmin Emergency
> page, cron-failure paging, `/api/health`. What was missing was the _written
> process_: who declares, who is told, and how fast. This is that process,
> sized for a small team where the founder is also the on-call.

## Roles

| Role               | Who                    | Responsibility                                                                                                                                                                                   |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Incident commander | The founder            | Declares the incident, decides severity, owns communication until it is closed.                                                                                                                  |
| On-call            | The founder            | Watches alerts. Committed cadence: **alerts are checked at least once every 24 hours**; a page from cron-failure paging (`scheduledOps.lastAlertAt`) or uptime monitoring is acted on when seen. |
| Scribe             | Whoever is handling it | Keeps the incident row updated as facts change, not at the end.                                                                                                                                  |

There is no 24/7 rotation, and pretending otherwise would be a lie in a
customer contract. Stated honestly: **business-hours response, best-effort
outside them.**

## Severity

| Level    | Definition                                                                                                       | Acknowledge           | Mitigation target      |
| -------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------- |
| **SEV1** | Customers cannot use the product, or data is at risk (data loss, leak, cross-tenant exposure, payments failing). | Immediately on notice | Start within 1 hour    |
| **SEV2** | A major feature is down or degraded for many tenants; no data risk.                                              | Same day              | Start within 4 hours   |
| **SEV3** | Single tenant affected, or a background job failing with no customer impact yet.                                 | Next working period   | Within 3 business days |

Cross-tenant data exposure is **always SEV1**, regardless of how few rows are
involved — it is the failure customers cannot detect and we must.

## What to do, in order

1. **Declare.** Open an `emergencyIncidents` row (Superadmin → Emergency). State
   severity, what is observed, and what is _not yet known_. The row is the
   record; a Slack message is not.
2. **Stop the bleeding** with the smallest safe action. The operator tools exist
   for this: pause a misbehaving cron from Scheduled Ops, disable a module via
   feature toggles, freeze an organization. Prefer reversible levers over
   edits.
3. **Diagnose.** `/api/health` (Convex reachability + error-tracking state),
   Sentry, cron outcomes in Scheduled Ops, deploy history in Vercel. Note that
   an empty Sentry means "no errors captured" only if `checks.errorTracking` is
   `on`.
4. **Communicate.** Update the incident row; affected tenants are told
   **within 72 hours of confirmation** for anything touching their data
   (matches Armenian data-protection expectations and GDPR art. 33 practice).
   The commitment is: what happened, what data, what we did, what they should do.
5. **Fix, then verify** with the failing signal, not with a hunch.
6. **Close** the incident row with a short timeline: impact, cause, fix,
   follow-ups with owners.

## Emergency changes

Allowed without prior review during SEV1/SEV2 under the conditions in
`docs/change-management-policy.md` — smallest change, retro-review within 24
hours, recorded in the incident row.

## Post-incident

Within **5 business days** of closing a SEV1 or SEV2:

- a written review (in the incident row or a linked note): what failed, what
  would have caught it earlier, what changes as a result;
- follow-up items become issues with owners — not a paragraph of intentions.

A backup restore that has never been tested is not a control: run
`docs/runbooks/backup-restore.md` quarterly, and after any incident that
required it.

## Sub-processor incidents

If the cause is a vendor (Convex, Vercel, Stripe, Resend…), we cannot fix it —
we can only know it happened and tell customers. That is the whole reason
`/api/health` probes the Convex deployment and why uptime monitoring is
external to Vercel: one degraded vendor must not look like a healthy product.
