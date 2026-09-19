/**
 * workflowEngine — decides *what a workflow should do*, without doing it.
 *
 * The builder (`src/components/workflow/WorkflowBuilderClient.tsx`) saves a
 * linear list of steps — one trigger, then any number of condition / delay /
 * action steps — as `automationWorkflows.config`. Until now nothing read that
 * config: a "run" inserted a task row, waited two seconds and marked it
 * complete, which is why the builder was deliberately kept out of tenant hands
 * (see the note in `automationActions.ts`). Exposing a builder whose output never
 * executes is worse than not showing it.
 *
 * This module is the missing half. It is pure: config + event in, an execution
 * plan out. That matters because the plan is what an auditor reads — "this leave
 * notification was sent because step 3 matched" — and because a planner that can
 * be unit-tested is a planner that cannot silently change behaviour when a
 * dropdown gains an option.
 *
 * ── Semantics (linear, deliberately) ────────────────────────────────────────
 * The builder produces a list, not a graph, so the engine reads it as one:
 *
 *   1. The trigger's `eventType` must equal the incoming event's type.
 *   2. The trigger's own `conditions` must all pass.
 *   3. Remaining steps run in `position` order.
 *      - `condition` that fails stops the run (later steps are skipped).
 *      - `delay` accumulates into the plan; the caller decides how to honour it.
 *      - `action` is collected for execution.
 *
 * A failing condition stopping the run is the predictable choice for a linear
 * list: there is no branch to take, so the alternative would be "continue anyway",
 * which would make `condition` decorative.
 *
 * Nothing here executes anything, and nothing here decides whether an action is
 * *supported* — the runner owns that, and must report unsupported actions out
 * loud rather than dropping them.
 */

// ── Config shape (as the builder saves it) ───────────────────────────────────

export type WorkflowStepType = 'trigger' | 'action' | 'condition' | 'delay';

export interface WorkflowStep {
  id?: string;
  type: WorkflowStepType;
  /** `{ eventType, conditions }`, `{ actionType, parameters }`, … */
  config: Record<string, unknown>;
  position?: number;
}

/** One action the caller should perform. */
export interface PlannedAction {
  /** Index within the normalised step list — appears in the run trace. */
  stepIndex: number;
  actionType: string;
  parameters: Record<string, unknown>;
}

/**
 * A group of actions that run together after waiting `delayMs`.
 *
 * The linear list can interleave delays and actions — `action, delay 1h,
 * action` — and that has to mean the second action runs an hour later, not that
 * both run at once and the delay is decorative. Grouping into stages is how the
 * plan carries that: the runner executes a stage, then schedules the next one
 * `delayMs` in the future. Actions with no delay between them share a stage so a
 * five-step workflow costs one job, not five.
 */
export interface PlanStage {
  /** Milliseconds to wait *before* this stage's actions run. Stage 0 is 0. */
  delayMs: number;
  actions: PlannedAction[];
}

export type PlanReason =
  | 'no_steps'
  | 'no_trigger'
  | 'no_event_type'
  | 'event_mismatch'
  | 'trigger_condition_failed'
  | 'condition_failed'
  | 'no_actions'
  /**
   * The plan matched, but nothing could be attributed to it — there is no
   * author to record as the reviewer/assigner. Set by the runner, not here; it
   * lives in this union because it travels in the same `reason` field.
   */
  | 'no_actor';

export interface WorkflowPlan {
  matched: boolean;
  /** Why it did not run; null when it did match. */
  reason: PlanReason | null;
  /** Every action, flattened across stages — for callers that ignore timing. */
  actions: PlannedAction[];
  /** Actions in execution order, grouped by the wait before each group. */
  stages: PlanStage[];
  /**
   * Every delay step the author wrote, summed — including a trailing one with
   * nothing after it, which describes how long the workflow takes to be
   * considered finished rather than when any action runs.
   *
   * Not the same as "time until the last action": the execution timing is the
   * `delayMs` on each stage. Use `stages.length > 1` to ask whether the runner
   * will actually park a continuation.
   */
  totalDelayMs: number;
  /** Human-readable trace of every step considered — goes into the run record. */
  trace: PlanTraceEntry[];
}

/** Convenience for the early-return paths below: no match, no actions, no stages. */
function noMatch(reason: PlanReason, trace: PlanTraceEntry[]): WorkflowPlan {
  return { matched: false, reason, actions: [], stages: [], totalDelayMs: 0, trace };
}

export interface PlanTraceEntry {
  stepIndex: number;
  type: WorkflowStepType;
  outcome: 'trigger_matched' | 'passed' | 'skipped' | 'failed' | 'planned';
  detail?: string;
}

const OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty',
] as const;

export type ConditionOperator = (typeof OPERATORS)[number];

/** True when `value` is one of the operators the builder offers. */
export function isConditionOperator(value: unknown): value is ConditionOperator {
  return typeof value === 'string' && (OPERATORS as readonly string[]).includes(value);
}

// ── Normalisation ────────────────────────────────────────────────────────────

/**
 * Read the saved config into an ordered step list.
 *
 * Two shapes must be understood. The builder saves `{ steps: [...] }` today;
 * older rows (and the manual-run path that predates the builder) saved a
 * `{ trigger, action }` pair with no step list at all. Both describe the same
 * intent, so both are accepted — a workflow that saved fine should not become
 * unrunnable because the editor changed.
 */
export function normalizeWorkflowConfig(config: unknown): WorkflowStep[] {
  if (!config || typeof config !== 'object') return [];
  const record = config as Record<string, unknown>;

  if (Array.isArray(record.steps)) {
    const steps = record.steps
      .filter((step): step is WorkflowStep => isStep(step))
      .map((step) => ({
        id: typeof step.id === 'string' ? step.id : undefined,
        type: step.type,
        config:
          step.config && typeof step.config === 'object'
            ? (step.config as Record<string, unknown>)
            : {},
        position: typeof step.position === 'number' ? step.position : undefined,
      }));
    return sortByPosition(steps);
  }

  // Legacy pair shape: { trigger: {...}, action: {...} }
  const legacy: WorkflowStep[] = [];
  if (record.trigger && typeof record.trigger === 'object') {
    legacy.push({
      type: 'trigger',
      config: record.trigger as Record<string, unknown>,
      position: 0,
    });
  }
  if (record.action && typeof record.action === 'object') {
    legacy.push({ type: 'action', config: record.action as Record<string, unknown>, position: 1 });
  }
  return legacy;
}

function isStep(value: unknown): value is WorkflowStep {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return type === 'trigger' || type === 'action' || type === 'condition' || type === 'delay';
}

/**
 * Order steps the way the builder shows them. `position` is the author's order;
 * steps without one keep their array order *after* positioned ones, so a
 * half-saved config still runs in a stable sequence instead of a random one.
 */
function sortByPosition(steps: WorkflowStep[]): WorkflowStep[] {
  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => {
      const pa = a.step.position ?? Number.MAX_SAFE_INTEGER;
      const pb = b.step.position ?? Number.MAX_SAFE_INTEGER;
      return pa - pb || a.index - b.index;
    })
    .map(({ step }) => step);
}

// ── Condition evaluation ─────────────────────────────────────────────────────

/** Read a possibly nested field (`employee.department`) from the event payload. */
export function readField(payload: Record<string, unknown>, field: string): unknown {
  if (!field) return undefined;
  return field.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, payload);
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Compare numerically when both sides look like numbers, else compare as text. */
function compareOrdered(value: unknown, expected: unknown): number | null {
  const left = Number(value);
  const right = Number(expected);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return left - right;
}

/**
 * Evaluate one condition against an event payload.
 *
 * A condition with an unknown operator is treated as *not* matching. Failing
 * closed is the only safe direction here: an unrecognised operator silently
 * passing would send notifications (or approve requests) on a rule nobody wrote.
 */
export function evaluateCondition(
  condition: { field?: unknown; operator?: unknown; value?: unknown },
  payload: Record<string, unknown>,
): boolean {
  const field = typeof condition.field === 'string' ? condition.field : '';
  if (!field) return false;
  const operator = condition.operator;
  if (!isConditionOperator(operator)) return false;

  const actual = readField(payload, field);
  const expected = condition.value;

  switch (operator) {
    case 'is_empty':
      return isEmptyValue(actual);
    case 'is_not_empty':
      return !isEmptyValue(actual);
    case 'equals':
      return String(actual ?? '') === String(expected ?? '');
    case 'not_equals':
      return String(actual ?? '') !== String(expected ?? '');
    case 'contains': {
      if (Array.isArray(actual)) return actual.map(String).includes(String(expected ?? ''));
      return String(actual ?? '').includes(String(expected ?? ''));
    }
    case 'greater_than': {
      const diff = compareOrdered(actual, expected);
      return diff !== null && diff > 0;
    }
    case 'less_than': {
      const diff = compareOrdered(actual, expected);
      return diff !== null && diff < 0;
    }
    default:
      return false;
  }
}

// ── Delays ───────────────────────────────────────────────────────────────────

const UNIT_MS: Record<string, number> = {
  minutes: 60_000,
  hours: 60 * 60_000,
  days: 24 * 60 * 60_000,
};

/**
 * Delay in ms, capped at 30 days.
 *
 * A delay is a promise the runner has to keep with a scheduled job, so an
 * unbounded value (or a negative one, or `Infinity` from a stray input) must not
 * reach it — the cap is the difference between a slow workflow and a stuck one.
 */
export function delayToMs(config: Record<string, unknown>): number {
  const duration = Number(config.duration);
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const unit = typeof config.unit === 'string' ? config.unit : 'minutes';
  const perUnit = UNIT_MS[unit] ?? UNIT_MS.minutes!;
  const MAX = 30 * 24 * 60 * 60 * 1000;
  return Math.min(Math.round(duration) * perUnit, MAX);
}

// ── Planning ─────────────────────────────────────────────────────────────────

export interface WorkflowEvent {
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Plan a run of one workflow for one event.
 *
 * Returning `matched: false` with a reason is a first-class outcome, not an
 * error: the runner evaluates every workflow of an organisation against every
 * event, and "this one did not apply" is the normal case.
 */
export function planRun(config: unknown, event: WorkflowEvent): WorkflowPlan {
  const steps = normalizeWorkflowConfig(config);
  const trace: PlanTraceEntry[] = [];

  if (steps.length === 0) {
    return noMatch('no_steps', trace);
  }

  const triggerIndex = steps.findIndex((step) => step.type === 'trigger');
  if (triggerIndex === -1) {
    return noMatch('no_trigger', trace);
  }

  const trigger = steps[triggerIndex]!;
  const eventType = typeof trigger.config.eventType === 'string' ? trigger.config.eventType : '';
  if (!eventType) {
    trace.push({
      stepIndex: triggerIndex,
      type: 'trigger',
      outcome: 'skipped',
      detail: 'no event type',
    });
    return noMatch('no_event_type', trace);
  }
  if (eventType !== event.type) {
    return noMatch('event_mismatch', trace);
  }
  trace.push({
    stepIndex: triggerIndex,
    type: 'trigger',
    outcome: 'trigger_matched',
    detail: eventType,
  });

  const conditions = Array.isArray(trigger.config.conditions) ? trigger.config.conditions : [];
  for (const condition of conditions) {
    const ok =
      condition && typeof condition === 'object'
        ? evaluateCondition(condition as Record<string, unknown>, event.payload)
        : false;
    if (!ok) {
      trace.push({
        stepIndex: triggerIndex,
        type: 'trigger',
        outcome: 'failed',
        detail: 'trigger condition',
      });
      return noMatch('trigger_condition_failed', trace);
    }
  }
  if (conditions.length > 0) {
    trace.push({
      stepIndex: triggerIndex,
      type: 'trigger',
      outcome: 'passed',
      detail: `${conditions.length} condition(s)`,
    });
  }

  const stages: PlanStage[] = [];
  let current: PlanStage = { delayMs: 0, actions: [] };
  let pendingDelayMs = 0;
  let totalDelayMs = 0;

  /** Close the open stage, if it collected anything. */
  const flush = () => {
    if (current.actions.length > 0) stages.push(current);
  };

  for (let index = 0; index < steps.length; index += 1) {
    if (index === triggerIndex) continue;
    const step = steps[index]!;

    if (step.type === 'condition') {
      if (!evaluateCondition(step.config, event.payload)) {
        trace.push({ stepIndex: index, type: 'condition', outcome: 'failed' });
        // Nothing has run yet at this point — stages are executed by the caller
        // only after a matched plan, so discarding them costs nothing.
        return noMatch('condition_failed', trace);
      }
      trace.push({ stepIndex: index, type: 'condition', outcome: 'passed' });
      continue;
    }

    if (step.type === 'delay') {
      const ms = delayToMs(step.config);
      pendingDelayMs += ms;
      totalDelayMs += ms;
      trace.push({ stepIndex: index, type: 'delay', outcome: 'passed', detail: `${ms}ms` });
      continue;
    }

    if (step.type === 'action') {
      const actionType = typeof step.config.actionType === 'string' ? step.config.actionType : '';
      if (!actionType) {
        trace.push({
          stepIndex: index,
          type: 'action',
          outcome: 'skipped',
          detail: 'no action type',
        });
        continue;
      }
      // A delay between two actions splits them into separate stages, so the
      // wait is honoured instead of being folded into a single instant.
      if (pendingDelayMs > 0) {
        flush();
        current = { delayMs: pendingDelayMs, actions: [] };
        pendingDelayMs = 0;
      }
      current.actions.push({
        stepIndex: index,
        actionType,
        parameters:
          step.config.parameters && typeof step.config.parameters === 'object'
            ? (step.config.parameters as Record<string, unknown>)
            : {},
      });
      trace.push({ stepIndex: index, type: 'action', outcome: 'planned', detail: actionType });
    }
  }
  flush();

  const actions = stages.flatMap((stage) => stage.actions);
  if (actions.length === 0) {
    return noMatch('no_actions', trace);
  }

  return { matched: true, reason: null, actions, stages, totalDelayMs, trace };
}

/** True when the workflow listens for this event type — cheap pre-filter. */
export function listensFor(config: unknown, eventType: string): boolean {
  const steps = normalizeWorkflowConfig(config);
  const trigger = steps.find((step) => step.type === 'trigger');
  return !!trigger && trigger.config.eventType === eventType;
}
