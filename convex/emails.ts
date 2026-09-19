/**
 * emails — the outgoing mail path.
 *
 * Resend is not a new dependency: it already sends the password-reset mail
 * (`src/app/api/auth/forgot-password/route.ts`) and the operator subscription
 * notice (`src/app/api/stripe/webhook/route.ts`), and it is already named as a
 * subprocessor in `src/lib/subprocessors.ts`. This module gives the *backend* the
 * same ability, which is what a workflow-triggered email needs, and it reuses
 * that integration's conventions rather than introducing a second one:
 * `RESEND_API_KEY`, the `RESEND_DOMAIN_VERIFIED` gate, `RESEND_TEST_EMAIL` as the
 * unverified-domain fallback, and `RESEND_FROM_EMAIL`.
 *
 * ── Why a queue instead of a direct send ────────────────────────────────────
 * The workflow runner executes inside a mutation, and a mutation cannot make an
 * HTTP request. So the runner calls `queueEmail` (a mutation: it writes the row
 * and schedules delivery) and `deliverEmail` (an action: it owns the network).
 * The `emailDeliveries` row is then the answer to "did that email actually go?",
 * which a fire-and-forget `fetch` could never be.
 *
 * ── Calling the REST API, not the SDK ──────────────────────────────────────
 * `fetch` to `https://api.resend.com/emails` rather than `new Resend(...)`:
 * Convex functions run in a V8 isolate, where the SDK's Node assumptions are not
 * guaranteed, and the payload here is three fields. It also keeps the request —
 * including the `Idempotency-Key` that makes a retry safe — visible in one place.
 */

import { v } from 'convex/values';
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import type { ActionCtx, MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { getAuthCaller } from './lib/getAuthCaller';
import { isSuperadmin } from './lib/auth';
import {
  buildEmailContent,
  markRedirectedSubject,
  normalizeSubject,
  resolveEmailRouting,
  type EmailEnv,
  type EmailRouting,
} from './lib/emailMessage';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Attempts before a delivery is marked failed. */
export const MAX_EMAIL_ATTEMPTS = 3;

/** Backoff between attempts, in milliseconds, indexed by attempt number. */
export const EMAIL_RETRY_DELAYS_MS = [0, 30_000, 5 * 60_000] as const;

/** Read the mail configuration out of the deployment environment. */
function emailEnv(): EmailEnv {
  return {
    apiKey: process.env.RESEND_API_KEY,
    domainVerified: process.env.RESEND_DOMAIN_VERIFIED === 'true',
    testEmail: process.env.RESEND_TEST_EMAIL ?? process.env.BOOTSTRAP_SUPERADMIN_EMAIL,
    fromEmail: process.env.RESEND_FROM_EMAIL,
  };
}

/** Machine-readable reason for a delivery that was never attempted. */
function skipReason(problem: NonNullable<EmailRouting['problem']>): string {
  return `email_${problem}`;
}

export interface QueueEmailResult {
  deliveryId: Id<'emailDeliveries'>;
  status: 'pending' | 'skipped';
  /** Present when the message will not be sent. */
  reason?: string;
  /** Where it will go, after any unverified-domain redirect. */
  to: string;
  redirected: boolean;
}

/**
 * Queue one email and schedule its delivery.
 *
 * Returns a result rather than throwing when the deployment has no mail
 * configuration: the caller is usually a workflow run, and "email is not set up"
 * is an outcome to record, not an exception to fail a run over.
 */
export const queueEmail = internalMutation({
  args: {
    organizationId: v.optional(v.id('organizations')),
    intendedTo: v.string(),
    subject: v.string(),
    body: v.string(),
    organizationName: v.optional(v.string()),
    recipientName: v.optional(v.string()),
    actionUrl: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
    /** What produced this email, for the audit trail. */
    source: v.string(),
    workflowId: v.optional(v.id('automationWorkflows')),
    createdBy: v.optional(v.id('users')),
  },
  handler: async (ctx, args): Promise<QueueEmailResult> => {
    const routing = resolveEmailRouting(args.intendedTo, emailEnv());
    const content = buildEmailContent({
      subject: normalizeSubject(args.subject),
      body: args.body,
      organizationName: args.organizationName,
      recipientName: args.recipientName,
      actionUrl: args.actionUrl,
      actionLabel: args.actionLabel,
    });

    // The `[For …]` marker is applied in the stored subject, not at send time, so
    // what the row says and what the inbox shows cannot disagree.
    const subject = routing.redirected
      ? markRedirectedSubject(content.subject, routing.intendedTo)
      : content.subject;

    const now = Date.now();
    const deliveryId = await ctx.db.insert('emailDeliveries', {
      organizationId: args.organizationId,
      intendedTo: routing.intendedTo,
      to: routing.to,
      from: routing.from,
      subject,
      html: content.html,
      text: content.text,
      status: routing.configured ? 'pending' : 'skipped',
      redirected: routing.redirected,
      reason: routing.configured ? undefined : skipReason(routing.problem!),
      attempts: 0,
      source: args.source,
      workflowId: args.workflowId,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    if (routing.configured) {
      await ctx.scheduler.runAfter(0, internal.emails.deliverEmail, { deliveryId });
    }

    return {
      deliveryId,
      status: routing.configured ? 'pending' : 'skipped',
      reason: routing.configured ? undefined : skipReason(routing.problem!),
      to: routing.to,
      redirected: routing.redirected,
    };
  },
});

/** Read a delivery for the worker. Actions have no direct database access. */
export const getDelivery = internalQuery({
  args: { deliveryId: v.id('emailDeliveries') },
  handler: async (ctx, args) => ctx.db.get(args.deliveryId),
});

/**
 * Schedule another delivery attempt.
 *
 * A separate mutation rather than `deliverEmail` scheduling itself: a function
 * that references `internal.emails.deliverEmail` inside its *own* initializer
 * makes TypeScript's inference circular, and because `internal` is one type, the
 * cycle degraded callback inference in unrelated modules (`conflicts/main.ts`,
 * `newsletter.ts`, `superadmin/search.ts` all started reporting implicit `any`).
 * Going through a different function breaks the loop.
 */
export const scheduleEmailRetry = internalMutation({
  args: { deliveryId: v.id('emailDeliveries'), delayMs: v.number() },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(Math.max(0, args.delayMs), internal.emails.deliverEmail, {
      deliveryId: args.deliveryId,
    });
  },
});

/** Record the outcome of one attempt. */
export const finishDelivery = internalMutation({
  args: {
    deliveryId: v.id('emailDeliveries'),
    /**
     * `pending` is a real outcome here, not a placeholder: it means "this attempt
     * failed and another is already scheduled". Leaving the row `pending` with the
     * attempt count and the error attached is what lets an operator tell "still
     * trying" apart from "gave up".
     */
    outcome: v.union(v.literal('sent'), v.literal('failed'), v.literal('pending')),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    attempts: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.deliveryId, {
      status: args.outcome,
      providerId: args.providerId,
      error: args.error,
      attempts: args.attempts,
      sentAt: args.outcome === 'sent' ? now : undefined,
      updatedAt: now,
    });
    return { ok: true };
  },
});

/**
 * Deliver one queued email through Resend.
 *
 * Retries with backoff, and sends an `Idempotency-Key` of the delivery id so a
 * retry after a lost response cannot become a second copy in somebody's inbox.
 * The key is derived from the row id, so it is stable across every attempt.
 */
/** Result of one delivery attempt, so the handler has an explicit return type. */
interface DeliverOutcome {
  sent: boolean;
  reason?: string;
  providerId?: string;
}

export const deliverEmail = internalAction({
  args: { deliveryId: v.id('emailDeliveries') },
  handler: async (ctx: ActionCtx, args): Promise<DeliverOutcome> => {
    const delivery = await ctx.runQuery(internal.emails.getDelivery, {
      deliveryId: args.deliveryId,
    });
    if (!delivery) return { sent: false, reason: 'not_found' };
    // Already finished (a duplicate scheduler run, or a manual retry that has
    // since succeeded): do not send again.
    if (delivery.status === 'sent' || delivery.status === 'skipped') {
      return { sent: delivery.status === 'sent', reason: 'noop' };
    }

    const attempts = delivery.attempts + 1;
    const key = emailEnv().apiKey?.trim();

    const fail = async (error: string): Promise<DeliverOutcome> => {
      const retryable = attempts < MAX_EMAIL_ATTEMPTS;
      if (retryable) {
        const delay = EMAIL_RETRY_DELAYS_MS[attempts] ?? EMAIL_RETRY_DELAYS_MS.at(-1)!;
        await ctx.runMutation(internal.emails.scheduleEmailRetry, {
          deliveryId: args.deliveryId,
          delayMs: delay,
        });
      }
      // Record the failure either way — `attempts` is what tells a reader whether
      // a retry is still coming or this is final.
      await ctx.runMutation(internal.emails.finishDelivery, {
        deliveryId: args.deliveryId,
        outcome: retryable ? 'pending' : 'failed',
        error,
        attempts,
      });
      return { sent: false, reason: error };
    };

    if (!key) {
      // A key that was present at queue time and gone now — an env change between
      // the two steps. The row says so instead of staying pending forever.
      await ctx.runMutation(internal.emails.finishDelivery, {
        deliveryId: args.deliveryId,
        outcome: 'failed',
        error: 'RESEND_API_KEY is not set',
        attempts,
      });
      return { sent: false, reason: 'no_api_key' };
    }

    let response: Response;
    try {
      response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          // Stable per delivery, so a retry after a lost response is deduplicated
          // rather than delivered twice.
          'Idempotency-Key': args.deliveryId,
        },
        body: JSON.stringify({
          from: delivery.from,
          to: [delivery.to],
          subject: delivery.subject,
          html: delivery.html,
          text: delivery.text,
        }),
      });
    } catch (error) {
      // Network-level failure: worth another attempt.
      return await fail(error instanceof Error ? error.message : String(error));
    }

    const raw = await response.text();
    if (!response.ok) {
      // 4xx is a configuration or content problem (unverified domain, bad key,
      // rejected recipient) and will fail identically on a retry, so it is final.
      // 5xx and 429 are worth retrying.
      const retryableStatus = response.status >= 500 || response.status === 429;
      if (!retryableStatus) {
        await ctx.runMutation(internal.emails.finishDelivery, {
          deliveryId: args.deliveryId,
          outcome: 'failed',
          error: `Resend ${response.status}: ${raw.slice(0, 500)}`,
          attempts,
        });
        return { sent: false, reason: `http_${response.status}` };
      }
      return await fail(`Resend ${response.status}: ${raw.slice(0, 500)}`);
    }

    let providerId: string | undefined;
    try {
      providerId = (JSON.parse(raw) as { id?: string }).id;
    } catch {
      // A 2xx whose body we cannot parse still means accepted; the id is a
      // convenience, not the record of truth.
    }

    await ctx.runMutation(internal.emails.finishDelivery, {
      deliveryId: args.deliveryId,
      outcome: 'sent',
      providerId,
      attempts,
    });
    return { sent: true, providerId };
  },
});

// ── Admin surface ────────────────────────────────────────────────────────────

/** Resolve an org admin or superadmin, or refuse. */
async function requireAdmin(ctx: MutationCtx) {
  const caller = await getAuthCaller(ctx);
  if (!caller) throw new Error('Not authenticated');
  const requester = await ctx.db.get(caller._id);
  if (!requester) throw new Error('Requester not found');
  if (!isSuperadmin(requester) && requester.role !== 'admin') {
    throw new Error('Only administrators can manage email settings');
  }
  return requester;
}

/**
 * Whether this deployment can send email, and how it will route.
 *
 * Read by the operator/admin UI so "why did nothing arrive?" has an answer
 * before somebody inspects the deployment environment.
 */
export const getEmailConfiguration = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) return null;
    const requester = await ctx.db.get(caller._id);
    if (!requester) return null;
    if (!isSuperadmin(requester) && requester.role !== 'admin') return null;

    const env = emailEnv();
    // A probe address that is always syntactically valid, so the routing answer
    // reflects the key and the verified-domain gate rather than a recipient typo.
    const probe = resolveEmailRouting(requester.email, env);

    return {
      configured: probe.configured,
      /** Present when email cannot be sent at all. */
      problem: probe.problem ?? null,
      domainVerified: probe.domainVerified,
      from: probe.from,
      /** Where a message would land while the domain is unverified. */
      redirectTo: probe.redirected ? probe.to : null,
    };
  },
});

/**
 * Send a test email to the caller.
 *
 * The point of this is to answer one question — "is `RESEND_API_KEY` working?" —
 * without building a workflow to find out. It goes through the same queue and
 * delivery path as every other message, so a success here means the real path
 * works, not that a special case works.
 */
export const sendTestEmail = mutation({
  args: { intendedTo: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const requester = await requireAdmin(ctx);
    const to = args.intendedTo?.trim() || requester.email;

    const subject = 'Strata email delivery test';
    const result: QueueEmailResult = await ctx.runMutation(internal.emails.queueEmail, {
      organizationId: (requester.organizationId as Id<'organizations'> | undefined) ?? undefined,
      intendedTo: to,
      subject,
      body: [
        'This is a test message from your Strata deployment.',
        'If you are reading it, transactional email is configured correctly and workflows can send mail.',
        'While the sending domain is unverified, Resend delivers only to the account owner, so messages addressed to anyone else are redirected here and marked on the subject line.',
      ].join('\n\n'),
      organizationName: 'Strata',
      recipientName: requester.name,
      source: 'email_test',
      createdBy: requester._id,
    });

    return {
      success: result.status === 'pending',
      deliveryId: result.deliveryId,
      to: result.to,
      redirected: result.redirected,
      reason: result.reason ?? null,
    };
  },
});

/**
 * Requeue a delivery that failed, for the operator UI.
 *
 * Keeps the original row instead of inserting a new one, so the audit trail stays
 * one line per intended message and the attempt counter keeps its history.
 */
export const retryDelivery = mutation({
  args: { deliveryId: v.id('emailDeliveries') },
  handler: async (ctx, args) => {
    const requester = await requireAdmin(ctx);
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) throw new Error('Delivery not found');
    if (
      delivery.organizationId &&
      !isSuperadmin(requester) &&
      delivery.organizationId !== requester.organizationId
    ) {
      throw new Error('Access denied');
    }
    if (delivery.status === 'sent') throw new Error('This message was already delivered');

    await ctx.db.patch(args.deliveryId, {
      status: 'pending',
      error: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.emails.deliverEmail, { deliveryId: args.deliveryId });
    return { success: true };
  },
});
