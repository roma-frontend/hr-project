/**
 * Tests for src/lib/payroll/srcExport.ts — SRC (Armenian Tax Service)
 * filing row builders. Pure functions: no mocks needed.
 *
 * The numbers mirror convex/lib/taxRules.ts Armenia rules so the export always
 * agrees with the payslip: flat 20% income tax, funded pension 5% (≤500k) /
 * 10%−25k (cap 1,125,000 → max 87,500), military stamp duty 1,000/15,000,
 * tiered health insurance 0/4,800/10,800.
 */

import {
  buildSrcRows,
  computeSrcTotals,
  findSrcIssues,
  buildSrcCsv,
  type SrcPayrollRecord,
  type SrcEmployeeIdentity,
} from '../lib/payroll/srcExport';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function record(overrides: Partial<SrcPayrollRecord> = {}): SrcPayrollRecord {
  return {
    userId: 'u1',
    period: '2026-09',
    baseSalary: 1_000_000,
    grossSalary: 1_000_000,
    netSalary: 788_200,
    deductions: {
      incomeTax: 200_000,
      socialSecurity: 0,
      healthInsurance: 10_800,
      pension: 87_500,
      other: 1_000,
      total: 299_300,
    },
    status: 'paid',
    taxCountry: 'armenia',
    currency: 'AMD',
    ...overrides,
  };
}

function identity(overrides: Partial<SrcEmployeeIdentity> = {}): SrcEmployeeIdentity {
  return {
    userId: 'u1',
    name: 'Anna Martirosyan',
    taxId: '01234567',
    nationalId: '1234567890',
    position: 'Engineer',
    department: 'IT',
    ...overrides,
  };
}

// ── Row building ─────────────────────────────────────────────────────────────

describe('buildSrcRows', () => {
  it('builds a complete row from a record + identity', () => {
    const rows = buildSrcRows([record()], { u1: identity() });

    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.name).toBe('Anna Martirosyan');
    expect(r.taxId).toBe('01234567');
    expect(r.nationalId).toBe('1234567890');
    expect(r.position).toBe('Engineer');
    expect(r.department).toBe('IT');
    expect(r.period).toBe('2026-09');
    expect(r.gross).toBe(1_000_000);
    expect(r.incomeTax).toBe(200_000);
    expect(r.pension).toBe(87_500);
    expect(r.stampDuty).toBe(1_000);
    expect(r.healthInsurance).toBe(10_800);
    expect(r.net).toBe(788_200);
    expect(r.missingTaxId).toBe(false);
  });

  it('computes totalWithheld as the sum of all statutory deductions', () => {
    const rows = buildSrcRows([record()], { u1: identity() });
    // 200,000 + 87,500 + 1,000 + 10,800
    expect(rows[0]!.totalWithheld).toBe(299_300);
  });

  it('normalizes ՀՎՀՀ to digits only', () => {
    const rows = buildSrcRows([record()], {
      u1: identity({ taxId: ' 0123-4567 ' }),
    });
    expect(rows[0]!.taxId).toBe('01234567');
    expect(rows[0]!.missingTaxId).toBe(false);
  });

  it('flags rows with a missing ՀՎՀՀ instead of failing', () => {
    const rows = buildSrcRows([record()], { u1: identity({ taxId: null }) });
    expect(rows[0]!.taxId).toBe('');
    expect(rows[0]!.missingTaxId).toBe(true);
  });

  it('flags rows when no identity exists at all', () => {
    const rows = buildSrcRows([record()], {});
    expect(rows[0]!.name).toBe('u1');
    expect(rows[0]!.missingTaxId).toBe(true);
  });

  it('drops cancelled records — they are not filed', () => {
    const rows = buildSrcRows([record(), record({ userId: 'u2', status: 'cancelled' })], {
      u1: identity(),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe('u1');
  });

  it('treats absent deductions as zeros (draft run before calculation)', () => {
    const rows = buildSrcRows([record({ deductions: null, netSalary: 1_000_000 })], {
      u1: identity(),
    });
    const r = rows[0]!;
    expect(r.incomeTax).toBe(0);
    expect(r.pension).toBe(0);
    expect(r.stampDuty).toBe(0);
    expect(r.healthInsurance).toBe(0);
    expect(r.totalWithheld).toBe(0);
    expect(r.net).toBe(1_000_000);
  });

  it('maps deductions.other to stamp duty (taxRules field mapping)', () => {
    const rows = buildSrcRows(
      [record({ deductions: { incomeTax: 200_000, other: 15_000, total: 215_000 } })],
      { u1: identity() },
    );
    // >1M gross → high stamp duty tier
    expect(rows[0]!.stampDuty).toBe(15_000);
    expect(rows[0]!.pension).toBe(0);
    expect(rows[0]!.healthInsurance).toBe(0);
  });

  it('keeps the record currency, falling back to the caller default', () => {
    const rows = buildSrcRows(
      [record({ currency: null }), record({ userId: 'u2', currency: 'RUB' })],
      { u1: identity(), u2: identity({ userId: 'u2' }) },
      'AMD',
    );
    expect(rows[0]!.currency).toBe('AMD');
    expect(rows[1]!.currency).toBe('RUB');
  });

  it('low-salary employee: pension 5%, zero health insurance, low stamp duty', () => {
    // 150,000 gross → tax 30,000; pension 5% = 7,500; stamp 1,000; health 0
    const rows = buildSrcRows(
      [
        record({
          userId: 'u3',
          baseSalary: 150_000,
          grossSalary: 150_000,
          netSalary: 111_500,
          deductions: {
            incomeTax: 30_000,
            socialSecurity: 0,
            healthInsurance: 0,
            pension: 7_500,
            other: 1_000,
            total: 38_500,
          },
        }),
      ],
      { u3: identity({ userId: 'u3', taxId: '76543210' }) },
    );
    const r = rows[0]!;
    expect(r.incomeTax).toBe(30_000);
    expect(r.pension).toBe(7_500);
    expect(r.stampDuty).toBe(1_000);
    expect(r.healthInsurance).toBe(0);
    expect(r.totalWithheld).toBe(38_500);
    expect(r.net).toBe(111_500);
  });
});

// ── Totals ───────────────────────────────────────────────────────────────────

describe('computeSrcTotals', () => {
  it('sums every money column and counts employees', () => {
    const rows = buildSrcRows(
      [
        record(),
        record({
          userId: 'u2',
          grossSalary: 150_000,
          netSalary: 111_500,
          deductions: {
            incomeTax: 30_000,
            socialSecurity: 0,
            healthInsurance: 0,
            pension: 7_500,
            other: 1_000,
            total: 38_500,
          },
        }),
      ],
      { u1: identity(), u2: identity({ userId: 'u2' }) },
    );

    const totals = computeSrcTotals(rows);
    expect(totals.employees).toBe(2);
    expect(totals.gross).toBe(1_150_000);
    expect(totals.incomeTax).toBe(230_000);
    expect(totals.pension).toBe(95_000);
    expect(totals.stampDuty).toBe(2_000);
    expect(totals.healthInsurance).toBe(10_800);
    expect(totals.totalWithheld).toBe(337_800);
    expect(totals.net).toBe(899_700);
  });

  it('returns zeros for an empty sheet', () => {
    const totals = computeSrcTotals([]);
    expect(totals.employees).toBe(0);
    expect(totals.gross).toBe(0);
    expect(totals.totalWithheld).toBe(0);
  });
});

// ── Issues ───────────────────────────────────────────────────────────────────

describe('findSrcIssues', () => {
  it('reports missing tax ids with the stable i18n key', () => {
    const rows = buildSrcRows([record(), record({ userId: 'u2' })], {
      u1: identity(),
      u2: identity({ userId: 'u2', taxId: null }),
    });
    const issues = findSrcIssues(rows);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      userId: 'u2',
      kind: 'missing_tax_id',
      messageKey: 'payroll.srcExportIssueMissingTaxId',
    });
  });

  it('returns nothing when every row carries a ՀՎՀՀ', () => {
    const rows = buildSrcRows([record()], { u1: identity() });
    expect(findSrcIssues(rows)).toHaveLength(0);
  });
});

// ── CSV ──────────────────────────────────────────────────────────────────────

describe('buildSrcCsv', () => {
  it('writes a header row plus one row per employee', () => {
    const csv = buildSrcCsv(buildSrcRows([record()], { u1: identity() }));
    const lines = csv.split('\n');
    expect(lines[0]).toContain('hvhh');
    expect(lines[0]).toContain('income_tax_20');
    expect(lines[0]).toContain('funded_pension');
    expect(lines[0]).toContain('military_stamp');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Anna Martirosyan');
    expect(lines[1]).toContain('01234567');
  });

  it('escapes commas and quotes in names (RFC 4180)', () => {
    const csv = buildSrcCsv(buildSrcRows([record()], { u1: identity({ name: 'Doe, John "JD"' }) }));
    expect(csv).toContain('"Doe, John ""JD"""');
  });
});
