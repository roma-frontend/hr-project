/**
 * The salary bank-file layout is now stored per organisation, which means two
 * things must not drift:
 *
 * 1. **The stored column list and the renderer's field list.** They live in
 *    different runtimes — the layout in Convex (`convex/lib/paymentFields.ts`),
 *    the renderer in React/Next (`src/lib/payroll/bankProfile.ts`, which
 *    re-exports the shared ids) — so a rename on one side once produced a file
 *    that silently lost a column.
 *
 * 2. **The new settings screen and its translations.** A missing key does not
 *    fail; it renders the raw key string in an admin screen the accountant is
 *    supposed to trust before moving salaries. The screen offers every field id
 *    as a label, and three separators, so all of them are asserted here in all
 *    four languages.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';
import {
  PAYMENT_DELIMITERS,
  PAYMENT_FIELD_IDS,
  dedupePaymentFields,
  isPaymentDelimiter,
  parsePaymentFieldList,
  unknownPaymentFields,
} from '../../convex/lib/paymentFields';
import {
  PAYMENT_FIELDS,
  buildCustomProfile,
  buildProfiledFile,
  getBankProfile,
} from '../lib/payroll/bankProfile';
import type { PaymentRow } from '../lib/payroll/paymentRegister';

const LOCALES = ['en', 'ru', 'hy', 'de'] as const;

function lookup(lng: string, ns: string, key: string): unknown {
  const file = path.join(process.cwd(), 'public', 'locales', lng, `${ns}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, json);
}

/** Keys live under the namespace's root object, so `payroll.paymentFields.x`. */
const payrollKey = (lng: string, key: string) => lookup(lng, 'payroll', `payroll.${key}`);

const row: PaymentRow = {
  userId: 'u1',
  name: 'Ani Petrosyan',
  account: '15700123456789012345',
  bankName: 'Ameriabank',
  amount: 450_000,
  currency: 'AMD',
  period: '2026-09',
  status: 'approved',
  missingAccount: false,
  invalidAccount: false,
  missingBeneficiary: false,
  zeroAmount: false,
};

describe('payment field list (shared between Convex and the renderer)', () => {
  it('keeps order, drops duplicates and unknown names', () => {
    expect(parsePaymentFieldList('account,beneficiary,amount,account,nonsense')).toEqual([
      'account',
      'beneficiary',
      'amount',
    ]);
  });

  it('treats an empty value as no override', () => {
    expect(parsePaymentFieldList('')).toEqual([]);
    expect(parsePaymentFieldList(null)).toEqual([]);
    expect(parsePaymentFieldList(undefined)).toEqual([]);
  });

  it('names the unknown fields so the save error is actionable', () => {
    expect(unknownPaymentFields(['account', 'nope', 'bad'])).toEqual(['nope', 'bad']);
    expect(unknownPaymentFields(['account'])).toEqual([]);
  });

  it('dedupes a stored row on read, so a hand-edited entry cannot double a column', () => {
    expect(dedupePaymentFields(['amount', 'amount', 'account'])).toEqual(['amount', 'account']);
  });

  it('accepts only the separators a portal realistically uses', () => {
    expect([...PAYMENT_DELIMITERS]).toEqual([',', ';', '\t']);
    expect(isPaymentDelimiter(',')).toBe(true);
    expect(isPaymentDelimiter(';')).toBe(true);
    expect(isPaymentDelimiter('\t')).toBe(true);
    expect(isPaymentDelimiter('|')).toBe(false);
    expect(isPaymentDelimiter('')).toBe(false);
  });

  it('has a renderer definition for every shared id', () => {
    for (const id of PAYMENT_FIELD_IDS) {
      expect(PAYMENT_FIELDS[id]).toBeDefined();
      expect(PAYMENT_FIELDS[id].id).toBe(id);
      // A header line is read by a human, so it must not be an i18n key.
      expect(PAYMENT_FIELDS[id].columnName).not.toContain('.');
    }
  });
});

describe('bank file layout overrides', () => {
  it('applies a separator and header override to the preset itself', () => {
    // This is the path the export route takes when an org saved the preset's own
    // column order but changed the separator: the override must still land.
    const preset = getBankProfile('fastbank'); // no header, comma by default
    const profile = buildCustomProfile(preset, preset.columns, {
      delimiter: ';',
      header: true,
    });
    expect(profile.delimiter).toBe(';');
    expect(profile.header).toBe(true);

    const file = buildProfiledFile([row], profile, { purpose: 'Salary 2026-09' });
    const [header, data] = file.content.split('\n');
    expect(header).toContain(';');
    expect(data).toBe(`15700123456789012345;450000`);
  });

  it('keeps the preset when no override is given', () => {
    const preset = getBankProfile('fastbank');
    const profile = buildCustomProfile(preset, preset.columns, {});
    expect(profile.delimiter).toBe(preset.delimiter);
    expect(profile.header).toBe(preset.header);
  });
});

describe('payroll file settings i18n', () => {
  it('labels every column the settings screen offers, in every language', () => {
    for (const lng of LOCALES) {
      for (const id of PAYMENT_FIELD_IDS) {
        const label = payrollKey(lng, `paymentFields.${id}`);
        expect(typeof label).toBe('string');
        expect(label).not.toBe('');
      }
    }
  });

  it('translates every string the settings screen renders', () => {
    const keys = [
      'payrollFile.title',
      'payrollFile.description',
      'payrollFile.adminOnly',
      'payrollFile.preset',
      'payrollFile.unverifiedNote',
      'payrollFile.columns',
      'payrollFile.columnsHint',
      'payrollFile.moveUp',
      'payrollFile.moveDown',
      'payrollFile.remove',
      'payrollFile.allColumnsUsed',
      'payrollFile.needColumns',
      'payrollFile.delimiter',
      'payrollFile.delimiterPreset',
      'payrollFile.delimiterComma',
      'payrollFile.delimiterSemicolon',
      'payrollFile.delimiterTab',
      'payrollFile.header',
      'payrollFile.headerPreset',
      'payrollFile.headerYes',
      'payrollFile.headerNo',
      'payrollFile.purpose',
      'payrollFile.purposePlaceholder',
      'payrollFile.purposeHint',
      'payrollFile.payerAccount',
      'payrollFile.payerAccountHint',
      'payrollFile.preview',
      'payrollFile.previewHint',
      'payrollFile.previewHintSample',
      'payrollFile.previewSource',
      'payrollFile.previewSample',
      'payrollFile.previewEmployees',
      'payrollFile.previewRows',
      'payrollFile.previewTotal',
      'payrollFile.previewExcluded',
      'payrollFile.previewEmpty',
      'payrollFile.previewNoRows',
      'payrollFile.previewDelimiter',
      // The template import: the file picker, every failure it can report, and
      // the mapping table. An untranslated key here renders a dotted string next
      // to a column the accountant is deciding how to pay people with.
      'payrollFile.importTitle',
      'payrollFile.importHint',
      'payrollFile.importChoose',
      'payrollFile.importFormats',
      'payrollFile.importUnsupported',
      'payrollFile.importEmpty',
      'payrollFile.importDetected',
      'payrollFile.importColumn',
      'payrollFile.importSample',
      'payrollFile.importMapsTo',
      'payrollFile.importUnnamed',
      'payrollFile.importInferred',
      'payrollFile.importIgnore',
      'payrollFile.importMissingRequired',
      'payrollFile.importReady',
      'payrollFile.importApplied',
      'payrollFile.importApply',
      'payrollFile.importCancel',
      'payrollFile.save',
      'payrollFile.saved',
      'payrollFile.reset',
      'payrollFile.resetDone',
    ];
    for (const lng of LOCALES) {
      for (const key of keys) {
        const value = payrollKey(lng, key);
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the interpolated placeholder in every string that has one', () => {
    // A translation that drops `{{value}}` renders "Separator:" with no value,
    // and one that drops `{{count}}` renders a sentence about " rows".
    const placeholders: Record<string, string[]> = {
      'payrollFile.previewDelimiter': ['{{value}}'],
      'payrollFile.previewHint': ['{{period}}'],
      'payrollFile.previewEmployees': ['{{count}}'],
      'payrollFile.previewRows': ['{{count}}'],
      'payrollFile.previewTotal': ['{{amount}}'],
      'payrollFile.previewExcluded': ['{{count}}'],
      'payrollFile.importDetected': ['{{file}}', '{{delimiter}}', '{{rows}}', '{{header}}'],
      'payrollFile.importUnnamed': ['{{n}}'],
      'payrollFile.importMissingRequired': ['{{fields}}'],
      'payrollFile.importReady': ['{{count}}'],
      'payrollFile.importApplied': ['{{count}}'],
    };
    for (const lng of LOCALES) {
      for (const [key, vars] of Object.entries(placeholders)) {
        const value = String(payrollKey(lng, key));
        for (const variable of vars) expect(value).toContain(variable);
      }
    }
  });

  it('does not leave the sample-row wording on the real-run preview', () => {
    // The two hints are shown in different situations; if one translation were
    // left as the other's, the screen would claim a payroll run is missing while
    // it is rendering one.
    for (const lng of LOCALES) {
      const real = String(payrollKey(lng, 'payrollFile.previewHint'));
      const sample = String(payrollKey(lng, 'payrollFile.previewHintSample'));
      expect(real).not.toBe(sample);
      expect(sample).not.toContain('{{period}}');
    }
  });

  it('names the settings tab in every language', () => {
    // The tab strip renders `settings.payrollFile`; a missing key would put a
    // raw dotted string in the navigation.
    for (const lng of LOCALES) {
      const label = lookup(lng, 'settings', 'settings.payrollFile');
      const desc = lookup(lng, 'settings', 'settings.payrollFileDesc');
      expect(typeof label).toBe('string');
      expect(typeof desc).toBe('string');
    }
  });
});
