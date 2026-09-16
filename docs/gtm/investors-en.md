# Strata — Investor Overview

> **For investors and advisors · September 2026.** Companion to `docs/gtm-playbook.md`
> (internal) and the public comparison pages at `/compare`. All product claims in this
> document are verified against the repository; competitor marks come from public
> vendor material and are re-checked per deal.

---

## 1. The company in one paragraph

Strata is an HR platform for companies operating in Armenia and the Armenian- and
Russian-speaking markets: employee records, biometric attendance, leave, shift
scheduling, payroll with Armenian Tax Service (SRC) reporting, local payments, hiring,
performance, learning, documents with e-signatures, and built-in communication — in one
system, in Armenian, Russian, English and German. Global HR vendors do not build Armenian
statutory reporting, local payment rails (Idram/ArCa), national e-ID login (imID), or an
Armenian interface. Strata does, and sells everything above as one product instead of four
subscriptions.

## 2. Why now

- **The wedge exists and is durable.** Armenia's formalisation of employment and tax
  reporting keeps pushing companies from spreadsheets to systems. No global vendor will
  localise for a market of this size — which is exactly why the position is defensible.
- **Consolidation pressure is measurable.** A typical target customer runs HR in a
  spreadsheet, attendance in Telegram, tasks in a messenger, e-signatures in a separate
  tool, and payroll in an accountant's software. Each hand-off is manual work and each
  subscription is a line item Strata removes.
- **The product is built.** This is not a deck about roadmap: the platform ships 46+
  modules, a public API, local payments, SSO/SCIM, and four fully localised interfaces —
  verifiable in the repository and in the product today.

## 3. Product proof (shipped, not planned)

| Capability                                              | Status                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Modules (HR, time, payroll, talent, ops, communication) | 46+ shipped, 114 product pages                                                      |
| Armenian SRC-ready payroll export                       | Shipped and tested (income tax, pension, stamp duty, ՀՎՀՀ)                          |
| Local payments (Idram / ArCa)                           | Shipped end to end: checkout, webhooks, admin console                               |
| Public API + customer webhooks                          | Shipped, metered per plan (from Pro)                                                |
| Enterprise SSO (SAML 2.0 / OIDC) + SCIM 2.0             | Shipped                                                                             |
| Localization                                            | en / ru / hy / de, key parity machine-checked in CI                                 |
| Comparison pages (competitive surface)                  | Live at `/compare`, six head-to-head pages                                          |
| Security posture                                        | Audit logs, security center, compliance module, automated SOC 2 evidence collection |

## 4. Market and position

**Segments (in priority order):**

1. Armenian companies with field/shift staff (20–300 people) — attendance, shifts, payroll.
2. Armenian offices of international groups — the local statutory layer global HQ tools lack.
3. Diaspora businesses (CIS, UAE, EU) — Armenian/Russian interface at Western-tool prices.
4. Service companies with drivers and fleets.

**The honest competitive picture** (full matrix in `ROADMAP.md`, public pages at `/compare`):
on shipped capability Strata sits above the SMB/mid-market set (BambooHR, HiBob,
Personio) and roughly level with Rippling and Deel minus their US/finance infrastructure.
The rows that decide local deals — SRC export, Armsoft sync, imID, Idram/ArCa, Armenian
UI and support — exist in **no** global competitor.

**What we lose on, publicly:** native mobile apps (PWA today), a SOC 2 Type II
certificate (evidence automation shipped; audit is the remaining step), brand and
references. These are capital and time problems, not product-architecture problems.

## 5. Business model

- **Per-employee SaaS** in three published tiers: Starter (≤10 seats), Pro (≤50, includes
  the public API), Enterprise (unlimited, custom terms).
- **Enforced limits, not brochure limits:** every plan limit is checked server-side;
  upsell is triggered by real quota events (a 51st employee on Pro is an upgrade screen,
  not an invoice dispute).
- **Local payment rails reduce churn friction:** renewals can be paid with Idram/ArCa by
  companies without international cards.
- **Partner channel (planned):** accountants and Armsoft/1C integrators — the people who
  actually choose HR systems for Armenian SMBs — with revenue share.

## 6. Roadmap that matters

| Item                               | Why it moves the number                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| Succession planning + career paths | Completes the talent suite; Leapsome/HiBob compete on this |
| Native mobile (iOS/Android)        | The single most-asked-for capability in deals              |
| SOC 2 Type II audit                | Unblocks mid-market and international procurement          |
| Partner program                    | Distribution without proportional S&M spend                |
| Case studies (3)                   | References are the currency of local B2B sales             |

## 7. Risks we own

- **Market size discipline:** Armenia is small; the strategy is depth-first (own the local
  stack), then diaspora/CIS expansion with the same statutory playbook.
- **Competitor attention:** global vendors localise for large markets only; the realistic
  threat is a regional entrant, which argues for moving fast on the partner channel.
- **Key-person and platform risk:** mitigated by the public API, data export in every plan,
  and standard infrastructure (Next.js/Convex) with no exotic dependencies.

## 8. The one-sentence thesis

> Strata owns the HR operating system for a market global vendors will never localise for —
> and sells it as one product at the price global vendors charge for a fraction of it.
