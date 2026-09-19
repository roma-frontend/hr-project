/**
 * The workflow builder and the workflow runner have to agree.
 *
 * They did not. The builder offered ten action types and ten trigger types from
 * a list of its own; the runner implemented two actions and no automatic
 * triggers. An admin could build "when a leave is requested → send an email",
 * save it, watch it appear in the list as active, and get nothing — forever,
 * silently. There was no error and no clue.
 *
 * Both sides now read `convex/lib/workflowActions.ts`, and these tests are what
 * keep that true:
 *   - an option offered in the UI must resolve to a real translation, in every
 *     language, or the admin sees a raw key;
 *   - an action is either implemented or explicitly explained, never silently
 *     broken;
 *   - a trigger is either wired to code that emits it, or listed disabled with
 *     what it still needs;
 *   - the runner's enforced list is the catalogue's implemented list, not a
 *     second opinion about it.
 */
import fs from 'fs';
import path from 'path';
import {
  WORKFLOW_ACTIONS,
  WORKFLOW_TRIGGERS,
  WORKFLOW_ACTION_IDS,
  WORKFLOW_TRIGGER_IDS,
  IMPLEMENTED_ACTION_IDS,
  WIRED_TRIGGER_IDS,
  DOMAIN_EVENT_TO_TRIGGER,
  isImplementedAction,
  isWiredTrigger,
} from '../../convex/lib/workflowActions';
import { SUPPORTED_ACTIONS } from '../../convex/automationRunner';

const LOCALES = ['en', 'ru', 'hy', 'de'] as const;

function localeJson(lng: string, ns: string): Record<string, unknown> {
  const file = path.join(process.cwd(), 'public', 'locales', lng, `${ns}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/** Resolve a dotted key inside one namespace, or undefined when absent. */
function lookup(lng: string, ns: string, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (acc, part) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
      return undefined;
    },
    localeJson(lng, ns),
  );
}

describe('workflow catalogue', () => {
  it('lists every action exactly once', () => {
    expect(WORKFLOW_ACTIONS.map((a) => a.id).sort()).toEqual([...WORKFLOW_ACTION_IDS].sort());
  });

  it('lists every trigger exactly once', () => {
    expect(WORKFLOW_TRIGGERS.map((t) => t.id).sort()).toEqual([...WORKFLOW_TRIGGER_IDS].sort());
  });

  it('explains every unimplemented action instead of dropping it', () => {
    for (const action of WORKFLOW_ACTIONS) {
      if (action.implemented) {
        expect(action.unavailableReasonKey).toBeUndefined();
      } else {
        // Silence is the failure mode this catalogue exists to prevent: an
        // option that is offered and does nothing. A parked action has to say so.
        expect(typeof action.unavailableReasonKey).toBe('string');
      }
    }
  });

  it('explains every unwired trigger', () => {
    for (const trigger of WORKFLOW_TRIGGERS) {
      if (!trigger.wired) expect(typeof trigger.needsKey).toBe('string');
    }
  });

  it('translates every label, reason and requirement in all four languages', () => {
    const keys: string[] = [];
    for (const action of WORKFLOW_ACTIONS) {
      keys.push(action.labelKey);
      if (action.unavailableReasonKey) keys.push(action.unavailableReasonKey);
    }
    for (const trigger of WORKFLOW_TRIGGERS) {
      keys.push(trigger.labelKey);
      if (trigger.needsKey) keys.push(trigger.needsKey);
    }

    const missing: string[] = [];
    for (const lng of LOCALES) {
      for (const key of keys) {
        // Every key lives under `automation.builder` in `modules.json`.
        const value = lookup(lng, 'modules', key);
        if (typeof value !== 'string' || value.trim() === '') missing.push(`${lng}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('keeps the runner’s enforced list identical to the catalogue', () => {
    // Two lists again is exactly how the builder and the runner drifted apart.
    expect([...SUPPORTED_ACTIONS].sort()).toEqual([...IMPLEMENTED_ACTION_IDS].sort());
  });

  it('agrees with its own membership helpers', () => {
    for (const action of WORKFLOW_ACTIONS) {
      expect(isImplementedAction(action.id)).toBe(action.implemented);
    }
    for (const trigger of WORKFLOW_TRIGGERS) {
      expect(isWiredTrigger(trigger.id)).toBe(trigger.wired);
    }
  });

  it('maps domain events only onto triggers that exist and are wired', () => {
    for (const [domainEvent, triggerId] of Object.entries(DOMAIN_EVENT_TO_TRIGGER)) {
      expect(WORKFLOW_TRIGGER_IDS).toContain(triggerId);
      // A mapping onto an unwired trigger would be a workflow wired to nothing:
      // the emitter fires, the trigger is never matched, and nobody knows.
      expect(WIRED_TRIGGER_IDS).toContain(triggerId);
      expect(domainEvent).toMatch(/^(leave|employee)\./);
    }
  });

  it('records the runner as supporting the nine actions it implements', () => {
    // A pinned list, so a change to it is a deliberate edit here too.
    expect([...IMPLEMENTED_ACTION_IDS]).toEqual([
      'send_notification',
      'create_task',
      'escalate',
      'assign_user',
      'approve_request',
      'reject_request',
      'block_user',
      'webhook',
      'send_email',
    ]);
  });

  it('implements send_email, which was once parked on a wrong premise', () => {
    // It was listed as unavailable because a search claimed the platform had no
    // mail transport. Resend was already sending password-reset and subscription
    // mail; the search had returned nothing because the tool was broken. This
    // test is the tripwire if somebody parks it again without checking.
    const sendEmail = WORKFLOW_ACTIONS.find((a) => a.id === 'send_email');
    expect(sendEmail?.implemented).toBe(true);
    expect(sendEmail?.unavailableReasonKey).toBeUndefined();
    expect(SUPPORTED_ACTIONS).toContain('send_email');
  });
});
