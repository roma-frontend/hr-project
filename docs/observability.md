# Observability and alerting

> What actually pages a human, and what stays a dashboard nobody opens. The
> point of this document is the second column: a signal with no recipient is not
> monitoring.

## What exists

| Signal               | Where                                                                                    | Pages anyone?                              |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| Application errors   | Sentry (`sentry.client.config.ts`, `sentry.server.config.ts`)                            | **Only if an alert rule exists**           |
| Cron failures        | Scheduled Ops registry; `recordCronRun` emails every superadmin on transition to `error` | **Yes** — at most once a day while failing |
| Convex reachability  | `/api/health` → probes the deployment's `/version`                                       | **Yes, once a monitor points at it**       |
| Uptime (Vercel edge) | Vercel Analytics / Speed Insights                                                        | No                                         |
| Traces               | OpenTelemetry auto-instrumentation                                                       | No                                         |
| Load                 | k6 (`tests/performance/load-test.js`)                                                    | Manual                                     |

Two gaps were closed on 2026-09-19: cron failures page a superadmin instead of
writing a console row nobody reads, and `/api/health` answers **503** when Convex
is unreachable instead of always `ok`. Before that, a monitor pointed at health
would have stayed green through the exact outage it exists to catch.

## Sentry: error tracking is only half the job

The config initialises Sentry **only when `NEXT_PUBLIC_SENTRY_DSN` is set**, and
says nothing when it is not. `/api/health` reports `checks.errorTracking:
on|off` so "are we actually capturing errors?" is answerable from monitoring
rather than by reading config.

A DSN with no alert rule collects errors nobody reads. Two ways to fix it,
pick one:

### Option A — provision the rules with the API (repeatable)

`scripts/sentry-alert-rules.mjs` creates the two rules below from CI or locally:

```bash
SENTRY_AUTH_TOKEN=… SENTRY_ORG=… SENTRY_PROJECT=… npm run sentry:rules
```

The token needs **both** `project:read` and `project:write`. The script lists
rules first (to stay idempotent) and `project:write` on its own answers **403**
on that listing — so a write-only token makes the command fail before it can
create anything. The DSN being live is not the same as the rules existing: check
`checks.errorTracking` at `/api/health` for the DSN, and the Sentry UI for the rules.

(`npm run sentry:rules -- --strict` exits 1 when unconfigured, for CI.)

It is idempotent: an existing rule with the same name is left alone. Run it
during setup, and re-run it after the Sentry project is recreated.

### Option B — create them by hand

| Rule name                       | Condition                                                                          | Action                    |
| ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------- |
| `Production errors — new issue` | A **new** issue in `production` environment                                        | Email the on-call address |
| `Production errors — spike`     | Error count above a threshold in a 1h window (e.g. > 20 events for the same issue) | Email the on-call address |

Deliberately **not** alerting on: every event (noise), session replays (quota),
or `NODE_ENV=development`.

## Uptime monitoring (external)

Vercel's own metrics do not cover "the deployment is up but Convex is not", and
they cannot outlive Vercel itself. An external monitor is required for a SOC 2
availability claim.

**Recommended: [UptimeRobot](https://uptimerobot.com)** — free tier is enough
for two checks with email alerts; keep the account credentials wherever the
other operational accounts live.

Two monitors:

| Monitor  | URL                           | Passing condition                |
| -------- | ----------------------------- | -------------------------------- |
| Homepage | `https://<domain>/`           | HTTP 200                         |
| Health   | `https://<domain>/api/health` | HTTP 200 — **not** "contains ok" |

`/api/health` returns 503 when Convex is unreachable, so "status code is 200" is
the correct rule. A keyword rule would pass on a cached body and miss the outage.

Set the alert contact to the same address as the Sentry rules, and **keep at
least 90 days of history** — that history is the availability evidence for the
observation window.

## On-call

There is no rotation. Stated plainly, and to be stated plainly to customers
too: **business-hours response, best-effort outside them**, with alerts checked
at least once every 24 hours. See `docs/incident-response.md` for what happens
once an alert is seen.

## What this document cannot prove

- Whether the Sentry rules or the uptime monitors **exist right now**. They live
  in vendor dashboards; this file describes what to create and why. The
  automated evidence collector covers what is in the repository, not in Sentry.
- Whether the DSN is set in production. `/api/health` is the check for that —
  point a monitor at it.
