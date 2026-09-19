import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@/lib/logger';
import {
  buildPaymentCsv,
  buildPaymentRows,
  computePaymentTotals,
  findPaymentIssues,
  isPayable,
  type PaymentEmployeeDetails,
  type PaymentPayrollRecord,
} from '@/lib/payroll/paymentRegister';
import {
  buildCustomProfile,
  buildProfiledFile,
  getBankProfile,
  isPaymentDelimiter,
  parseFieldList,
  profileFilename,
} from '@/lib/payroll/bankProfile';

/**
 * Bank payment register for a payroll run — the file the accountant uploads to
 * the bank portal to pay salaries.
 *
 * Three shapes, same numbers:
 *   - `format: 'xlsx'` (default) — styled workbook, one row per beneficiary,
 *     with totals and a pre-flight issues block, for the accountant's file.
 *   - `format: 'csv'` with no `profile` — neutral account/amount CSV, payable
 *     rows only (the CSV builder drops and reports unroutable rows).
 *   - `format: 'csv'` with a `profile` — the same rows laid out for one bank
 *     portal (`lib/payroll/bankProfile.ts`), optionally overriding the column
 *     order via `columns`. The response repeats the layout's `verified` flag in
 *     a header so the client can warn that a preset has not been checked against
 *     the bank's spec.
 *
 * Like the SRC route this is a dumb formatter: every RBAC check already happened
 * in Convex (`payroll.queries.getPayrollRunById` is supervisor-scoped) and the
 * payload is what that query returned to the authorised caller.
 */

type Lang = 'en' | 'ru' | 'hy' | 'de';

interface HeaderDict {
  sheet: string;
  period: string;
  beneficiary: string;
  account: string;
  bank: string;
  amount: string;
  currency: string;
  status: string;
  totals: string;
  issuesTitle: string;
  issueMissingAccount: string;
  issueInvalidAccount: string;
  issueMissingBeneficiary: string;
  issueZeroAmount: string;
  org: string;
  generated: string;
  excludedNote: string;
}

const HEADERS: Record<Lang, HeaderDict> = {
  en: {
    sheet: 'Salary Payment Register',
    period: 'Period',
    beneficiary: 'Beneficiary',
    account: 'Account number',
    bank: 'Bank',
    amount: 'Amount',
    currency: 'Currency',
    status: 'Status',
    totals: 'TOTAL TO TRANSFER',
    issuesTitle: 'Rows excluded from the payment file',
    issueMissingAccount: 'No bank account — add it on the employee profile',
    issueInvalidAccount: 'Account is not 20 digits',
    issueMissingBeneficiary: 'No employee name on the record',
    issueZeroAmount: 'Zero amount',
    org: 'Organization',
    generated: 'Generated',
    excludedNote: 'excluded',
  },
  ru: {
    sheet: 'Реестр перечислений зарплаты',
    period: 'Период',
    beneficiary: 'Получатель',
    account: 'Номер счёта',
    bank: 'Банк',
    amount: 'Сумма',
    currency: 'Валюта',
    status: 'Статус',
    totals: 'ИТОГО К ПЕРЕЧИСЛЕНИЮ',
    issuesTitle: 'Строки, исключённые из платёжного файла',
    issueMissingAccount: 'Нет банковского счёта — заполните в профиле сотрудника',
    issueInvalidAccount: 'Счёт не 20 цифр',
    issueMissingBeneficiary: 'В записи нет имени сотрудника',
    issueZeroAmount: 'Нулевая сумма',
    org: 'Организация',
    generated: 'Сформировано',
    excludedNote: 'исключено',
  },
  hy: {
    sheet: 'Աշխատավարձի փոխանցումների ցուցակ',
    period: 'Ժամանակաշրջան',
    beneficiary: 'Ստացող',
    account: 'Հաշվի համար',
    bank: 'Բանկ',
    amount: 'Գումար',
    currency: 'Արժույթ',
    status: 'Կարգավիճակ',
    totals: 'ԸՆԴՀԱՆՈՒՐ ՓՈԽԱՆՑՄԱՆ',
    issuesTitle: 'Վճարային ֆայլից բացառված տողեր',
    issueMissingAccount: 'Բանկային հաշիվ չկա — լրացրեք աշխատակցի պրոֆիլում',
    issueInvalidAccount: 'Հաշիվը 20 նիշ չէ',
    issueMissingBeneficiary: 'Գրառման մեջ աշխատակցի անուն չկա',
    issueZeroAmount: 'Զրո գումար',
    org: 'Կազմակերպություն',
    generated: 'Կազմված է',
    excludedNote: 'բացառված',
  },
  de: {
    sheet: 'Gehaltszahlungsregister',
    period: 'Zeitraum',
    beneficiary: 'Empfänger',
    account: 'Kontonummer',
    bank: 'Bank',
    amount: 'Betrag',
    currency: 'Währung',
    status: 'Status',
    totals: 'GESAMT ZU ÜBERWEISEN',
    issuesTitle: 'Aus der Zahlungsdatei ausgeschlossene Zeilen',
    issueMissingAccount: 'Keine Bankverbindung — im Mitarbeiterprofil ergänzen',
    issueInvalidAccount: 'Kontonummer hat nicht 20 Stellen',
    issueMissingBeneficiary: 'Kein Mitarbeitername am Datensatz',
    issueZeroAmount: 'Betrag ist null',
    org: 'Organisation',
    generated: 'Erstellt',
    excludedNote: 'ausgeschlossen',
  },
};

function normalizeLang(lang?: string): Lang {
  const code = (lang || 'en').slice(0, 2).toLowerCase();
  return code === 'ru' || code === 'hy' || code === 'de' ? code : 'en';
}

interface PaymentRegisterBody {
  records?: PaymentPayrollRecord[];
  details?: Record<string, PaymentEmployeeDetails>;
  organizationName?: string;
  currency?: string;
  lang?: string;
  format?: 'xlsx' | 'csv';
  /** Bank preset id; absent means the neutral CSV. */
  profile?: string;
  /** Comma-separated field ids overriding the preset's column order. */
  columns?: string;
  /** Cell separator override; must be one of the accepted separators. */
  delimiter?: string;
  /** Header-line override for the layout. */
  header?: boolean;
  /** Payment description the portal asks for on every line. */
  purpose?: string;
  /** The paying account, when the template includes it. */
  payerAccount?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PaymentRegisterBody;
    const records = body.records;
    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Records array is required' }, { status: 400 });
    }

    const t = HEADERS[normalizeLang(body.lang)];
    const currency = body.currency ?? 'AMD';
    const rows = buildPaymentRows(records, body.details ?? {}, currency);
    const totals = computePaymentTotals(rows);
    const issues = findPaymentIssues(rows);

    const period = rows[0]?.period ?? 'all';

    // ── CSV: bank portal file ─────────────────────────────────────────────
    if (body.format === 'csv') {
      // A named profile means the accountant picked a layout; anything else is
      // the neutral file this route has always produced.
      if (body.profile) {
        // A separator outside the three a portal accepts is a client bug, not a
        // layout choice. Failing loudly beats writing a file whose separator
        // silently does not match what the caller asked for.
        if (body.delimiter !== undefined && !isPaymentDelimiter(body.delimiter)) {
          return NextResponse.json({ error: 'Unsupported delimiter' }, { status: 400 });
        }

        const preset = getBankProfile(body.profile);
        const columns = parseFieldList(body.columns);
        const options = { delimiter: body.delimiter, header: body.header };
        // Overrides apply whether or not the columns were pinned: an org that
        // saved the preset's own column order but changed the separator must
        // still get their separator.
        const profile =
          columns.length > 0 || body.delimiter !== undefined || body.header !== undefined
            ? buildCustomProfile(preset, columns.length > 0 ? columns : preset.columns, options)
            : preset;
        const file = buildProfiledFile(rows, profile, {
          purpose: body.purpose,
          payerAccount: body.payerAccount,
        });

        // BOM so Excel on Windows opens Armenian/Cyrillic names correctly.
        return new NextResponse('\uFEFF' + file.content, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${profileFilename(file.profileId, period)}"`,
            // The client warns when this is 'false' — an unchecked layout is not
            // a certified one, and the accountant is the last line of defence.
            'X-Payment-Profile': file.profileId,
            'X-Payment-Profile-Verified': String(file.verified),
            'X-Payment-Rows-Included': String(file.included),
            'X-Payment-Rows-Excluded': String(file.excluded),
            'X-Payment-Amount': String(file.amount),
          },
        });
      }

      const csv = buildPaymentCsv(rows);
      return new NextResponse('\uFEFF' + csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="salary-payments-${period}.csv"`,
        },
      });
    }

    // ── XLSX: the accountant's working file ───────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Strata HR';
    workbook.created = new Date();

    const ws = workbook.addWorksheet(t.sheet, {
      properties: { tabColor: { argb: '0F766E' } },
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { header: t.period, key: 'period', width: 12 },
      { header: t.beneficiary, key: 'beneficiary', width: 28 },
      { header: t.account, key: 'account', width: 24 },
      { header: t.bank, key: 'bank', width: 22 },
      { header: t.amount, key: 'amount', width: 16 },
      { header: t.currency, key: 'currency', width: 10 },
      { header: t.status, key: 'status', width: 12 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    for (const r of rows) {
      ws.addRow({
        period: r.period,
        beneficiary: r.name,
        // An unroutable account is shown, not hidden: the accountant needs to
        // see which row to fix, even though it is excluded from the CSV file.
        account: r.account || '—',
        bank: r.bankName,
        amount: r.amount,
        currency: r.currency,
        status: isPayable(r) ? r.status : `${t.excludedNote}`,
      });
    }

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
      row.getCell('amount').numFmt = '#,##0.00';
    });

    const totalsRow = ws.addRow({
      beneficiary: t.totals,
      amount: totals.amount,
      currency: rows[0]?.currency ?? currency,
    });
    totalsRow.font = { bold: true };
    totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCFBF1' } };
    totalsRow.getCell('amount').numFmt = '#,##0.00';

    if (issues.length > 0) {
      ws.addRow([]);
      const title = ws.addRow([`${t.issuesTitle} (${issues.length})`]);
      title.font = { bold: true, color: { argb: 'B45309' } };
      const LABEL: Record<string, keyof HeaderDict> = {
        'payroll.paymentIssueMissingAccount': 'issueMissingAccount',
        'payroll.paymentIssueInvalidAccount': 'issueInvalidAccount',
        'payroll.paymentIssueMissingBeneficiary': 'issueMissingBeneficiary',
        'payroll.paymentIssueZeroAmount': 'issueZeroAmount',
      };
      for (const issue of issues) {
        const labelKey = LABEL[issue.messageKey];
        ws.addRow([labelKey ? t[labelKey] : issue.messageKey, issue.name]);
      }
    }

    ws.addRow([]);
    const footer = ws.addRow([`${t.org}: ${body.organizationName ?? ''}`]);
    footer.font = { bold: true };
    ws.addRow([`${t.generated}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`]);

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `salary-payments-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('Payment register export error:', error);
    return NextResponse.json({ error: 'Failed to export payment register' }, { status: 500 });
  }
}
