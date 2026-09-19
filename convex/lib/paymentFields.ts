/**
 * paymentFields — the columns a salary bank file may contain, defined once.
 *
 * This list used to live only in `src/lib/payroll/bankProfile.ts`, which the
 * Convex side cannot import. The organisation's chosen column order is now
 * stored in the database (`orgPayrollFile`), and a stored order that names a
 * column the renderer does not know would be silently dropped at export time —
 * the accountant would get a file missing a column and no error. So the ids are
 * shared, and `savePayrollFileLayout` rejects anything not on this list.
 *
 * Pure (no Convex imports) so it is importable from React, from the Next.js API
 * route and from unit tests.
 */

/** Everything a register row can contribute to a bank file. */
export const PAYMENT_FIELD_IDS = [
  'period',
  'beneficiary',
  'account',
  'bank',
  'amount',
  'currency',
  'status',
  'purpose',
  'payerAccount',
] as const;

export type PaymentFieldId = (typeof PAYMENT_FIELD_IDS)[number];

export function isPaymentFieldId(value: string): value is PaymentFieldId {
  return (PAYMENT_FIELD_IDS as readonly string[]).includes(value);
}

/**
 * Parse a `account,beneficiary,amount` value into known field ids, in order.
 *
 * Duplicates are dropped rather than repeated: the same field twice would put
 * two identical columns in the file, which a portal parses as a malformed row.
 * Unknown names are dropped rather than guessed at, so a typo yields a shorter
 * file rather than a wrong one — and the caller can compare lengths to notice.
 */
export function parsePaymentFieldList(value: string | null | undefined): PaymentFieldId[] {
  if (!value) return [];
  const seen = new Set<PaymentFieldId>();
  const out: PaymentFieldId[] = [];
  for (const raw of value.split(',')) {
    const id = raw.trim();
    if (isPaymentFieldId(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Field ids in a stored array that are not recognised, for a clear error message. */
export function unknownPaymentFields(values: readonly string[]): string[] {
  return values.filter((value) => !isPaymentFieldId(value));
}

/**
 * Deduplicate a stored column list, preserving order.
 *
 * Applied on read as well as on write: a row written before a rename, or by a
 * future version of the editor, must not be able to render a file with two
 * identical columns.
 */
export function dedupePaymentFields(values: readonly string[]): PaymentFieldId[] {
  const seen = new Set<PaymentFieldId>();
  const out: PaymentFieldId[] = [];
  for (const value of values) {
    if (isPaymentFieldId(value) && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

/** Separators a bank portal realistically accepts. Anything else is a typo. */
export const PAYMENT_DELIMITERS = [',', ';', '\t'] as const;

export function isPaymentDelimiter(value: string): value is (typeof PAYMENT_DELIMITERS)[number] {
  return (PAYMENT_DELIMITERS as readonly string[]).includes(value);
}
