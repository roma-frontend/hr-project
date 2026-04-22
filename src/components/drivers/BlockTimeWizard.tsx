/**
 * Block Time Wizard - Пошаговая форма блокировки времени водителя
 * Использует универсальный Wizard компонент
 */

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wizard, WizardStep } from '@/components/ui/wizard';
import { CardSelectionStep, TextInputStep } from '@/components/ui/wizard-step-components';
import { Calendar, Clock, FileText } from 'lucide-react';
import { useCreateSchedule } from '@/hooks/useDrivers';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useWizardContext } from '@/components/ui/wizard';

interface BlockTimeWizardProps {
  driverId: string;
  organizationId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

function DateTimeStep() {
  const { t } = useTranslation();
  const { stepData, updateStepData } = useWizardContext();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="startTime">{t('driverCalendar.startTime')}</Label>
        <Input
          id="startTime"
          type="datetime-local"
          value={String(stepData.startTime || '')}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            updateStepData('startTime', e.target.value)
          }
          className="bg-(--background) border-(--border) text-(--text-primary)"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endTime">{t('driverCalendar.endTime')}</Label>
        <Input
          id="endTime"
          type="datetime-local"
          value={String(stepData.endTime || '')}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            updateStepData('endTime', e.target.value)
          }
          className="bg-(--background) border-(--border) text-(--text-primary)"
        />
      </div>
      <TextInputStep
        field="reason"
        label={t('driverCalendar.reason')}
        placeholder={t('driverCalendar.enterReason')}
        required
      />
    </div>
  );
}

export function BlockTimeWizard({
  driverId,
  organizationId,
  onComplete,
  onCancel,
}: BlockTimeWizardProps) {
  const { t } = useTranslation();
  const createSchedule = useCreateSchedule();

  const steps: WizardStep[] = [
    {
      id: 'type',
      title: t('driverCalendar.wizardSteps.type.title'),
      description: t('driverCalendar.wizardSteps.type.description'),
      icon: <Calendar className="w-5 h-5" />,
      content: (
        <CardSelectionStep
          field="type"
          label={t('driverCalendar.type')}
          options={[
            {
              value: 'vacation',
              title: t('driverCalendar.vacation'),
              description: '',
              icon: <Calendar className="w-6 h-6" />,
              color: 'bg-blue-500/10 text-blue-600',
            },
            {
              value: 'sick',
              title: t('driverCalendar.sickLeave'),
              description: '',
              icon: <Clock className="w-6 h-6" />,
              color: 'bg-red-500/10 text-red-600',
            },
            {
              value: 'personal',
              title: t('driverCalendar.personal'),
              description: '',
              icon: <FileText className="w-6 h-6" />,
              color: 'bg-green-500/10 text-green-600',
            },
          ]}
          columns={3}
          required
        />
      ),
    },
    {
      id: 'datetime',
      title: t('driverCalendar.wizardSteps.datetime.title'),
      description: t('driverCalendar.wizardSteps.datetime.description'),
      icon: <Clock className="w-5 h-5" />,
      content: <DateTimeStep />,
    },
  ];

  const handleSubmit = async (
    data: Record<string, string | number | boolean | string[] | null>,
  ) => {
    try {
      const type = data.type as string;
      const startTimeStr = data.startTime as string;
      const endTimeStr = data.endTime as string;
      const reason = data.reason as string;

      if (!type || !startTimeStr || !endTimeStr || !reason) {
        toast.error(t('toasts.pleaseFillAllFields'));
        return;
      }

      const startTime = new Date(startTimeStr).getTime();
      const endTime = new Date(endTimeStr).getTime();

      if (isNaN(startTime) || isNaN(endTime)) {
        toast.error(t('driverCalendar.failedToBlockTime'));
        return;
      }

      if (endTime <= startTime) {
        toast.error(t('toasts.endTimeAfterStart'));
        return;
      }

      await createSchedule.mutateAsync({
        driverId,
        type: type as 'vacation' | 'sick' | 'personal',
        startTime,
        endTime,
        reason,
      });

      toast.success(t('toasts.timeBlockedSuccess'));
      onComplete?.();
    } catch (error) {
      toast.error(t('driverCalendar.failedToBlockTime'));
      console.error(error);
    }
  };

  return (
    <Wizard
      steps={steps}
      onComplete={handleSubmit}
      onCancel={onCancel}
      submitLabel={t('driverCalendar.blockTimeBtn')}
      cancelLabel={t('actions.cancel')}
    />
  );
}
