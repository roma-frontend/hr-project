import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@/lib/logger';
import {
  buildSrcRows,
  computeSrcTotals,
  findSrcIssues,
  type SrcEmployeeIdentity,
  type SrcPayrollRecord,
} from '@/lib/payroll/srcExport';

/**
 * SRC ( Armenia) payroll filing export — styled .xlsx for the accountant.
 *
 * One sheet, per-employee rows with identification (ՀՎՀՀ/ՀԾՀ), gross and every
 * statutory withholding (income tax, funded pension, military stamp duty, tiered
 * health insurance), plus a totals row and a pre-flight issues block. Column
 * headers are localized (en / ru / hy / de) — the workbook the accountant files
 * reads in the office language.
 */

type Lang = 'en' | 'ru' | 'hy' | 'de';

interface HeaderDict {
  sheet: string;
  period: string;
  employee: string;
  hvhh: string;
  nationalId: string;
  position: string;
  department: string;
  gross: string;
  incomeTax: string;
  pension: string;
  stampDuty: string;
  healthInsurance: string;
  totalWithheld: string;
  net: string;
  currency: string;
  status: string;
  totals: string;
  issuesTitle: string;
  issueMissingTaxId: string;
  org: string;
  generated: string;
}

const HEADERS: Record<Lang, HeaderDict> = {
  en: {
    sheet: 'SRC Payroll Filing',
    period: 'Period',
    employee: 'Employee',
    hvhh: 'TIN (ՀՎՀՀ)',
    nationalId: 'National ID (ՀԾՀ)',
    position: 'Position',
    department: 'Department',
    gross: 'Gross (AMD)',
    incomeTax: 'Income Tax 20%',
    pension: 'Funded Pension',
    stampDuty: 'Military Stamp Duty',
    healthInsurance: 'Health Insurance',
    totalWithheld: 'Total Withheld',
    net: 'Net Paid',
    currency: 'Currency',
    status: 'Status',
    totals: 'TOTALS',
    issuesTitle: 'Issues to resolve before filing',
    issueMissingTaxId: 'Missing TIN (ՀՎՀՀ)',
    org: 'Organization',
    generated: 'Generated',
  },
  ru: {
    sheet: 'Налоговый отчёт (SRC)',
    period: 'Период',
    employee: 'Сотрудник',
    hvhh: 'ИНН (ՀՎՀՀ)',
    nationalId: 'Нац. удостоверение (ՀԾՀ)',
    position: 'Должность',
    department: 'Отдел',
    gross: 'Начислено (AMD)',
    incomeTax: 'Подоходный налог 20%',
    pension: 'Накопительный пенсионный',
    stampDuty: 'Военный сбор',
    healthInsurance: 'Медицинское страхование',
    totalWithheld: 'Всего удержано',
    net: 'К выплате',
    currency: 'Валюта',
    status: 'Статус',
    totals: 'ИТОГО',
    issuesTitle: 'Проблемы перед подачей',
    issueMissingTaxId: 'Отсутствует ИНН (ՀՎՀՀ)',
    org: 'Организация',
    generated: 'Сформировано',
  },
  hy: {
    sheet: 'Հարկային հաշվետվություն (ՀԱԴ)',
    period: 'Ժամանակաշրջան',
    employee: 'Աշխատակից',
    hvhh: 'ՀՎՀՀ',
    nationalId: 'ՀԾՀ',
    position: 'Պաշտոն',
    department: 'Բաժին',
    gross: 'Համախառն (AMD)',
    incomeTax: 'Եկամտային հարկ 20%',
    pension: 'Կուտակային կենսաթոշակ',
    stampDuty: 'Զինվորական վճար',
    healthInsurance: 'Առողջապահական ապահովագրություն',
    totalWithheld: 'Ընդհանուր պահված',
    net: 'Զուտ վճար',
    currency: 'Արժույթ',
    status: 'Կարգավիճակ',
    totals: 'ԸՆԴՀԱՆՈՒՐ',
    issuesTitle: 'Խնդիրներ հանձնելուց առաջ',
    issueMissingTaxId: 'Բացակայում է ՀՎՀՀ-ն',
    org: 'Կազմակերպություն',
    generated: 'Կազմված է',
  },
  de: {
    sheet: 'Steuerbericht (SRC)',
    period: 'Zeitraum',
    employee: 'Mitarbeiter',
    hvhh: 'Steuernr. (ՀՎՀՀ)',
    nationalId: 'Ausweis-Nr. (ՀԾՀ)',
    position: 'Position',
    department: 'Abteilung',
    gross: 'Brutto (AMD)',
    incomeTax: 'Einkommensteuer 20%',
    pension: 'Fondsrente',
    stampDuty: 'Militärgebühr',
    healthInsurance: 'Krankenversicherung',
    totalWithheld: 'Einbehalt gesamt',
    net: 'Netto',
    currency: 'Währung',
    status: 'Status',
    totals: 'SUMME',
    issuesTitle: 'Vor der Einreichung zu klären',
    issueMissingTaxId: 'Fehlende Steuernummer (ՀՎՀՀ)',
    org: 'Organisation',
    generated: 'Erstellt',
  },
};

function normalizeLang(lang?: string): Lang {
  const code = (lang || 'en').slice(0, 2).toLowerCase();
  return code === 'ru' || code === 'hy' || code === 'de' ? code : 'en';
}

interface SrcExportBody {
  records?: SrcPayrollRecord[];
  identities?: Record<string, SrcEmployeeIdentity>;
  organizationName?: string;
  currency?: string;
  lang?: string;
}

const MONEY_COLUMNS = [
  'gross',
  'incomeTax',
  'pension',
  'stampDuty',
  'healthInsurance',
  'totalWithheld',
  'net',
] as const;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SrcExportBody;
    const records = body.records;
    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Records array is required' }, { status: 400 });
    }
    const t = HEADERS[normalizeLang(body.lang)];
    const identities = body.identities ?? {};

    const rows = buildSrcRows(records, identities, body.currency);
    const totals = computeSrcTotals(rows);
    const issues = findSrcIssues(rows);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Strata HR';
    workbook.created = new Date();

    const ws = workbook.addWorksheet(t.sheet, {
      properties: { tabColor: { argb: 'B91C1C' } },
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { header: t.period, key: 'period', width: 11 },
      { header: t.employee, key: 'employee', width: 26 },
      { header: t.hvhh, key: 'taxId', width: 13 },
      { header: t.nationalId, key: 'nationalId', width: 13 },
      { header: t.position, key: 'position', width: 20 },
      { header: t.department, key: 'department', width: 18 },
      { header: t.gross, key: 'gross', width: 15 },
      { header: t.incomeTax, key: 'incomeTax', width: 15 },
      { header: t.pension, key: 'pension', width: 15 },
      { header: t.stampDuty, key: 'stampDuty', width: 14 },
      { header: t.healthInsurance, key: 'healthInsurance', width: 16 },
      { header: t.totalWithheld, key: 'totalWithheld', width: 15 },
      { header: t.net, key: 'net', width: 15 },
      { header: t.currency, key: 'currency', width: 9 },
      { header: t.status, key: 'status', width: 12 },
    ];

    // Header style — dark red like the tax service, white bold text.
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'B91C1C' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    for (const r of rows) {
      ws.addRow({
        period: r.period,
        employee: r.name,
        taxId: r.taxId || '—',
        nationalId: r.nationalId || '',
        position: r.position,
        department: r.department,
        gross: r.gross,
        incomeTax: r.incomeTax,
        pension: r.pension,
        stampDuty: r.stampDuty,
        healthInsurance: r.healthInsurance,
        totalWithheld: r.totalWithheld,
        net: r.net,
        currency: r.currency,
        status: r.status,
      });
    }

    // Borders + number format for every data row.
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
      for (const col of MONEY_COLUMNS) {
        row.getCell(col).numFmt = '#,##0.00';
      }
    });

    // Totals row — bold on top.
    const totalsRow = ws.addRow({
      employee: t.totals,
      gross: totals.gross,
      incomeTax: totals.incomeTax,
      pension: totals.pension,
      stampDuty: totals.stampDuty,
      healthInsurance: totals.healthInsurance,
      totalWithheld: totals.totalWithheld,
      net: totals.net,
    });
    totalsRow.font = { bold: true };
    totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
    for (const col of MONEY_COLUMNS) {
      totalsRow.getCell(col).numFmt = '#,##0.00';
    }

    // Pre-flight issues block — the accountant sees blockers without paging.
    if (issues.length > 0) {
      ws.addRow([]);
      const title = ws.addRow([`${t.issuesTitle} (${issues.length})`]);
      title.font = { bold: true, color: { argb: 'B91C1C' } };
      for (const issue of issues) {
        ws.addRow([issue.messageKey ? t.issueMissingTaxId : '', `${issue.name}`]);
      }
    }

    // Footer block — org + generated timestamp.
    ws.addRow([]);
    const footer1 = ws.addRow([`${t.org}: ${body.organizationName ?? ''}`]);
    footer1.font = { bold: true };
    ws.addRow([`${t.generated}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`]);

    const buffer = await workbook.xlsx.writeBuffer();

    const firstPeriod = rows[0]?.period ?? 'all';
    const filename = `src-filing-${firstPeriod}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('SRC export error:', error);
    return NextResponse.json({ error: 'Failed to export SRC filing data' }, { status: 500 });
  }
}
