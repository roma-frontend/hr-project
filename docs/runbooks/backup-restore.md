# Runbook: backup restore drill

> An untested backup is not a backup. This is the procedure to run **quarterly**
> (and after any incident that needed a restore), plus the RTO/RPO we commit to.

## First, the thing that must be said out loud

There are two different things called "backup" in this product, and confusing
them is how a team discovers too late that it has neither:

|                           | What it is                                                                                                                                         | Who restores it                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `employeeBackups` table   | **Per-employee JSON snapshots** the product offers customers (48h retention, `BACKUP_RETENTION_HOURS`). A user restore is `restoreEmployeeBackup`. | The product, in-app                         |
| Deployment-level recovery | The **whole Convex deployment** — every table, every tenant.                                                                                       | Convex Cloud's backup feature (vendor-side) |

**`employeeBackups` is not a database backup.** It cannot reconstruct an
organization after a bad migration or a deleted table. Deployment-level recovery
is Convex's, and the drill below is what turns that vendor checkbox into
something we have actually performed.

## RTO / RPO

| Metric                                 | Target       | What it depends on                                                                      |
| -------------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| **RPO** (data at risk after a loss)    | **24 hours** | Convex Cloud's automated backup cadence for the production deployment.                  |
| **RTO** (time to service after a loss) | **4 hours**  | Creating a staging deployment from the most recent snapshot and pointing the app at it. |

> **Confirm both against the current Convex plan before publishing them to a
> customer.** The figures above match a plan with daily automated backups; a plan
> without them has an RPO of "whatever we exported ourselves" — i.e. none. This
> is a five-minute check in the Convex dashboard, and the answer belongs here.

## The drill

Run against a **staging/dev deployment**, never production. Record the outcome
in the SOC 2 evidence file (`npm run soc2:evidence`).

1. **Pick a snapshot.** In the Convex dashboard, note the timestamp of the most
   recent backup of the production deployment. Record it — that timestamp is the
   RPO you actually had.
2. **Restore elsewhere.** Create a throwaway Convex deployment and restore that
   snapshot into it. Do not touch production.
3. **Count rows in the same breath.** Against the restored deployment, compare
   counts for the core tables against what production had at the snapshot time:
   `organizations`, `users`, `timeRecords`, `leaveRequests`, `payrollRuns`,
   `auditLogs`. Equal counts is the pass condition; "roughly equal" is a fail.
4. **Check a known record end-to-end.** Take one real employee from production,
   confirm their row — and a related attendance row and a payroll row — exists
   in the restore with the same shape. Counts can match while a migration lost a
   field.
5. **Time it.** Record the clock time from "start" to "restore usable". That is
   the RTO you actually have.
6. **Write it down.** Date, snapshot timestamp, row counts, elapsed time,
   anomalies, who ran it. The series is the evidence — one report proves
   nothing.
7. **Tear down** the throwaway deployment.

## After the drill

- If RTO or RPO missed the targets above, either the target or the plan is
  wrong: fix the one that is lying.
- Re-verify the in-app path separately: `restoreEmployeeBackup` returns
  `{ success: true, restoredAt }` and refuses expired snapshots. That path is
  covered by unit tests, but a test is not a tenant's real restore.
- Snapshot age is a real limit: an `employeeBackups` row older than
  `BACKUP_RETENTION_HOURS` is unreadable by design. If a customer asks for a
  month-old copy of an employee record, the answer is the deployment backup, not
  this table.
