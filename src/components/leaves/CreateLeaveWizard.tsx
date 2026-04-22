/**
 * Create Leave Wizard - Пошаговая форма создания заявки на отпуск
 * Использует универсальный Wizard компонент
 */

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wizard, WizardStep } from '@/components/ui/wizard';
import {
  CardSelectionStep,
  TextInputStep,
  TextareaStep,
} from '@/components/ui/wizard-step-components';
import { Calendar, Sun, Heart, Users, Briefcase, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveType } from '@/lib/types';
import { useMyOrganization } from '@/hooks/useOrganizations';
import { useCreateLeave } from '@/hooks/useLeaves';
import { useAuthStore } from '@/store/useAuthStore';

interface CreateLeaveWizardProps {
  userId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function CreateLeaveWizard({ userId, onComplete, onCancel }: CreateLeaveWizardProps) {
  const { t } = useTranslation();
  const createLeaveMutation = useCreateLeave();
  const { user } = useAuthStore();
  const { data: userOrg } = useMyOrganization(!!userId);

  const steps: WizardStep[] = [
    {
      id: 'type',
      title: t('leaveWizard.steps.type.title'),
      description: t('leaveWizard.steps.type.description'),
      icon: <Calendar className="w-5 h-5" />,
      content: (
        <CardSelectionStep
          field="type"
          label={t('leaveWizard.steps.type.typeLabel')}
          options={[
            {
              value: 'paid',
              title: t('leave.types.paid'),
              description: t('leave.types.paidDesc'),
              icon: <Sun className="w-6 h-6" />,
              color: 'bg-yellow-500/10 text-yellow-600',
            },
            {
              value: 'sick',
              title: t('leave.types.sick'),
              description: t('leave.types.sickDesc'),
              icon: <Heart className="w-6 h-6" />,
              color: 'bg-red-500/10 text-red-600',
            },
            {
              value: 'family',
              title: t('leave.types.family'),
              description: t('leave.types.familyDesc'),
              icon: <Users className="w-6 h-6" />,
              color: 'bg-purple-500/10 text-purple-600',
            },
            {
              value: 'unpaid',
              title: t('leave.types.unpaid'),
              description: t('leave.types.unpaidDesc'),
              icon: <Briefcase className="w-6 h-6" />,
              color: 'bg-gray-500/10 text-gray-600',
            },
          ]}
          columns={2}
          required
        />
      ),
      validation: () => true,
    },
    {
      id: 'dates',
      title: t('leaveWizard.steps.dates.title'),
      description: t('leaveWizard.steps.dates.description'),
      icon: <Calendar className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextInputStep
              field="startDate"
              label={t('leaveWizard.steps.dates.startDateLabel')}
              type="date"
              required
            />
            <TextInputStep
              field="endDate"
              label={t('leaveWizard.steps.dates.endDateLabel')}
              type="date"
              required
            />
          </div>
          <div className="p-4 rounded-lg bg-(--background-subtle) border border-(--border)">
            <p className="text-sm text-(--text-muted)">
              {t('leaveWizard.steps.dates.totalDays')}:{' '}
              <span className="font-semibold text-(--text-primary)">
                {t('leaveWizard.steps.dates.calculating')}
              </span>
            </p>
          </div>
        </div>
      ),
      validation: () => {
        return true;
      },
    },
    {
      id: 'details',
      title: t('leaveWizard.steps.details.title'),
      description: t('leaveWizard.steps.details.description'),
      icon: <Calendar className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <TextInputStep
            field="reason"
            label={t('leaveWizard.steps.details.reasonLabel')}
            placeholder={t('leaveWizard.steps.details.reasonPlaceholder')}
            required
          />
          <TextareaStep
            field="comment"
            label={t('leaveWizard.steps.details.commentLabel')}
            placeholder={t('leaveWizard.steps.details.commentPlaceholder')}
            rows={4}
          />
          {user && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡{' '}
                {t('leaveWizard.steps.details.balanceInfo', {
                  balance: (user as any).paidLeaveBalance ?? 24,
                })}
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'confirm',
      title: t('leaveWizard.steps.confirm.title'),
      description: t('leaveWizard.steps.confirm.description'),
      icon: <CheckCircle className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-(--background-subtle) border border-(--border)">
            <h4 className="font-semibold text-(--text-primary) mb-3">
              {t('leaveWizard.steps.confirm.summary')}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-(--text-muted)">{t('leaveWizard.steps.confirm.type')}:</span>
                <span className="font-medium text-(--text-primary)">
                  {t('leaveWizard.steps.confirm.typeValue')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--text-muted)">{t('leaveWizard.steps.confirm.dates')}:</span>
                <span className="font-medium text-(--text-primary)">
                  {t('leaveWizard.steps.confirm.datesValue')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--text-muted)">{t('leaveWizard.steps.confirm.days')}:</span>
                <span className="font-medium text-(--text-primary)">
                  {t('leaveWizard.steps.confirm.daysValue')}
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  };

  const handleSubmit = async (
    data: Record<string, string | number | boolean | string[] | null>,
  ) => {
    try {
      const days = calculateDays(String(data.startDate), String(data.endDate));

      await createLeaveMutation.mutateAsync({
        userId,
        organizationId: userOrg?.id || (user as any)?.organizationId || '',
        leaveType: String(data.type) as LeaveType,
        startDate: String(data.startDate),
        endDate: String(data.endDate),
        reason: String(data.reason),
      });

      toast.success(t('leaveWizard.toast.success'), {
        description: t('leaveWizard.toast.description'),
      });
      onComplete?.();
    } catch (error) {
      toast.error(t('leaveWizard.toast.error'));
      console.error(error);
    }
  };

  return (
    <Wizard
      steps={steps}
      onComplete={handleSubmit}
      onCancel={onCancel}
      submitLabel={t('leaveWizard.submit')}
      cancelLabel={t('actions.cancel')}
    />
  );
}
