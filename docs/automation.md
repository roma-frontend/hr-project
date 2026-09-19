# Workflow automation

Admins build workflows in **/automation**: drag a trigger, conditions, delays and
actions into a list, save, and it runs. This document covers what actually
happens, which parts are deliberate, and — most importantly — what is _not_
implemented and how the product says so.

| Piece                                                      | File                                                |
| ---------------------------------------------------------- | --------------------------------------------------- |
| Catalogue of actions and triggers (single source of truth) | `convex/lib/workflowActions.ts`                     |
| Planner — config + event in, execution plan out (pure)     | `convex/lib/workflowEngine.ts`                      |
| Runner — performs the plan, records the trace              | `convex/automationRunner.ts`                        |
| Domain-event fan-out into workflows                        | `convex/lib/webhookEvents.ts`                       |
| Builder UI                                                 | `src/components/workflow/WorkflowBuilderClient.tsx` |
| Tenant page                                                | `src/app/(dashboard)/automation/page.tsx`           |

---

## 1. The honesty rule

The builder and the runner read the **same catalogue**. This is not stylistic.

They used to disagree: the builder offered ten action types and ten triggers, the
runner implemented two actions and zero automatic triggers. An admin could build
"when a leave is requested → send an email", save it, see it listed as active, and
get nothing — with no error and no clue. The builder was consequently kept away
from tenants, because exposing a builder whose output never executes is worse
than not exposing it.

Now:

- the builder renders only `implemented` actions, and lists unwired triggers
  **disabled with the reason** rather than hiding them;
- the runner refuses anything not `implemented`;
- `src/__tests__/workflowCatalogue.test.ts` fails if the two lists drift, if a
  label or reason is missing in any of the four languages, or if a domain event
  is mapped onto a trigger nothing emits.

Anything that reaches the runner unimplemented is recorded as `unsupported` in
the run result — never dropped silently.

---

## 2. Actions

Nine implemented:

| Action              | What it does                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `send_email`        | Queues transactional email through Resend (`convex/emails.ts`); see `docs/email.md`. The run records `queued`, not `done`. |
| `send_notification` | In-app notification to an explicit `userId`, else the event's user. No broadcast fallback.                                 |
| `create_task`       | Inserts a task assigned to the resolved user, with priority and optional deadline.                                         |
| `escalate`          | Notifies every org admin **and** the workflow's author.                                                                    |
| `assign_user`       | Reassigns an existing task (`taskId` + `userId`).                                                                          |
| `approve_request`   | Approves a pending leave request through the real approval pipeline.                                                       |
| `reject_request`    | Rejects a pending leave request, same pipeline.                                                                            |
| `block_user`        | Deactivates an account. Requires an explicit `userId` — see below.                                                         |
| `webhook`           | Emits `workflow.triggered` to the org's registered endpoints.                                                              |

One parked, with the reason surfaced in the UI:

| Action          | Why not                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `update_record` | The builder has no way to express _which record and which field_. Implementing it would mean guessing a target from the event — i.e. writing to customer data on an instruction nobody gave. |

`send_email` was parked here too, on the stated grounds that the platform had no
mail transport. **That was wrong.** Resend was already sending the password-reset
and subscription mail, and is already named as a subprocessor. The search that
concluded otherwise returned nothing because the search tool was broken, and the
conclusion was drawn from an empty result instead of a verification. It is now
implemented on that same integration; `src/__tests__/workflowCatalogue.test.ts`
asserts it stays implemented.

### Approvals go through the real pipeline

`approve_request` / `reject_request` call `approveLeaveInternal` /
`rejectLeaveInternal` (`convex/leaves/mutations.ts`), which are the same core the
UI's `approveLeave` / `rejectLeave` delegate to.

This was extracted rather than duplicated on purpose. Approving a leave deducts
the balance, closes the SLA metric, writes the audit entry, refreshes the HR
assistant digest and schedules the countersignature document. A second
implementation in the runner would drift, and the first thing to drift would be
the balance arithmetic.

Two consequences worth knowing:

- **`assertMayReview` still runs.** A workflow approves _as the admin who
  configured it_, so a rule that reaches outside that admin's reporting line is
  refused. The refusal is recorded as the action's outcome with the pipeline's
  own error message — "you are not allowed to do this" is more useful than a
  silent success.
- **The audit log distinguishes it.** An automated decision is written as
  `leave_automation_approved` / `leave_automation_rejected` with the workflow name
  attached, so a machine decision never looks like a human click.

### Why `block_user` only reads its own parameter

Deactivating an account is not recoverable if it happens to the wrong person.
`block_user` therefore reads `parameters.userId` and never falls back to the
event's user, and it refuses to deactivate the workflow's own author. Everything
else about it is audited (`user_deactivated_by_automation`).

### Parameters are a form, not JSON

The builder renders real fields per action — a person picker for `userId`, a list
of pending leave requests for `requestId`, a task list for `taskId`, a priority
select, and text/textarea/number/URL inputs for the rest. Before this, the only
field any action had was a free-text `recipient`, and everything else had to be
typed as raw JSON by hand, including the ids of leave requests.

The field definitions live in `ACTION_PARAM_FIELDS` in the builder and mirror
`reads` in `convex/lib/workflowActions.ts`. An **Advanced parameters (JSON)**
disclosure stays available so a parameter with no field is still reachable;
invalid JSON is reported rather than silently dropped.

When `send_email` is selected and the deployment has no mail configuration, the
step shows a warning naming the reason instead of failing at run time.

### Why `webhook` does not POST to a URL

It emits into the registered-endpoint pipeline (`convex/webhooks/main.ts`), which
already signs, retries with backoff, dead-letters and audits. The alternative —
holding an arbitrary URL in the config and POSTing to it from the server — turns
an automation into a request-forgery primitive pointed at arbitrary hosts.

Register the destination in **Settings → Webhooks**; the workflow then triggers it.

---

## 3. Triggers

Wired (an emitter exists today):

| Trigger                  | Emitted from                                                   |
| ------------------------ | -------------------------------------------------------------- |
| `leave_created`          | `createLeave`, via `emitLeaveEvent(ctx, 'leave.requested', …)` |
| `leave_approved`         | both approve paths (manual and auto-approval)                  |
| `leave_rejected`         | `rejectLeave`                                                  |
| `user_onboarded`         | employee creation                                              |
| `user_offboarded`        | both deactivate paths                                          |
| `ticket_created`         | ticket creation                                                |
| `ticket_escalated`       | the SLA sweep, when a ticket breaches its target               |
| `performance_review_due` | the review cron, when a review falls due                       |
| `probation_ending`       | the probation reminder sweep                                   |
| `manual`                 | the "Run now" button                                           |

Not wired, listed disabled with what it needs:

| Trigger             | Needs                  |
| ------------------- | ---------------------- |
| `contract_expiring` | a contract-expiry scan |

`contract_expiring` is the one entry here that used to describe four. Its three
neighbours (`ticket_*`, `performance_review_due`) were listed as "needs an
emitter" and now have one, because the emitter was the honest piece of work.
`contract_expiring` was not in that position: the platform tracks probation end
dates and has a sweep for them, but no contract-expiry scan, so the trigger
named a job nobody runs. It stays in the catalogue marked unwired — a gap the
builder shows is one somebody can close, and one it hides is not — and
`probation_ending` covers the reminder it was reaching for.

**Who a run is attributed to.** The workflow's author (`createdBy`). That is the
person whose rule it is and whose name has to appear in the audit trail of an
automated approval. Legacy rows without an author fall back to an org admin; an
organisation with no admin cannot run automations, and the run records `no_actor`.

---

## 4. Delays

`planRun` splits a workflow into **stages**. `action, delay 1h, action` becomes
two stages: the runner executes the first immediately, then parks the remainder in
`automationPendingRuns` and schedules itself to resume.

So a delay means what it says. The first version of this engine summed every delay
into one number and ran every action at once, which made the delay decorative.

Notes:

- Actions with no delay between them share a stage, so a five-step workflow costs
  one job, not five.
- Delays are capped at 30 days (`delayToMs`).
- A trailing delay with nothing after it is counted in `totalDelayMs` but
  schedules no stage — nothing follows it, so there is nothing to wake up for.
  `plan.stages.length > 1` is the question "will a continuation be parked?".
- On resume, the run is **dropped** if the workflow was paused or deleted in the
  meantime. A delay is not a licence to execute a workflow somebody switched off.
- The event payload is not re-injected on resume: re-running conditions against a
  re-read of live data is how an automation starts acting on facts nobody
  approved.

---

## 5. Semantics of the linear list

The builder produces a list, not a graph, and the engine reads it as one:

1. The trigger's `eventType` must equal the incoming event type.
2. The trigger's own `conditions` must all pass.
3. Remaining steps run in `position` order.
   - A `condition` that fails **stops the run** — later steps are skipped. With no
     branch to take, the alternative would be "continue anyway", which would make
     a condition decorative.
   - A `delay` adds to the wait before the next action.
   - An `action` is collected for execution.

A condition with an unknown operator is treated as **not matching**: failing
closed is the only safe direction, since a silently-passing condition would send
notifications (or approve requests) on a rule nobody wrote.

---

## 6. Runs and tracing

Every run writes an `automationTasks` row containing `{ trace, actions, delayMs }`:

- `trace` — every step considered, with the outcome (`trigger_matched`,
  `passed`, `skipped`, `failed`, `planned`) and a detail string, so an admin can
  see _why_ step 3 was skipped rather than wonder whether the automation ran.
- `actions` — per-action status: `done`, `skipped` (with a stable machine-readable
  `reason` such as `no_recipient`, `recipient_not_in_organization`,
  `no_webhook_endpoint`), `unsupported`, or `failed`.
- A run with a pending continuation stays `running` until its last stage runs; the
  manual run returns `scheduled: true` so the UI says "started", not "done".

---

## 7. Plan gating

The `automation` module is gated on read _and_ write (`assertModuleAccess`), and
every write is scoped to the caller's organisation. Platform-level rows (no
`organizationId`) are superadmin-only in both directions — a tenant admin must
never be able to trigger a platform workflow against their own data.
