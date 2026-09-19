/**
 * Staging area for HR module cron jobs.
 *
 * ⚠️ **Nothing in this file runs.** Convex only registers the `cronJobs()`
 * object exported from `convex/crons.ts`; a `cronJobs()` object exported from
 * any other module is never scheduled. To switch a job on, move it into
 * `crons.ts` (through the shared dispatcher, so the Scheduled Ops console can
 * pause it) and delete it from here.
 *
 * The jobs that used to sit here are now registered, and were removed from this
 * file so a second definition cannot drift out of sync with the live one:
 * performance-deadline-checks, okr-checkin-reminders, survey-auto-activation,
 * survey-auto-closure, asset-warranty-reminders, asset-maintenance-reminders,
 * onboarding-task-activation and onboarding-overdue-reminders.
 *
 * The same trap caught the backup jobs, which lived in a `backups.cron.ts` and
 * therefore never fired at all — see the header of `convex/crons.ts`.
 * `src/__tests__/cronRegistration.test.ts` now fails if a job listed in
 * `CRON_REGISTRY` is not registered in `crons.ts`, and if a key defined here is
 * also registered there.
 */

import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Weekly newsletter (Monday at 9 AM UTC) — dormant: not registered in
// `crons.ts`, so no digest is sent until it is moved there.
crons.weekly(
  'weekly-newsletter',
  { dayOfWeek: 'monday', hourUTC: 9, minuteUTC: 0 },
  internal.newsletter.sendWeeklyDigest,
);

// Newsletter drip campaign (every 12 hours) — dormant for the same reason.
crons.interval('newsletter-drip', { hours: 12 }, internal.newsletter.processDripCampaign);

export default crons;
