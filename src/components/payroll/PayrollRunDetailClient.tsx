'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/i18n/config';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { motion } from '@/lib/cssMotion';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  FileText,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calculator,
  Send,
  Pencil,
  Ban,
  Landmark,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/store/useAuthStore';
import { EditPayrollRecordDialog } from '@/components/payroll/EditPayrollRecordDialog';
import type { SrcEmployeeIdentity } from '@/lib/payroll/srcExport';
import type { PaymentEmployeeDetails } from '@/lib/payroll/paymentRegister';
import { BANK_PROFILES, DEFAULT_BANK_PROFILE_ID, getBankProfile } from '@/lib/payroll/bankProfile';

type PayrollRunDetail = NonNullable<
  FunctionReturnType<typeof api.payroll.queries.getPayrollRunById>
>;
type PayrollRecordItem = PayrollRunDetail['records'][number] & {
  /** ՀՎՀՀ from the employee profile — present when the org collected it. */
  taxId?: string | null;
  /** ՀԾՀ from the user row — present when the org collected it. */
  nationalId?: string | null;
  /** Bank account for the salary transfer — absent until HR fills it in. */
  bankAccountNumber?: string | null;
  /** Beneficiary bank name, printed in the payment register. */
  bankName?: string | null;
};

function formatCurrency(amount: number, currency = 'AMD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadge(status: string, t: (key: string) => string) {
  const variants: Record<
    string,
    { variant: 'success' | 'warning' | 'destructive' | 'secondary'; icon: React.ReactNode }
  > = {
    paid: { variant: 'success', icon: <CheckCircle className="w-3 h-3" /> },
    approved: { variant: 'success', icon: <CheckCircle className="w-3 h-3" /> },
    calculated: { variant: 'warning', icon: <Clock className="w-3 h-3" /> },
    draft: { variant: 'secondary', icon: <FileText className="w-3 h-3" /> },
    cancelled: { variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
  };

  const config = variants[status] ?? variants.draft!;

  return (
    <Badge variant={config.variant} className="capitalize flex items-center gap-1">
      {config.icon}
      {t(`payroll.${status}`)}
    </Badge>
  );
}

export default function PayrollRunDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const { t, i18n } = useTranslation();
  const resolvedParams = React.use(params);
  const rawRunId = resolvedParams.id;
  // Defensive: stale links may carry a period like "2026-08" instead of a
  // Convex doc id. Convex ids are alphanumeric only (no '-'), so reject anything
  // else before querying — otherwise the validator throws ArgumentValidationError.
  const isValidRunId = /^[A-Za-z0-9]+$/.test(rawRunId);
  const runId = rawRunId as Id<'payrollRuns'>;
  const { user } = useAuthStore();

  const isAdmin =
    user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'superadmin';

  const run = useQuery(
    api.payroll.queries.getPayrollRunById,
    user?.id && isValidRunId ? { id: runId } : 'skip',
  );

  const calculate = useMutation(api.payroll.mutations.calculatePayrollRun);
  const approve = useMutation(api.payroll.mutations.approvePayrollRun);
  const markPaid = useMutation(api.payroll.mutations.markPayrollRunAsPaid);
  const cancel = useMutation(api.payroll.mutations.cancelPayrollRun);

  const [editingRecord, setEditingRecord] = useState<PayrollRecordItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [srcExporting, setSrcExporting] = useState(false);
  const [paymentExporting, setPaymentExporting] = useState(false);
  /**
   * Which bank portal the CSV is being prepared for.
   *
   * The organisation's saved layout (`/settings?tab=payroll-file`) decides this,
   * not the browser: the employer's bank template is the same for everyone, and
   * it used to live in `localStorage` where a second accountant's machine
   * exported a differently shaped file from the same run. The dropdown remains
   * as a per-export override; the default falls back to the neutral layout,
   * which is the one every portal accepts.
   */
  const savedLayout = useQuery(api.payrollFile.getPayrollFileLayout);
  const [bankProfileId, setBankProfileId] = useState<string>(DEFAULT_BANK_PROFILE_ID);
  const bankProfile = getBankProfile(bankProfileId);

  // The query resolves a tick after mount, so the saved choice is applied when
  // it arrives rather than only at first render.
  useEffect(() => {
    if (savedLayout?.profileId) setBankProfileId(savedLayout.profileId);
  }, [savedLayout]);

  /**
   * The stored layout, but only for the profile currently selected — otherwise
   * a column order saved for Ameriabank would be applied to Ardshinbank's
   * preset and quietly produce a file nobody chose.
   */
  const layoutForProfile = savedLayout?.profileId === bankProfileId ? savedLayout : null;

  const runAction = async (fn: () => Promise<unknown>, successKey: string) => {
    if (!user?.id) {
      toast.error(t('errors.unauthorized'));
      return;
    }
    setActionLoading(true);
    try {
      await fn();
      toast.success(t(successKey) || 'Done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      const key = getPayrollErrorTranslationKey(msg);
      toast.error(key ? t(key) : msg || t('common.error', 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  function getPayrollErrorTranslationKey(msg: string): string | null {
    const map: Record<string, string> = {
      'Payroll run for this period already exists': 'payroll.runExists',
      'Invalid period format, expected YYYY-MM': 'payroll.invalidPeriodFormat',
      'Payroll run not found': 'payroll.runNotFound',
      'Can only calculate draft payroll runs': 'payroll.canOnlyCalculateDraft',
      'Can only approve calculated payroll runs': 'payroll.canOnlyApproveCalculated',
      'Can only pay approved payroll runs': 'payroll.canOnlyPayApproved',
      'Cannot cancel a paid payroll run': 'payroll.cannotCancelPaid',
      'Cannot update a paid payroll record': 'payroll.cannotUpdatePaid',
      'Cannot delete a paid payroll record': 'payroll.cannotDeletePaidRecord',
      'Insufficient permissions': 'payroll.insufficientPermissions',
      'Base salary cannot be negative': 'payroll.baseSalaryCannotBeNegative',
      'Bonuses cannot be negative': 'payroll.bonusesCannotBeNegative',
      'Overtime hours cannot be negative': 'payroll.overtimeHoursCannotBeNegative',
    };
    return map[msg] ?? null;
  }

  if (!run) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-(--text-muted)">{t('payroll.noData')}</div>
      </div>
    );
  }

  // ── SRC filing export (Armenian Tax Service) ──────────────────────────
  // Sends the run's records + employee identity data to the export API and
  // downloads the styled workbook. The API is a dumb formatter — all RBAC
  // happened already (this page is supervisor+ only, run came from Convex).
  const exportSrcFiling = async () => {
    if (!run.records || run.records.length === 0) return;
    setSrcExporting(true);
    try {
      const identities: Record<string, SrcEmployeeIdentity> = {};
      for (const record of run.records) {
        identities[record.userId] = {
          userId: record.userId,
          name: record.user?.name ?? record.userId,
          taxId: record.taxId ?? null,
          nationalId: record.nationalId ?? null,
          position: record.user?.position ?? null,
          department: record.user?.department ?? null,
        };
      }
      const csrfRes = await fetch('/api/csrf-token', { method: 'GET' });
      const csrfData = csrfRes.ok
        ? ((await csrfRes.json()) as { token?: string; signature?: string })
        : {};
      const res = await fetch('/api/payroll/src-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token ?? '',
          'X-CSRF-Token-Signature': csrfData.signature ?? '',
        },
        body: JSON.stringify({
          records: run.records.map((record) => ({
            userId: record.userId,
            period: record.period,
            baseSalary: record.baseSalary,
            grossSalary: record.grossSalary,
            netSalary: record.netSalary,
            bonuses: record.bonuses,
            overtimePay: record.overtimePay,
            deductions: record.deductions,
            status: record.status,
            taxCountry: record.taxCountry,
            currency: record.currency ?? 'AMD',
          })),
          identities,
          currency: run.records[0]?.currency ?? 'AMD',
          lang: i18n.language,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `src-filing-${run.period}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('payroll.srcExported', 'SRC filing exported'));
    } catch (e) {
      logger.error('[SRC export]', e);
      toast.error(t('payroll.srcExportFailed', 'SRC export failed'));
    } finally {
      setSrcExporting(false);
    }
  };

  // ── Bank payment register ─────────────────────────────────────────────
  // The step after the SRC filing: who gets how much, to which account. The
  // xlsx is the accountant's working file; the CSV is what the bank portal
  // imports and contains payable rows only (see paymentRegister.ts).
  const exportPaymentRegister = async (format: 'xlsx' | 'csv' = 'xlsx', profileId?: string) => {
    if (!run.records || run.records.length === 0) return;
    setPaymentExporting(true);
    try {
      const details: Record<string, PaymentEmployeeDetails> = {};
      for (const record of run.records) {
        details[record.userId] = {
          userId: record.userId,
          name: record.user?.name ?? record.userId,
          bankAccountNumber: record.bankAccountNumber ?? null,
          bankName: record.bankName ?? null,
        };
      }
      const csrfRes = await fetch('/api/csrf-token', { method: 'GET' });
      const csrfData = csrfRes.ok
        ? ((await csrfRes.json()) as { token?: string; signature?: string })
        : {};
      const res = await fetch('/api/payroll/payment-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token ?? '',
          'X-CSRF-Token-Signature': csrfData.signature ?? '',
        },
        body: JSON.stringify({
          records: run.records.map((record) => ({
            userId: record.userId,
            period: record.period,
            netSalary: record.netSalary,
            // What is actually transferred (salary + reimbursed benefit claims).
            netPayout: record.netPayout ?? null,
            status: record.status,
            currency: record.currency ?? 'AMD',
          })),
          details,
          currency: run.records[0]?.currency ?? 'AMD',
          lang: i18n.language,
          format,
          // Only sent for the portal file: the accountant's xlsx is a working
          // document and has one shape. The saved layout travels with the
          // request so the export renders the same columns the settings screen
          // previewed.
          ...(profileId
            ? {
                profile: profileId,
                ...(layoutForProfile
                  ? {
                      columns: layoutForProfile.columns.join(','),
                      delimiter: layoutForProfile.delimiter,
                      header: layoutForProfile.header,
                      purpose: layoutForProfile.purpose,
                      payerAccount: layoutForProfile.payerAccount,
                    }
                  : {}),
              }
            : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        format === 'csv'
          ? `salary-payments-${run.period}.csv`
          : `salary-payments-${run.period}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      // The layout is a preset nobody has checked against the bank's current
      // specification, and the accountant is about to move a month of salaries
      // with it. Say so every time rather than once in a doc nobody reads.
      const verified = res.headers.get('X-Payment-Profile-Verified') === 'true';
      const excluded = Number(res.headers.get('X-Payment-Rows-Excluded') ?? '0');
      if (format === 'csv' && profileId && !verified) {
        toast.warning(
          t('payroll.bankProfileUnverified', {
            profile: t(getBankProfile(profileId).labelKey, ''),
          }),
        );
      } else {
        toast.success(t('payroll.paymentRegisterExported', 'Payment register exported'));
      }
      if (excluded > 0) {
        toast.warning(t('payroll.paymentRegisterExcluded', { count: excluded }));
      }
    } catch (e) {
      logger.error('[Payment register]', e);
      toast.error(t('payroll.paymentRegisterFailed', 'Payment register export failed'));
    } finally {
      setPaymentExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 my-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/payroll">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-(--text-primary)">
              {t('payroll.run')} #{run._id.slice(-6)}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-(--text-muted)" />
              <span className="text-(--text-muted)">{run.period}</span>
              {getStatusBadge(run.status, t)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && run.status === 'draft' && (
            <Button
              size="sm"
              onClick={() =>
                runAction(
                  () =>
                    calculate({
                      payrollRunId: run._id,
                    }),
                  'payroll.calculated',
                )
              }
              disabled={actionLoading}
            >
              <Calculator className="w-4 h-4 mr-2" />
              {t('payroll.calculate') || 'Calculate'}
            </Button>
          )}
          {isAdmin && run.status === 'calculated' && user?.id && (
            <Button
              size="sm"
              onClick={() =>
                runAction(
                  () =>
                    approve({
                      payrollRunId: run._id,
                    }),
                  'payroll.approved',
                )
              }
              disabled={actionLoading}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {t('payroll.approve') || 'Approve'}
            </Button>
          )}
          {isAdmin && run.status === 'approved' && (
            <Button
              size="sm"
              onClick={() =>
                runAction(
                  () =>
                    markPaid({
                      payrollRunId: run._id,
                    }),
                  'payroll.markedAsPaid',
                )
              }
              disabled={actionLoading}
            >
              <Send className="w-4 h-4 mr-2" />
              {t('payroll.markPaid') || 'Mark as paid'}
            </Button>
          )}
          {isAdmin && run.status !== 'cancelled' && (
            <Button
              size="sm"
              variant="outline"
              onClick={exportSrcFiling}
              disabled={actionLoading || srcExporting || !run.records?.length}
              title={t('payroll.srcExportHint', '')}
            >
              <Landmark className="w-4 h-4 mr-2" />
              {srcExporting ? t('common.loading', '…') : t('payroll.srcExport', 'SRC Filing')}
            </Button>
          )}
          {isAdmin && run.status !== 'cancelled' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportPaymentRegister('xlsx')}
              disabled={actionLoading || paymentExporting || !run.records?.length}
              title={t('payroll.paymentRegisterHint', '')}
            >
              <Landmark className="w-4 h-4 mr-2" />
              {paymentExporting
                ? t('common.loading', '…')
                : t('payroll.paymentRegister', 'Payment register')}
            </Button>
          )}
          {isAdmin && run.status !== 'cancelled' && (
            <div className="flex items-center gap-2">
              <select
                aria-label={t('payroll.bankProfile', 'Bank profile')}
                className="h-8 rounded-md border border-(--border) bg-(--background) px-2 text-xs"
                value={bankProfileId}
                onChange={(e) => setBankProfileId(e.target.value)}
                title={t('payroll.bankProfileHint', '')}
              >
                {BANK_PROFILES.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {t(profile.labelKey, profile.id)}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => exportPaymentRegister('csv', bankProfile.id)}
                disabled={actionLoading || paymentExporting || !run.records?.length}
                title={t('payroll.paymentRegisterCsvHint', '')}
              >
                {t('payroll.paymentRegisterCsv', 'Payment CSV')}
              </Button>
              {!bankProfile.verified && (
                <span
                  className="text-[11px] text-(--warning-text)"
                  title={t(bankProfile.noteKey, '')}
                >
                  {t('payroll.bankProfileUnverifiedShort', 'unverified layout')}
                </span>
              )}
            </div>
          )}
          {isAdmin && run.status !== 'paid' && run.status !== 'cancelled' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                runAction(
                  () =>
                    cancel({
                      payrollRunId: run._id,
                    }),
                  'payroll.cancelled',
                )
              }
              disabled={actionLoading}
            >
              <Ban className="w-4 h-4 mr-2" />
              {t('payroll.cancel')}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-(--success-text)" />
              <span className="text-sm text-(--text-muted)">{t('payroll.totalGross')}</span>
            </div>
            <p className="text-2xl font-bold text-(--text-primary)">
              {formatCurrency(run.totalGross || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-(--brand-text)" />
              <span className="text-sm text-(--text-muted)">{t('payroll.totalNet')}</span>
            </div>
            <p className="text-2xl font-bold text-(--brand-text)">
              {formatCurrency(run.totalNet || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-(--danger-text)" />
              <span className="text-sm text-(--text-muted)">{t('payroll.totalDeductions')}</span>
            </div>
            <p className="text-2xl font-bold text-(--danger-text)">
              {formatCurrency(run.totalDeductions || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-(--purple-text)" />
              <span className="text-sm text-(--text-muted)">{t('payroll.employees')}</span>
            </div>
            <p className="text-2xl font-bold text-(--purple-text)">{run.employeeCount || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.records')}</CardTitle>
        </CardHeader>
        <CardContent>
          {run.records && run.records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-(--border)">
                    <th className="text-left py-3 px-4 text-sm font-medium text-(--text-muted)">
                      {t('payroll.employee')}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-(--text-muted)">
                      {t('payroll.baseSalary')}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-(--text-muted)">
                      {t('payroll.grossSalary')}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-(--text-muted)">
                      {t('payroll.netSalary')}
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-(--text-muted)">
                      {t('payroll.statusLabel', 'Status')}
                    </th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {run.records.map((record) => (
                    <tr
                      key={record._id}
                      className="border-b border-(--border) hover:bg-(--card-hover)"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-(--primary)/10 flex items-center justify-center text-(--primary) text-sm font-medium">
                            {record.user?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-(--text-primary)">
                              {record.user?.name || t('common.unknownUser', 'Unknown')}
                            </p>
                            <p className="text-xs text-(--text-muted)">{record.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-(--text-primary)">
                        {formatCurrency(record.baseSalary)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-(--text-primary)">
                        {formatCurrency(record.grossSalary)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-(--success-text)">
                        {formatCurrency(record.netSalary)}
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(record.status, t)}</td>
                      <td className="py-3 px-4 text-right">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingRecord(record)}
                            disabled={record.status === 'paid'}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-(--text-muted)">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>{t('payroll.noRecords')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>{t('payroll.metadata')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-(--text-muted)" />
                <span className="text-sm text-(--text-muted)">{t('payroll.createdAt')}:</span>
                <span className="text-sm font-medium">
                  {new Date(run.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-(--text-muted)" />
                <span className="text-sm text-(--text-muted)">{t('payroll.updatedAt')}:</span>
                <span className="text-sm font-medium">
                  {new Date(run.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {run.approvedByUser && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-(--text-muted)" />
                  <span className="text-sm text-(--text-muted)">{t('payroll.approvedBy')}:</span>
                  <span className="text-sm font-medium">{run.approvedByUser.name}</span>
                </div>
              )}
              {run.approvedAt && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-(--success-text)" />
                  <span className="text-sm text-(--text-muted)">{t('payroll.approvedAt')}:</span>
                  <span className="text-sm font-medium">
                    {new Date(run.approvedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {run.notes && (
            <>
              <Separator className="my-4" />
              <div>
                <h4 className="text-sm font-medium mb-2">{t('payroll.notes')}</h4>
                <p className="text-sm text-(--text-muted)">{run.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <EditPayrollRecordDialog
        open={!!editingRecord}
        onOpenChange={(o) => !o && setEditingRecord(null)}
        record={editingRecord}
      />
    </motion.div>
  );
}
