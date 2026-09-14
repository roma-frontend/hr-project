import {
  isEligibleForPlan,
  isEnrollmentWindowOpen,
  type EligibilityUser,
} from '../../convex/lib/benefitEligibility';

const NOW = 1_800_000_000_000; // fixed clock
const DAY = 86_400_000;

function user(overrides: Partial<EligibilityUser> = {}): EligibilityUser {
  return {
    _id: 'u1' as EligibilityUser['_id'],
    department: 'Engineering',
    employeeType: 'staff',
    createdAt: NOW - 400 * DAY,
    ...overrides,
  };
}

describe('benefit plan eligibility', () => {
  it('is eligible when no rules are configured', () => {
    expect(isEligibleForPlan(user(), undefined, NOW)).toBe(true);
    expect(isEligibleForPlan(user(), {}, NOW)).toBe(true);
  });

  it('enforces the department allowlist', () => {
    const eligibility = { departments: ['Sales'] };
    expect(isEligibleForPlan(user({ department: 'Sales' }), eligibility, NOW)).toBe(true);
    expect(isEligibleForPlan(user({ department: 'Engineering' }), eligibility, NOW)).toBe(false);
    expect(isEligibleForPlan(user({ department: undefined }), eligibility, NOW)).toBe(false);
  });

  it('treats an empty departments array as whole-org', () => {
    expect(isEligibleForPlan(user(), { departments: [] }, NOW)).toBe(true);
  });

  it('enforces minimum tenure in days', () => {
    const eligibility = { minTenureDays: 365 };
    expect(isEligibleForPlan(user({ createdAt: NOW - 366 * DAY }), eligibility, NOW)).toBe(true);
    expect(isEligibleForPlan(user({ createdAt: NOW - 100 * DAY }), eligibility, NOW)).toBe(false);
    expect(isEligibleForPlan(user({ createdAt: NOW - 365 * DAY }), eligibility, NOW)).toBe(true);
  });

  it('enforces employment-type restrictions', () => {
    const eligibility = { employeeTypes: ['staff' as const] };
    expect(isEligibleForPlan(user({ employeeType: 'staff' }), eligibility, NOW)).toBe(true);
    expect(isEligibleForPlan(user({ employeeType: 'contractor' }), eligibility, NOW)).toBe(false);
    expect(isEligibleForPlan(user({ employeeType: undefined }), eligibility, NOW)).toBe(false);
  });

  it('requires every configured rule to pass', () => {
    const eligibility = {
      departments: ['Engineering'],
      minTenureDays: 90,
      employeeTypes: ['staff' as const],
    };
    expect(isEligibleForPlan(user(), eligibility, NOW)).toBe(true);
    expect(isEligibleForPlan(user({ employeeType: 'contractor' }), eligibility, NOW)).toBe(false);
    expect(isEligibleForPlan(user({ createdAt: NOW - 10 * DAY }), eligibility, NOW)).toBe(false);
  });
});

describe('benefit enrollment window', () => {
  it('is open when no window is set', () => {
    expect(isEnrollmentWindowOpen({}, NOW)).toBe(true);
  });

  it('respects the open date', () => {
    expect(isEnrollmentWindowOpen({ enrollmentOpensAt: NOW + 1 }, NOW)).toBe(false);
    expect(isEnrollmentWindowOpen({ enrollmentOpensAt: NOW }, NOW)).toBe(true);
    expect(isEnrollmentWindowOpen({ enrollmentOpensAt: NOW - 1 }, NOW)).toBe(true);
  });

  it('respects the close date', () => {
    expect(isEnrollmentWindowOpen({ enrollmentClosesAt: NOW - 1 }, NOW)).toBe(false);
    expect(isEnrollmentWindowOpen({ enrollmentClosesAt: NOW }, NOW)).toBe(true);
  });

  it('respects both bounds', () => {
    expect(
      isEnrollmentWindowOpen({ enrollmentOpensAt: NOW - DAY, enrollmentClosesAt: NOW + DAY }, NOW),
    ).toBe(true);
    expect(
      isEnrollmentWindowOpen(
        { enrollmentOpensAt: NOW - 2 * DAY, enrollmentClosesAt: NOW - DAY },
        NOW,
      ),
    ).toBe(false);
  });
});
