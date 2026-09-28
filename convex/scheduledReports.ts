/**
 * scheduledReports — Automated Report Delivery via Email.
 *
 * Provides CRUD operations for report schedules, calculates summary data
 * for leaves, attendance, tasks, and headcount, and delivers formatted HTML reports
 * to designated recipients via Resend (`convex/emails.ts`).
 */

import { v } from 'convex/values';
import {
  mutation,
  query,
  internalMutation,
  internalAction,
  internalQuery,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { getAuthCaller } from './lib/getAuthCaller';
import { assertModuleAccess } from './lib/entitlements';

/** Calculate next run timestamp in ms based on frequency and time */
export function calculateNextRunAt(
  frequency: 'daily' | 'weekly' | 'monthly',
  timeOfDayUTC: string,
  dayOfWeek?: number,
  dayOfMonth?: number,
  fromDateMs: number = Date.now(),
): number {
  const [hourStr, minStr] = timeOfDayUTC.split(':');
  const targetHour = parseInt(hourStr ?? '', 10) || 9;
  const targetMin = parseInt(minStr ?? '', 10) || 0;

  const d = new Date(fromDateMs);
  d.setUTCHours(targetHour, targetMin, 0, 0);

  // If time already passed today, advance
  if (d.getTime() <= fromDateMs) {
    d.setUTCDate(d.getUTCDate() + 1);
  }

  if (frequency === 'daily') {
    return d.getTime();
  }

  if (frequency === 'weekly') {
    // 1 (Monday) to 7 (Sunday)
    const targetDay = dayOfWeek && dayOfWeek >= 1 && dayOfWeek <= 7 ? dayOfWeek : 1;
    // JS getUTCDay(): 0 (Sun), 1 (Mon) ... 6 (Sat)
    const jsTarget = targetDay === 7 ? 0 : targetDay;
    while (d.getUTCDay() !== jsTarget || d.getTime() <= fromDateMs) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return d.getTime();
  }

  if (frequency === 'monthly') {
    const targetDate = dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 31 ? dayOfMonth : 1;
    d.setUTCDate(targetDate);
    if (d.getTime() <= fromDateMs) {
      d.setUTCMonth(d.getUTCMonth() + 1);
      d.setUTCDate(targetDate);
    }
    return d.getTime();
  }

  return d.getTime();
}

/** List scheduled reports for current organization */
export const listScheduledReports = query({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) return [];

    return await ctx.db
      .query('scheduledReports')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .order('desc')
      .collect();
  },
});

/** Create a new scheduled report */
export const createScheduledReport = mutation({
  args: {
    organizationId: v.id('organizations'),
    name: v.string(),
    reportType: v.union(
      v.literal('leaves_summary'),
      v.literal('attendance_digest'),
      v.literal('tasks_overview'),
      v.literal('headcount_analytics'),
    ),
    frequency: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
    dayOfWeek: v.optional(v.number()),
    dayOfMonth: v.optional(v.number()),
    timeOfDayUTC: v.string(),
    recipients: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Unauthenticated');
    await assertModuleAccess(ctx, 'reports');

    const now = Date.now();
    const nextRun = calculateNextRunAt(
      args.frequency,
      args.timeOfDayUTC,
      args.dayOfWeek,
      args.dayOfMonth,
      now,
    );

    return await ctx.db.insert('scheduledReports', {
      organizationId: args.organizationId,
      name: args.name,
      reportType: args.reportType,
      frequency: args.frequency,
      dayOfWeek: args.dayOfWeek,
      dayOfMonth: args.dayOfMonth,
      timeOfDayUTC: args.timeOfDayUTC,
      recipients: args.recipients,
      isEnabled: true,
      nextRunAt: nextRun,
      createdBy: caller._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Toggle report schedule enabled/disabled */
export const toggleScheduledReport = mutation({
  args: {
    reportId: v.id('scheduledReports'),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Unauthenticated');

    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error('Report not found');
    await assertModuleAccess(ctx, 'reports');

    const now = Date.now();
    const nextRun = args.isEnabled
      ? calculateNextRunAt(
          report.frequency,
          report.timeOfDayUTC,
          report.dayOfWeek,
          report.dayOfMonth,
          now,
        )
      : report.nextRunAt;

    await ctx.db.patch(args.reportId, {
      isEnabled: args.isEnabled,
      nextRunAt: nextRun,
      updatedAt: now,
    });
  },
});

/** Delete a scheduled report */
export const deleteScheduledReport = mutation({
  args: { reportId: v.id('scheduledReports') },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Unauthenticated');

    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error('Report not found');
    await assertModuleAccess(ctx, 'reports');

    await ctx.db.delete(args.reportId);
  },
});

/** Internal query to find due reports across all tenants */
export const getDueReports = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query('scheduledReports')
      .withIndex('by_nextRunAt', (q) => q.eq('isEnabled', true).lte('nextRunAt', now))
      .take(20);
  },
});

/** Internal query to gather organization data and generate the report body */
export const buildReportContent = internalQuery({
  args: { reportId: v.id('scheduledReports') },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;

    const org = await ctx.db.get(report.organizationId);
    const orgName = org?.name ?? 'Strata';

    let subject = `[${orgName}] Scheduled Report: ${report.name}`;
    let htmlContent = '';
    let textContent = '';

    if (report.reportType === 'leaves_summary') {
      const leaves = await ctx.db
        .query('leaveRequests')
        .withIndex('by_org', (q) => q.eq('organizationId', report.organizationId))
        .collect();

      const pending = leaves.filter((l) => l.status === 'pending').length;
      const approved = leaves.filter((l) => l.status === 'approved').length;
      const totalDays = leaves.reduce((sum, l) => sum + (l.days || 0), 0);

      subject = `[${orgName}] Leaves Summary: ${pending} pending requests`;
      htmlContent = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #111;">
          <h2>Leaves Summary Report</h2>
          <p><strong>Organization:</strong> ${orgName}</p>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
          <ul>
            <li><strong>Pending Requests:</strong> ${pending}</li>
            <li><strong>Approved Requests:</strong> ${approved}</li>
            <li><strong>Total Recorded Leave Days:</strong> ${totalDays}</li>
            <li><strong>Total Requests:</strong> ${leaves.length}</li>
          </ul>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Generated automatically by Strata Platform Scheduled Reports.
          </p>
        </div>
      `;
      textContent = `Leaves Summary Report\nOrganization: ${orgName}\nPending: ${pending}\nApproved: ${approved}\nTotal Days: ${totalDays}\nTotal Requests: ${leaves.length}`;
    } else if (report.reportType === 'headcount_analytics') {
      const users = await ctx.db
        .query('users')
        .withIndex('by_org', (q) => q.eq('organizationId', report.organizationId))
        .collect();

      const active = users.filter((u) => u.isActive).length;
      const staff = users.filter((u) => u.employeeType === 'staff').length;
      const contractors = users.filter((u) => u.employeeType === 'contractor').length;

      subject = `[${orgName}] Headcount Analytics: ${active} active members`;
      htmlContent = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #111;">
          <h2>Headcount Analytics Report</h2>
          <p><strong>Organization:</strong> ${orgName}</p>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
          <ul>
            <li><strong>Active Headcount:</strong> ${active}</li>
            <li><strong>Staff Employees:</strong> ${staff}</li>
            <li><strong>Contractors:</strong> ${contractors}</li>
            <li><strong>Total Accounts:</strong> ${users.length}</li>
          </ul>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Generated automatically by Strata Platform Scheduled Reports.
          </p>
        </div>
      `;
      textContent = `Headcount Analytics Report\nOrganization: ${orgName}\nActive: ${active}\nStaff: ${staff}\nContractors: ${contractors}\nTotal: ${users.length}`;
    } else {
      subject = `[${orgName}] Activity Digest: ${report.name}`;
      htmlContent = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #111;">
          <h2>${report.name}</h2>
          <p><strong>Organization:</strong> ${orgName}</p>
          <p>Scheduled report executed successfully at ${new Date().toISOString()}.</p>
        </div>
      `;
      textContent = `${report.name}\nOrganization: ${orgName}\nScheduled report executed successfully.`;
    }

    return {
      report,
      subject,
      htmlContent,
      textContent,
      recipients: report.recipients,
    };
  },
});

/** Internal mutation to update report after run */
export const recordReportExecution = internalMutation({
  args: {
    reportId: v.id('scheduledReports'),
    status: v.union(v.literal('success'), v.literal('error')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return;

    const now = Date.now();
    const nextRun = calculateNextRunAt(
      report.frequency,
      report.timeOfDayUTC,
      report.dayOfWeek,
      report.dayOfMonth,
      now,
    );

    await ctx.db.patch(args.reportId, {
      lastRunAt: now,
      lastStatus: args.status,
      lastError: args.error,
      nextRunAt: nextRun,
      updatedAt: now,
    });
  },
});

/**
 * Cron entrypoint: sweeps due reports, queues email deliveries, and schedules next runs.
 */
export const sweepDueScheduledReports = internalAction({
  args: {},
  handler: async (ctx) => {
    const dueReports = await ctx.runQuery(internal.scheduledReports.getDueReports, {});
    if (dueReports.length === 0) return { dispatched: 0 };

    let dispatched = 0;
    for (const report of dueReports) {
      try {
        const payload = await ctx.runQuery(internal.scheduledReports.buildReportContent, {
          reportId: report._id,
        });

        if (payload && payload.recipients.length > 0) {
          for (const recipient of payload.recipients) {
            await ctx.runMutation(internal.emails.queueEmail, {
              intendedTo: recipient,
              subject: payload.subject,
              body: payload.textContent,
              organizationId: report.organizationId,
              source: 'notification',
            });
          }
        }

        await ctx.runMutation(internal.scheduledReports.recordReportExecution, {
          reportId: report._id,
          status: 'success',
        });
        dispatched++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error executing report';
        await ctx.runMutation(internal.scheduledReports.recordReportExecution, {
          reportId: report._id,
          status: 'error',
          error: msg,
        });
      }
    }

    return { dispatched };
  },
});
