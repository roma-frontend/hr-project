/**
 * Tests for src/lib/payroll/paymentRegister.ts — the Armenian bank payment
 * register built for a payroll run.
 *
 * The two properties that matter commercially are asserted explicitly:
 *   1. the transferred amount is `netPayout` (salary + reimbursed benefit
 *      claims), never `netSalary`, and
 *   2. a generated file never contains a row that cannot be paid.
 */

import {
  ARMENIAN_ACCOUNT_LENGTH,
  amountFor,
  buildPaymentCsv,
  buildPaymentRows,
  computePaymentTotals,
  findPaymentIssues,
  isPayable,
  isValidArmenianAccount,
  normalizeAccount,
  type PaymentEmployeeDetails,
  type PaymentPayrollRecord,
} from '../lib/payroll/paymentRegister';

const ACCOUNT = '12345678901234567890';

function record(over: Partial<PaymentPayrollRecord> = {}): PaymentPayrollRecord {
  return {
    userId: 'u1',
    period: '2026-08',
    netSalary: 400_000,
    netPayout: null,
    status: 'approved',
    currency: 'AMD',
    ...over,
  };
}

function details(over: Partial<PaymentEmployeeDetails> = {}): PaymentEmployeeDetails {
  return {
    userId: 'u1',
    name: 'Ani Sargsyan',
    bankAccountNumber: ACCOUNT,
    bankName: 'Ameriabank',
    ...over,
  };
}

describe('normalizeAccount', () => {
  it('strips the separators accountants type', () => {
    expect(normalizeAccount('1234 5678 9012 3456 7890')).toBe(ACCOUNT);
    expect(normalizeAccount('1234-5678-9012-3456-7890')).toBe(ACCOUNT);
    expect(normalizeAccount('1234.5678.9012.3456.7890')).toBe(ACCOUNT);
  });

  it('treats a missing value as empty, not as an error string', () => {
    expect(normalizeAccount(null)).toBe('');
    expect(normalizeAccount(undefined)).toBe('');
    expect(normalizeAccount('')).toBe('');
  });
});

describe('isValidArmenianAccount', () => {
  it('accepts a 20-digit account written with spaces', () => {
    expect(ARMENIAN_ACCOUNT_LENGTH).toBe(20);
    expect(isValidArmenianAccount('1234 5678 9012 3456 7890')).toBe(true);
  });

  it('rejects a 19- or 21-digit account rather than rounding to a valid one', () => {
    expect(isValidArmenianAccount(ACCOUNT.slice(0, 19))).toBe(false);
    expect(isValidArmenianAccount(ACCOUNT + '1')).toBe(false);
  });

  it('rejects letters — an alphanumeric value is not an Armenian account', () => {
    expect(isValidArmenianAccount('1234567890123456789A')).toBe(false);
  });

  it('rejects an empty account', () => {
    expect(isValidArmenianAccount('')).toBe(false);
    expect(isValidArmenianAccount(null)).toBe(false);
  });
});

describe('amountFor', () => {
  it('transfers the net payout when present — it includes reimbursed benefits', () => {
    expect(amountFor(record({ netSalary: 400_000, netPayout: 420_000 }))).toBe(420_000);
  });

  it('falls back to net salary when the payout field is absent', () => {
    expect(amountFor(record({ netSalary: 400_000, netPayout: null }))).toBe(400_000);
    expect(amountFor(record({ netSalary: 400_000 }))).toBe(400_000);
  });

  it('honours an explicit zero payout instead of silently using net salary', () => {
    // 0 means "pay nothing" (e.g. fully deducted), not "field missing".
    expect(amountFor(record({ netSalary: 400_000, netPayout: 0 }))).toBe(0);
  });
});

describe('buildPaymentRows', () => {
  it('drops cancelled records — they are not paid', () => {
    const rows = buildPaymentRows([record(), record({ userId: 'u2', status: 'cancelled' })], {
      u1: details(),
      u2: details({ userId: 'u2' }),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe('u1');
  });

  it('keeps records that have no payment details and flags them', () => {
    const rows = buildPaymentRows([record({ userId: 'u9' })], {});
    expect(rows).toHaveLength(1);
    expect(rows[0]!.missingAccount).toBe(true);
    expect(rows[0]!.missingBeneficiary).toBe(true);
  });

  it('flags a short or lettered account as invalid rather than missing', () => {
    const [short, lettered] = buildPaymentRows([record({ userId: 'a' }), record({ userId: 'b' })], {
      a: details({ userId: 'a', bankAccountNumber: '12345' }),
      b: details({ userId: 'b', bankAccountNumber: 'ACCT-1' }),
    });
    expect(short!.missingAccount).toBe(false);
    expect(short!.invalidAccount).toBe(true);
    expect(lettered!.invalidAccount).toBe(true);
  });

  it('carries the period, currency and bank name onto the row', () => {
    const rows = buildPaymentRows([record()], { u1: details() });
    expect(rows[0]).toMatchObject({
      period: '2026-08',
      currency: 'AMD',
      bankName: 'Ameriabank',
      account: ACCOUNT,
    });
  });

  it('preserves input order so the register matches the payroll table', () => {
    const rows = buildPaymentRows([record({ userId: 'z' }), record({ userId: 'a' })], {
      z: details({ userId: 'z' }),
      a: details({ userId: 'a' }),
    });
    expect(rows.map((r) => r.userId)).toEqual(['z', 'a']);
  });
});

describe('isPayable', () => {
  it('is false for every way a row can be unpayable', () => {
    const rows = buildPaymentRows(
      [
        record({ userId: 'ok' }),
        record({ userId: 'noAcct' }),
        record({ userId: 'badAcct' }),
        record({ userId: 'zero', netSalary: 0, netPayout: 0 }),
      ],
      {
        ok: details({ userId: 'ok' }),
        noAcct: details({ userId: 'noAcct', bankAccountNumber: null }),
        badAcct: details({ userId: 'badAcct', bankAccountNumber: '12' }),
        zero: details({ userId: 'zero' }),
      },
    );
    expect(rows.map(isPayable)).toEqual([true, false, false, false]);
  });
});

describe('computePaymentTotals', () => {
  it('counts the amount of payable rows only, and reports the gap', () => {
    const rows = buildPaymentRows(
      [record({ userId: 'a', netPayout: 100 }), record({ userId: 'b', netPayout: 250 })],
      { a: details({ userId: 'a' }), b: details({ userId: 'b', bankAccountNumber: null }) },
    );
    const totals = computePaymentTotals(rows);
    expect(totals.employees).toBe(2);
    expect(totals.amount).toBe(100);
    expect(totals.outstanding).toBe(1);
    expect(totals.outstandingAmount).toBe(250);
  });

  it('is all zeros for an empty run', () => {
    expect(computePaymentTotals([])).toEqual({
      employees: 0,
      amount: 0,
      outstanding: 0,
      outstandingAmount: 0,
    });
  });
});

describe('findPaymentIssues', () => {
  it('returns nothing for a clean register', () => {
    expect(findPaymentIssues(buildPaymentRows([record()], { u1: details() }))).toEqual([]);
  });

  it('orders issues by what costs most if ignored: unroutable money first', () => {
    const rows = buildPaymentRows(
      [
        record({ userId: 'zero', netSalary: 0, netPayout: 0 }),
        record({ userId: 'bad', netSalary: 10 }),
        record({ userId: 'none' }),
      ],
      {
        zero: details({ userId: 'zero' }),
        bad: details({ userId: 'bad', bankAccountNumber: '123' }),
        none: details({ userId: 'none', bankAccountNumber: null }),
      },
    );
    const issues = findPaymentIssues(rows);
    expect(issues.map((i) => i.kind)).toEqual([
      'missing_account',
      'invalid_account',
      'zero_amount',
    ]);
  });

  it('exposes an i18n key per issue kind', () => {
    const rows = buildPaymentRows([record({ userId: 'none' })], {
      none: details({ userId: 'none', bankAccountNumber: null }),
    });
    expect(findPaymentIssues(rows)[0]!.messageKey).toBe('payroll.paymentIssueMissingAccount');
  });
});

describe('buildPaymentCsv', () => {
  it('writes payable rows only — a bank file must never carry an unroutable line', () => {
    const rows = buildPaymentRows(
      [record({ userId: 'ok' }), record({ userId: 'bad', netSalary: 999 })],
      { ok: details({ userId: 'ok' }), bad: details({ userId: 'bad', bankAccountNumber: '42' }) },
    );
    const csv = buildPaymentCsv(rows);
    expect(csv).toContain('Ani Sargsyan');
    // The excluded row's amount IS mentioned — in the trailing `#` comment that
    // makes the omission visible. It must not appear as a data line.
    const dataLines = csv.split('\n').filter((l) => !l.startsWith('#'));
    expect(dataLines.some((l) => l.includes('999'))).toBe(false);
    expect(dataLines.some((l) => l.includes('u2'))).toBe(false);
  });

  it('ends with a TOTAL line and an explicit excluded note', () => {
    const rows = buildPaymentRows(
      [record({ userId: 'ok', netPayout: 400_000 }), record({ userId: 'bad', netSalary: 500 })],
      { ok: details({ userId: 'ok' }), bad: details({ userId: 'bad', bankAccountNumber: null }) },
    );
    const lines = buildPaymentCsv(rows).split('\n');
    expect(lines[1]!.startsWith('2026-08,Ani Sargsyan,')).toBe(true);
    expect(lines.at(-2)).toContain('TOTAL');
    expect(lines.at(-2)).toContain('400000');
    expect(lines.at(-1)).toContain('1 row(s) excluded');
  });

  it('has no excluded note when every row is payable', () => {
    const rows = buildPaymentRows([record()], { u1: details() });
    expect(buildPaymentCsv(rows)).not.toContain('excluded');
  });

  it('escapes commas and quotes in a beneficiary name (RFC 4180)', () => {
    const rows = buildPaymentRows([record()], {
      u1: details({ name: 'Doe, John "JD"' }),
    });
    const csv = buildPaymentCsv(rows);
    expect(csv).toContain('"Doe, John ""JD"""');
    // …and the header row stays intact.
    expect(csv.split('\n')[0]).toBe('period,beneficiary,account,bank,amount,currency');
  });
});
