import { api, internal } from '../_generated/api';
import { action, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { calculatePayroll, type CountryCode } from '../lib/payrollCalculator';
import { resolvePensionExemption } from '../lib/pension';
import { logger } from '../../src/lib/logger';
import { getAuthCaller } from '../lib/getAuthCaller';
import { requireOrgAdmin } from '../lib/rbac';

/** Payroll-relevant fields carried by employee profile docs. */
interface PayrollEmployee {
  _id: string;
  baseSalary?: number;
  bonuses?: number;
  overtimeHours?: number;
  birthYear?: number;
  dateOfBirth?: string;
  pensionExempt?: boolean;
  healthInsured?: boolean;
}

/** Settings returned by `settings.getOrganizationSettings`. */
interface PayrollOrgSettings {
  taxCountry?: CountryCode;
  overtimeMultiplier?: number;
}

export const checkPayrollAccess = internalQuery({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireOrgAdmin(ctx, caller._id, args.organizationId);
    return caller._id;
  },
});

export const processScheduledPayroll = action({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ processed: number; totalGross: number; totalNet: number; message: string }> => {
    const { organizationId } = args;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) throw new Error('Not authenticated');
    await ctx.runQuery(internal.payroll.actions.checkPayrollAccess, { organizationId });

    const _currentMonth = new Date().toISOString().slice(0, 7);

    const runQuery = ctx.runQuery as unknown as (fn: unknown, args: unknown) => Promise<unknown>;
    const employees =
      ((await runQuery(api.employeeProfiles.getEmployeesByOrganization, {
        organizationId,
      })) as PayrollEmployee[] | null | undefined) ?? [];

    if (!employees || employees.length === 0) {
      return { processed: 0, totalGross: 0, totalNet: 0, message: 'No employees found' };
    }

    const settings = (await runQuery(api.settings.getOrganizationSettings, {
      organizationId,
    })) as PayrollOrgSettings | null | undefined;

    const taxCountry = settings?.taxCountry ?? 'armenia';

    let totalGross = 0;
    let totalNet = 0;
    let processedCount = 0;

    for (const emp of employees) {
      try {
        const baseSalary = emp.baseSalary ?? 0;
        const bonuses = emp.bonuses ?? 0;
        const overtimeHours = emp.overtimeHours ?? 0;
        const hourlyRate = baseSalary > 0 ? baseSalary / 160 : 0;

        const calculation = calculatePayroll({
          country: taxCountry,
          baseSalary,
          bonuses,
          overtimeHours,
          hourlyRate,
          overtimeMultiplier: settings?.overtimeMultiplier,
          // Armenia: employees born before 1974 are exempt from the funded pension.
          pensionExempt: resolvePensionExemption({
            pensionExempt: emp.pensionExempt,
            birthYear: emp.birthYear,
            dateOfBirth: emp.dateOfBirth,
          }),
          // Armenia: health insurance participation flag
          healthInsured: emp.healthInsured ?? false,
        });

        totalGross += calculation.grossSalary;
        totalNet += calculation.netSalary;
        processedCount++;
      } catch (error) {
        logger.error(`Error processing payroll for employee ${emp._id}:`, error);
      }
    }

    return {
      processed: processedCount,
      totalGross,
      totalNet,
      message: `Processed payroll for ${processedCount} employees`,
    };
  },
});
