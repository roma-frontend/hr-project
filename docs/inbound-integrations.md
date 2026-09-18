# Inbound integrations (devices and webhooks → Strata)

The mirror image of [`docs/webhooks.md`](./webhooks.md): here a **third party
posts into Strata**. One URL per token, one provider per token:

| Provider  | Who calls it                                              | What happens                                                                  |
| --------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `device`  | an attendance terminal (ZKTeco / Suprema ADMS-style push) | a punch lands in the **journal**; HR confirms it before payroll sees anything |
| `jira`    | a Jira Cloud webhook                                      | an issue event becomes a **task** for the assignee configured on the token    |
| `generic` | anything else                                             | the payload is acknowledged and counted; no mapping is guessed                |

Implementation: `convex/inbound.ts` (tokens, matching, mapping),
`convex/lib/inboundPayload.ts` (vendor-shape parsing), `convex/http.ts` (the
route), tables in `convex/schema/inbound.ts`.

## 1. The token

```
POST https://<your-deployment>.convex.site/api/in/<token>
```

- Created in the app (`inbound.mintInboundToken`), returned **once** — only the
  SHA-256 hash is stored, like an API key.
- Scoped to one organization: the payload can never choose a tenant.
- Disable or revoke it and the URL stops working immediately; punches already in
  the journal stay.

## 2. Attendance hardware

Point the terminal's push/ADMS destination at the token URL. The fields are read
from whichever spelling the firmware uses:

| Fact      | Accepted keys                                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| Employee  | `employeeNumber`, `employee_number`, `emp_code`, `employeeCode`, `employeeNo`, `personnelNumber`, `pin`, `user_id`, `badge` |
| Time      | `timestamp`, `punchTime`, `punch_time`, `punchedAt`, `occurredAt`, `time`, `datetime`                                       |
| Direction | `direction`, `type`, `state`, `punch_state`, `punchState`, `status`                                                         |

Rules that matter in practice:

- **Time**: a bare number is treated as epoch **seconds** or **milliseconds**
  (auto-detected); a string may be ISO with a zone (`2026-09-18T09:01:22Z`) or
  local wall clock (`2026-09-18 09:01:22`), which is resolved as **Armenia
  (UTC+4)** — the same zone attendance scheduling uses, so a punch lands where
  the employee clocked, not where the server happens to run.
- **Direction**: `0`/`in`/`check_in` → in, `1`/`out`/`check_out` → out, anything
  else → unknown (kept, never guessed).
- **Batches**: an array, or an object wrapping one under `punches` / `data` /
  `records` / `items`, is expanded to one journal row per punch.
- **Impossible times** (a device clock set to 1970, or a month in the future) are
  rejected rather than stored — one bad row is cheaper than a payroll mistake.

```bash
# A single punch
curl -X POST "https://<deployment>.convex.site/api/in/inb_xxx" \
  -H 'Content-Type: application/json' \
  -d '{"pin":"1024","timestamp":1787000000,"punch_state":"0"}'
# → {"received":1,"recorded":1,"unmatched":0,"duplicates":0,"total":1}
```

Response codes: `200` stored, `202` accepted but nothing could be read (the
reason is kept on the token — a device that gets a 500 retries the same batch
forever), `400` not JSON, `401/404/403` bad, unknown or disabled token,
`413` payload over 1 MB.

### The journal (why not straight into attendance)

`devicePunches` is evidence, not attendance. `timeTracking` drives lateness,
worked minutes and overtime — i.e. money — so a typo, a duplicated push or a bad
device clock must not be able to write there. Each punch is stored with a status:

| Status      | Meaning                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| `pending`   | matched to an employee by табельный номер, waiting for HR                          |
| `unmatched` | no employee with that number — HR can set the number and the row re-matches itself |
| `duplicate` | same employee, same minute, same direction already stored                          |
| `imported`  | HR promoted it into `timeTracking`                                                 |
| `ignored`   | HR dismissed it (with an optional note)                                            |

HR confirms a punch by calling the **existing** `timeTracking.checkIn` /
`timeTracking.checkOut` with the punch's employee and time, then
`inbound.markPunchImported`. There is exactly one implementation of "what counts
as late" and it stays in `convex/timeTracking.ts`.

### Employee numbers

The табельный номер lives on the user (`users.employeeNumber`). Set it through
`inbound.setEmployeeNumber`, which also refuses a number another employee already
owns (two people sharing one turns every punch into a coin flip) and re-matches
that person's unmatched punches.

## 3. Jira

1. In Jira: **Settings → System → WebHooks → Create**, URL = the token URL,
   events = _Issue created_ (and _updated_ if you want changes tracked).
2. The token needs a **default assignee** (chosen when minting) — the task is
   created for them; Strata never invents an assignee.
3. The task is titled `[HR-42] <summary>` and carries the issue URL and
   description. The same issue key is never turned into a second task, so Jira's
   delivery retries are harmless.
4. If the payload is not an issue event, or the assignee is missing, the reason
   is recorded on the token (`lastError`) instead of creating an empty task.

## 4. What is deliberately not here

- **No arbitrary payload → arbitrary table.** Each provider has an explicit
  mapping; a generic token only acknowledges.
- **No writes into payroll-adjacent tables from the network.** Attendance arrives
  through a person's confirmation.
- **No per-device tokens in the payload.** The token _is_ the device identity —
  rotating it is how a stolen terminal is cut off.
