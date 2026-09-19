/**
 * paymentRegister — the Armenian bank payment register for a payroll run.
 *
 * The SRC deliverable (`srcExport.ts`) answers "what do we owe the tax service?".
 * This one answers the question the accountant asks next: "who gets how much,
 * and to which account?". Armenian companies pay salaries by uploading a
 * register (ներբեռնման ցուցակ) to their bank portal — account number + amount,
 * one line per beneficiary — and until now that step was done by hand in Excel
 * from the payslips, which is exactly where a digit gets transposed.
 *
 * Deliberately pure: records + payment details in, rows/totals/issues out. The
 * caller owns i18n, formatting and the workbook. Keeping it pure means the
 * file the accountant uploads can be regression-tested without ExcelJS.
 *
 * ── Two safety rules encoded here ────────────────────────────────────────────
 * 1. `amountFor` transfers `netPayout` when present, NOT `netSalary`. A payroll
 *    record's netPayout includes approved benefit-claim reimbursements (a
 *    documented expense repayment paid out with salary); using netSalary would
 *    underpay every employee who claimed benefits that month.
 * 2. A generated file never contains a row that cannot be paid. `buildPaymentCsv`
 *    filters to payable rows only — a register with a blank account or a short
 *    number is rejected by the bank portal or, worse, silently misrouted, so
 *    such rows are reported as issues instead and must be fixed in the profile.
 *
 * We do not pretend to emit any single bank's proprietary template: banks in
 * Armenia each publish their own layout. The register is a neutral
 * account/amount file every portal can import, and a per-bank adapter can be
 * layered on top without touching this module.
 */

// ── Input contracts ──────────────────────────────────────────────────────────

/** Employee payment details (subset of `employeeProfiles`). */
export interface PaymentEmployeeDetails {
  userId: string;
  name: string;
  /** Armenian account number as stored — may contain spaces or dashes. */
  bankAccountNumber?: string | null;
  bankName?: string | null;
}

/** Minimal payroll-record shape consumed here (subset of `payrollRecords`). */
export interface PaymentPayrollRecord {
  userId: string;
  period: string;
  netSalary: number;
  /**
   * Net salary + approved benefits reimbursement — what is actually
   * transferred. Falls back to `netSalary` when absent.
   */
  netPayout?: number | null;
  status: string;
  currency?: string | null;
}

// ── Row assembly ─────────────────────────────────────────────────────────────

/** One beneficiary line of the payment register. */
export interface PaymentRow {
  userId: string;
  name: string;
  /** Normalised account: digits only. Empty when missing. */
  account: string;
  bankName: string;
  /** Amount to transfer (netPayout when present, else netSalary). */
  amount: number;
  currency: string;
  period: string;
  status: string;
  missingAccount: boolean;
  invalidAccount: boolean;
  missingBeneficiary: boolean;
  zeroAmount: boolean;
}

/** Armenian bank accounts are 20 digits, sometimes written in 5 groups of 4. */
export const ARMENIAN_ACCOUNT_LENGTH = 20;

/** Keep digits only — accountants paste accounts as "1234 5678 9012 3456 7890". */
export function normalizeAccount(value?: string | null): string {
  return (value ?? '').replace(/[\s\-—.]/g, '');
}

/**
 * True when the account looks like an Armenian 20-digit account. We validate
 * shape only: the checksum a bank would run needs the bank's own rules, and
 * inventing one here would reject valid accounts.
 */
export function isValidArmenianAccount(value?: string | null): boolean {
  return new RegExp(`^\\d{${ARMENIAN_ACCOUNT_LENGTH}}$`).test(normalizeAccount(value));
}

/**
 * Amount to transfer for a record. `netPayout` wins when present: it is net
 * salary plus reimbursed benefit claims, i.e. everything the employee receives.
 */
export function amountFor(record: PaymentPayrollRecord): number {
  return record.netPayout ?? record.netSalary;
}

/**
 * A row can be paid: it has a beneficiary, a valid account and a non-zero amount.
 * Everything else is reported as an issue and excluded from the file.
 */
export function isPayable(row: PaymentRow): boolean {
  return (
    !row.missingAccount &&
    !row.invalidAccount &&
    !row.missingBeneficiary &&
    !row.zeroAmount &&
    row.amount > 0
  );
}

/**
 * Build register rows from payroll records + payment details.
 *
 * `cancelled` records are dropped — they are not paid. Input order is preserved
 * so the register lines up with the payroll table the accountant is looking at.
 *
 * @param records payroll records for the period (one per employee ideally)
 * @param details lookup userId → payment details (name + account)
 * @param currency fallback currency when a record does not carry one
 */
export function buildPaymentRows(
  records: PaymentPayrollRecord[],
  details: Record<string, PaymentEmployeeDetails>,
  currency = 'AMD',
): PaymentRow[] {
  return records
    .filter((r) => r.status !== 'cancelled')
    .map((record) => {
      const detail = details[record.userId];
      const account = normalizeAccount(detail?.bankAccountNumber);
      const amount = amountFor(record);
      const name = detail?.name?.trim() ?? '';
      return {
        userId: record.userId,
        name: name || record.userId,
        account,
        bankName: detail?.bankName?.trim() ?? '',
        amount,
        currency: record.currency ?? currency,
        period: record.period,
        status: record.status,
        missingAccount: account.length === 0,
        invalidAccount: account.length > 0 && !isValidArmenianAccount(account),
        missingBeneficiary: name.length === 0,
        zeroAmount: amount <= 0,
      };
    });
}

// ── Totals ───────────────────────────────────────────────────────────────────

/** Register totals — what leaves the account, and what still has to be fixed. */
export interface PaymentTotals {
  /** Every non-cancelled row, payable or not. */
  employees: number;
  /** Sum of payable rows only — the amount the bank file transfers. */
  amount: number;
  /** Rows excluded from the file (bad account / zero amount / no name). */
  outstanding: number;
  /** Sum of the excluded rows, so the gap is visible rather than silent. */
  outstandingAmount: number;
}

export function computePaymentTotals(rows: PaymentRow[]): PaymentTotals {
  let amount = 0;
  let outstandingAmount = 0;
  let outstanding = 0;
  for (const row of rows) {
    if (isPayable(row)) {
      amount += row.amount;
    } else {
      outstanding += 1;
      // A missing account still has an amount that somebody must be paid.
      outstandingAmount += Math.max(0, row.amount);
    }
  }
  return { employees: rows.length, amount, outstanding, outstandingAmount };
}

// ── Health checks ────────────────────────────────────────────────────────────

export type PaymentIssueKind =
  | 'missing_account'
  | 'invalid_account'
  | 'missing_beneficiary'
  | 'zero_amount';

/** A row that blocks a clean register until somebody fixes the profile. */
export interface PaymentIssue {
  userId: string;
  name: string;
  kind: PaymentIssueKind;
  /** i18n key under `payroll.*`; the caller renders the locale string. */
  messageKey:
    | 'payroll.paymentIssueMissingAccount'
    | 'payroll.paymentIssueInvalidAccount'
    | 'payroll.paymentIssueMissingBeneficiary'
    | 'payroll.paymentIssueZeroAmount';
}

const ISSUE_KEYS: Record<PaymentIssueKind, PaymentIssue['messageKey']> = {
  missing_account: 'payroll.paymentIssueMissingAccount',
  invalid_account: 'payroll.paymentIssueInvalidAccount',
  missing_beneficiary: 'payroll.paymentIssueMissingBeneficiary',
  zero_amount: 'payroll.paymentIssueZeroAmount',
};

/**
 * Pre-flight issues, in the order that costs the most money if ignored:
 * an unroutable account first, then an unnamed beneficiary, then a zero amount.
 */
export function findPaymentIssues(rows: PaymentRow[]): PaymentIssue[] {
  const order: PaymentIssueKind[] = [
    'missing_account',
    'invalid_account',
    'missing_beneficiary',
    'zero_amount',
  ];
  const kindOf = (row: PaymentRow): PaymentIssueKind | null => {
    if (row.missingAccount) return 'missing_account';
    if (row.invalidAccount) return 'invalid_account';
    if (row.missingBeneficiary) return 'missing_beneficiary';
    if (row.zeroAmount) return 'zero_amount';
    return null;
  };
  return rows
    .filter((row) => kindOf(row) !== null)
    .map((row) => ({ row, kind: kindOf(row)! }))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map(({ row, kind }) => ({
      userId: row.userId,
      name: row.name,
      kind,
      messageKey: ISSUE_KEYS[kind],
    }));
}

// ── CSV (what the bank portal imports) ───────────────────────────────────────

export const PAYMENT_CSV_HEADERS = [
  'period',
  'beneficiary',
  'account',
  'bank',
  'amount',
  'currency',
] as const;

/** Escape per RFC 4180 so commas in names survive a round-trip. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV register for the bank portal, containing **payable rows only** and a
 * totals line the accountant can reconcile against the payroll run.
 *
 * Rows that failed validation are not written: a bank file is an instruction to
 * move money, and an unroutable line is worse than an absent one. Their count
 * and amount go into the trailing comment line so the omission is visible.
 * Numbers are plain, dot-decimal, no thousands separators.
 */
export function buildPaymentCsv(rows: PaymentRow[]): string {
  const payable = rows.filter(isPayable);
  const totals = computePaymentTotals(rows);
  const lines = [PAYMENT_CSV_HEADERS.join(',')];
  for (const r of payable) {
    lines.push(
      [r.period, r.name, r.account, r.bankName, r.amount, r.currency].map(csvCell).join(','),
    );
  }
  // Totals row — labelled so it cannot be mistaken for a beneficiary.
  lines.push(
    ['TOTAL', '', '', '', totals.amount, payable[0]?.currency ?? 'AMD'].map(csvCell).join(','),
  );
  if (totals.outstanding > 0) {
    lines.push(
      `# ${totals.outstanding} row(s) excluded (missing/invalid account or zero amount): ${totals.outstandingAmount}`,
    );
  }
  return lines.join('\n');
}
