# Change management policy

> One page, as an auditor expects it: what may change, who reviews it, and what
> happens in an emergency. The tooling already enforces most of this — CI on
> every PR, Conventional Commits, preview deploys — so this document is about
> binding the _rules_ to the tooling, not restating the tooling.

## Scope

Everything that ships to production: application code, Convex functions and
schema, migrations, environment variables, CI/deploy configuration, and the
content of public pages.

## The normal path

1. **A change is proposed as a pull request.** Direct pushes to `main` are not
   part of the process; production deploys run from `main` only.
2. **CI must be green before merge.** The required checks are the jobs in
   `.github/workflows/ci.yml`: lint + format, type check, unit tests with the
   coverage gate, build, and Playwright E2E. CodeQL and `npm audit` run on the
   same PR.
3. **A code owner reviews.** `.github/CODEOWNERS` routes review requests; the
   paths it marks — auth, authorization/entitlements, billing, payments,
   payroll, biometrics, the schema, CI — cannot merge without the owner's
   approval.
4. **History stays readable.** Conventional Commits are enforced by commitlint
   (husky hook), so the audit trail says _why_ a change happened, not only that
   one did.
5. **A preview deploy is available** for every PR (Vercel), which is where
   review of anything visual should happen.

## Database changes

Schema changes are **additive first**, versioned, and go through
`convex/migrations.ts`. The rule that matters: a deploy may add a field or a
table and backfill it, but a field is not removed or repurposed until nothing
reads the old shape. `jest.config.js` coverage thresholds and the CI type check
are what catch a caller left behind.

## Emergency changes

During an active incident (see `docs/incident-response.md`) a fix may be pushed
without review if waiting would extend customer impact. Two conditions:

- the change is the **smallest** one that restores service — not a refactor
  done under pressure;
- a **retroactive review happens within 24 hours**, written into the incident
  log (`emergencyIncidents`), and any shortcut taken is recorded there.

An emergency change that touches a CODEOWNERS path still gets its review — just
after the fact, and in the log where an auditor can find it.

## What is not covered

- **Branch protection is a GitHub setting, not a file.** The requirement above
  is enforced only if `main` has protection enabled: required reviews ≥ 1,
  required status checks, no force-push. Verify it in repository settings and
  keep a screenshot as evidence — this repository cannot prove it from code.
- **Vendor-side changes** (a Stripe webhook secret rotated in the dashboard, a
  Vercel env var edited by hand) are outside the PR path. They are listed in
  `docs/secret-inventory.md` and must be recorded there when they change.

## Evidence

| Control                            | Where it lives                           |
| ---------------------------------- | ---------------------------------------- |
| Review required on sensitive paths | `.github/CODEOWNERS` + branch protection |
| CI gate on every PR                | `.github/workflows/ci.yml`               |
| Conventional Commits               | `commitlint.config.*`, husky hooks       |
| Additive-first migrations          | `convex/migrations.ts`, schema review    |
| Emergency-change retro-review      | incident log (`emergencyIncidents`)      |
