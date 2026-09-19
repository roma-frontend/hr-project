/**
 * Reading a bank's own template file.
 *
 * The import exists to stop the column order from being retyped by hand, so the
 * failure it has to avoid is a *silent* mis-read: a template read with the wrong
 * separator, or a header row read as data, produces a plausible-looking column
 * order that is off by one. Every case here is one of those, asserted on the
 * bytes a real Armenian or Russian template contains.
 */
import { describe, it, expect } from '@jest/globals';
import {
  TEMPLATE_DELIMITERS,
  ambiguousHeaderForms,
  detectDelimiter,
  fieldForHeader,
  inferFromValue,
  looksBinary,
  missingRequiredFields,
  orderedFields,
  parseTemplate,
} from '../lib/payroll/templateImport';

describe('separator detection', () => {
  it('reads the separator from the file rather than assuming a comma', () => {
    expect(detectDelimiter('Name;Amount\nAni;450000\n')).toBe(';');
    expect(detectDelimiter('Name,Amount\nAni,450000\n')).toBe(',');
    expect(detectDelimiter('Name\tAmount\nAni\t450000\n')).toBe('\t');
  });

  it('prefers the separator that is consistent across rows over the one that is merely present', () => {
    // A semicolon template whose address column contains commas. Counting
    // occurrences would pick the comma and split every row in the wrong place.
    const text =
      'Name;Address;Amount\nAni;Yerevan, Kentron 1;450000\nDavit;Gyumri, Centre;380000\n';
    expect(detectDelimiter(text)).toBe(';');
  });

  it('is not fooled by a comma inside a quoted cell', () => {
    const text = 'Name,Address,Amount\nAni,"Yerevan, Kentron 1",450000\n';
    expect(detectDelimiter(text)).toBe(',');
  });

  it('falls back to a comma for a single-column file instead of guessing', () => {
    expect(detectDelimiter('Amount\n450000\n')).toBe(',');
    expect(TEMPLATE_DELIMITERS).toContain(detectDelimiter('Amount\n450000\n'));
  });
});

describe('template parsing', () => {
  const armenian = [
    'Հաշվի համար;Անուն Ազգանուն;Գումար;Նշանակություն',
    '15700123456789012345;Ani Petrosyan;450000;Salary 2026-09',
    '22000456789012345678;Davit Sargsyan;380000;Salary 2026-09',
  ].join('\n');

  it('maps an Armenian header row to fields, in file order', () => {
    const parsed = parseTemplate(armenian);
    expect(parsed.delimiter).toBe(';');
    expect(parsed.hasHeader).toBe(true);
    expect(parsed.dataRows).toBe(2);
    expect(parsed.columns.map((c) => c.suggested)).toEqual([
      'account',
      'beneficiary',
      'amount',
      'purpose',
    ]);
    // Names, not shapes — these must not be reported as guesses.
    expect(parsed.columns.every((c) => c.inferred === false)).toBe(true);
    expect(parsed.columns.map((c) => c.header)).toEqual([
      'Հաշվի համար',
      'Անուն Ազգանուն',
      'Գումար',
      'Նշանակություն',
    ]);
  });

  it('maps a Russian header row, including the payer account', () => {
    const text = [
      'Счёт плательщика;Номер счёта;ФИО;Сумма;Назначение платежа',
      '15700123456789012345;22000456789012345678;Ани Петросян;450 000;Зарплата',
    ].join('\n');
    const parsed = parseTemplate(text);
    expect(parsed.columns.map((c) => c.suggested)).toEqual([
      'payerAccount',
      'account',
      'beneficiary',
      'amount',
      'purpose',
    ]);
  });

  it('keeps a quoted delimiter and a quoted newline inside one cell', () => {
    const text =
      'Account;Name;Purpose\n15700123456789012345;"Petrosyan, Ani";"Salary;\nSeptember"\n';
    const parsed = parseTemplate(text);
    expect(parsed.columns).toHaveLength(3);
    expect(parsed.columns[1]!.sample).toBe('Petrosyan, Ani');
    // Two data rows would mean the quoted newline split the record.
    expect(parsed.dataRows).toBe(1);
    expect(parsed.columns[2]!.sample).toContain('September');
  });

  it('strips a byte-order mark so the first header cell still matches', () => {
    const parsed = parseTemplate('\uFEFFAmount;Account\n450000;15700123456789012345\n');
    expect(parsed.columns[0]!.suggested).toBe('amount');
  });

  it('detects a header line whose vocabulary we do not have, from the row shapes', () => {
    // Invented column names: no synonym matches, but a non-numeric row above a
    // numeric one is a header by any reading — so the names are kept for the
    // accountant to read and the *values* supply the suggestion instead.
    const parsed = parseTemplate('Kod;Znachenie\n15700123456789012345;450000\n');
    expect(parsed.hasHeader).toBe(true);
    expect(parsed.dataRows).toBe(1);
    expect(parsed.columns.map((c) => c.header)).toEqual(['Kod', 'Znachenie']);
    expect(parsed.columns.map((c) => c.suggested)).toEqual(['account', 'amount']);
    // Flagged as guesses, so the screen asks for confirmation rather than
    // presenting them with the confidence a name match would carry.
    expect(parsed.columns.every((c) => c.inferred)).toBe(true);
  });

  it('claims nothing when neither the names nor the values say anything', () => {
    const parsed = parseTemplate('Kod;Znachenie\nAlpha;Beta\n');
    expect(parsed.columns.map((c) => c.suggested)).toEqual([null, null]);
  });

  it('reads a headerless file as data and flags guesses made from the values', () => {
    const parsed = parseTemplate('15700123456789012345,300000\n22000456789012345678,200000\n');
    expect(parsed.hasHeader).toBe(false);
    expect(parsed.dataRows).toBe(2);
    expect(parsed.columns.map((c) => c.suggested)).toEqual(['account', 'amount']);
    expect(parsed.columns.every((c) => c.inferred)).toBe(true);
    // Without a header there is no name to show, so the screen numbers it.
    expect(parsed.columns[0]!.header).toBe('');
  });

  it('gives one field to one column, leaving the second claim unassigned', () => {
    const parsed = parseTemplate('Amount;Summa;Account\n450000;450000;15700123456789012345\n');
    expect(parsed.columns[0]!.suggested).toBe('amount');
    expect(parsed.columns[1]!.suggested).toBeNull();
    expect(parsed.columns[2]!.suggested).toBe('account');
  });

  it('handles a header with nothing under it', () => {
    const parsed = parseTemplate('Name;Account;Amount\n');
    expect(parsed.hasHeader).toBe(true);
    expect(parsed.columns).toHaveLength(3);
    expect(parsed.dataRows).toBe(0);
    expect(parsed.columns.every((c) => c.sample === '')).toBe(true);
  });

  it('returns no columns for an empty file rather than an empty column', () => {
    const parsed = parseTemplate('   \n\n');
    expect(parsed.columns).toEqual([]);
    expect(parsed.dataRows).toBe(0);
  });

  it('uses an explicit separator override when it is one the export could also write', () => {
    const forced = parseTemplate('Name;Amount\nAni;450000\n', { delimiter: ',' });
    expect(forced.delimiter).toBe(',');
    expect(forced.columns).toHaveLength(1);
    // The whole line collapses into one column instead of being split wrongly,
    // which is visible on the screen — one column whose value is the raw line —
    // rather than silent.
    expect(forced.columns[0]!.sample).toBe('Name;Amount');
    expect(forced.columns[0]!.suggested).toBeNull();
  });

  it('ignores a separator the portal does not accept rather than writing it', () => {
    expect(parseTemplate('Name|Amount\nAni|450000\n').delimiter).toBe(',');
    expect(parseTemplate('Name,Amount\nAni,450000\n', { delimiter: '|' }).delimiter).toBe(',');
  });
});

describe('header vocabulary', () => {
  it('matches whole cells, so a payer account is not read as a beneficiary account', () => {
    expect(fieldForHeader('Счет плательщика')).toBe('payerAccount');
    expect(fieldForHeader('Счёт №')).toBe('account');
    expect(fieldForHeader('Назначение платежа')).toBe('purpose');
    expect(fieldForHeader('Գումար')).toBe('amount');
    expect(fieldForHeader('валюта')).toBe('currency');
    expect(fieldForHeader('Period')).toBe('period');
  });

  it('ignores case, punctuation and the ё/е distinction', () => {
    expect(fieldForHeader('  ACCOUNT-NUMBER ')).toBe('account');
    expect(fieldForHeader('расчётный счёт')).toBe('account');
    expect(fieldForHeader('расчетный счет')).toBe('account');
  });

  it('returns null for a column it has no business guessing at', () => {
    expect(fieldForHeader('ծանոթագրություն')).toBeNull();
    expect(fieldForHeader('')).toBeNull();
    expect(fieldForHeader('   ')).toBeNull();
  });

  it('has no form claimed by two fields', () => {
    // A duplicate would resolve by list order, which is not a reason.
    expect(ambiguousHeaderForms()).toEqual([]);
  });
});

describe('inference from a value', () => {
  it('recognises an Armenian account, a period and an amount', () => {
    expect(inferFromValue('15700123456789012345')).toBe('account');
    expect(inferFromValue('1570 0123 4567 8901 2345')).toBe('account');
    expect(inferFromValue('2026-09')).toBe('period');
    expect(inferFromValue('450000')).toBe('amount');
    expect(inferFromValue('450 000,50')).toBeNull();
  });

  it('refuses a digit string that is too long for an account and too long for an amount', () => {
    // 21+ digits is some banks' card numbering; calling it an account would put
    // an unroutable value in a payment file.
    expect(inferFromValue('123456789012345678901')).toBeNull();
  });

  it('recognises nothing in text', () => {
    expect(inferFromValue('Ani Petrosyan')).toBeNull();
    expect(inferFromValue('')).toBeNull();
  });
});

describe('applying a mapping', () => {
  it('keeps the file order, drops ignored columns and repeats', () => {
    expect(orderedFields(['amount', '', 'account', 'amount', 'beneficiary', null])).toEqual([
      'amount',
      'account',
      'beneficiary',
    ]);
  });

  it('ignores anything that is not a known field', () => {
    expect(orderedFields(['account', 'nonsense' as never])).toEqual(['account']);
    expect(orderedFields([])).toEqual([]);
  });

  it('names the columns a payment file cannot be saved without', () => {
    expect(missingRequiredFields(['account', 'amount'])).toEqual([]);
    expect(missingRequiredFields(['account', 'beneficiary'])).toEqual(['amount']);
    expect(missingRequiredFields([])).toEqual(['account', 'amount']);
  });
});

describe('binary files', () => {
  it('detects a spreadsheet read as text, so the screen can say what to do', () => {
    expect(looksBinary('PK\u0003\u0004\u0014\u0000\u0006\u0000')).toBe(true);
    expect(looksBinary('col1,col2\u0000\u0000')).toBe(true);
    expect(looksBinary('�PNG')).toBe(true);
  });

  it('leaves ordinary text alone', () => {
    expect(looksBinary('Account;Amount\n15700123456789012345;450000\n')).toBe(false);
    expect(looksBinary('')).toBe(false);
  });
});
