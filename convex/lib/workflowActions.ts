/**
 * workflowActions — the single source of truth for what a workflow may do.
 *
 * The problem this module removes: the builder
 * (`src/components/workflow/WorkflowBuilderClient.tsx`) had its own hardcoded
 * list of ten action types and ten trigger types, while the runner implemented
 * two actions and zero automatic triggers. An admin could build "when a leave is
 * requested → send an email", save it, see it in the list, and get nothing —
 * forever, silently. The runner reported `unsupported` in a run record nobody
 * reads, and the UI kept offering the option.
 *
 * So the catalogue lives here, once, and both sides read it:
 *   - the runner refuses anything not marked `implemented`;
 *   - the builder only renders what is `implemented`, and hides triggers with
 *     no emitter behind them;
 *   - a test asserts the two stay in agreement.
 *
 * ── On `implemented: false` ─────────────────────────────────────────────────
 * One entry is deliberately parked. It is kept in the catalogue with an explicit
 * reason rather than deleted, so the decision is legible:
 *
 *   - `update_record` — the builder exposes no way to say *which record and
 *     which field*. Implementing it would mean guessing a target from the event,
 *     i.e. writing to customer data on an instruction nobody actually gave.
 *
 * `send_email` used to be parked here too, on the stated grounds that the
 * platform had no mail transport. That was wrong: Resend was already sending the
 * password-reset and subscription mail, and the search that concluded otherwise
 * had returned nothing because the search tool itself was broken. It is now
 * implemented, on the same Resend integration (`convex/emails.ts`).
 *
 * This module is pure (no Convex imports) so it can also be imported by the
 * React builder and by unit tests.
 */

/** Ids of every action the builder knows about. */
export const WORKFLOW_ACTION_IDS = [
  'send_notification',
  'create_task',
  'escalate',
  'assign_user',
  'approve_request',
  'reject_request',
  'block_user',
  'webhook',
  'send_email',
  'update_record',
] as const;

export type WorkflowActionId = (typeof WORKFLOW_ACTION_IDS)[number];

export interface WorkflowActionDefinition {
  id: WorkflowActionId;
  /** i18n key under `automation.builder.actionTypes.*`. */
  labelKey: string;
  /** Whether the runner can actually perform it. */
  implemented: boolean;
  /** Why it is not implemented — shown in the builder as a disabled option. */
  unavailableReasonKey?: string;
  /** Parameters the runner reads. Empty object means "uses the event only". */
  reads: readonly string[];
}

export const WORKFLOW_ACTIONS: readonly WorkflowActionDefinition[] = [
  {
    id: 'send_notification',
    labelKey: 'automation.builder.actionTypes.send_notification',
    implemented: true,
    reads: ['userId', 'title', 'message'],
  },
  {
    id: 'create_task',
    labelKey: 'automation.builder.actionTypes.create_task',
    implemented: true,
    reads: ['userId', 'title', 'description', 'priority', 'dueInDays'],
  },
  {
    id: 'escalate',
    labelKey: 'automation.builder.actionTypes.escalate',
    implemented: true,
    reads: ['title', 'message'],
  },
  {
    id: 'assign_user',
    labelKey: 'automation.builder.actionTypes.assign_user',
    implemented: true,
    reads: ['userId', 'taskId'],
  },
  {
    id: 'approve_request',
    labelKey: 'automation.builder.actionTypes.approve_request',
    implemented: true,
    reads: ['requestId', 'comment'],
  },
  {
    id: 'reject_request',
    labelKey: 'automation.builder.actionTypes.reject_request',
    implemented: true,
    reads: ['requestId', 'comment'],
  },
  {
    id: 'block_user',
    labelKey: 'automation.builder.actionTypes.block_user',
    implemented: true,
    reads: ['userId'],
  },
  {
    id: 'webhook',
    labelKey: 'automation.builder.actionTypes.webhook',
    implemented: true,
    reads: [],
  },
  {
    id: 'send_email',
    labelKey: 'automation.builder.actionTypes.send_email',
    implemented: true,
    reads: ['email', 'userId', 'subject', 'body', 'actionUrl', 'actionLabel'],
  },
  {
    id: 'update_record',
    labelKey: 'automation.builder.actionTypes.update_record',
    implemented: false,
    unavailableReasonKey: 'automation.builder.unavailable.update_record',
    reads: ['recordId', 'field', 'value'],
  },
];

/** Action ids the runner can perform — the list it enforces against. */
export const IMPLEMENTED_ACTION_IDS = WORKFLOW_ACTIONS.filter((a) => a.implemented).map(
  (a) => a.id,
);

export function isImplementedAction(value: string): value is WorkflowActionId {
  return IMPLEMENTED_ACTION_IDS.includes(value as WorkflowActionId);
}

/** Catalogue entry for an action id, or undefined when it is unknown entirely. */
export function findWorkflowAction(value: string): WorkflowActionDefinition | undefined {
  return WORKFLOW_ACTIONS.find((a) => a.id === value);
}

// ── Triggers ─────────────────────────────────────────────────────────────────

/** Ids of every trigger the builder knows about. */
export const WORKFLOW_TRIGGER_IDS = [
  'leave_created',
  'leave_approved',
  'leave_rejected',
  'user_onboarded',
  'user_offboarded',
  'ticket_created',
  'ticket_escalated',
  'performance_review_due',
  'probation_ending',
  'contract_expiring',
  'manual',
] as const;

export type WorkflowTriggerId = (typeof WORKFLOW_TRIGGER_IDS)[number];

export interface WorkflowTriggerDefinition {
  id: WorkflowTriggerId;
  /** i18n key under `automation.builder.triggerTypes.*`. */
  labelKey: string;
  /**
   * Whether some code path actually emits this event. A trigger with no emitter
   * is a workflow that can never run, so the builder hides it.
   *
   * `manual` is wired by definition: it is the "Run now" button.
   */
  wired: boolean;
  /**
   * For unwired triggers, what it would take. Kept so the gap is a documented
   * piece of work rather than something somebody rediscovers.
   */
  needsKey?: string;
}

export const WORKFLOW_TRIGGERS: readonly WorkflowTriggerDefinition[] = [
  { id: 'leave_created', labelKey: 'automation.builder.triggerTypes.leave_created', wired: true },
  { id: 'leave_approved', labelKey: 'automation.builder.triggerTypes.leave_approved', wired: true },
  { id: 'leave_rejected', labelKey: 'automation.builder.triggerTypes.leave_rejected', wired: true },
  { id: 'user_onboarded', labelKey: 'automation.builder.triggerTypes.user_onboarded', wired: true },
  {
    id: 'user_offboarded',
    labelKey: 'automation.builder.triggerTypes.user_offboarded',
    wired: true,
  },
  { id: 'ticket_created', labelKey: 'automation.builder.triggerTypes.ticket_created', wired: true },
  {
    id: 'ticket_escalated',
    labelKey: 'automation.builder.triggerTypes.ticket_escalated',
    wired: true,
  },
  {
    id: 'performance_review_due',
    labelKey: 'automation.builder.triggerTypes.performance_review_due',
    wired: true,
  },
  {
    id: 'probation_ending',
    labelKey: 'automation.builder.triggerTypes.probation_ending',
    wired: true,
  },
  { id: 'manual', labelKey: 'automation.builder.triggerTypes.manual', wired: true },
  {
    id: 'contract_expiring',
    labelKey: 'automation.builder.triggerTypes.contract_expiring',
    // Kept in the catalogue with an accurate reason rather than deleted. There is
    // no employment-contract record in the product — no start, no end, no type —
    // so there is no date to watch and no event to emit. Inventing one would mean
    // asking customers to enter contract data to enable a trigger nobody asked
    // for. `probation_ending` is the deadline the product actually has.
    wired: false,
    needsKey: 'automation.builder.needs.contract_expiring',
  },
];

export const WIRED_TRIGGER_IDS = WORKFLOW_TRIGGERS.filter((t) => t.wired).map((t) => t.id);

export function isWiredTrigger(value: string): value is WorkflowTriggerId {
  return WIRED_TRIGGER_IDS.includes(value as WorkflowTriggerId);
}

/**
 * Map a domain event name (as the webhook layer already emits it) onto the
 * automation trigger id the builder writes into a workflow config.
 *
 * The two vocabularies already exist and are already published to customers
 * (`leave.requested`, `employee.created`), so the mapping is translated here
 * rather than forcing either side to rename.
 */
export const DOMAIN_EVENT_TO_TRIGGER: Record<string, WorkflowTriggerId> = {
  'leave.requested': 'leave_created',
  'leave.approved': 'leave_approved',
  'leave.rejected': 'leave_rejected',
  'employee.created': 'user_onboarded',
  'employee.deactivated': 'user_offboarded',
};

export function triggerForDomainEvent(eventType: string): WorkflowTriggerId | undefined {
  return DOMAIN_EVENT_TO_TRIGGER[eventType];
}
