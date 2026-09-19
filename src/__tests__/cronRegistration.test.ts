/**
 * Cron registration parity.
 *
 * Convex registers exactly one `cronJobs()` object: the one exported from
 * `convex/crons.ts`. A job defined in any other file never fires — and the
 * failure is completely silent. Nothing errors, no test goes red, and every
 * human artifact keeps confirming the job: the docs, the product copy, the
 * operator console.
 *
 * That is not hypothetical. The backup jobs lived in `convex/backups.cron.ts`,
 * so "automated employee backups (48h retention)" was copy and a compliance
 * checkbox with no scheduler behind it: no snapshot was ever created and
 * expired ones were never purged.
 *
 * A job key has to appear in three separate places, which is why this is
 * asserted from source text rather than from one exported list:
 *   1. `crons.ts`            — the job is actually scheduled;
 *   2. `dispatchCron`'s `case` — the dispatch resolves to real work (otherwise
 *      the dispatcher throws "Unknown cron job key" on every tick, at runtime,
 *      where only Convex logs see it);
 *   3. `CRON_REGISTRY`       — the console can list and pause it.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CRONS_FILE = 'convex/crons.ts';
const DISPATCH_FILE = 'convex/superadmin/operatorTools.ts';

/** Staging files that intentionally define jobs nothing registers. */
const DORMANT_CRON_FILES = ['convex/hrCronJobs.ts'];

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

/** `jobKey: 'x'` — in `crons.ts` the dispatch arg, in operatorTools the registry. */
function jobKeys(src: string): string[] {
  return [...src.matchAll(/jobKey:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
}

/** `case 'x':` inside `dispatchCron`'s switch. */
function dispatchCases(src: string): string[] {
  return [...src.matchAll(/case '([a-z0-9-]+)':/g)].map((m) => m[1]);
}

/** `crons.daily('x', …)` — the job name a dormant file would register. */
function declaredCronNames(src: string): string[] {
  return [...src.matchAll(/crons\.(?:daily|weekly|interval|hourly)\(\s*'([a-z0-9-]+)'/g)].map(
    (m) => m[1],
  );
}

const registered = jobKeys(read(CRONS_FILE));
const dispatched = dispatchCases(read(DISPATCH_FILE));
const registry = jobKeys(read(DISPATCH_FILE));

describe('cron registration', () => {
  it('finds a non-trivial number of jobs (the parser itself is not the test)', () => {
    expect(registered.length).toBeGreaterThan(15);
    expect(registry.length).toBe(registered.length);
  });

  it('schedules every job the operator console lists', () => {
    // A registry entry with no registration is the dead-control bug: the
    // console shows a job, an operator pauses it, and nothing was ever running.
    const unscheduled = registry.filter((key) => !registered.includes(key));
    expect(unscheduled).toEqual([]);
  });

  it('resolves every listed job to real work in the dispatcher', () => {
    // Without a case, the tick throws and the only trace is a registry row with
    // outcome `error` — which nobody reads until something is already broken.
    const unresolved = registry.filter((key) => !dispatched.includes(key));
    expect(unresolved).toEqual([]);
  });

  it('lists every scheduled job in the console, so every job can be paused', () => {
    const invisible = registered.filter((key) => !registry.includes(key));
    expect(invisible).toEqual([]);
  });

  it('keeps the backup jobs registered — they are the retention window in the copy', () => {
    for (const key of ['backup-all-enterprise-orgs', 'cleanup-expired-backups']) {
      expect(registered).toContain(key);
      expect(dispatched).toContain(key);
      expect(registry).toContain(key);
    }
    // And they are not tucked back into a cron file of their own: only
    // `crons.ts` may declare them, or the scheduler silently ignores them again.
    const offenders = cronFiles().filter(
      (file) => file !== CRONS_FILE && read(file).includes('backup-all-enterprise-orgs'),
    );
    expect(offenders).toEqual([]);
  });

  it('never registers a job that a dormant staging file also declares', () => {
    // Two definitions of one job key drift apart, and the stale one is the one
    // a reader will find first (it has the nicer comment). If a staged job is
    // switched on, it is moved into `crons.ts` and removed from the staging file.
    for (const file of DORMANT_CRON_FILES) {
      const duplicated = declaredCronNames(read(file)).filter((key) => registered.includes(key));
      expect({ file, duplicated }).toEqual({ file, duplicated: [] });
    }
  });
});

/** Every file under `convex/` that declares a `cronJobs()` object. */
function cronFiles(): string[] {
  return readdirSync(join(ROOT, 'convex'))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => `convex/${name}`)
    .filter((path) => read(path).includes('cronJobs('));
}

describe('cron files', () => {
  it('declares crons in crons.ts and in no file outside the staging allow-list', () => {
    // A new `*.cron.ts` file is a job that will never run. If one is genuinely
    // needed as a staging area, add it to DORMANT_CRON_FILES on purpose.
    const unexpected = cronFiles().filter(
      (file) => file !== CRONS_FILE && !DORMANT_CRON_FILES.includes(file),
    );
    expect(unexpected).toEqual([]);
  });
});
