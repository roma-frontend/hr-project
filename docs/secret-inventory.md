# Secret inventory

> SOC 2 CC6.5 asks a simple question: _where does each secret live, who can read
> it, and has it ever been rotated?_ This is the answer, kept next to the code
> so it can be wrong out loud rather than silently. `.env.example` is the
> generator's list of **names**; this file records the **stores**.

## The three stores

| Store                             | What lives there                                                   | Who can read it                                           |
| --------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| **Vercel** (project env)          | Next.js runtime secrets — auth, OAuth, Cloudinary, AI providers    | Anyone with Vercel project access (currently the founder) |
| **Convex** (deployment env)       | Secrets used inside Convex functions — mail, LiveKit, Telegram, AI | Anyone with Convex project access (currently the founder) |
| **GitHub Actions** (repo secrets) | Deploy + CI tokens                                                 | Repo admins; values are write-only after saving           |

`NEXT_PUBLIC_*` values are **browser-visible by design** — they are not secrets
and are excluded from the evidence collector on purpose. Putting a real key
behind that prefix is the mistake this note exists to prevent.

## Inventory

### Vercel — Next.js

| Key                                                                                  | Used for                                | Rotated            |
| ------------------------------------------------------------------------------------ | --------------------------------------- | ------------------ |
| `AUTH_SECRET`                                                                        | Auth.js session/JWT signing             | _never recorded_   |
| `JWT_SECRET`, `CSRF_SECRET`                                                          | app tokens, CSRF                        | _never recorded_   |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`                                              | Google sign-in                          | _never recorded_   |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID`            | Entra sign-in, SharePoint               | _never recorded_   |
| `CLOUDINARY_API_SECRET` (+ public cloud name/key)                                    | uploads (avatars, CVs, **face images**) | _never recorded_   |
| `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | AI assistant / meeting summaries        | _never recorded_   |
| `CONVEX_AUTH_PRIVATE_KEY`, `JWKS`                                                    | Convex auth bridge                      | _never recorded_   |
| `BOOTSTRAP_SUPERADMIN_EMAIL`, `NEXT_PUBLIC_BOOTSTRAP_SUPERADMIN_EMAIL`               | first-admin bootstrap                   | n/a (not a secret) |

### Convex — functions

| Key                                                             | Used for                                   |
| --------------------------------------------------------------- | ------------------------------------------ |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_DOMAIN_VERIFIED` | transactional email, workflow `send_email` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL`        | meetings                                   |
| `LIVEKIT_EGRESS_S3_*`                                           | meeting recording storage                  |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`                 | Telegram bot + webhook verification        |
| `GOOGLE_MAPS_API_KEY`, `APP_URL` / `NEXT_PUBLIC_APP_URL`        | places, links                              |
| `CLERK_JWT_KEY`, `JWKS`                                         | token verification                         |

### GitHub Actions

| Key                                                 | Used for                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `VERCEL_TOKEN`                                      | deploy                                                                                     |
| `CONVEX_DEPLOY_KEY`, `CONVEX_DEPLOYMENT`            | `npx convex deploy`                                                                        |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | source maps + alert-rule provisioning (token needs `project:read` **and** `project:write`) |
| `CODECOV_TOKEN`                                     | coverage upload                                                                            |

## Rotation

Rotating a secret is a deploy; do it deliberately:

1. Create the new value at the provider (Stripe, Resend, Convex, …).
2. Update the store(s) for **every** entry that uses it — several appear in both
   Vercel and Convex.
3. Redeploy. A rotated secret is not live until the running processes read it.
4. Verify the dependent feature actually works: email sends, webhooks verify,
   uploads land. A silent 401 from a rotated key is the usual outcome.
5. **Record the date in this table.** A rotation nobody wrote down did not
   happen as far as an audit is concerned.

## Open items — and the honest status

- **No rotation has ever been recorded.** Before the SOC 2 observation window
  starts, rotate everything once and fill the "Rotated" column. Until that
  happens, "we can rotate" is an untested claim.
- **Two people reading the same store** is the moment to move to per-person
  access; today there is one.
- Webhook signing secrets for local PSPs (Idram/ArCa) and Lucky Carrot are
  configured per integration and stored with the integration record, not in the
  environment — see `docs/webhooks.md`.
