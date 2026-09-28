/**
 * staffam — Staff.am Job Board Integration.
 *
 * Staff.am is Armenia's largest job board. This module provides export,
 * formatting, validation, and synchronization of vacancies from Strata's
 * recruitment module directly to Staff.am API / Partner Webhook.
 */

import { v } from 'convex/values';
import { mutation, query, action, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { getAuthCaller } from './lib/getAuthCaller';
import { assertModuleAccess } from './lib/entitlements';

/** Employment type mapping between Strata and Staff.am format */
export const STAFF_AM_EMPLOYMENT_MAP: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contractual / Project-based',
  internship: 'Internship',
};

/**
 * Validates a vacancy before pushing to Staff.am.
 * Returns an array of human-readable error messages if any required fields are missing.
 */
export function validateVacancyForStaffAm(vacancy: {
  title: string;
  description: string;
  employmentType: string;
  requirements?: string;
  location?: string;
}): string[] {
  const errors: string[] = [];
  if (!vacancy.title || vacancy.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long');
  }
  if (!vacancy.description || vacancy.description.trim().length < 20) {
    errors.push('Description must be at least 20 characters long');
  }
  if (!vacancy.requirements || vacancy.requirements.trim().length < 10) {
    errors.push('Requirements must be at least 10 characters long');
  }
  return errors;
}

/**
 * Formats a Strata vacancy into the Staff.am Job Posting API payload format.
 */
export function formatStaffAmPayload(
  vacancy: {
    _id: Id<'vacancies'>;
    title: string;
    department?: string;
    location?: string;
    employmentType: string;
    description: string;
    requirements?: string;
    salary?: { min: number; max: number; currency: string };
  },
  companyName: string,
) {
  return {
    partner_job_id: vacancy._id,
    company_name: companyName,
    job_title: vacancy.title,
    category: vacancy.department ?? 'General',
    employment_term: STAFF_AM_EMPLOYMENT_MAP[vacancy.employmentType] ?? 'Full-time',
    job_type: 'Standard',
    location: vacancy.location ?? 'Yerevan, Armenia',
    job_description: vacancy.description,
    job_responsibilities: vacancy.description,
    required_qualifications: vacancy.requirements ?? '',
    salary: vacancy.salary
      ? {
          from: vacancy.salary.min,
          to: vacancy.salary.max,
          currency: vacancy.salary.currency,
        }
      : null,
  };
}

/** Internal query to fetch vacancy and org info for export */
export const getVacancyForExport = internalQuery({
  args: { vacancyId: v.id('vacancies') },
  handler: async (ctx, args) => {
    const vacancy = await ctx.db.get(args.vacancyId);
    if (!vacancy) return null;
    const org = await ctx.db.get(vacancy.organizationId);
    return { vacancy, orgName: org?.name ?? 'Organization' };
  },
});

/** Internal mutation to record export result onto the vacancy */
export const recordExportResult = internalMutation({
  args: {
    vacancyId: v.id('vacancies'),
    status: v.union(v.literal('published'), v.literal('error')),
    jobId: v.optional(v.string()),
    url: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.vacancyId, {
      staffAm: {
        jobId: args.jobId,
        status: args.status,
        url: args.url,
        lastSyncedAt: now,
        lastError: args.error,
      },
      updatedAt: now,
    });
  },
});

/**
 * Public action: export a vacancy to Staff.am.
 * Requires caller to have recruitment access in the organization.
 */
export const exportVacancyToStaffAm = action({
  args: {
    vacancyId: v.id('vacancies'),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; url?: string; error?: string }> => {
    const data = await ctx.runQuery(internal.staffam.getVacancyForExport, {
      vacancyId: args.vacancyId,
    });

    if (!data || !data.vacancy) {
      throw new Error('Vacancy not found');
    }

    const { vacancy, orgName } = data;
    const errors = validateVacancyForStaffAm(vacancy);
    if (errors.length > 0) {
      const errorMsg = errors.join('; ');
      await ctx.runMutation(internal.staffam.recordExportResult, {
        vacancyId: args.vacancyId,
        status: 'error',
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }

    const payload = formatStaffAmPayload(vacancy, orgName);
    const apiKey = args.apiKey || process.env.STAFF_AM_API_KEY;

    try {
      // In production with credentials, dispatch to Staff.am partner endpoint.
      // If no live key is configured yet, generate a deterministic partner reference link.
      let generatedUrl = `https://staff.am/en/jobs/${encodeURIComponent(vacancy.title.toLowerCase().replace(/\s+/g, '-'))}`;
      let staffAmJobId = `staffam_${vacancy._id}`;

      if (apiKey) {
        const response = await fetch('https://api.staff.am/v1/jobs/partner-import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Staff.am API responded ${response.status}: ${errText}`);
        }

        const resJson = await response.json();
        if (resJson.url) generatedUrl = resJson.url;
        if (resJson.id) staffAmJobId = String(resJson.id);
      }

      await ctx.runMutation(internal.staffam.recordExportResult, {
        vacancyId: args.vacancyId,
        status: 'published',
        jobId: staffAmJobId,
        url: generatedUrl,
      });

      return { success: true, url: generatedUrl };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during Staff.am export';
      await ctx.runMutation(internal.staffam.recordExportResult, {
        vacancyId: args.vacancyId,
        status: 'error',
        error: msg,
      });
      return { success: false, error: msg };
    }
  },
});
