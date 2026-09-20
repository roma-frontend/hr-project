# Vendor register

> SOC 2 CC9.1 wants a list of the vendors we depend on, with their security
> reports on file and dated. `docs/legal/subprocessors.md` is the customer-facing
> register; this file is the **internal** one: what we need from each vendor and
> whether we actually have it.

## Status legend

- **Report** — vendor's SOC 2 / ISO certificate on file, with the report date.
- **DPA** — data-processing agreement executed.

Nothing here is marked collected until a dated PDF is saved. "They publish one"
is not the same as "we have it", and an auditor will ask for the file.

## Core platform — required for every tenant

| Vendor         | Purpose                                | Report | DPA | Notes                                                                                       |
| -------------- | -------------------------------------- | ------ | --- | ------------------------------------------------------------------------------------------- |
| **Convex**     | Application database + functions       | ☐      | ☐   | Deployment-level backup/restore is a vendor control — see `docs/runbooks/backup-restore.md` |
| **Vercel**     | Hosting, CDN, deploys                  | ☐      | ☐   | EU region `fra1`; DPA is click-through                                                      |
| **Sentry**     | Error monitoring                       | ☐      | ☐   | Payloads scrubbed before send                                                               |
| **Upstash**    | Rate limiting / cache                  | ☐      | ☐   |                                                                                             |
| **Cloudinary** | Uploads: avatars, CVs, **face images** | ☐      | ☐   | Hosts **biometric** images — highest-scrutiny vendor in this list                           |
| **Resend**     | Transactional email                    | ☐      | ☐   | Carries employee names and account emails                                                   |
| **Stripe**     | Subscription billing                   | ☐      | ☐   | Card data never touches us                                                                  |
| **LiveKit**    | Video/audio for calls                  | ☐      | ☐   | Only during a call                                                                          |

## Optional — dormant until a tenant enables them

| Vendor       | Enabled by                    | Report | DPA |
| ------------ | ----------------------------- | ------ | --- |
| Google       | sign-in, calendar, Gemini     | ☐      | ☐   |
| Microsoft    | Entra SSO, SharePoint library | ☐      | ☐   |
| OpenAI       | AI assistant, summaries       | ☐      | ☐   |
| Telegram     | bot notifications             | ☐      | ☐   |
| imID         | Armenian e-ID login/signing   | ☐      | ☐   |
| Idram / ArCa | local card checkout           | ☐      | ☐   |
| Lucky Carrot | engagement integration        | ☐      | ☐   |
| UptimeRobot  | external uptime monitoring    | ☐      | ☐   |

## AI data flows (CC9 + privacy)

AI features send employee text to a provider. Record, once, and check that each
provider's no-training terms apply to our tier:

| Provider        | What is sent                    | No-training confirmed |
| --------------- | ------------------------------- | --------------------- |
| Google (Gemini) | assistant prompts, meeting text | ☐                     |
| OpenAI          | assistant, meeting summaries    | ☐                     |
| Groq            | assistant models                | ☐                     |
| OpenRouter      | routing to the above            | ☐                     |

The product-side guardrails are the `aiGovernance` module; this table is about
the **contract** with the provider, which no code can assert.

## Process

1. Collect the report PDF + signed DPA from the vendor's trust portal. Save both
   outside the repository (they are customer-confidential under NDA and do not
   belong in git).
2. Enter the report date here and set an annual reminder to re-check it.
3. A new subprocessor requires 30-day customer notice
   (`SUBPROCESSOR_CHANGE_NOTICE_DAYS`) — update `src/lib/subprocessors.ts`, and
   the public `/subprocessors` page follows.

## Honest status

As of 2026-09-20 **no report and no DPA has been collected into a file** for any
vendor in this table. Every row above is a to-do, not a record. That is the one
part of vendor management that cannot be automated and should not be papered
over: the work is opening ~15 trust portals and saving ~30 PDFs. Until it is
done, the vendor-management control is not in place.
