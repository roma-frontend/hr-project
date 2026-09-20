# SOC 2 Type II Readiness — Strata Platform

> **Scope:** the Strata product (Next.js 16 on Vercel EU + Convex + Upstash Redis +
> third-party subprocessors Stripe/Resend/Cloudinary/LiveKit/Sentry).
> **Standard:** SOC 2 Type II, Security Trust Service Criteria (TSC); Availability &
> Confidentiality added where customers ask.
> **Status legend:** `[x]` in place · `[~]` partial · `[ ]` gap
> **Last reviewed:** 2026-09-14

---

## 0. How to use this document

1. Every control names **where it lives in the codebase** — SOC 2 auditors want
   evidence, and for us the evidence is code + config + cron output.
2. Type I = "controls existed at a point in time". Type II = "controls operated
   **consistently over 3–12 months**". Anything marked `[ ]` must be fixed
   _before_ the observation window starts, because the clock only counts while
   a control runs.
3. Minimal practical path: complete §2–§4, pick a 6-month window, collect the
   §7 evidence continuously, then engage the auditor.

---

## 1. Trust Services Criteria map

| TSC | Criteria family             | Where we stand |
| --- | --------------------------- | -------------- |
| CC1 | Control environment         | §2             |
| CC2 | Communication & information | §2.5           |
| CC3 | Risk assessment             | §2.6           |
| CC4 | Monitoring                  | §6, §7         |
| CC5 | Control activities          | §2–§5          |
| CC6 | Logical & physical access   | §3             |
| CC7 | System operations           | §5             |
| CC8 | Change management           | §4             |
| CC9 | Risk mitigation / vendors   | §6             |

---

## 2. Control environment (CC1–CC3)

### 2.1 Governance `[ ]`

- [ ] Written **information security policy** signed by the founder (1 page is fine; auditors want it dated and acknowledged by everyone).
- [ ] Named **security officer** (can be the founder) with a documented role description.
- [ ] Annual (first: initial) **security awareness training** — a recorded session + attendance list is acceptable at this size.
- [x] Documented **incident response plan** with severity levels — written in `docs/incident-response.md`: severity ladder, declaration, operator-tool levers, the 72h customer-notification commitment and emergency-change rules. Tooling: `emergencyIncidents` + Superadmin Emergency page.

### 2.2 Code of behavior `[~]`

- [x] Contributor discipline: Conventional Commits, commitlint, husky hooks.
- [ ] Acceptable-use / confidentiality clauses in employment & contractor agreements.

### 2.3 Product security organization `[~]`

- [x] Platform operator controls in-product: `superadmin/operator-tools` (cron pause/track), `featureToggles`, `emergencyIncidents`, `superadminAccessTokens` (time-boxed auditor accounts).
- [ ] Documented runbook linking each operator tool to when it may be used.

### 2.4 Vendor/process discipline `[ ]`

- [~] Vendor register: the list is written in `docs/vendor-register.md` (core + optional vendors, AI data flows, DPAs). **No report and no DPA has been collected into a file yet** — every row is a to-do.
- [ ] Annual review of each vendor's report date.

### 2.5 Communication `[ ]`

- [ ] Security page (`/security`) already exists — add: how to report vulnerabilities (`security@…` + PGP), expected response time.
- [ ] Customer-facing incident-communication commitment (e.g. "notification within 72h" — matches Armenian data-law expectations and GDPR practice).

### 2.6 Risk assessment `[ ]`

- [ ] One-time **risk register** (spreadsheet is fine): top 10 risks with owner + mitigation. Candidates for this product: face-recognition biometric data (special category under GDPR!), superadmin impersonation abuse, webhook secret leakage, PSP fraud, AI data leakage via assistant providers.

---

## 3. Logical access (CC6) — strongest area

### 3.1 Authentication `[x]`

- [x] Password: bcrypt (12 rounds) — `convex/auth.ts`.
- [x] Lockout/attempt tracking: `loginAttempts` + `loginFailedAttempts`/`loginLockedUntil`.
- [x] TOTP 2FA (`convex/auth/*totp*`), WebAuthn passkeys, Face login (server-verified one-time tokens in `faceLoginTokens`).
- [x] OAuth: Google, Azure AD, imID; enterprise **SSO**: OIDC+PKCE (`convex/sso`) and **SAML 2.0** (`convex/sso/samlActions.ts`, pinned certificate, single-use flows).
- [x] Session model: server-issued `sessionToken` + `sessionExpiry` (7d), JWT cookie `httpOnly`+`secure`+`sameSite`, revocable (`security/sessions` admin page).

### 3.2 Authorization `[x]`

- [x] RBAC 5 roles + `convex/lib/rbac.ts` ranking; every mutation re-checks via `getAuthCaller`/`orgAccess` (server-side, never client-arg trust).
- [x] Entitlements engine enforces plan/module access server-side (`convex/lib/entitlements.ts`).
- [x] Segregation of duties in money flows: expenses & benefits claims forbid self-approval; reviewedBy always server-attributed.

### 3.3 Access provisioning & deprovisioning `[~]`

- [x] SCIM 2.0 (`/api/scim/v2/*`): create/deactivate/delete (soft), hashed bearer tokens, revocable.
- [x] SSO auto-provisioning is scoped + audited (`sso_user_provisioned`).
- [ ] **Joiner/mover/leaver runbook**: when an employee leaves _our own company_, who revokes Vercel/Convex/GitHub/Stripe dashboard access, within how many days. (Sub-processor admin access is in scope for SOC 2, not just product users!)

### 3.4 Privileged access `[~]`

- [x] Superadmin impersonation is reason-tracked and session-bounded (`impersonationSessions` with reason + expiry + audit log).
- [x] Time-boxed superadmin tokens for external specialists (`superadminAccessTokens` auto-expiry).
- [x] Admin Data Browser records before/after JSON with one-click undo (`adminDbChanges`).
- [ ] Quarterly **superadmin access review** — export `users` with role=superadmin, sign off. Schedule it as a calendar event; keep the exports.

### 3.5 Crypto & secrets `[~]`

- [x] TLS everywhere; HSTS configured at platform level.
- [x] Webhook signing: HMAC-SHA256, timing-safe compares (outbound `convex/webhooks/emit.ts`, inbound Lucky Carrot scheme, local PSP webhooks `convex/payments.ts`).
- [x] SCIM tokens stored as SHA-256 hashes only.
- [~] Secret inventory is written in `docs/secret-inventory.md` (three stores, who can read each, `NEXT_PUBLIC_*` exclusion explained, rotation procedure). **Rotation has never been recorded and everything still needs rotating once before the window starts** — the inventory does not substitute for doing it.

### 3.6 Physical `[x]`

- [x] N/A — no physical infrastructure; covered by Vercel/Convex vendor reports. Note this explicitly; auditors accept it.

---

## 4. Change management (CC8) — strong, needs one artifact

- [x] CI gate on every PR: ESLint+Prettier, `tsc --noEmit`, Jest with coverage thresholds + Codecov, Playwright cross-browser E2E, npm audit, CodeQL SAST, dependency review (`.github/workflows/ci.yml`).
- [x] Preview deploys per PR on Vercel; production deploys only from `main`.
- [x] Conventional Commits enforced (commitlint) → auditable history.
- [x] DB changes are additive-first, versioned, with `convex/migrations.ts` infra.
- [x] **Written change policy** — `docs/change-management-policy.md`, with `.github/CODEOWNERS` routing review for auth, authorization/entitlements, billing, payments, payroll, biometrics, the schema and CI.
- [ ] Enable **branch protection**: required reviews ≥1 on `main`, required CI checks (lint, type-check, unit-tests, build, e2e). `.github/CODEOWNERS` is in place, but a GitHub setting is not a file — verify it in repository settings and screenshot it; this cannot be proven from the repository.
- [ ] Emergency-change procedure: what's allowed without review during an incident, and the mandatory retro-review within 24h (pair with incident plan §2.1).

---

## 5. System operations (CC7) — availability & monitoring

- [x] Error tracking: Sentry (client+server configs) with release health. **Caveat:** `sentry.server.config.ts` sets `enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN`, so a production deploy without the DSN tracks nothing — silently. `/api/health` now reports `checks.errorTracking: on|off` so "are errors actually captured?" is answerable from monitoring tooling instead of by reading the config.
- [x] Tracing: OpenTelemetry auto-instrumentation (`opentelemetry.server.config.ts`, `instrumentation.ts`).
- [x] Performance: Vercel Analytics + Speed Insights; bundle-size guardrails in CI (`check-bundle-guardrails`).
- [x] Backups: `convex/backups.ts`, registered in `convex/crons.ts` (`backup-all-enterprise-orgs`, every 6h; `cleanup-expired-backups`, hourly) and pausable from the Scheduled Ops console. Retention is a **flat 48h for every plan** (`BACKUP_RETENTION_HOURS`), which is also what the product copy says ("Automated employee backups (48h retention)") — there is no per-plan retention table.

  **Найдено и исправлено 19.09.** До этой правки оба задания лежали в отдельном `backups.cron.ts`, а `cronJobs()` из файла, отличного от `convex/crons.ts`, Convex **не регистрирует**: «автоматические бэкапы» существовали в копирайте и в этом чек-листе, но не запускались ни разу, а просроченные снапшоты никто не удалял. Теперь задание в реестре крон можно считать существующим только если оно зарегистрировано — это проверяет `src/__tests__/cronRegistration.test.ts`.

- [x] Health endpoint (`/api/health`) probes what the product cannot run without: it calls the Convex deployment's `/version` (no table read, no auth) and answers **503 / `status: degraded`** when the deployment is unreachable. Before this it returned `ok` unconditionally — a monitor pointed at it stayed green through the exact outage it exists to catch.
- [x] Cron failure paging: `recordCronRun` emails every superadmin when a job transitions into `error`, and re-alerts at most once a day while it keeps failing (`scheduledOps.lastAlertAt`). Without it a broken job's only trace was a console row nobody opens — how the deadline-reminder job threw daily and the backup jobs never ran at all.
- [ ] **Not ours, and must be said out loud:** the `employeeBackups` table is not a database backup. It is per-employee JSON snapshots the product offers customers; there is no restore of the whole deployment under our control. Deployment-level recovery is Convex Cloud's backup feature (a vendor control to be cited under CC9.1 and tested in the restore drill below).
- [x] Load testing exists (`k6` — `tests/performance/load-test.js`).
- [~] **Backup restore test** — procedure written in `docs/runbooks/backup-restore.md` (staging restore, row counts, elapsed time, snapshot timestamp). **Not performed once yet**; the first drill is what turns the vendor checkbox into a control.
- [~] **Uptime monitoring** external to Vercel — specified in `docs/observability.md` (UptimeRobot, `/` + `/api/health` with a _200-status_ rule, since health answers 503 when Convex is down). Needs the account created and 90 days of history kept.
- [x] Documented **RTO/RPO**: RTO 4h / RPO 24h in `docs/runbooks/backup-restore.md`, with the caveat attached — they hold only if the Convex plan includes automated backups. Verify the plan; the target is a claim until it matches.
- [~] Alert routing: `docs/observability.md` defines on-call ("business-hours response, alerts checked at least daily") and the two Sentry rules; `scripts/sentry-alert-rules.mjs` provisions them idempotently. **The rules still need to be created** (run the script) — a DSN with no rule catches errors nobody reads.

---

## 6. Risk mitigation / vendor management (CC9)

- [x] Rate limiting: Upstash Redis on sensitive endpoints.
- [x] CSP/XSS headers, i18n-driven static content, React (no raw HTML injection surfaces except reviewed markdown).
- [x] Local PSP webhook idempotency (HMAC verify + idempotent ledger `localPayments`).
- [ ] **DPAs** signed with each sub-processor — tracked in `docs/vendor-register.md`. Most accept click-through DPAs; none has been saved yet.
- [x] **Biometric special-category handling** — explicit consent at enrolment (checkbox gates the camera, and `registerFace` refuses without `consentGranted`), versioned consent records (`convex/lib/biometricConsent.ts`), self-enrolment-only authorization (`Cannot register Face ID for another user`), and descriptor + photo erased with consent withdrawn on both Face-ID removal and offboarding. Policy: `docs/legal/biometric-policy.md`. **Still open:** Cloudinary (US) hosts the enrolment photo — a residency gap for AM/EU-only customers.
- [~] **AI data-flow note**: providers and what is sent are tabulated in `docs/vendor-register.md` §AI data flows. **The per-provider no-training terms are not yet confirmed** — that check is a to-do, not a checkbox.
- [ ] Annual **penetration test** — one external test before Type II window closes; budget ~$3–8k (or start with CodeQL + npm audit + a bug-bounty-style private disclosure program and document findings).

---

## 7. Evidence collection plan (start on day 1 of the window)

Automate everything below into a monthly folder (`/evidence/2026-MM/`):

| Evidence                         | Source                                              | Frequency      |
| -------------------------------- | --------------------------------------------------- | -------------- |
| CI run log (all green checks)    | GitHub Actions                                      | auto, per PR   |
| CodeQL + Dependabot alerts state | GitHub Security tab                                 | monthly export |
| Backup job success               | `operatorTools` cron registry (`lastRunAt`/outcome) | monthly export |
| Restore test report              | manual, §5                                          | quarterly      |
| Superadmin role list + sign-off  | `users` query                                       | quarterly      |
| Access-token revocations         | `superadminAccessTokens`                            | quarterly      |
| Login-failure review             | `loginAttempts` (riskScore/blockedReason)           | monthly sample |
| SSO login anomalies              | `ssoLoginEvents`                                    | monthly sample |
| Incident log                     | `emergencyIncidents`                                | as they occur  |
| Vendor SOC 2 reports             | vendor trust portals                                | annual refresh |
| Change log                       | conventional commits + PRs                          | continuous     |

**Tip:** the cron registry in Scheduled Ops already records `lastRunAt` + outcome
per job — that's a ready-made control-operation log for backups, webhook
maintenance, and retention sweeps.

### 7.1 Automated evidence collector (shipped 2026-09-15)

Ten of the controls above now collect themselves:

```bash
npm run soc2:evidence            # writes reports/soc2-evidence-<date>.md
npm run soc2:evidence:stdout     # print to terminal instead
node scripts/soc2-evidence.mjs --strict   # exit 1 if any control fails (CI-friendly)
```

Each run reads repository state only — no network, no database, no secrets — and
produces a dated artefact with per-control status, the evidence lines behind it and
the TSC reference:

| Automated control                                | TSC   | What it reads                                                                                                            |
| ------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| Change management (PR gates + commit discipline) | CC8.1 | `.github/workflows/ci.yml`, `package.json`, commitlint, husky                                                            |
| Coverage gate                                    | CC4.1 | `jest.config.js` thresholds, `badges/coverage.json`                                                                      |
| Dependency + SAST scanning                       | CC9.2 | CI workflow (npm audit, dependency review, CodeQL)                                                                       |
| Secret inventory                                 | CC6.5 | `.env.example` — key names only, asserts no live values; `NEXT_PUBLIC_*` explicitly excluded (browser-exposed by design) |
| Server-side authorization                        | CC6.1 | counts `getAuthCaller`, capabilities, entitlement assertions, superadmin exclusions across `convex/`                     |
| Webhook signing                                  | CC6.7 | `convex/lib/paymentSignature.ts`, `convex/webhooks/protocol.ts`                                                          |
| Credential hashing at rest                       | CC6.5 | SCIM token / API key storage paths                                                                                       |
| Scheduled operations                             | CC7.2 | `convex/crons.ts` + pause-aware dispatcher                                                                               |
| Backups                                          | A1.2  | `convex/schema/backups.ts`, `convex/backups.ts`, registration in `convex/crons.ts`, `BACKUP_RETENTION_HOURS`             |
| Privileged access                                | CC6.3 | impersonation sessions, time-boxed tokens, lockout tracking                                                              |

**What it deliberately does NOT do:** pass judgement on the ten human controls
(security policy, risk register, restore test, access review…). Those are emitted
as a MANUAL checklist with the exact procedure, because claiming them without a
human sign-off would be evidence theatre.

**Cadence:** run monthly from a scheduled job and keep every output — Type II is
about controls operating _consistently over 3–12 months_, so the value is the
series, not any single report. `--strict` makes it a CI gate: any control that
drops from pass fails the build.

> The report is evidence that controls are _configured_. It is not an audit
> opinion and does not replace §2's manual checklist.

---

## 8. Timeline (realistic for a solo/small team)

| Phase                             | Duration         | Work                                                                                                                         |
| --------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1. Remediate gaps                 | 3–5 weeks        | Items marked `[ ]` in §2–§6, prioritized: biometric policy (P0), incident plan, change policy, secret inventory, monitoring. |
| 2. Freeze controls & start window | day X            | All `[ ]` → `[x]`/`[~]`; start collecting §7 evidence.                                                                       |
| 3. Observation window             | 6 months (min 3) | Evidence cadence above; no control changes without documenting them.                                                         |
| 4. Audit                          | 4–8 weeks        | Choose a readiness-friendly auditor (e.g. firms offering "SOC 2 for startups" with Vanta/Drata/Secureframe automation).      |
| 5. Report                         | —                | Type II report issued; renew annually.                                                                                       |

Automation platforms (Vanta/Drata) cost ~$10–25k/yr but replace most manual
evidence collection; for this stack (Vercel/Convex/GitHub/Stripe all have
native connectors) they cover §3, §4, §5, §6 monitoring almost fully.

---

## 9. Immediate P0 list (do these first)

1. ~~**Biometric consent + retention policy**~~ — done 2026-09-20 (§6, `docs/legal/biometric-policy.md`). Remaining sub-item: the Cloudinary photo residency.
2. ~~**Incident response plan**~~ — done 2026-09-20 (`docs/incident-response.md`).
3. **Branch protection** — CODEOWNERS is in place; enabling protection on `main` is a GitHub setting and still to do (§4).
4. **Secret rotation** — inventory written; rotate everything once and record dates (§3.5, `docs/secret-inventory.md`).
5. **Uptime monitor account + first backup restore drill** — both specified, neither performed (§5).
6. **Vendor report collection + DPAs** — register written, PDFs not collected (§2.4/§6, `docs/vendor-register.md`).
7. **Sentry alert rules** — run `scripts/sentry-alert-rules.mjs` (§5).
