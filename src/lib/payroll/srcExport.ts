/**
 * srcExport — the SRC ( Armenia) payroll-filing deliverable.
 *
 * Armenian accountants file monthly salary taxes with the SRC (ԿԳԴ / Tax Service)
 * using per-employee rows: identification (name, ՀՎՀՀ), gross, income tax (20%),
 * funded-pension contributions (5% / 10%−25k tiers, skipped for employees born
 * before 1974), military stamp duty (1,000 / 15,000 AMD) and the tiered mandatory
 * health-insurance contribution (0 / 4,800 / 10,800 AMD).
 *
 * This module is deliberately pure: it turns payroll records + employee profile
 * data into filing rows and per-contribution totals. The caller (API route or UI)
 * owns i18n, formatting and the workbook itself. Keeping it pure means the
 * numbers the accountant files can be regression-tested without ExcelJS.
 *
 * Row shape mirrors what `convex/lib/payrollCalculator.ts` computes so export
 * values always agree with the payslip — they read the same record.
 */

// ── Input contracts ──────────────────────────────────────────────────────────

/** Minimal employee identification needed for a filing row. */
export interface SrcEmployeeIdentity {
  userId: string;
  name: string;
  /** ՀՎՀՀ — 8-digit Armenian TIN. May be absent; flagged, never invented. */
  taxId?: string | null;
  /** Armenian national ID (ՀԾՀ, 10 digits) — secondary identifier. */
  nationalId?: string | null;
  position?: string | null;
  department?: string | null;
}

/** Minimal payroll-record shape consumed here (subset of `payrollRecords`). */
export interface SrcPayrollRecord {
  userId: string;
  period: string;
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  bonuses?: number;
  overtimePay?: number;
  deductions?: {
    incomeTax?: number;
    socialSecurity?: number;
    healthInsurance?: number;
    pension?: number;
    other?: number;
    total?: number;
  } | null;
  status: string;
  taxCountry?: string;
  currency?: string | null;
}

// ── Row assembly ─────────────────────────────────────────────────────────────

/** One employee row of the SRC filing sheet. */
export interface SrcExportRow {
  userId: string;
  name: string;
  /** ՀՎՀՀ, digits only; empty when missing (row is flagged `missingTaxId`). */
  taxId: string;
  /** ՀԾՀ when known, else empty. */
  nationalId: string;
  position: string;
  department: string;
  period: string;
  /** Gross employment income for the month (AMD). */
  gross: number;
  /** Income tax withheld (flat 20% in Armenia). */
  incomeTax: number;
  /** Mandatory funded-pension employee contribution (0 for exempt employees). */
  pension: number;
  /** Military stamp duty (զինվորական վճար) — 1,000 / 15,000 AMD tiers. */
  stampDuty: number;
  /** Tiered mandatory health-insurance contribution — 0 / 4,800 / 10,800 AMD. */
  healthInsurance: number;
  /** Total withheld = incomeTax + pension + stampDuty + healthInsurance. */
  totalWithheld: number;
  /** Net paid to the employee. */
  net: number;
  currency: string;
  /** Record status — only approved/paid rows belong in a filing. */
  status: string;
  /** ՀՎՀՀ missing: the accountant must fill it in before filing. */
  missingTaxId: boolean;
}

/** Keep digits only — accountants paste TINs with spaces/dashes. */
function normalizeTaxId(taxId?: string | null): string {
  return (taxId ?? '').replace(/\D/g, '');
}

/** Deduction values of a record, with `other` = stamp duty + anything else. */
function deductionParts(record: SrcPayrollRecord): {
  incomeTax: number;
  pension: number;
  healthInsurance: number;
  stampDuty: number;
} {
  const d = record.deductions ?? {};
  return {
    incomeTax: d.incomeTax ?? 0,
    pension: d.pension ?? 0,
    healthInsurance: d.healthInsurance ?? 0,
    // `other` carries the military stamp duty (taxRules maps it to field 'other').
    stampDuty: d.other ?? 0,
  };
}

/**
 * Build filing rows from payroll records + identity lookups.
 *
 * `cancelled` records are dropped — they are not filed. Every other status is
 * kept and carries its status; the accountant decides whether the run is final.
 *
 * @param records payroll records for the period (one per employee ideally)
 * @param identities lookup userId → identification (name, taxId, …)
 * @param currency fallback currency when a record does not carry one
 */
export function buildSrcRows(
  records: SrcPayrollRecord[],
  identities: Record<string, SrcEmployeeIdentity>,
  currency = 'AMD',
): SrcExportRow[] {
  return records
    .filter((r) => r.status !== 'cancelled')
    .map((record) => {
      const identity = identities[record.userId];
      const parts = deductionParts(record);
      const taxId = normalizeTaxId(identity?.taxId);
      return {
        userId: record.userId,
        name: identity?.name ?? record.userId,
        taxId,
        nationalId: identity?.nationalId ?? '',
        position: identity?.position ?? '',
        department: identity?.department ?? '',
        period: record.period,
        gross: record.grossSalary,
        incomeTax: parts.incomeTax,
        pension: parts.pension,
        stampDuty: parts.stampDuty,
        healthInsurance: parts.healthInsurance,
        totalWithheld: parts.incomeTax + parts.pension + parts.stampDuty + parts.healthInsurance,
        net: record.netSalary,
        currency: record.currency ?? currency,
        status: record.status,
        missingTaxId: taxId.length === 0,
      };
    });
}

// ── Totals ───────────────────────────────────────────────────────────────────

/** Column totals of the filing sheet — what the org remits for the month. */
export interface SrcTotals {
  employees: number;
  gross: number;
  incomeTax: number;
  pension: number;
  stampDuty: number;
  healthInsurance: number;
  totalWithheld: number;
  net: number;
}

export function computeSrcTotals(rows: SrcExportRow[]): SrcTotals {
  const sum = (pick: (r: SrcExportRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  return {
    employees: rows.length,
    gross: sum((r) => r.gross),
    incomeTax: sum((r) => r.incomeTax),
    pension: sum((r) => r.pension),
    stampDuty: sum((r) => r.stampDuty),
    healthInsurance: sum((r) => r.healthInsurance),
    totalWithheld: sum((r) => r.totalWithheld),
    net: sum((r) => r.net),
  };
}

// ── Health checks ────────────────────────────────────────────────────────────

/** A row blocks a clean filing when the accountant must fix something first. */
export interface SrcExportIssue {
  userId: string;
  name: string;
  kind: 'missing_tax_id';
  /** Localized message comes from the caller; this is the stable code. */
  messageKey: 'payroll.srcExportIssueMissingTaxId';
}

/**
 * Pre-flight issues the accountant should resolve before filing.
 * Today: missing ՀՎՀՀ. Kept as a list so future checks (checksum failures,
 * pension-exemption mismatches) slot in without changing the shape.
 */
export function findSrcIssues(rows: SrcExportRow[]): SrcExportIssue[] {
  return rows
    .filter((r) => r.missingTaxId)
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      kind: 'missing_tax_id' as const,
      messageKey: 'payroll.srcExportIssueMissingTaxId' as const,
    }));
}

// ── CSV (universal fallback — every accounting software imports it) ──────────

const CSV_HEADERS = [
  'period',
  'employee',
  'hvhh',
  'national_id',
  'position',
  'department',
  'gross',
  'income_tax_20',
  'funded_pension',
  'military_stamp',
  'health_insurance',
  'total_withheld',
  'net',
  'currency',
  'status',
] as const;

/** Escape per RFC 4180 so commas in names survive a round-trip. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV export of the filing rows — the lingua franca between HR systems and
 * accounting software (Armsoft/1C import it). Numbers are plain, dot-decimal;
 * the workbook path adds localized headers.
 */
export function buildSrcCsv(rows: SrcExportRow[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.period,
        r.name,
        r.taxId,
        r.nationalId,
        r.position,
        r.department,
        r.gross,
        r.incomeTax,
        r.pension,
        r.stampDuty,
        r.healthInsurance,
        r.totalWithheld,
        r.net,
        r.currency,
        r.status,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}
