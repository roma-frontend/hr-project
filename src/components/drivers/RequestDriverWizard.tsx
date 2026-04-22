/**
 * Request Driver Wizard - Пошаговая форма заказа водителя
 * Использует универсальный Wizard компонент
 */

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wizard, WizardStep } from '@/components/ui/wizard';
import {
  TextInputStep,
  TextareaStep,
  CardSelectionStep,
} from '@/components/ui/wizard-step-components';
import { Car, MapPin, Clock, Calendar, Users } from 'lucide-react';
import { useAvailableDrivers, useCreateDriverRequest } from '@/hooks/useDrivers';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization';

interface RequestDriverWizardProps {
  userId: string;
  onComplete?: () => void;
  onCancel?: () => void;
  preselectedDriverId?: string;
}

export function RequestDriverWizard({
  userId,
  onComplete,
  onCancel,
  preselectedDriverId,
}: RequestDriverWizardProps) {
  const { t } = useTranslation();
  const requestDriver = useCreateDriverRequest();
  const { user } = useAuthStore();
  const selectedOrgId = useSelectedOrganization();
  const organizationId = (selectedOrgId ?? user?.organizationId) as string | undefined;
  const { data: drivers } = useAvailableDrivers(organizationId);

  const steps: WizardStep[] = [
    {
      id: 'type',
      title: t('driverWizard.steps.type.title'),
      description: t('driverWizard.steps.type.description'),
      icon: <Car className="w-5 h-5" />,
      content: (
        <CardSelectionStep
          field="tripCategory"
          label={t('driverWizard.steps.type.typeLabel')}
          options={[
            {
              value: 'airport',
              title: t('driverWizard.types.airport'),
              description: t('driverWizard.types.airportDesc'),
              icon: <Calendar className="w-6 h-6" />,
              color: 'bg-blue-500/10 text-blue-600',
            },
            {
              value: 'office_transfer',
              title: t('driverWizard.types.officeTransfer'),
              description: t('driverWizard.types.officeTransferDesc'),
              icon: <MapPin className="w-6 h-6" />,
              color: 'bg-green-500/10 text-green-600',
            },
            {
              value: 'client_meeting',
              title: t('driverWizard.types.clientMeeting'),
              description: t('driverWizard.types.clientMeetingDesc'),
              icon: <Users className="w-6 h-6" />,
              color: 'bg-purple-500/10 text-purple-600',
            },
          ]}
          columns={3}
          required
        />
      ),
    },
    {
      id: 'route',
      title: t('driverWizard.steps.route.title'),
      description: t('driverWizard.steps.route.description'),
      icon: <MapPin className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <TextInputStep
            field="from"
            label={t('driverWizard.steps.route.fromLabel')}
            placeholder={t('driverWizard.steps.route.fromPlaceholder')}
            required
          />
          <TextInputStep
            field="to"
            label={t('driverWizard.steps.route.toLabel')}
            placeholder={t('driverWizard.steps.route.toPlaceholder')}
            required
          />
          <TextInputStep
            field="purpose"
            label={t('driverWizard.steps.route.purposeLabel')}
            placeholder={t('driverWizard.steps.route.purposePlaceholder')}
            required
          />
          <TextInputStep
            field="passengerCount"
            label={t('driverWizard.steps.route.passengerCountLabel')}
            type="number"
            defaultValue="1"
          />
        </div>
      ),
    },
    {
      id: 'driver',
      title: t('driverWizard.steps.driver.title'),
      description: t('driverWizard.steps.driver.description'),
      icon: <Car className="w-5 h-5" />,
      content:
        drivers && drivers.length > 0 ? (
          <CardSelectionStep
            field="driverId"
            label={t('driverWizard.steps.driver.selectLabel')}
            options={drivers
              .filter((driver) => driver !== null)
              .map((driver) => ({
                value: driver.id,
                title: driver.userName,
                description: driver.userPosition || '',
                icon: <Car className="w-6 h-6" />,
                color: 'bg-blue-500/10 text-blue-600',
              }))}
            columns={2}
            required
          />
        ) : (
          <div className="text-center py-8 text-(--text-muted)">
            {t('driverWizard.steps.driver.noDrivers')}
          </div>
        ),
    },
    {
      id: 'datetime',
      title: t('driverWizard.steps.datetime.title'),
      description: t('driverWizard.steps.datetime.description'),
      icon: <Clock className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextInputStep
              field="date"
              label={t('driverWizard.steps.datetime.dateLabel')}
              type="text"
              placeholder={t('placeholders.dateFormat', 'YYYY-MM-DD')}
              required
            />
            <TextInputStep
              field="time"
              label={t('driverWizard.steps.datetime.timeLabel')}
              type="text"
              placeholder={t('placeholders.timeFormat', 'HH:MM')}
              required
            />
          </div>
          <TextareaStep
            field="notes"
            label={t('driverWizard.steps.datetime.notesLabel')}
            placeholder={t('driverWizard.steps.datetime.notesPlaceholder')}
            rows={3}
          />
        </div>
      ),
    },
  ];

  const handleSubmit = async (
    data: Record<string, string | number | boolean | string[] | null>,
  ) => {
    try {
      if (!organizationId) {
        toast.error(t('driverWizard.toast.noOrg'));
        return;
      }

      const dateStr = String(data.date || '').trim();
      const timeStr = String(data.time || '').trim();

      if (!dateStr || !timeStr) {
        toast.error(
          t('driverWizard.toast.fillDateAndTime', 'Please fill in both date and time fields.'),
        );
        return;
      }

      const parsedDate = new Date(`${dateStr}T${timeStr}:00`);
      const startTime = parsedDate.getTime();

      if (isNaN(startTime)) {
        toast.error(
          t(
            'driverWizard.toast.invalidDateTime',
            'Invalid date or time. Please use YYYY-MM-DD and HH:MM formats.',
          ),
        );
        return;
      }

      const endTime = startTime + 3600000;

      const result = await requestDriver.mutateAsync({
        organizationId,
        driverId: data.driverId as string,
        startTime,
        endTime,
        tripInfo: {
          from: String(data.from),
          to: String(data.to),
          purpose: String(data.purpose),
          passengerCount: Number(data.passengerCount) || 1,
          notes: data.notes ? String(data.notes) : undefined,
        },
      });

      toast.success(t('driverWizard.toast.success'));
      onComplete?.();
    } catch (error) {
      toast.error(t('driverWizard.toast.error'));
      console.error(error);
    }
  };

  return (
    <Wizard
      steps={steps}
      onComplete={handleSubmit}
      onCancel={onCancel}
      submitLabel={t('driverWizard.submit')}
      cancelLabel={t('actions.cancel')}
    />
  );
}
