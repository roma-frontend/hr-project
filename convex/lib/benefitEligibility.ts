import type { Id } from '../_generated/dataModel';

/**
 * Benefit plan eligibility — pure decision logic (no DB) so unit tests can
 * drive it directly, mirroring src/lib/payroll/srcExport.ts conventions.
 */

export interface EligibilityUser {
  _id: Id<'users'>;
  department?: string | null;
  employeeType?: 'staff' | 'contractor' | null;
  createdAt: number;
}

export interface PlanEligibility {
  departments?: string[];
  minTenureDays?: number;
  employeeTypes?: Array<'staff' | 'contractor'>;
}

export interface EligibilityWindow {
  enrollmentOpensAt?: number;
  enrollmentClosesAt?: number;
}

/**
 * Whether a user passes a plan's static eligibility rules. All present rules
 * must pass; an absent rules object means everyone is eligible.
 */
export function isEligibleForPlan(
  user: EligibilityUser,
  eligibility: PlanEligibility | undefined,
  now = Date.now(),
): boolean {
  if (!eligibility) return true;

  if (eligibility.departments && eligibility.departments.length > 0) {
    if (!user.department || !eligibility.departments.includes(user.department)) return false;
  }

  if (
    eligibility.employeeTypes &&
    eligibility.employeeTypes.length > 0 &&
    (!user.employeeType || !eligibility.employeeTypes.includes(user.employeeType))
  ) {
    return false;
  }

  if (typeof eligibility.minTenureDays === 'number' && eligibility.minTenureDays > 0) {
    const tenureDays = Math.floor((now - user.createdAt) / 86_400_000);
    if (tenureDays < eligibility.minTenureDays) return false;
  }

  return true;
}

/** Whether the plan's enrollment window (if any) is currently open. */
export function isEnrollmentWindowOpen(plan: EligibilityWindow, now = Date.now()): boolean {
  if (plan.enrollmentOpensAt !== undefined && now < plan.enrollmentOpensAt) return false;
  if (plan.enrollmentClosesAt !== undefined && now > plan.enrollmentClosesAt) return false;
  return true;
}
