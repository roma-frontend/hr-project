/**
 * Scheduled jobs for HR modules:
 * - Performance review deadline notifications
 * - OKR weekly check-in reminders
 * - Survey auto-activation/closure
 * - Onboarding task activation & overdue reminders
 */

import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Check for performance review deadlines approaching (daily at 9 AM)
crons.daily(
  'performance-deadline-checks',
  { hourUTC: 9, minuteUTC: 0 },
  internal.performance.checkDeadlineNotifications,
);

// OKR weekly check-in reminders (Monday at 10 AM)
crons.weekly(
  'okr-checkin-reminders',
  { dayOfWeek: 'monday', hourUTC: 10, minuteUTC: 0 },
  internal.goals.sendWeeklyCheckinReminders,
);

// Survey auto-activation (every hour)
crons.interval('survey-auto-activation', { hours: 1 }, internal.surveys.activateScheduledSurveys);

// Survey auto-closure (every hour)
crons.interval('survey-auto-closure', { hours: 1 }, internal.surveys.closeExpiredSurveys);

// Onboarding task activation (every hour)
crons.interval(
  'onboarding-task-activation',
  { hours: 1 },
  internal.onboarding.activateOnboardingTasks,
);

// Onboarding overdue task reminders (daily at 9 AM)
crons.daily(
  'onboarding-overdue-reminders',
  { hourUTC: 9, minuteUTC: 0 },
  internal.onboarding.sendOnboardingOverdueReminders,
);

// Weekly newsletter (Monday at 9 AM UTC)
crons.weekly(
  'weekly-newsletter',
  { dayOfWeek: 'monday', hourUTC: 9, minuteUTC: 0 },
  internal.newsletter.sendWeeklyDigest,
);

export default crons;
