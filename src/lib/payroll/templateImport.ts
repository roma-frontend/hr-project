/**
 * templateImport — reading the bank's own template instead of guessing at it.
 *
 * The bank-file layout screen lets an accountant order nine known columns by
 * hand, which works only if they already know the order. In practice the order
 * arrives as a file: the bank emails an .xls/.csv template ("փոխանցումների
 * ցուցակ"), the accountant saves it and fills it in. Asking them to retype that
 * order into our editor is a transcription task with a silent failure mode —
 * swap `amount` and `currency` and the portal reads the wrong column.
 *
 * So the screen accepts the template itself and reads the order from it.
 *
 * ── What this module will and will not claim ────────────────────────────────
 * Column *names* are matched against a synonym list (English, Russian, Armenian)
 * because those three are the languages these templates are actually written in.
 * That is a guess about vocabulary, and the UI presents it as a guess: every
 * column comes back with the match it found and the accountant confirms or
 * corrects each one before anything is applied. When no name matches, a cell
 * *shape* can still suggest a field (`^\\d{16,20}$` → account), and those are
 * flagged separately as inferred from the values rather than from the text.
 *
 * What it never does is assert a bank's certified column order. Matching a
 * header called "Գումար" to `amount` is a vocabulary fact; claiming this is
 * Ameriabank's current specification is not, and the presets stay `verified:
 * false` for exactly that reason.
 *
 * ── Deliberately pure ───────────────────────────────────────────────────────
 * Text in, description out: no DOM, no File, no i18n. The reading of the file is
 * the component's job; this module only says what the text contains, so the
 * header row of a real Armenian bank template can be asserted in a test.
 */

import { isPaymentFieldId, type PaymentFieldId } from '../../../convex/lib/paymentFields';

// ── Vocabulary ───────────────────────────────────────────────────────────────

/**
 * Header names each field is written under, normalised: lowercased, `ё` folded to
 * `е`, everything that is not a letter or digit removed. So "Счёт №" → "счет",
 * "Bank Account" → "bankaccount", "Հաշվի համար" → "հաշվիհամար".
 *
 * Entries are matched by **whole-cell equality**, never by substring. That is
 * what keeps "Счет плательщика" from matching `account`: it normalises to
 * `счетплательщика`, which is listed under `payerAccount` and nowhere else.
 */
const SYNONYMS: Record<PaymentFieldId, readonly string[]> = {
  account: [
    'account',
    'accountnumber',
    'accountno',
    'accno',
    'acc',
    'iban',
    'bankaccount',
    'bankaccountnumber',
    'cardnumber',
    'հաշիվ',
    'հաշվիհամար',
    'հաշվեհամար',
    'հաշիվհամար',
    'счет',
    'счёт',
    'номерсчета',
    'номерсчёта',
    'расчетныйсчет',
    'расчётныйсчёт',
    'рс',
  ],
  beneficiary: [
    'beneficiary',
    'name',
    'fullname',
    'employeename',
    'employee',
    'recipient',
    'payee',
    'անուն',
    'անունազգանուն',
    'աշխատակից',
    'ստացող',
    'фио',
    'имя',
    'получатель',
    'сотрудник',
    'наименование',
  ],
  amount: [
    'amount',
    'sum',
    'total',
    'payment',
    'netpay',
    'salary',
    'գումար',
    'վճարմանգումարը',
    'сумма',
    'суммакперечислению',
    'кперечислению',
    'итого',
  ],
  currency: ['currency', 'ccy', 'curr', 'արժույթ', 'валюта'],
  bank: ['bank', 'bankname', 'bankcode', 'բանկ', 'բանկիանվանում', 'банк', 'наименованиебанка'],
  purpose: [
    'purpose',
    'paymentpurpose',
    'description',
    'details',
    'comment',
    'note',
    'նպատակ',
    'նշանակություն',
    'վճարմաննշանակությունը',
    'назначение',
    'назначениеплатежа',
    'описание',
    'комментарий',
  ],
  period: [
    'period',
    'month',
    'payperiod',
    'ժամանակաշրջան',
    'ամիս',
    'период',
    'месяц',
    'расчетныйпериод',
  ],
  payerAccount: [
    'payeraccount',
    'payeraccountnumber',
    'senderaccount',
    'debitingaccount',
    'companyaccount',
    'հաշիվվճարող',
    'վճարողիհաշիվ',
    'счетплательщика',
    'счётплательщика',
    'счетотправителя',
    'счётотправителя',
    'счеторганизации',
    'счёторганизации',
    'нашсчет',
  ],
  status: ['status', 'կարգավիճակ', 'статус'],
};

/**
 * Which field wins when a header could name two, and the order columns are
 * matched in. Specific fields are tried before general ones, so a hypothetical
 * collision resolves toward the narrower meaning.
 */
const ASSIGNMENT_ORDER: readonly PaymentFieldId[] = [
  'payerAccount',
  'purpose',
  'currency',
  'period',
  'status',
  'account',
  'beneficiary',
  'bank',
  'amount',
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

const HEADER_LOOKUP: ReadonlyMap<string, PaymentFieldId> = (() => {
  const map = new Map<string, PaymentFieldId>();
  for (const field of ASSIGNMENT_ORDER) {
    for (const form of SYNONYMS[field]) {
      // First field in ASSIGNMENT_ORDER wins, so a form listed twice resolves
      // deterministically instead of depending on object key order.
      if (!map.has(form)) map.set(form, field);
    }
  }
  return map;
})();

/**
 * Synonym forms claimed by more than one field.
 *
 * Exported for the test suite rather than for the UI: a duplicate here means the
 * dictionary has drifted and a header would map to whichever field happens to be
 * earlier in `ASSIGNMENT_ORDER` — an arbitrary answer to a question that has a
 * right one.
 */
export function ambiguousHeaderForms(): string[] {
  const seen = new Map<string, PaymentFieldId>();
  const clashes: string[] = [];
  for (const field of ASSIGNMENT_ORDER) {
    for (const form of SYNONYMS[field]) {
      const owner = seen.get(form);
      if (owner && owner !== field) clashes.push(form);
      else seen.set(form, field);
    }
  }
  return clashes;
}

/** The field a header cell names, or null when nothing in the vocabulary fits. */
export function fieldForHeader(cell: string): PaymentFieldId | null {
  const key = normalize(cell);
  if (!key) return null;
  return HEADER_LOOKUP.get(key) ?? null;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

/** Separators the editor and the export both accept; nothing exotic is guessed at. */
export const TEMPLATE_DELIMITERS = [',', ';', '\t'] as const;

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Cut the text into records, honouring quoted newlines.
 *
 * A naive `split('\n')` breaks on a name or an address that contains one, which
 * would shift every subsequent column of that row by one — the exact failure the
 * import exists to prevent.
 */
function splitRecords(text: string): string[] {
  const records: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      // Toggling also handles "" inside a quoted cell: two toggles, no state.
      quoted = !quoted;
      current += ch;
      continue;
    }
    if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      records.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  records.push(current);
  return records;
}

/** Split one record into cells, unwrapping quotes and unescaping "" → ". */
function parseRecord(record: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < record.length; i++) {
    const ch = record[i]!;
    if (quoted) {
      if (ch === '"') {
        if (record[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(current);
      current = '';
    } else current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function nonEmptyRecords(text: string): string[] {
  return splitRecords(stripBom(text)).filter((line) => line.trim().length > 0);
}

/**
 * Which separator the file uses.
 *
 * Decided on the first few records and scored by **consistency across them**, not
 * by raw width: a template whose address column contains commas would otherwise
 * make the comma look like the separator. Ties fall to the earliest candidate, so
 * a header-only file is read as comma-separated rather than randomly.
 */
export function detectDelimiter(text: string): string {
  const records = nonEmptyRecords(text).slice(0, 5);
  let best: string = TEMPLATE_DELIMITERS[0];
  let bestScore = 0;
  for (const delimiter of TEMPLATE_DELIMITERS) {
    const widths = records.map((record) => parseRecord(record, delimiter).length);
    if (widths.length === 0) continue;
    const widest = Math.max(...widths);
    if (widest <= 1) continue;
    const consistent = widths.filter((w) => w === widest).length;
    const score = consistent * 100 + widest;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

function isNumericCell(cell: string): boolean {
  return /^-?\d+([.,]\d+)?$/.test(cell.trim());
}

/**
 * Whether the first record is a header line.
 *
 * Two independent signals, because neither is reliable alone: a cell naming a
 * field we know (unambiguous), or a majority of non-numeric cells above a row
 * that does contain numbers (true of nearly every template, including ones whose
 * vocabulary we do not have).
 */
function looksLikeHeader(headerCells: string[], dataCells: string[]): boolean {
  if (headerCells.length === 0) return false;
  if (headerCells.some((cell) => fieldForHeader(cell) !== null)) return true;
  const nonNumeric = headerCells.filter((cell) => cell.length > 0 && !isNumericCell(cell)).length;
  const dataHasNumbers = dataCells.some(isNumericCell);
  return dataHasNumbers && nonNumeric >= Math.ceil(headerCells.length / 2);
}

/**
 * A field implied by what a value looks like, when no header text matched.
 *
 * Deliberately narrow — three shapes whose meaning is not really in doubt — and
 * reported apart from header matches, so the UI can ask for confirmation instead
 * of presenting a shape guess with the same confidence as a name.
 */
export function inferFromValue(cell: string): PaymentFieldId | null {
  const trimmed = cell.trim();
  if (!trimmed) return null;
  const digitsOnly = trimmed.replace(/[\s\-—.]/g, '');
  // Armenian accounts are 20 digits; the range lets a padded or grouped account
  // through while excluding the 21+ digit strings some banks use for cards.
  if (/^\d{16,20}$/.test(digitsOnly)) return 'account';
  if (/^\d{4}-\d{2}$/.test(trimmed)) return 'period';
  if (/^\d{1,12}$/.test(trimmed) || /^\d{1,10}[.,]\d{1,2}$/.test(trimmed)) return 'amount';
  return null;
}

export interface TemplateColumn {
  /** 0-based position in the file — what "column 3" means to the accountant. */
  index: number;
  /** Header text as written, or '' when the file has no header line. */
  header: string;
  /** First cell below the header, so the accountant can recognise the column. */
  sample: string;
  /** Best guess, or null when nothing matched. */
  suggested: PaymentFieldId | null;
  /** True when `suggested` came from the values rather than from the header text. */
  inferred: boolean;
}

export interface ParsedTemplate {
  delimiter: string;
  /** Whether the first record was read as a header line rather than as data. */
  hasHeader: boolean;
  columns: TemplateColumn[];
  /** Records below the header — 0 when the file is a header with nothing under it. */
  dataRows: number;
}

export function parseTemplate(text: string, options: { delimiter?: string } = {}): ParsedTemplate {
  const clean = stripBom(text);
  const requested = options.delimiter;
  const delimiter =
    requested && (TEMPLATE_DELIMITERS as readonly string[]).includes(requested)
      ? requested
      : detectDelimiter(clean);

  const records = nonEmptyRecords(clean);
  const first = records[0] ? parseRecord(records[0], delimiter) : [];
  const second = records[1] ? parseRecord(records[1], delimiter) : [];
  const hasHeader = looksLikeHeader(first, second);

  // Without a header the first record *is* the data, so it supplies both the
  // sample values and the fact that there is one fewer data row.
  const nameCells = hasHeader ? first : [];
  const valueCells = hasHeader ? second : first;
  const width = Math.max(first.length, second.length);

  const used = new Set<PaymentFieldId>();
  const columns: TemplateColumn[] = [];
  for (let index = 0; index < width; index++) {
    const header = (nameCells[index] ?? '').trim();
    const sample = (valueCells[index] ?? '').trim();

    let suggested = hasHeader ? fieldForHeader(header) : null;
    let inferred = false;
    if (!suggested) {
      const guess = inferFromValue(sample);
      if (guess) {
        suggested = guess;
        inferred = true;
      }
    }
    // One column per field: two columns both claiming `amount` would render a
    // duplicate the portal parses as a malformed row, so the second is left for
    // the accountant to place deliberately.
    if (suggested && used.has(suggested)) {
      suggested = null;
      inferred = false;
    }
    if (suggested) used.add(suggested);

    columns.push({ index, header, sample, suggested, inferred });
  }

  return {
    delimiter,
    hasHeader,
    columns,
    dataRows: Math.max(0, records.length - (hasHeader ? 1 : 0)),
  };
}

// ── Applying a mapping ───────────────────────────────────────────────────────

/**
 * Column order from one field choice per template column, dropping "ignore"
 * entries and repeats. Mirrors `dedupePaymentFields`, which re-applies the same
 * rule when the layout is saved.
 */
export function orderedFields(mapping: readonly (PaymentFieldId | null | '')[]): PaymentFieldId[] {
  const seen = new Set<PaymentFieldId>();
  const out: PaymentFieldId[] = [];
  for (const value of mapping) {
    if (!value || !isPaymentFieldId(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * Columns a payment file cannot do without.
 *
 * A template import that yields neither is not a layout, it is a mis-reading —
 * and saving it would leave every export unable to say where the money goes, so
 * the screen refuses to apply it rather than writing a file nobody can upload.
 */
export const REQUIRED_TEMPLATE_FIELDS: readonly PaymentFieldId[] = ['account', 'amount'];

export function missingRequiredFields(fields: readonly PaymentFieldId[]): PaymentFieldId[] {
  return REQUIRED_TEMPLATE_FIELDS.filter((field) => !fields.includes(field));
}

/**
 * Whether the text is a binary file that got read as text.
 *
 * The accept list covers CSV/TSV; an accountant who picks the .xlsx the bank
 * actually sent would otherwise get a screenful of mojibake and no explanation.
 * Detecting it lets the screen say "save it as CSV first" — the client bundle
 * does not carry a spreadsheet reader, and pulling one in for a settings screen
 * would cost more than the round trip through the bank's own export button.
 */
export function looksBinary(text: string): boolean {
  return text.includes('\u0000') || text.startsWith('PK\u0003\u0004') || text.includes('\uFFFD');
}
