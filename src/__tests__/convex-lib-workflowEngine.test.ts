/**
 * Tests for convex/lib/workflowEngine.ts — the planner that reads a saved
 * workflow config and decides what to do with an event.
 *
 * Before this existed nothing read `automationWorkflows.config` at all, so a
 * "run" was a two-second sleep. These tests are what makes the new behaviour
 * dependable: the plan is what an admin will read to explain why something did or
 * did not happen, and it has to be boringly predictable.
 */

import { describe, it, expect } from '@jest/globals';
import {
  delayToMs,
  evaluateCondition,
  isConditionOperator,
  listensFor,
  normalizeWorkflowConfig,
  planRun,
  readField,
  type WorkflowStep,
} from '../../convex/lib/workflowEngine';

function steps(...list: WorkflowStep[]): { steps: WorkflowStep[] } {
  return { steps: list };
}

const TRIGGER: WorkflowStep = {
  type: 'trigger',
  config: { eventType: 'leave_created', conditions: [] },
  position: 0,
};

function action(actionType: string, parameters: Record<string, unknown> = {}): WorkflowStep {
  return { type: 'action', config: { actionType, parameters }, position: 99 };
}

describe('normalizeWorkflowConfig', () => {
  it('reads the builder shape and orders by position', () => {
    const config = steps({ type: 'action', config: { actionType: 'b' }, position: 2 }, TRIGGER, {
      type: 'action',
      config: { actionType: 'a' },
      position: 1,
    });
    const normalized = normalizeWorkflowConfig(config);
    expect(normalized.map((s) => s.type)).toEqual(['trigger', 'action', 'action']);
    expect(normalized[1]!.config.actionType).toBe('a');
  });

  it('keeps unpositioned steps in array order after positioned ones', () => {
    const normalized = normalizeWorkflowConfig(
      steps(
        { type: 'action', config: { actionType: 'first' } },
        { type: 'action', config: { actionType: 'second' } },
        { type: 'trigger', config: { eventType: 'x' }, position: 0 },
      ),
    );
    expect(normalized[0]!.type).toBe('trigger');
    expect(normalized.slice(1).map((s) => s.config.actionType)).toEqual(['first', 'second']);
  });

  it('understands the legacy { trigger, action } pair shape', () => {
    // Workflows saved before the builder produced a step list must stay runnable.
    const normalized = normalizeWorkflowConfig({
      trigger: { eventType: 'leave_created', conditions: [] },
      action: { actionType: 'send_notification', parameters: {} },
    });
    expect(normalized.map((s) => s.type)).toEqual(['trigger', 'action']);
  });

  it('returns nothing for garbage rather than throwing', () => {
    expect(normalizeWorkflowConfig(null)).toEqual([]);
    expect(normalizeWorkflowConfig('nope')).toEqual([]);
    expect(normalizeWorkflowConfig({ steps: 'not-an-array' })).toEqual([]);
  });

  it('drops entries that are not steps', () => {
    const normalized = normalizeWorkflowConfig({
      steps: [TRIGGER, { type: 'nonsense' }, null, action('send_notification')],
    });
    expect(normalized).toHaveLength(2);
  });
});

describe('readField', () => {
  it('reads a nested path', () => {
    expect(readField({ employee: { department: 'Sales' } }, 'employee.department')).toBe('Sales');
  });

  it('is undefined for a missing path instead of throwing', () => {
    expect(readField({}, 'employee.department')).toBeUndefined();
    expect(readField({ employee: null }, 'employee.department')).toBeUndefined();
  });
});

describe('evaluateCondition', () => {
  const payload = { days: 5, department: 'Sales', note: '', tags: ['urgent', 'legal'] };

  it('compares text with equals/not_equals', () => {
    expect(
      evaluateCondition({ field: 'department', operator: 'equals', value: 'Sales' }, payload),
    ).toBe(true);
    expect(
      evaluateCondition({ field: 'department', operator: 'not_equals', value: 'Sales' }, payload),
    ).toBe(false);
  });

  it('compares numbers numerically, not lexically', () => {
    // "10" > "9" as text; a days threshold must not depend on that.
    expect(
      evaluateCondition({ field: 'days', operator: 'greater_than', value: 9 }, { days: 10 }),
    ).toBe(true);
    expect(
      evaluateCondition({ field: 'days', operator: 'less_than', value: 9 }, { days: 10 }),
    ).toBe(false);
  });

  it('contains works on strings and on arrays', () => {
    expect(
      evaluateCondition({ field: 'department', operator: 'contains', value: 'al' }, payload),
    ).toBe(true);
    expect(
      evaluateCondition({ field: 'tags', operator: 'contains', value: 'urgent' }, payload),
    ).toBe(true);
  });

  it('treats empty string, null, undefined and [] as empty', () => {
    expect(evaluateCondition({ field: 'note', operator: 'is_empty', value: '' }, payload)).toBe(
      true,
    );
    expect(evaluateCondition({ field: 'missing', operator: 'is_empty', value: '' }, payload)).toBe(
      true,
    );
    expect(
      evaluateCondition({ field: 'tags', operator: 'is_empty', value: '' }, { tags: [] }),
    ).toBe(true);
    expect(
      evaluateCondition({ field: 'department', operator: 'is_not_empty', value: '' }, payload),
    ).toBe(true);
  });

  it('fails closed on an unknown operator', () => {
    // A typo must not send notifications.
    expect(evaluateCondition({ field: 'days', operator: 'roughly', value: 5 }, payload)).toBe(
      false,
    );
    expect(evaluateCondition({ field: 'days', operator: undefined, value: 5 }, payload)).toBe(
      false,
    );
  });

  it('fails closed when the field is missing from the condition', () => {
    expect(evaluateCondition({ operator: 'equals', value: 'x' }, payload)).toBe(false);
  });

  it('recognises exactly the operators the builder offers', () => {
    expect(isConditionOperator('equals')).toBe(true);
    expect(isConditionOperator('contains')).toBe(true);
    expect(isConditionOperator('roughly')).toBe(false);
    expect(isConditionOperator(7)).toBe(false);
  });
});

describe('delayToMs', () => {
  it('converts the builder units', () => {
    expect(delayToMs({ duration: 15, unit: 'minutes' })).toBe(900_000);
    expect(delayToMs({ duration: 2, unit: 'hours' })).toBe(7_200_000);
    expect(delayToMs({ duration: 1, unit: 'days' })).toBe(86_400_000);
  });

  it('defaults an unknown unit to minutes rather than zero', () => {
    expect(delayToMs({ duration: 3, unit: 'fortnights' })).toBe(180_000);
  });

  it('is zero for a missing, negative or non-numeric duration', () => {
    expect(delayToMs({})).toBe(0);
    expect(delayToMs({ duration: -5, unit: 'hours' })).toBe(0);
    expect(delayToMs({ duration: 'soon', unit: 'hours' })).toBe(0);
  });

  it('caps a delay at 30 days so a scheduled job cannot be parked forever', () => {
    expect(delayToMs({ duration: 400, unit: 'days' })).toBe(30 * 86_400_000);
  });
});

describe('planRun', () => {
  it('does not run a workflow listening for another event', () => {
    const plan = planRun(steps(TRIGGER, action('send_notification')), {
      type: 'ticket_created',
      payload: {},
    });
    expect(plan.matched).toBe(false);
    expect(plan.reason).toBe('event_mismatch');
  });

  it('does not run a workflow whose trigger has no event type', () => {
    const plan = planRun(
      steps({ type: 'trigger', config: { eventType: '' } }, action('send_notification')),
      { type: 'leave_created', payload: {} },
    );
    expect(plan.reason).toBe('no_event_type');
  });

  it('refuses a config with no trigger at all', () => {
    expect(planRun(steps(action('send_notification')), { type: 'x', payload: {} }).reason).toBe(
      'no_trigger',
    );
  });

  it('refuses an empty config', () => {
    expect(planRun({}, { type: 'x', payload: {} }).reason).toBe('no_steps');
  });

  it('reports no_actions when the flow would do nothing', () => {
    const plan = planRun(steps(TRIGGER), { type: 'leave_created', payload: {} });
    expect(plan.matched).toBe(false);
    expect(plan.reason).toBe('no_actions');
  });

  it('matches and collects the actions in order', () => {
    const plan = planRun(
      steps(
        TRIGGER,
        action('send_notification', { userId: 'u1' }),
        action('create_task', { title: 'T' }),
      ),
      { type: 'leave_created', payload: {} },
    );
    expect(plan.matched).toBe(true);
    expect(plan.reason).toBeNull();
    expect(plan.actions.map((a) => a.actionType)).toEqual(['send_notification', 'create_task']);
    expect(plan.actions[0]!.parameters).toEqual({ userId: 'u1' });
  });

  it('stops at a failing trigger condition and executes nothing', () => {
    const plan = planRun(
      steps(
        {
          type: 'trigger',
          config: {
            eventType: 'leave_created',
            conditions: [{ field: 'days', operator: 'greater_than', value: 10 }],
          },
        },
        action('send_notification'),
      ),
      { type: 'leave_created', payload: { days: 3 } },
    );
    expect(plan.matched).toBe(false);
    expect(plan.reason).toBe('trigger_condition_failed');
    expect(plan.actions).toEqual([]);
  });

  it('runs when every trigger condition passes', () => {
    const plan = planRun(
      steps(
        {
          type: 'trigger',
          config: {
            eventType: 'leave_created',
            conditions: [{ field: 'days', operator: 'greater_than', value: 10 }],
          },
        },
        action('send_notification'),
      ),
      { type: 'leave_created', payload: { days: 14 } },
    );
    expect(plan.matched).toBe(true);
  });

  it('stops at a failing mid-flow condition, keeping nothing planned', () => {
    const plan = planRun(
      steps(
        TRIGGER,
        { type: 'condition', config: { field: 'department', operator: 'equals', value: 'Sales' } },
        action('send_notification'),
      ),
      { type: 'leave_created', payload: { department: 'Legal' } },
    );
    expect(plan.matched).toBe(false);
    expect(plan.reason).toBe('condition_failed');
    expect(plan.actions).toEqual([]);
  });

  it('accumulates delays into the plan', () => {
    const plan = planRun(
      steps(
        TRIGGER,
        { type: 'delay', config: { duration: 30, unit: 'minutes' } },
        action('send_notification'),
        { type: 'delay', config: { duration: 1, unit: 'hours' } },
      ),
      { type: 'leave_created', payload: {} },
    );
    expect(plan.matched).toBe(true);
    expect(plan.totalDelayMs).toBe(90 * 60_000);
  });

  it('skips an action step with no action type but still runs the others', () => {
    const plan = planRun(
      steps(TRIGGER, { type: 'action', config: {} }, action('create_task', { title: 'T' })),
      { type: 'leave_created', payload: {} },
    );
    expect(plan.actions.map((a) => a.actionType)).toEqual(['create_task']);
  });

  it('records a trace an admin can read back', () => {
    const plan = planRun(steps(TRIGGER, action('send_notification')), {
      type: 'leave_created',
      payload: {},
    });
    expect(plan.trace[0]).toMatchObject({ type: 'trigger', outcome: 'trigger_matched' });
    expect(plan.trace.at(-1)).toMatchObject({ type: 'action', outcome: 'planned' });
    // Step indexes point back into the normalised list the runner executed.
    expect(plan.trace.every((entry) => typeof entry.stepIndex === 'number')).toBe(true);
  });
});

/**
 * Stages are what turn a `delay` step into an actual wait.
 *
 * The first version of this engine summed every delay into one number and
 * executed every action immediately — so `action, delay 1h, action` sent both
 * actions at once and the author's delay was decorative. The runner now executes
 * one stage and schedules the next, so the grouping has to be exact.
 */
describe('planRun stages', () => {
  const delay = (duration: number, unit = 'minutes'): WorkflowStep => ({
    type: 'delay',
    config: { duration, unit },
  });

  /**
   * Position steps by their argument order.
   *
   * The shared `action()` helper pins `position: 99`, which is fine when a test
   * has one action and wrong when the point of the test is the order.
   */
  const ordered = (...list: WorkflowStep[]): { steps: WorkflowStep[] } => ({
    steps: list.map((step, index) => ({ ...step, position: index })),
  });

  it('puts actions with nothing between them in one stage', () => {
    const plan = planRun(ordered(TRIGGER, action('a'), action('b')), {
      type: 'leave_created',
      payload: {},
    });
    expect(plan.stages).toHaveLength(1);
    expect(plan.stages[0]!.delayMs).toBe(0);
    expect(plan.stages[0]!.actions.map((a) => a.actionType)).toEqual(['a', 'b']);
  });

  it('splits stages at a delay, so the later action really waits', () => {
    const plan = planRun(ordered(TRIGGER, action('a'), delay(30), action('b')), {
      type: 'leave_created',
      payload: {},
    });
    expect(plan.stages).toHaveLength(2);
    expect(plan.stages[0]!.delayMs).toBe(0);
    expect(plan.stages[0]!.actions.map((a) => a.actionType)).toEqual(['a']);
    expect(plan.stages[1]!.delayMs).toBe(30 * 60_000);
    expect(plan.stages[1]!.actions.map((a) => a.actionType)).toEqual(['b']);
  });

  it('accumulates consecutive delays into the stage that follows them', () => {
    const plan = planRun(ordered(TRIGGER, delay(30), delay(1, 'hours'), action('a')), {
      type: 'leave_created',
      payload: {},
    });
    expect(plan.stages).toHaveLength(1);
    expect(plan.stages[0]!.delayMs).toBe(90 * 60_000);
  });

  it('flattens every stage into `actions`, in execution order', () => {
    const plan = planRun(ordered(TRIGGER, action('a'), delay(10), action('b')), {
      type: 'leave_created',
      payload: {},
    });
    expect(plan.actions.map((a) => a.actionType)).toEqual(['a', 'b']);
    expect(plan.stages.flatMap((s) => s.actions)).toHaveLength(plan.actions.length);
  });

  it('plans nothing at all when a condition fails after a delay', () => {
    const plan = planRun(
      ordered(
        TRIGGER,
        delay(60),
        { type: 'condition', config: { field: 'x', operator: 'equals', value: '1' } },
        action('a'),
      ),
      { type: 'leave_created', payload: { x: '2' } },
    );
    expect(plan.matched).toBe(false);
    expect(plan.reason).toBe('condition_failed');
    // A discarded plan must not leave half a schedule behind for the runner.
    expect(plan.stages).toEqual([]);
    expect(plan.totalDelayMs).toBe(0);
  });

  it('counts a trailing delay in totalDelayMs but schedules no stage for it', () => {
    const plan = planRun(ordered(TRIGGER, delay(15), action('a'), delay(45)), {
      type: 'leave_created',
      payload: {},
    });
    expect(plan.totalDelayMs).toBe(60 * 60_000);
    // One stage only: nothing follows the trailing delay, so there is nothing to
    // wake up for. `stages.length > 1` is how the runner asks this question.
    expect(plan.stages).toHaveLength(1);
  });
});

describe('listensFor', () => {
  it('is a cheap pre-filter for the event type', () => {
    expect(listensFor(steps(TRIGGER), 'leave_created')).toBe(true);
    expect(listensFor(steps(TRIGGER), 'ticket_created')).toBe(false);
    expect(listensFor({}, 'leave_created')).toBe(false);
  });
});
