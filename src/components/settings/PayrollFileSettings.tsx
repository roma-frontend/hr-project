'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Save,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/useAuthStore';
import { logger } from '@/lib/logger';
import {
  BANK_PROFILES,
  DEFAULT_BANK_PROFILE_ID,
  PAYMENT_DELIMITERS,
  PAYMENT_FIELDS,
  buildCustomProfile,
  buildProfiledFile,
  getBankProfile,
  type PaymentFieldId,
} from '@/lib/payroll/bankProfile';
import {
  buildPaymentRows,
  type PaymentEmployeeDetails,
  type PaymentRow,
} from '@/lib/payroll/paymentRegister';
import {
  looksBinary,
  missingRequiredFields,
  orderedFields,
  parseTemplate,
  type ParsedTemplate,
} from '@/lib/payroll/templateImport';

/**
 * The organisation's salary bank-file layout — who the columns are for, and why
 * this is a server setting rather than a dropdown.
 *
 * The export used to remember its column layout in `localStorage`, which meant
 * the *employer's* bank template was a private preference of one browser. Two
 * accountants, or one accountant on a new laptop, produced differently shaped
 * files from the same payroll run. The layout now lives on the organisation
 * (`orgPayrollFile`), so it is edited once and every export uses it.
 *
 * The preview is the point of the screen. A column order is impossible to
 * evaluate from a list of ids, and the accountant is about to move a month of
 * salaries with it — so the panel renders the *actual bytes* that will be
 * written, using the same pure builder the export route calls (see
 * `lib/payroll/bankProfile.ts`). Nothing here re-implements the format.
 *
 * ── Why the preview shows a real run ────────────────────────────────────────
 * It used to render two hard-coded employees. That proved the column *order* and
 * nothing else, while hiding the thing that actually goes wrong: on a real run
 * some rows have no bank account yet, and `buildProfiledFile` withholds them.
 * With sample rows that exclusion never happened, so the screen looked correct
 * and the export silently paid fewer people than the accountant expected. The
 * panel now reads a real run, and says so when rows are held back.
 */

/** Two employees for the case where the organisation has no payroll run yet. */
const SAMPLE_ROWS: PaymentRow[] = [
  {
    userId: 'sample-1',
    name: 'Ani Petrosyan',
    account: '15700123456789012345',
    bankName: 'Ameriabank',
    amount: 450000,
    currency: 'AMD',
    period: '2026-09',
    status: 'approved',
    missingAccount: false,
    invalidAccount: false,
    missingBeneficiary: false,
    zeroAmount: false,
  },
  {
    userId: 'sample-2',
    name: 'Davit Sargsyan',
    account: '22000456789012345678',
    bankName: 'ACBA Bank',
    amount: 380000,
    currency: 'AMD',
    period: '2026-09',
    status: 'approved',
    missingAccount: false,
    invalidAccount: false,
    missingBeneficiary: false,
    zeroAmount: false,
  },
];

/** Sentinel select value for "preview the samples because there is no run". */
const SAMPLE_SOURCE = 'sample';

interface ImportDraft {
  fileName: string;
  parsed: ParsedTemplate;
  /** One choice per template column, positionally — '' means "ignore". */
  mapping: (PaymentFieldId | '')[];
}

export function PayrollFileSettings() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const organizationId = user?.organizationId;

  const saved = useQuery(api.payrollFile.getPayrollFileLayout);
  const saveLayout = useMutation(api.payrollFile.savePayrollFileLayout);
  const resetLayout = useMutation(api.payrollFile.resetPayrollFileLayout);

  /**
   * Real payroll runs for the preview.
   *
   * Gated on admin + organisation so a superadmin with no organisation in scope
   * never fires a request that would be rejected; both queries want supervisor
   * rights, and a rejected query would take the whole screen down rather than
   * degrade to samples.
   */
  const runs = useQuery(
    api.payroll.queries.getPayrollRuns,
    isAdmin && organizationId ? { organizationId: organizationId as Id<'organizations'> } : 'skip',
  );

  const defaultProfile = getBankProfile(DEFAULT_BANK_PROFILE_ID);

  const [profileId, setProfileId] = useState(DEFAULT_BANK_PROFILE_ID);
  const [columns, setColumns] = useState<PaymentFieldId[]>(defaultProfile.columns);
  const [delimiter, setDelimiter] = useState<string | undefined>(undefined);
  const [header, setHeader] = useState<boolean | undefined>(undefined);
  const [purpose, setPurpose] = useState('');
  const [payerAccount, setPayerAccount] = useState('');
  const [saving, setSaving] = useState(false);
  /** Undefined until the accountant picks; then a run id or `SAMPLE_SOURCE`. */
  const [previewSource, setPreviewSource] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  /** i18n key of the last import failure, or null. */
  const [importErrorKey, setImportErrorKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preset = getBankProfile(profileId);

  /**
   * Seed the form from the stored layout.
   *
   * Keyed on the query result rather than run once: the query resolves a tick
   * after mount, and an effect that only ran on mount would leave the form on
   * defaults and let a save silently overwrite the org's real layout.
   */
  useEffect(() => {
    if (saved === undefined) return;
    if (!saved) {
      setProfileId(DEFAULT_BANK_PROFILE_ID);
      setColumns(defaultProfile.columns);
      setDelimiter(undefined);
      setHeader(undefined);
      setPurpose('');
      setPayerAccount('');
      return;
    }
    setProfileId(saved.profileId);
    // A stored row is authoritative, but an empty column list means "no
    // override" — fall back to the preset it names, the same as the export does.
    setColumns(saved.columns.length > 0 ? saved.columns : getBankProfile(saved.profileId).columns);
    setDelimiter(saved.delimiter);
    setHeader(saved.header);
    setPurpose(saved.purpose ?? '');
    setPayerAccount(saved.payerAccount ?? '');
  }, [saved, defaultProfile.columns]);

  /** Picking a preset replaces the column list — that is what a preset is for. */
  const applyPreset = (id: string) => {
    const next = getBankProfile(id);
    setProfileId(id);
    setColumns(next.columns);
    // Delimiter/header go back to the preset's own values rather than keeping a
    // stale override from the previous preset.
    setDelimiter(undefined);
    setHeader(undefined);
  };

  const available = useMemo(
    () => (Object.keys(PAYMENT_FIELDS) as PaymentFieldId[]).filter((id) => !columns.includes(id)),
    [columns],
  );

  const effectiveDelimiter = delimiter ?? preset.delimiter;
  const effectiveHeader = header ?? preset.header;

  // ── Preview source ─────────────────────────────────────────────────────
  // `getPayrollRuns` returns newest first, so the first run that has records is
  // the one the accountant most likely wants to check.
  const runsWithRecords = useMemo(() => (runs ?? []).filter((run) => run.recordCount > 0), [runs]);
  const previewValue = previewSource ?? runsWithRecords[0]?._id ?? SAMPLE_SOURCE;
  const usingSamples = previewValue === SAMPLE_SOURCE;

  const previewRun = useQuery(
    api.payroll.queries.getPayrollRunById,
    previewValue !== SAMPLE_SOURCE ? { id: previewValue as Id<'payrollRuns'> } : 'skip',
  );

  /**
   * The real run as register rows.
   *
   * Reuses `buildPaymentRows` — the same assembler the export route feeds — so
   * the preview cannot disagree with the file about who is payable.
   */
  const realRows = useMemo<PaymentRow[]>(() => {
    if (!previewRun) return [];
    const details: Record<string, PaymentEmployeeDetails> = {};
    for (const record of previewRun.records) {
      details[record.userId] = {
        userId: record.userId,
        name: record.user?.name ?? record.userId,
        bankAccountNumber: record.bankAccountNumber ?? null,
        bankName: record.bankName ?? null,
      };
    }
    return buildPaymentRows(
      previewRun.records.map((record) => ({
        userId: record.userId,
        period: record.period,
        netSalary: record.netSalary,
        netPayout: record.netPayout ?? null,
        status: record.status,
        currency: record.currency ?? null,
      })),
      details,
      previewRun.records[0]?.currency ?? 'AMD',
    );
  }, [previewRun]);

  // `undefined` means the run query is still resolving — showing the samples in
  // that instant would flash a different employee list than the one selected.
  const previewRows = usingSamples ? SAMPLE_ROWS : realRows;
  const previewLoading = !usingSamples && previewRun === undefined;

  const preview = useMemo(() => {
    const profile = buildCustomProfile(preset, columns, {
      delimiter: effectiveDelimiter,
      header: effectiveHeader,
    });
    return buildProfiledFile(previewRows, profile, {
      purpose: purpose.trim() || undefined,
      payerAccount: payerAccount.trim() || undefined,
    });
  }, [preset, columns, effectiveDelimiter, effectiveHeader, purpose, payerAccount, previewRows]);

  const previewCurrency = previewRows[0]?.currency ?? 'AMD';
  const formattedAmount = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: previewCurrency,
        maximumFractionDigits: 0,
      }).format(preview.amount),
    [preview.amount, previewCurrency],
  );

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    setColumns(next);
  };

  const fieldLabel = (id: PaymentFieldId) =>
    t(PAYMENT_FIELDS[id].labelKey, PAYMENT_FIELDS[id].columnName);

  // ── Template import ────────────────────────────────────────────────────

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTemplateFile = async (file: File) => {
    setImportErrorKey(null);
    setDraft(null);
    // The bank sends .xls/.xlsx as often as .csv, and reading a zip as text
    // yields mojibake rather than an error. Say what to do instead of showing
    // the accountant a broken table.
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
      setImportErrorKey('payroll.payrollFile.importUnsupported');
      return;
    }
    try {
      const text = await file.text();
      if (looksBinary(text)) {
        setImportErrorKey('payroll.payrollFile.importUnsupported');
        return;
      }
      const parsed = parseTemplate(text);
      if (parsed.columns.length === 0) {
        setImportErrorKey('payroll.payrollFile.importEmpty');
        return;
      }
      setDraft({
        fileName: file.name,
        parsed,
        mapping: parsed.columns.map((column) => column.suggested ?? ''),
      });
    } catch (e) {
      logger.error('[PayrollFileSettings] template import', e);
      setImportErrorKey('payroll.payrollFile.importEmpty');
    }
  };

  const draftFields = draft ? orderedFields(draft.mapping) : [];
  const draftMissing = missingRequiredFields(draftFields);

  const applyDraft = () => {
    if (!draft) return;
    const fields = orderedFields(draft.mapping);
    const missing = missingRequiredFields(fields);
    if (missing.length > 0) {
      // Applying it would save a layout that cannot route money. Refusing is the
      // only outcome that leaves the accountant able to fix it.
      toast.error(
        t('payroll.payrollFile.importMissingRequired', {
          defaultValue: 'The template must map these columns: {{fields}}',
          fields: missing.map(fieldLabel).join(', '),
        }),
      );
      return;
    }
    setColumns(fields);
    // The template defines the whole format, not just the order: its separator
    // and whether it carries a header line are what the portal expects.
    setDelimiter(draft.parsed.delimiter);
    setHeader(draft.parsed.hasHeader);
    setDraft(null);
    setImportErrorKey(null);
    resetFileInput();
    toast.success(
      t('payroll.payrollFile.importApplied', {
        defaultValue: '{{count}} columns imported — review, then save',
        count: fields.length,
      }),
    );
  };

  const cancelDraft = () => {
    setDraft(null);
    setImportErrorKey(null);
    resetFileInput();
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    if (columns.length === 0) {
      // A file with no columns is not a layout, it is a bug. The database would
      // accept it (empty means "use the preset"), which is exactly why the UI
      // must not let it through silently.
      toast.error(t('payroll.payrollFile.needColumns', 'Keep at least one column'));
      return;
    }
    setSaving(true);
    try {
      await saveLayout({
        profileId,
        columns,
        delimiter,
        header,
        purpose: purpose.trim() || undefined,
        payerAccount: payerAccount.trim() || undefined,
      });
      toast.success(t('payroll.payrollFile.saved', 'Bank file layout saved'));
    } catch (e) {
      logger.error('[PayrollFileSettings] save', e);
      toast.error(e instanceof Error ? e.message : t('common.error', 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await resetLayout();
      setProfileId(DEFAULT_BANK_PROFILE_ID);
      setColumns(defaultProfile.columns);
      setDelimiter(undefined);
      setHeader(undefined);
      setPurpose('');
      setPayerAccount('');
      toast.success(t('payroll.payrollFile.resetDone', 'Back to the neutral layout'));
    } catch (e) {
      logger.error('[PayrollFileSettings] reset', e);
      toast.error(e instanceof Error ? e.message : t('common.error', 'Error'));
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <p className="text-sm text-(--text-muted)">
          {t(
            'payroll.payrollFile.adminOnly',
            'Only an administrator can change the salary bank-file layout.',
          )}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              {t('payroll.payrollFile.title', 'Salary bank file')}
            </h3>
            <p className="text-sm text-(--text-muted) mt-1 max-w-2xl">
              {t(
                'payroll.payrollFile.description',
                'The layout the bank portal expects for salary transfers. Saved for the whole organisation, so every export from every computer produces the same file.',
              )}
            </p>
          </div>
        </div>

        {/* ── Preset ─────────────────────────────────────────────────────── */}
        <div className="grid gap-2">
          <Label htmlFor="payroll-file-preset">
            {t('payroll.payrollFile.preset', 'Starting layout')}
          </Label>
          <select
            id="payroll-file-preset"
            className="h-9 w-full max-w-md rounded-md border border-(--border) bg-(--background) px-2 text-sm"
            value={profileId}
            onChange={(e) => applyPreset(e.target.value)}
          >
            {BANK_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {t(profile.labelKey, profile.id)}
              </option>
            ))}
          </select>
          {/* Stated on the screen, not only in a doc: no preset here has been
              checked against a live bank portal, and the accountant is the last
              line of defence before money moves. */}
          <p className="text-xs text-(--warning-text) flex items-start gap-1.5 max-w-2xl">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {t(
              'payroll.payrollFile.unverifiedNote',
              'No preset has been validated against a bank portal. Compare the preview with your bank’s template once and adjust the columns here.',
            )}
          </p>
        </div>

        {/* ── Columns ────────────────────────────────────────────────────── */}
        <div className="grid gap-3">
          <div>
            <Label>{t('payroll.payrollFile.columns', 'Columns, in file order')}</Label>
            <p className="text-xs text-(--text-muted) mt-0.5">
              {t(
                'payroll.payrollFile.columnsHint',
                'Left to right, exactly as the portal parses them.',
              )}
            </p>
          </div>

          <ol className="space-y-1.5">
            {columns.map((id, index) => (
              <li
                key={id}
                className="flex items-center gap-2 rounded-lg border border-(--border) bg-(--surface-1) px-3 py-2"
              >
                <span className="text-xs tabular-nums text-(--text-muted) w-5">{index + 1}</span>
                <span className="text-sm flex-1">{fieldLabel(id)}</span>
                <span className="text-[11px] font-mono text-(--text-muted) hidden sm:inline">
                  {PAYMENT_FIELDS[id].columnName}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={t('payroll.payrollFile.moveUp', 'Move up')}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={index === columns.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={t('payroll.payrollFile.moveDown', 'Move down')}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  // Removing the last column would leave a file with no columns,
                  // which the portal reads as a malformed upload.
                  disabled={columns.length === 1}
                  onClick={() => setColumns(columns.filter((c) => c !== id))}
                  aria-label={t('payroll.payrollFile.remove', 'Remove column')}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ol>

          {available.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {available.map((id) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setColumns([...columns, id])}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {fieldLabel(id)}
                </Button>
              ))}
            </div>
          )}
          {available.length === 0 && (
            <p className="text-xs text-(--text-muted)">
              {t('payroll.payrollFile.allColumnsUsed', 'All available columns are in the file.')}
            </p>
          )}
        </div>

        {/* ── Format ─────────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          <div className="grid gap-2">
            <Label htmlFor="payroll-file-delimiter">
              {t('payroll.payrollFile.delimiter', 'Separator')}
            </Label>
            <select
              id="payroll-file-delimiter"
              className="h-9 rounded-md border border-(--border) bg-(--background) px-2 text-sm"
              value={delimiter ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                setDelimiter(value === '' ? undefined : value);
              }}
            >
              <option value="">{t('payroll.payrollFile.delimiterPreset', 'Preset default')}</option>
              {PAYMENT_DELIMITERS.map((d) => (
                <option key={d} value={d}>
                  {d === ','
                    ? t('payroll.payrollFile.delimiterComma', 'Comma (,)')
                    : d === ';'
                      ? t('payroll.payrollFile.delimiterSemicolon', 'Semicolon (;)')
                      : t('payroll.payrollFile.delimiterTab', 'Tab')}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="payroll-file-header">
              {t('payroll.payrollFile.header', 'Header line')}
            </Label>
            <select
              id="payroll-file-header"
              className="h-9 rounded-md border border-(--border) bg-(--background) px-2 text-sm"
              value={header === undefined ? '' : String(header)}
              onChange={(e) => {
                const value = e.target.value;
                setHeader(value === '' ? undefined : value === 'true');
              }}
            >
              <option value="">{t('payroll.payrollFile.headerPreset', 'Preset default')}</option>
              <option value="true">
                {t('payroll.payrollFile.headerYes', 'Yes — name each column')}
              </option>
              <option value="false">
                {t('payroll.payrollFile.headerNo', 'No — data rows only')}
              </option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="payroll-file-purpose">
              {t('payroll.payrollFile.purpose', 'Payment purpose')}
            </Label>
            <Input
              id="payroll-file-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={t('payroll.payrollFile.purposePlaceholder', 'Salary for September 2026')}
            />
            <p className="text-xs text-(--text-muted)">
              {t(
                'payroll.payrollFile.purposeHint',
                'Written on every line when the template has a purpose column.',
              )}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="payroll-file-payer">
              {t('payroll.payrollFile.payerAccount', 'Payer account')}
            </Label>
            <Input
              id="payroll-file-payer"
              value={payerAccount}
              onChange={(e) => setPayerAccount(e.target.value)}
              placeholder="15700123456789012345"
            />
            <p className="text-xs text-(--text-muted)">
              {t(
                'payroll.payrollFile.payerAccountHint',
                'Your own account, when the template asks for it.',
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Template import ──────────────────────────────────────────────── */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {t('payroll.payrollFile.importTitle', 'Import the bank’s template')}
          </h3>
          <p className="text-sm text-(--text-muted) mt-1 max-w-2xl">
            {t(
              'payroll.payrollFile.importHint',
              'Upload the template the bank sent you and the column order is read from it, instead of being retyped by hand. Nothing is applied until you confirm the mapping below.',
            )}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.tsv,text/csv"
          className="hidden"
          aria-label={t('payroll.payrollFile.importChoose', 'Choose template file')}
          data-testid="payroll-file-template-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleTemplateFile(file);
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            {t('payroll.payrollFile.importChoose', 'Choose template file')}
          </Button>
          <span className="text-xs text-(--text-muted)">
            {t(
              'payroll.payrollFile.importFormats',
              'CSV or TSV. An Excel file has to be saved as CSV first.',
            )}
          </span>
        </div>

        {importErrorKey && (
          <p className="text-xs text-(--danger-text)">
            {t(importErrorKey, 'Could not read that file.')}
          </p>
        )}

        {draft && (
          <div className="space-y-3">
            <p className="text-xs text-(--text-muted)">
              {t('payroll.payrollFile.importDetected', {
                defaultValue:
                  '{{file}} — separator {{delimiter}}, {{rows}} data rows, header line: {{header}}',
                file: draft.fileName,
                delimiter:
                  draft.parsed.delimiter === '\t'
                    ? t('payroll.payrollFile.delimiterTab', 'Tab')
                    : draft.parsed.delimiter,
                rows: draft.parsed.dataRows,
                header: draft.parsed.hasHeader ? t('common.yes', 'Yes') : t('common.no', 'No'),
              })}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-(--text-muted)">
                    <th className="py-1 pr-3 font-medium">
                      {t('payroll.payrollFile.importColumn', 'Template column')}
                    </th>
                    <th className="py-1 pr-3 font-medium">
                      {t('payroll.payrollFile.importSample', 'First value')}
                    </th>
                    <th className="py-1 font-medium">
                      {t('payroll.payrollFile.importMapsTo', 'Our column')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.parsed.columns.map((column, index) => (
                    <tr key={column.index} className="border-t border-(--border)">
                      <td className="py-1.5 pr-3">
                        <span className="text-xs tabular-nums text-(--text-muted) mr-2">
                          {column.index + 1}
                        </span>
                        {column.header ||
                          t('payroll.payrollFile.importUnnamed', 'Column {{n}}', {
                            n: column.index + 1,
                          })}
                        {column.inferred && (
                          // A guess from the cell's shape, not from its name —
                          // presented as a guess so it gets checked.
                          <span className="ml-2 text-[11px] text-(--warning-text)">
                            {t('payroll.payrollFile.importInferred', 'guessed from the value')}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-xs font-mono text-(--text-muted) max-w-[12rem] truncate">
                        {column.sample}
                      </td>
                      <td className="py-1.5">
                        <select
                          className="h-8 rounded-md border border-(--border) bg-(--background) px-2 text-xs"
                          aria-label={t('payroll.payrollFile.importMapsTo', 'Our column')}
                          value={draft.mapping[index] ?? ''}
                          onChange={(e) => {
                            const value = e.target.value as PaymentFieldId | '';
                            setDraft({
                              ...draft,
                              mapping: draft.mapping.map((m, i) => (i === index ? value : m)),
                            });
                          }}
                        >
                          <option value="">
                            {t('payroll.payrollFile.importIgnore', 'Do not import')}
                          </option>
                          {(Object.keys(PAYMENT_FIELDS) as PaymentFieldId[]).map((id) => (
                            <option key={id} value={id}>
                              {fieldLabel(id)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {draftMissing.length > 0 ? (
              <p className="text-xs text-(--warning-text) flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {t('payroll.payrollFile.importMissingRequired', {
                  defaultValue: 'The template must map these columns: {{fields}}',
                  fields: draftMissing.map(fieldLabel).join(', '),
                })}
              </p>
            ) : (
              <p className="text-xs text-(--text-muted)">
                {t(
                  'payroll.payrollFile.importReady',
                  '{{count}} columns will replace the current order.',
                  {
                    count: draftFields.length,
                  },
                )}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={applyDraft} disabled={draftMissing.length > 0}>
                {t('payroll.payrollFile.importApply', 'Apply to layout')}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelDraft}>
                {t('payroll.payrollFile.importCancel', 'Cancel')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Preview ──────────────────────────────────────────────────────── */}
      <Card className="p-6 space-y-3">
        <div>
          <h3 className="text-base font-semibold">{t('payroll.payrollFile.preview', 'Preview')}</h3>
          <p className="text-sm text-(--text-muted) mt-1 max-w-2xl">
            {usingSamples
              ? t(
                  'payroll.payrollFile.previewHintSample',
                  'Exactly what the CSV will contain, on two sample employees — there is no payroll run to read yet. Numbers are unformatted because the portal parses them.',
                )
              : t('payroll.payrollFile.previewHint', {
                  defaultValue:
                    'Exactly what the CSV will contain for {{period}}, built from that run’s payroll rows. Numbers are unformatted because the portal parses them.',
                  period: previewRun?.period ?? '—',
                })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="payroll-file-preview-source">
            {t('payroll.payrollFile.previewSource', 'Rows to preview')}
          </Label>
          <select
            id="payroll-file-preview-source"
            className="h-9 rounded-md border border-(--border) bg-(--background) px-2 text-sm"
            value={previewValue}
            onChange={(e) => setPreviewSource(e.target.value)}
          >
            {runsWithRecords.map((run) => (
              <option key={run._id} value={run._id}>
                {run.period} · {t(`payroll.${run.status}`, run.status)} ·{' '}
                {t('payroll.payrollFile.previewEmployees', '{{count}} employees', {
                  count: run.recordCount,
                })}
              </option>
            ))}
            <option value={SAMPLE_SOURCE}>
              {t('payroll.payrollFile.previewSample', 'Sample rows (no payroll run yet)')}
            </option>
          </select>
        </div>

        <pre className="overflow-x-auto rounded-lg border border-(--border) bg-(--surface-1) p-3 text-xs font-mono whitespace-pre">
          {previewLoading
            ? t('common.loading', '…')
            : columns.length === 0
              ? t('payroll.payrollFile.previewEmpty', 'No columns selected.')
              : preview.included === 0
                ? // A file with nothing payable in it and a file with no columns are
                  // different problems. The header line alone would look like a layout
                  // that works, and "no columns selected" would send the accountant to
                  // the wrong control; the warning below lists why each row was held
                  // back, which is what they actually have to fix.
                  t('payroll.payrollFile.previewNoRows', 'No payable rows in this run.')
                : preview.content}
        </pre>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-xs text-(--text-muted)">
            {t('payroll.payrollFile.previewDelimiter', {
              defaultValue: 'Separator: {{value}}',
              value:
                effectiveDelimiter === '\t'
                  ? t('payroll.payrollFile.delimiterTab', 'Tab')
                  : effectiveDelimiter,
            })}
          </p>
          <p className="text-xs text-(--text-muted)">
            {t('payroll.payrollFile.previewTotal', 'Total in the file: {{amount}}', {
              amount: formattedAmount,
            })}
          </p>
          <p className="text-xs text-(--text-muted)">
            {t('payroll.payrollFile.previewRows', '{{count}} rows written', {
              count: preview.included,
            })}
          </p>
        </div>

        {preview.excluded > 0 && (
          // The reason this preview reads a real run: these rows are the ones the
          // accountant would otherwise notice only after the bank paid fewer
          // people than the payroll table says.
          <p className="text-xs text-(--warning-text) flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {t('payroll.payrollFile.previewExcluded', {
              defaultValue:
                '{{count}} rows are held back — no bank account, a wrong-length account or a zero amount. Fix them on the employee profile before the upload.',
              count: preview.excluded,
            })}
          </p>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? t('common.loading', '…') : t('payroll.payrollFile.save', 'Save layout')}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={saving}>
          <RotateCcw className="w-4 h-4 mr-2" />
          {t('payroll.payrollFile.reset', 'Use neutral layout')}
        </Button>
      </div>
    </div>
  );
}
