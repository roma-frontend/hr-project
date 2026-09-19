'use client';

/**
 * EmployeePaymentDetailsCard — where the salary is actually sent.
 *
 * Salary can be calculated without this, but it cannot be *paid*: the bank
 * payment register (`src/lib/payroll/paymentRegister.ts`) needs a beneficiary
 * account per employee. Before this card the only way to get salary out of the
 * product was a hand-built Excel file, and a missing account surfaced as a
 * broken bank upload rather than as a field somebody could fill in.
 *
 * Read: whoever may see compensation (same-org staff, superadmin, the employee).
 * Write: HR / a manager in the reporting line — `updatePaymentDetails` is
 * compensation-guarded, so an employee cannot silently redirect their own pay.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Landmark, Pencil, Check, X, AlertTriangle } from 'lucide-react';
import { ARMENIAN_ACCOUNT_LENGTH, isValidArmenianAccount } from '@/lib/payroll/paymentRegister';

interface EmployeePaymentDetailsCardProps {
  userId: Id<'users'>;
  organizationId?: Id<'organizations'>;
  /** HR / reporting-line manager — the mutation re-checks this server-side. */
  canEdit: boolean;
}

export function EmployeePaymentDetailsCard({
  userId,
  organizationId,
  canEdit,
}: EmployeePaymentDetailsCardProps) {
  const { t } = useTranslation();
  const salary = useQuery(api.employeeProfiles.getSalary, { userId });
  const updatePaymentDetails = useMutation(api.employeeProfiles.updatePaymentDetails);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState('');
  const [bank, setBank] = useState('');

  // Reset the draft whenever we enter edit mode so a cancelled edit does not
  // leak into the next one.
  useEffect(() => {
    if (!editing) return;
    setAccount(salary?.bankAccountNumber ?? '');
    setBank(salary?.bankName ?? '');
  }, [editing, salary?.bankAccountNumber, salary?.bankName]);

  const storedAccount = salary?.bankAccountNumber ?? '';
  const accountLooksWrong = account.trim().length > 0 && !isValidArmenianAccount(account);

  const save = async () => {
    setSaving(true);
    try {
      await updatePaymentDetails({
        userId,
        organizationId,
        bankAccountNumber: account.trim(),
        bankName: bank.trim(),
      });
      toast.success(t('payroll.paymentDetailsSaved', 'Payment details saved'));
      setEditing(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('payroll.paymentDetailsSaveFailed', 'Could not save'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 rounded-lg bg-(--background-subtle) space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-(--text-muted) flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5" />
          {t('payroll.paymentDetails', 'Salary payment details')}
        </p>
        {canEdit && !editing && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            title={t('payroll.paymentDetailsEditHint', '')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-1">
          {storedAccount || bank ? (
            <>
              <p className="text-sm font-semibold text-(--text-primary) tabular-nums">
                {storedAccount || '—'}
              </p>
              <p className="text-xs text-(--text-muted)">{bank || '—'}</p>
              {storedAccount && !isValidArmenianAccount(storedAccount) && (
                <p className="text-xs text-(--warning-text) flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('payroll.paymentIssueInvalidAccount', 'Account is not 20 digits')}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-(--warning-text) flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t('payroll.paymentIssueMissingAccount', 'No bank account on file')}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bank-account" className="text-xs">
              {t('payroll.bankAccountNumber', 'Account number')}
            </Label>
            <Input
              id="bank-account"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={'1234 5678 9012 3456 7890'}
              inputMode="numeric"
              className="tabular-nums"
            />
            {accountLooksWrong && (
              <p className="text-xs text-(--warning-text) flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {t('payroll.paymentAccountMustBe20Digits', {
                  n: ARMENIAN_ACCOUNT_LENGTH,
                  defaultValue: 'Armenian accounts are {{n}} digits',
                })}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="bank-name" className="text-xs">
              {t('payroll.bankName', 'Bank name')}
            </Label>
            <Input id="bank-name" value={bank} onChange={(e) => setBank(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={save} disabled={saving || accountLooksWrong}>
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {saving ? t('common.saving', '…') : t('common.save', 'Save')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
