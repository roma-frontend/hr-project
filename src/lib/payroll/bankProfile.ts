/**
 * bankProfile — turning register rows into the file a specific bank portal wants.
 *
 * `paymentRegister.ts` builds the numbers; this module decides how they are laid
 * out. The split matters because the numbers are objective (who gets how much,
 * to which account) and the layout is not: every Armenian bank publishes its own
 * column order for the salary register (փոխանցումների ցուցակ) it accepts, and
 * they change it without telling anyone.
 *
 * ── The rule this module is built around ────────────────────────────────────
 * **A preset is a starting point, never a certified format.** None of these
 * layouts has been validated against a live bank portal, so every profile
 * carries `verified: false` and every generated file reports which profile
 * produced it. The UI shows that, and the accountant is expected to compare the
 * first export against their portal's template once — after which the column
 * mapping is theirs to adjust, because the fields are a fixed, enumerable set
 * and the order is just a list.
 *
 * Claiming "Ameriabank format, verified" without having the bank's current
 * specification in hand would put a plausible-looking but wrong file in front of
 * somebody responsible for moving a month of salaries. A wrong file fails in the
 * bank portal, or worse, is accepted and misroutes a payment.
 *
 * ── Deliberately pure ───────────────────────────────────────────────────────
 * Rows in, text out. No ExcelJS, no i18n, no fetch — so the exact bytes the
 * accountant uploads can be asserted in a test, and a layout regression is a
 * failing assertion rather than a support ticket.
 */

import {
  computePaymentTotals,
  findPaymentIssues,
  isPayable,
  type PaymentIssue,
  type PaymentRow,
} from './paymentRegister';
import {
  PAYMENT_DELIMITERS,
  PAYMENT_FIELD_IDS,
  dedupePaymentFields,
  isPaymentDelimiter,
  isPaymentFieldId,
  type PaymentFieldId,
} from '../../../convex/lib/paymentFields';

// ── Fields ───────────────────────────────────────────────────────────────────

/**
 * The row columns, shared with Convex.
 *
 * Re-exported rather than redeclared: `orgPayrollFile` stores a column order and
 * validates it against `convex/lib/paymentFields.ts`, so two copies of this list
 * would let a saved layout name a column this renderer does not know — the file
 * would quietly lose a column. The ids themselves live in the shared module and
 * are re-exported here because every existing caller imports them from here.
 */
export { PAYMENT_FIELD_IDS, PAYMENT_DELIMITERS, isPaymentDelimiter, isPaymentFieldId };
export type { PaymentFieldId };

/** Values that come from the employer rather than from the row. */
export interface ProfileContext {
  /** The paying account, when the bank's template asks for it. */
  payerAccount?: string;
  /** Payment description / назначение платежа. */
  purpose?: string;
  /**
   * Localised column names for the header line.
   *
   * Optional, and only ever cosmetic: portal imports are parsed positionally, so
   * the header is for the accountant reading the file back. Defaults to each
   * field's stable English `columnName`.
   */
  headers?: Partial<Record<PaymentFieldId, string>>;
}

interface PaymentFieldDefinition {
  id: PaymentFieldId;
  /** i18n key under `payroll.paymentFields.*`, for the column-mapping UI. */
  labelKey: string;
  /**
   * What is written in the file's header line.
   *
   * A fixed English name, NOT the i18n key: a header line is read by the
   * accountant and by whoever opens the support ticket, and shipping
   * `payroll.paymentFields.account` in a bank file would be worse than useless.
   * `ProfileContext.headers` can override it per locale.
   */
  columnName: string;
  /** Serialise one cell. Numbers stay unformatted — banks parse, not display. */
  value: (row: PaymentRow, ctx: ProfileContext) => string | number;
}

export const PAYMENT_FIELDS: Record<PaymentFieldId, PaymentFieldDefinition> = {
  period: {
    id: 'period',
    labelKey: 'payroll.paymentFields.period',
    columnName: 'Period',
    value: (r) => r.period,
  },
  beneficiary: {
    id: 'beneficiary',
    labelKey: 'payroll.paymentFields.beneficiary',
    columnName: 'Beneficiary',
    value: (r) => r.name,
  },
  account: {
    id: 'account',
    labelKey: 'payroll.paymentFields.account',
    columnName: 'Account number',
    value: (r) => r.account,
  },
  bank: {
    id: 'bank',
    labelKey: 'payroll.paymentFields.bank',
    columnName: 'Bank',
    value: (r) => r.bankName,
  },
  amount: {
    id: 'amount',
    labelKey: 'payroll.paymentFields.amount',
    columnName: 'Amount',
    value: (r) => r.amount,
  },
  currency: {
    id: 'currency',
    labelKey: 'payroll.paymentFields.currency',
    columnName: 'Currency',
    value: (r) => r.currency,
  },
  status: {
    id: 'status',
    labelKey: 'payroll.paymentFields.status',
    columnName: 'Status',
    value: (r) => r.status,
  },
  purpose: {
    id: 'purpose',
    labelKey: 'payroll.paymentFields.purpose',
    columnName: 'Payment purpose',
    value: (_r, ctx) => ctx.purpose ?? '',
  },
  payerAccount: {
    id: 'payerAccount',
    labelKey: 'payroll.paymentFields.payerAccount',
    columnName: 'Payer account',
    value: (_r, ctx) => ctx.payerAccount ?? '',
  },
};

// ── Profiles ─────────────────────────────────────────────────────────────────

export interface BankProfile {
  id: string;
  /** i18n key under `payroll.bankProfiles.*`. */
  labelKey: string;
  /** Column separator the portal imports. Semicolon is the safer default when a
   *  template contains commas (Armenian addresses do). */
  delimiter: string;
  /** Whether the portal expects a header line. Most reject one. */
  header: boolean;
  columns: PaymentFieldId[];
  /**
   * Whether this layout has been checked against the bank's current
   * specification. Always false here — see the module header.
   */
  verified: boolean;
  /** What to check before the first live upload, as an i18n key. */
  noteKey: string;
}

/**
 * Preset layouts.
 *
 * Ordered neutral-first: the safe default is the column set every Armenian
 * portal accepts (account + amount + beneficiary), and a bank-specific preset is
 * a deliberate choice the accountant makes after looking at their portal.
 */
export const BANK_PROFILES: BankProfile[] = [
  {
    id: 'generic',
    labelKey: 'payroll.bankProfiles.generic',
    delimiter: ',',
    header: true,
    columns: ['beneficiary', 'account', 'amount', 'currency'],
    verified: false,
    noteKey: 'payroll.bankProfileNotes.generic',
  },
  {
    id: 'ameriabank',
    labelKey: 'payroll.bankProfiles.ameriabank',
    delimiter: ';',
    header: true,
    columns: ['account', 'beneficiary', 'amount', 'currency', 'purpose'],
    verified: false,
    noteKey: 'payroll.bankProfileNotes.ameriabank',
  },
  {
    id: 'acba',
    labelKey: 'payroll.bankProfiles.acba',
    delimiter: ';',
    header: true,
    columns: ['account', 'beneficiary', 'amount', 'purpose'],
    verified: false,
    noteKey: 'payroll.bankProfileNotes.acba',
  },
  {
    id: 'ardshinbank',
    labelKey: 'payroll.bankProfiles.ardshinbank',
    delimiter: ';',
    header: true,
    columns: ['beneficiary', 'account', 'bank', 'amount', 'purpose'],
    verified: false,
    noteKey: 'payroll.bankProfileNotes.ardshinbank',
  },
  {
    id: 'fastbank',
    labelKey: 'payroll.bankProfiles.fastbank',
    delimiter: ',',
    header: false,
    columns: ['account', 'amount'],
    verified: false,
    noteKey: 'payroll.bankProfileNotes.fastbank',
  },
];

export const DEFAULT_BANK_PROFILE_ID = 'generic';

export function getBankProfile(id: string | undefined | null): BankProfile {
  return (
    BANK_PROFILES.find((profile) => profile.id === id) ??
    BANK_PROFILES.find((profile) => profile.id === DEFAULT_BANK_PROFILE_ID)!
  );
}

/**
 * Build a profile from a caller-supplied column list — the "the bank changed
 * their template again" escape hatch, and the thing that makes an unverified
 * preset acceptable to ship: nothing about it is fixed.
 *
 * Unknown field names are dropped rather than guessed at, and an empty result
 * falls back to the preset, so a typo in a query string cannot produce a file
 * with no columns.
 */
export function buildCustomProfile(
  base: BankProfile,
  columns: PaymentFieldId[],
  options: { delimiter?: string; header?: boolean } = {},
): BankProfile {
  const cleaned = columns.filter(isPaymentFieldId);
  return {
    ...base,
    id: `${base.id}:custom`,
    columns: cleaned.length > 0 ? cleaned : base.columns,
    delimiter: options.delimiter === undefined ? base.delimiter : options.delimiter,
    header: options.header === undefined ? base.header : options.header,
  };
}

/**
 * Parse a `columns=account,beneficiary` value into known field ids, in order.
 *
 * Delegates to the shared module so the query-string path and the stored-layout
 * path cannot disagree about what a valid column list is.
 */
export function parseFieldList(value: string | null | undefined): PaymentFieldId[] {
  return value ? dedupePaymentFields(value.split(',').map((part) => part.trim())) : [];
}

// ── Serialisation ────────────────────────────────────────────────────────────

export interface ProfiledFile {
  /** Exactly what the portal imports: payable rows only. */
  content: string;
  /** Headers written, in column order (empty when the profile has no header). */
  headers: string[];
  /** Rows written. */
  included: number;
  /** Rows held back because the bank could not be told where to send them. */
  excluded: number;
  /** Why they were held back — the caller renders these as issues. */
  skipped: PaymentIssue[];
  /** Whether the layout behind this file was checked against the bank. */
  verified: boolean;
  /** The profile that produced it, for the filename and the audit trail. */
  profileId: string;
  /** Amount in `content`, so the accountant can reconcile before uploading. */
  amount: number;
}

/** Escape per RFC 4180 so a comma or a quote inside a name survives. */
function cell(value: string | number, delimiter: string): string {
  const text = String(value);
  const needsQuotes =
    text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r');
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Render the file for one profile.
 *
 * Payable rows only, for the same reason `buildPaymentCsv` filters: a bank file
 * is an instruction to move money, and a line with a blank or 15-digit account
 * is either rejected or misrouted. The withheld rows come back in `skipped` so
 * the UI can list them and the omission is never silent.
 *
 * No totals line, no comment lines: unlike the accountant's CSV, a portal import
 * is parsed positionally and an extra line is a malformed record.
 */
export function buildProfiledFile(
  rows: PaymentRow[],
  profile: BankProfile,
  ctx: ProfileContext = {},
): ProfiledFile {
  const payable = rows.filter(isPayable);
  const issues = findPaymentIssues(rows);
  const totals = computePaymentTotals(rows);

  const headers = profile.columns.map((id) => ctx.headers?.[id] ?? PAYMENT_FIELDS[id].columnName);
  const lines: string[] = [];
  if (profile.header) {
    lines.push(headers.map((name) => cell(name, profile.delimiter)).join(profile.delimiter));
  }
  for (const row of payable) {
    lines.push(
      profile.columns
        .map((id) => cell(PAYMENT_FIELDS[id].value(row, ctx), profile.delimiter))
        .join(profile.delimiter),
    );
  }

  return {
    content: lines.join('\n'),
    headers,
    included: payable.length,
    excluded: issues.length,
    skipped: issues,
    verified: profile.verified,
    profileId: profile.id,
    amount: totals.amount,
  };
}

/** Filename stem for a profile, so two exports are never confused on disk. */
export function profileFilename(profileId: string, period: string): string {
  const safeProfile = profileId.split(':')[0]!.replace(/[^a-z0-9-]/gi, '');
  const safePeriod = period.replace(/[^a-z0-9-]/gi, '');
  return `salary-${safePeriod}-${safeProfile}.csv`;
}
