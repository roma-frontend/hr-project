import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Outgoing email audit log.
 *
 * Why a table rather than a fire-and-forget call: the workflow runner executes
 * inside a **mutation**, and a mutation cannot make an HTTP request. So the
 * runner queues the message here and schedules an action to deliver it. That
 * split is also the more useful design — the row is the record of what was
 * claimed to have been sent, and it carries the provider's id or the provider's
 * error, so "the workflow said it emailed the new hire" is checkable.
 *
 * A queue row that never leaves `pending` means the scheduled action never ran
 * or the deployment was restarted at the wrong moment; that visibility is the
 * point. `by_status_created` is what a sweeper would use to find them.
 */
export const email = {
  emailDeliveries: defineTable({
    /** Absent for platform-level mail (operator notifications, test sends). */
    organizationId: v.optional(v.id('organizations')),
    /** Where the message was meant to go. */
    intendedTo: v.string(),
    /** Where it actually went — differs when an unverified domain redirected it. */
    to: v.string(),
    from: v.string(),
    subject: v.string(),
    /** Rendered body, stored so a delivery can be re-sent without re-rendering. */
    html: v.string(),
    text: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('sent'),
      v.literal('failed'),
      /** Not attempted: no API key, no recipient, or nowhere to redirect to. */
      v.literal('skipped'),
    ),
    /**
     * Why the message was not delivered as addressed. `redirected` is separate
     * from a failure on purpose: the mail did arrive, just not to the recipient.
     */
    redirected: v.boolean(),
    /** Resend's message id, when it accepted the message. */
    providerId: v.optional(v.string()),
    /** Provider or transport error, verbatim, for the operator. */
    error: v.optional(v.string()),
    /** Stable machine-readable reason for `skipped`. */
    reason: v.optional(v.string()),
    attempts: v.number(),
    /** What produced it, so a surprising email can be traced to its source. */
    source: v.string(),
    /** Workflow that triggered it, when one did. */
    workflowId: v.optional(v.id('automationWorkflows')),
    createdBy: v.optional(v.id('users')),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_org_created', ['organizationId', 'createdAt'])
    .index('by_status_created', ['status', 'createdAt'])
    .index('by_created', ['createdAt']),
};
