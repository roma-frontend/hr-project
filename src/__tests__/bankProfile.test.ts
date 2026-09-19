/**
 * Tests for src/lib/payroll/bankProfile.ts — the bank-portal file layouts.
 *
 * Two things have to hold, and the second one matters more than the first:
 *
 * 1. The columns come out in the profile's order, escaped so a name with a
 *    semicolon in it does not shift every field after it.
 * 2. A file never contains a row the bank cannot act on, and every profile is
 *    honest about not having been validated against a live portal. Shipping a
 *    preset that claims to be "Ameriabank format" while nobody has opened
 *    Ameriabank's specification is how a month of salaries gets misrouted.
 */
import { describe, it, expect } from '@jest/globals';
import {
  BANK_PROFILES,
  PAYMENT_FIELDS,
  PAYMENT_FIELD_IDS,
  buildCustomProfile,
  buildProfiledFile,
  getBankProfile,
  parseFieldList,
  profileFilename,
} from '../lib/payroll/bankProfile';
import {
  buildPaymentRows,
  type PaymentEmployeeDetails,
  type PaymentPayrollRecord,
} from '../lib/payroll/paymentRegister';

function record(overrides: Partial<PaymentPayrollRecord> = {}): PaymentPayrollRecord {
  return {
    userId: 'u1',
    period: '2026-09',
    netSalary: 200_000,
    netPayout: null,
    status: 'approved',
    currency: 'AMD',
    ...overrides,
  };
}

function details(overrides: Partial<PaymentEmployeeDetails> = {}): PaymentEmployeeDetails {
  return {
    userId: 'u1',
    name: 'Անի Հակոբյան',
    bankAccountNumber: '12345678901234567890',
    bankName: 'Ameriabank',
    ...overrides,
  };
}

const rowsFor = (records: PaymentPayrollRecord[], map: Record<string, PaymentEmployeeDetails>) =>
  buildPaymentRows(records, map, 'AMD');

/**
 * Count `delimiter` occurrences that are not inside a quoted cell.
 *
 * A plain `line.split(delimiter)` cannot answer "did the escaping hold?",
 * because it splits the quoted cell as well. This walks the line the way a
 * parser would: inside quotes until a doubled quote or a closing one.
 */
function unquotedSeparators(line: string, delimiter: string): number {
  let count = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) count += 1;
  }
  return count;
}

describe('bank profiles', () => {
  it('gives every profile a translation key and a documentable caveat', () => {
    for (const profile of BANK_PROFILES) {
      expect(profile.labelKey).toMatch(/^payroll\.bankProfiles\./);
      expect(profile.noteKey).toMatch(/^payroll\.bankProfileNotes\./);
      expect(profile.columns.length).toBeGreaterThan(0);
    }
  });

  it('marks every shipped preset as unverified', () => {
    // The flag is the whole safety story. If a preset is ever genuinely checked
    // against a bank's specification, this test is where that decision gets
    // recorded — flipping the flag should be a deliberate edit with a source.
    for (const profile of BANK_PROFILES) {
      expect(profile.verified).toBe(false);
    }
  });

  it('only references known fields in any preset', () => {
    for (const profile of BANK_PROFILES) {
      for (const column of profile.columns) {
        expect(PAYMENT_FIELD_IDS).toContain(column);
      }
    }
  });

  it('falls back to the neutral profile for an unknown id', () => {
    expect(getBankProfile('not-a-bank').id).toBe('generic');
    expect(getBankProfile(undefined).id).toBe('generic');
    expect(getBankProfile('ameriabank').id).toBe('ameriabank');
  });

  it('gives every field a label key in a stable namespace', () => {
    for (const id of PAYMENT_FIELD_IDS) {
      expect(PAYMENT_FIELDS[id].labelKey).toBe(`payroll.paymentFields.${id}`);
    }
  });
});

describe('parseFieldList', () => {
  it('keeps known fields in order', () => {
    expect(parseFieldList('account,amount,beneficiary')).toEqual([
      'account',
      'amount',
      'beneficiary',
    ]);
  });

  it('drops unknown names instead of guessing', () => {
    expect(parseFieldList('account,iban,amount')).toEqual(['account', 'amount']);
  });

  it('drops duplicates, which would duplicate a column', () => {
    expect(parseFieldList('amount,amount,account')).toEqual(['amount', 'account']);
  });

  it('returns nothing for empty input so the caller can keep the preset', () => {
    expect(parseFieldList('')).toEqual([]);
    expect(parseFieldList(undefined)).toEqual([]);
    expect(parseFieldList(' , , ')).toEqual([]);
  });
});

describe('buildCustomProfile', () => {
  it('overrides the preset column order', () => {
    const profile = buildCustomProfile(getBankProfile('ameriabank'), ['amount', 'account']);
    expect(profile.columns).toEqual(['amount', 'account']);
  });

  it('keeps the preset columns when the override is empty', () => {
    const preset = getBankProfile('ameriabank');
    const profile = buildCustomProfile(preset, ['nonsense'] as never);
    expect(profile.columns).toEqual(preset.columns);
  });

  it('marks a customised profile as customised', () => {
    const profile = buildCustomProfile(getBankProfile('generic'), ['amount']);
    expect(profile.id).toBe('generic:custom');
    // Still unverified: editing the columns does not make the layout certified.
    expect(profile.verified).toBe(false);
  });
});

describe('buildProfiledFile', () => {
  it('writes readable header names and the cells in column order', () => {
    const rows = rowsFor([record()], { u1: details() });
    const file = buildProfiledFile(rows, getBankProfile('generic'));
    const [header, first] = file.content.split('\n');

    expect(header).toBe('Beneficiary,Account number,Amount,Currency');
    expect(first).toBe('Անի Հակոբյան,12345678901234567890,200000,AMD');
  });

  it('never writes an i18n key into the file', () => {
    // The header words the accountant reads are column names, not translation
    // keys — `payroll.paymentFields.account` in a bank file would be worse than
    // no header at all.
    const rows = rowsFor([record()], { u1: details() });
    for (const profile of BANK_PROFILES) {
      const file = buildProfiledFile(rows, profile);
      expect(file.content).not.toContain('payroll.');
    }
  });

  it('honours localised header names when the caller supplies them', () => {
    const rows = rowsFor([record()], { u1: details() });
    const file = buildProfiledFile(rows, getBankProfile('generic'), {
      headers: { beneficiary: 'Ստացող', account: 'Հաշվի համար' },
    });
    expect(file.content.split('\n')[0]).toBe('Ստացող,Հաշվի համար,Amount,Currency');
  });

  it('omits the header line for profiles whose portal rejects one', () => {
    const rows = rowsFor([record()], { u1: details() });
    const file = buildProfiledFile(rows, getBankProfile('fastbank'));
    expect(file.content.split('\n')).toHaveLength(1);
    expect(file.headers).toHaveLength(2);
  });

  it('quotes a cell that contains the delimiter, so columns cannot shift', () => {
    const rows = rowsFor([record()], { u1: details({ name: 'Smith; John' }) });
    const file = buildProfiledFile(rows, getBankProfile('ameriabank'));
    const line = file.content.split('\n')[1]!;
    expect(line).toContain('"Smith; John"');
    // A naive `split(';')` would split inside the quotes too, which is exactly
    // the failure this escaping exists to prevent — so count the separators that
    // are *outside* quoted cells instead.
    expect(unquotedSeparators(line, ';')).toBe(getBankProfile('ameriabank').columns.length - 1);
  });

  it('fills the payer-supplied fields from the context', () => {
    const rows = rowsFor([record()], { u1: details() });
    const file = buildProfiledFile(rows, getBankProfile('generic'), {
      purpose: 'September salary',
      payerAccount: '99998888777766665555',
    });
    const custom = buildCustomProfile(getBankProfile('generic'), [
      'account',
      'purpose',
      'payerAccount',
    ]);
    const withContext = buildProfiledFile(rows, custom, {
      purpose: 'September salary',
      payerAccount: '99998888777766665555',
    });
    expect(withContext.content).toContain('September salary');
    expect(withContext.content).toContain('99998888777766665555');
    // Without a context the columns are present but empty — never omitted, or
    // the row would have fewer cells than the header.
    expect(file.headers).toHaveLength(4);
    expect(file.content.split('\n')[1]!.split(',')).toHaveLength(4);
  });

  it('carries payable rows only, and reports what it held back', () => {
    const rows = rowsFor([record({ userId: 'u1' }), record({ userId: 'u2' })], {
      u1: details(),
      // No account at all — the bank cannot be told where to send it.
      u2: details({ userId: 'u2', name: 'Բ Լոռե', bankAccountNumber: null }),
    });
    const file = buildProfiledFile(rows, getBankProfile('generic'));

    expect(file.included).toBe(1);
    expect(file.excluded).toBe(1);
    expect(file.skipped).toHaveLength(1);
    expect(file.skipped[0]!.userId).toBe('u2');
    // The employee's name must not appear in a file that will not pay them.
    expect(file.content).not.toContain('Բ Լոռե');
  });

  it('reports the amount written, so the accountant can reconcile first', () => {
    const rows = rowsFor(
      [record({ userId: 'u1', netSalary: 100_000 }), record({ userId: 'u2', netSalary: 250_000 })],
      { u1: details(), u2: details({ userId: 'u2' }) },
    );
    const file = buildProfiledFile(rows, getBankProfile('generic'));
    expect(file.amount).toBe(350_000);
  });

  it('uses netPayout (salary plus reimbursed claims) rather than netSalary', () => {
    const rows = rowsFor([record({ netSalary: 200_000, netPayout: 215_000 })], { u1: details() });
    const file = buildProfiledFile(rows, getBankProfile('fastbank'));
    expect(file.content).toContain('215000');
    expect(file.content).not.toContain('200000');
  });

  it('drops cancelled records — they are not paid', () => {
    const rows = rowsFor(
      [record({ userId: 'u1' }), record({ userId: 'u2', status: 'cancelled' })],
      { u1: details(), u2: details({ userId: 'u2' }) },
    );
    const file = buildProfiledFile(rows, getBankProfile('generic'));
    expect(file.included).toBe(1);
  });

  it('propagates the profile id and verification flag into the result', () => {
    const rows = rowsFor([record()], { u1: details() });
    const file = buildProfiledFile(rows, getBankProfile('acba'));
    expect(file.profileId).toBe('acba');
    expect(file.verified).toBe(false);
  });

  it('produces an empty body rather than a stray newline when nothing is payable', () => {
    const file = buildProfiledFile([], getBankProfile('fastbank'));
    expect(file.content).toBe('');
    expect(file.included).toBe(0);
  });
});

describe('profileFilename', () => {
  it('names the file after the bank and the period', () => {
    expect(profileFilename('ameriabank', '2026-09')).toBe('salary-2026-09-ameriabank.csv');
  });

  it('strips the custom-suffix and anything path-like from the id', () => {
    expect(profileFilename('ameriabank:custom', '2026-09')).toBe('salary-2026-09-ameriabank.csv');
    expect(profileFilename('../../etc/passwd', '2026-09')).toBe('salary-2026-09-etcpasswd.csv');
  });
});
