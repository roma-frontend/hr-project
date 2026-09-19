# Transactional email

Outgoing mail goes through **Resend**. It is not a new dependency: Resend already
sends the password-reset email and the operator subscription notice, and it is
already listed as a subprocessor in `docs/soc2-type2-readiness.md` §2.4 via
`src/lib/subprocessors.ts`. This document covers the pieces the **backend** needed
so a workflow can send mail, and the conventions it inherits.

| Piece                              | File                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| Routing + message rendering (pure) | `convex/lib/emailMessage.ts`                                                       |
| Queue, delivery, admin surface     | `convex/emails.ts`                                                                 |
| Delivery audit table               | `convex/schema/email.ts` (`emailDeliveries`)                                       |
| Existing senders (web app)         | `src/app/api/auth/forgot-password/route.ts`, `src/app/api/stripe/webhook/route.ts` |

---

## 1. Environment

| Variable                 | Required         | Meaning                                                                                         |
| ------------------------ | ---------------- | ----------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`         | yes              | From the Resend dashboard. The literal placeholder `your_api_key` counts as **not configured**. |
| `RESEND_DOMAIN_VERIFIED` | no               | `'true'` once the sending domain is verified. Anything else means unverified.                   |
| `RESEND_TEST_EMAIL`      | while unverified | Where messages are redirected. Falls back to `BOOTSTRAP_SUPERADMIN_EMAIL`.                      |
| `RESEND_FROM_EMAIL`      | no               | Overrides the from-address, e.g. `HR <hr@acme.am>`.                                             |

Defaults: from is `Strata <hr@strata.work>` when the domain is verified and
`Strata <onboarding@resend.dev>` otherwise.

These are read from the **Convex** deployment environment, not just the Next.js
one — the sender is a Convex action:

```bash
npx convex env set RESEND_API_KEY re_...
npx convex env set RESEND_DOMAIN_VERIFIED true      # only once verified
npx convex env set RESEND_TEST_EMAIL owner@example.com
npx convex env set RESEND_FROM_EMAIL 'HR <hr@example.com>'
```

> `RESEND_*` is not in `.env.example` yet. It should be added next to the other
> optional integration keys, with a note that the values belong on the Convex
> deployment.

---

## 2. The unverified-domain rule

Resend will only deliver from an unverified domain to the **account owner's own
address**. While `RESEND_DOMAIN_VERIFIED` is not `'true'`:

- every message is redirected to `RESEND_TEST_EMAIL`;
- the subject is rewritten to `[For ada@example.com] …` so the real recipient is
  visible in the inbox it actually landed in;
- the delivery row keeps both `intendedTo` and `to`, so a redirect is never
  silent.

With no usable fallback address the message is **held**, not dropped: the row is
`skipped` with reason `email_no_fallback`, because otherwise the product would
report a send that reached nobody.

This mirrors `src/app/api/auth/forgot-password/route.ts` exactly, including the
subject marker — one convention, not two.

---

## 3. Why there is a queue

The workflow runner executes inside a **mutation**, and a mutation cannot make an
HTTP request. So:

1. `queueEmail` (mutation) resolves the routing, renders the message, writes an
   `emailDeliveries` row and schedules the send.
2. `deliverEmail` (action) owns the network: it POSTs to
   `https://api.resend.com/emails`, then records the outcome.

The REST endpoint is called with `fetch` rather than the `resend` SDK: Convex
functions run in a V8 isolate where the SDK's Node assumptions are not
guaranteed, and the payload is three fields.

Retries: up to `MAX_EMAIL_ATTEMPTS` (3) with backoff
(`EMAIL_RETRY_DELAYS_MS`). Each attempt sends `Idempotency-Key: <deliveryId>`, so
a retry after a lost response cannot become a second copy in an inbox.

Statuses in `emailDeliveries`:

| Status    | Meaning                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pending` | Queued, or an attempt failed and another is scheduled. `attempts` and `error` say which.                                      |
| `sent`    | Resend accepted it. `providerId` is Resend's message id.                                                                      |
| `failed`  | Final. 4xx from Resend is final immediately — a bad key or an unverified domain fails identically on a retry.                 |
| `skipped` | Never attempted. `reason` is one of `email_no_api_key`, `email_no_recipient`, `email_invalid_recipient`, `email_no_fallback`. |

A row stuck in `pending` means the scheduled action never ran; `by_status_created`
is the index a sweeper would use.

---

## 4. Using it

**From a workflow.** The `send_email` action resolves the recipient from a chosen
person (their work email) or an explicit address, then reads `subject`, `body`,
and optionally `actionUrl` / `actionLabel`. The builder renders a person picker
and real fields — no JSON required.

The run result records `queued` with the delivery id, **not `done`**: the message
has not been sent yet, and pretending otherwise would let a run report success for
something Resend later rejected. A redirect is noted in the run detail.

**From the app.** `/automation` shows whether mail is configured and offers
**Send test email**. It goes through the same queue and delivery path, so a
success there means the real path works rather than that a special case works.

**Operator retry.** `emails.retryDelivery` requeues a failed row in place, keeping
one audit line per intended message and preserving the attempt history.

---

## 5. Not implemented

- **No bounce/complaint webhook.** Resend reports bounces; nothing subscribes to
  them yet, so a hard-bounced address stays on the list. A workflow emailing the
  same bad address will keep failing the same way.
- **No per-user opt-out.** Workflow mail is transactional by nature, but an
  employee who does not want "your leave was approved" emails has no switch.
- **No templates in the database.** The shell is code
  (`buildEmailContent`); the body is whatever the workflow author typed.
