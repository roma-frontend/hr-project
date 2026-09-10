/**
 * Tests for src/lib/exportMyPayslip.ts
 *
 * pdfmake is mocked (the loader helpers) so the test asserts on the document
 * definition that reaches `createPdf` plus the download filename and locale
 * handling.
 */

jest.mock('@/lib/payrollUtils', () => ({
  formatCurrency: jest.fn((n: number, currency = 'AMD') => `${currency} ${n}`),
}));

jest.mock('@/lib/exportDocument', () => ({
  loadPdfMakeWithFonts: jest.fn(),
}));

import { loadPdfMakeWithFonts } from '@/lib/exportDocument';
import { exportMyPayslipPdf } from '@/lib/exportMyPayslip';

const loadMock = loadPdfMakeWithFonts as jest.Mock;

function makeMonth(overrides: Record<string, unknown> = {}) {
  return {
    month: '2025-03',
    hasRecord: true,
    gross: 1000,
    net: 800,
    bonus: 50,
    overtimeHours: 0,
    overtimePay: 0,
    pension: 50,
    incomeTax: 100,
    socialSecurity: 25,
    healthInsurance: 10,
    other: 0,
    employerTotal: 1200,
    currency: 'AMD',
    taxCountry: 'AM',
    status: 'paid',
    ...overrides,
  };
}

function makeSummary(overrides: Record<string, unknown> = {}) {
  return {
    year: 2025,
    months: [makeMonth(), makeMonth({ month: '2025-04', hasRecord: false })],
    ytd: {
      gross: 2000,
      net: 1600,
      bonus: 50,
      pension: 100,
      incomeTax: 200,
      socialSecurity: 50,
      healthInsurance: 20,
      other: 0,
      employerTotal: 2400,
      netKept: 1600,
      taxes: 200,
      mandatory: 170,
      monthsWithPay: 1,
    },
    latest: makeMonth(),
    ...overrides,
  };
}

const user = { id: 'u1', name: 'Jane Doe', email: 'jane@example.com', organizationId: 'org1' };

const t = ((key: string, fallback?: string) => fallback ?? key) as unknown as Parameters<
  typeof exportMyPayslipPdf
>[0]['t'];

let createPdf: jest.Mock;
let download: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  download = jest.fn();
  createPdf = jest.fn(() => ({ download }));
  loadMock.mockResolvedValue({ pdfMake: { createPdf }, font: 'Roboto' });
});

describe('exportMyPayslipPdf', () => {
  it('throws when summary is missing', async () => {
    await expect(
      exportMyPayslipPdf({ summary: undefined as never, user, locale: 'en', t }),
    ).rejects.toThrow('Missing data');
  });

  it('throws when user is missing', async () => {
    await expect(
      exportMyPayslipPdf({ summary: makeSummary() as never, user: null, locale: 'en', t }),
    ).rejects.toThrow('Missing data');
  });

  it('creates a pdf and downloads it with a slugged filename', async () => {
    await exportMyPayslipPdf({ summary: makeSummary() as never, user, locale: 'en', t });

    expect(createPdf).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith('payslip-2025-Jane-Doe.pdf');
  });

  it('falls back to "me" when the user has no name', async () => {
    await exportMyPayslipPdf({
      summary: makeSummary() as never,
      user: { ...user, name: undefined as unknown as string },
      locale: 'en',
      t,
    });

    expect(download).toHaveBeenCalledWith('payslip-2025-me.pdf');
  });

  it('sets the default style font from the loader', async () => {
    await exportMyPayslipPdf({ summary: makeSummary() as never, user, locale: 'en', t });

    const doc = createPdf.mock.calls[0][0] as { defaultStyle: { font: string } };
    expect(doc.defaultStyle.font).toBe('Roboto');
  });

  it('renders the latest-record table when latest.hasRecord', async () => {
    await exportMyPayslipPdf({ summary: makeSummary() as never, user, locale: 'en', t });

    const doc = createPdf.mock.calls[0][0] as { content: any[] };
    const latestBlock = doc.content[4] as { table?: unknown };
    expect(latestBlock.table).toBeDefined();
  });

  it('includes overtime hours when present', async () => {
    const summary = makeSummary({
      latest: makeMonth({ overtimeHours: 5, overtimePay: 75 }),
    });

    await exportMyPayslipPdf({ summary: summary as never, user, locale: 'en', t });

    const doc = createPdf.mock.calls[0][0] as { content: any[] };
    const body = doc.content[4].table.body as any[][];
    const overtimeRow = body.find((r) => r[0] === 'Overtime');
    expect(overtimeRow?.[1].text).toContain('(5 h)');
  });

  it('renders the no-data branch when latest.hasRecord is false', async () => {
    const summary = makeSummary({ latest: makeMonth({ hasRecord: false }) });

    await exportMyPayslipPdf({ summary: summary as never, user, locale: 'en', t });

    const doc = createPdf.mock.calls[0][0] as { content: any[] };
    expect(doc.content[4].italics).toBe(true);
  });

  it('renders the no-data branch when latest is null', async () => {
    const summary = makeSummary({ latest: null });

    await exportMyPayslipPdf({ summary: summary as never, user, locale: 'en', t });

    const doc = createPdf.mock.calls[0][0] as { content: any[] };
    expect(doc.content[4].italics).toBe(true);
  });

  it('defaults the currency to AMD when latest is null', async () => {
    const summary = makeSummary({ latest: null });

    await exportMyPayslipPdf({ summary: summary as never, user, locale: 'en', t });

    const doc = createPdf.mock.calls[0][0] as { content: any[] };
    const ytdBody = doc.content[6].table.body as any[][];
    expect(ytdBody[1][1].text).toContain('AMD');
  });

  it('maps the locale to a language name in the footer', async () => {
    for (const [locale, expected] of [
      ['hy-AM', 'Armenian'],
      ['ru-RU', 'Russian'],
      ['en-US', 'English'],
      ['de-DE', 'English'],
    ] as const) {
      createPdf.mockClear();
      await exportMyPayslipPdf({ summary: makeSummary() as never, user, locale, t });
      const doc = createPdf.mock.calls[0][0] as { content: any[] };
      const footer = doc.content[7] as { text: string };
      expect(footer.text).toContain(expected);
    }
  });

  it('uses fallback strings when t throws', async () => {
    const throwingT = (() => {
      throw new Error('no i18n');
    }) as unknown as Parameters<typeof exportMyPayslipPdf>[0]['t'];

    await exportMyPayslipPdf({
      summary: makeSummary() as never,
      user,
      locale: 'en',
      t: throwingT,
    });

    const doc = createPdf.mock.calls[0][0] as { content: any[] };
    expect(doc.content[0].text).toBe('My payroll summary');
  });

  it('ignores a non-string t result and uses the fallback', async () => {
    const weirdT = ((key: string) => 42) as unknown as Parameters<
      typeof exportMyPayslipPdf
    >[0]['t'];

    await exportMyPayslipPdf({
      summary: makeSummary() as never,
      user,
      locale: 'en',
      t: weirdT,
    });

    const doc = createPdf.mock.calls[0][0] as { content: any[] };
    expect(doc.content[0].text).toBe('My payroll summary');
  });

  it('marks months without a record with an em dash', async () => {
    await exportMyPayslipPdf({ summary: makeSummary() as never, user, locale: 'en', t });

    const doc = createPdf.mock.calls[0][0] as { content: any[] };
    const body = doc.content[6].table.body as any[][];
    const emptyRow = body.find((r) => r[0].text === '—');
    expect(emptyRow).toBeDefined();
  });
});
