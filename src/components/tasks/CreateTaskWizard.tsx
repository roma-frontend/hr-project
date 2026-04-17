/**
 * Create Task Wizard - Пошаговая форма создания задачи
 * Использует универсальный Wizard компонент
 */

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wizard, WizardStep } from '@/components/ui/wizard';
import { TextInputStep, TextareaStep, SelectStep } from '@/components/ui/wizard-step-components';
import { CheckSquare, Calendar, User, AlertCircle } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { toast } from 'sonner';

interface CreateTaskWizardProps {
  assigneeId?: Id<'users'>;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function CreateTaskWizard({ assigneeId, onComplete, onCancel }: CreateTaskWizardProps) {
  const { t } = useTranslation();
  const createTask = useMutation(api.tasks.createTask);
  const user = useQuery(api.users.queries.getCurrentUser, {});

  // Получаем список сотрудников для назначения
  const employees =
    useQuery(api.users.queries.getAllUsers, user?._id ? { requesterId: user._id } : 'skip') || [];

  const steps: WizardStep[] = [
    {
      id: 'details',
      title: t('taskWizard.steps.details.title'),
      description: t('taskWizard.steps.details.description'),
      icon: <CheckSquare className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <TextInputStep
            stepData={{}}
            updateStepData={() => {}}
            field="title"
            label={t('taskWizard.steps.details.titleLabel')}
            placeholder={t('taskWizard.steps.details.titlePlaceholder')}
            required
          />
          <TextareaStep
            stepData={{}}
            updateStepData={() => {}}
            field="description"
            label={t('taskWizard.steps.details.descriptionLabel')}
            placeholder={t('taskWizard.steps.details.descriptionPlaceholder')}
            rows={5}
          />
        </div>
      ),
    },
    {
      id: 'priority',
      title: t('taskWizard.steps.priority.title'),
      description: t('taskWizard.steps.priority.description'),
      icon: <AlertCircle className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <SelectStep
            stepData={{}}
            updateStepData={() => {}}
            field="priority"
            label={t('taskWizard.steps.priority.priorityLabel')}
            options={[
              { value: 'low', label: t('priority.low'), icon: null },
              { value: 'medium', label: t('priority.medium'), icon: null },
              { value: 'high', label: t('priority.high'), icon: null },
            ]}
            placeholder={t('taskWizard.steps.priority.priorityPlaceholder')}
            defaultValue="medium"
          />
          <TextInputStep
            stepData={{}}
            updateStepData={() => {}}
            field="deadline"
            label={t('taskWizard.steps.priority.deadlineLabel')}
            type="date"
            description={t('taskWizard.steps.priority.deadlineDescription')}
          />
        </div>
      ),
    },
    {
      id: 'assignee',
      title: t('taskWizard.steps.assignee.title'),
      description: t('taskWizard.steps.assignee.description'),
      icon: <User className="w-5 h-5" />,
      content: (
        <SelectStep
          stepData={{}}
          updateStepData={() => {}}
          field="assigneeId"
          label={t('taskWizard.steps.assignee.assigneeLabel')}
          options={employees
            .filter((e: any) => e._id !== user?._id)
            .map((e: any) => ({
              value: e._id,
              label: e.name,
              description: e.email,
            }))}
          placeholder={t('taskWizard.steps.assignee.assigneePlaceholder')}
          defaultValue={assigneeId || user?._id}
          required
        />
      ),
    },
  ];

  const handleSubmit = async (
    data: Record<string, string | number | boolean | string[] | null>,
  ) => {
    try {
      await createTask({
        assignedTo: String(data.assigneeId) as Id<'users'>,
        assignedBy: user?._id as Id<'users'>,
        title: String(data.title),
        description: String(data.description) || '',
        priority: (String(data.priority) || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
        deadline: data.deadline ? new Date(String(data.deadline)).getTime() : undefined,
      });

      toast.success(t('taskWizard.toast.success'));
      onComplete?.();
    } catch (error) {
      toast.error(t('taskWizard.toast.error'));
      console.error(error);
    }
  };

  return (
    <Wizard
      steps={steps}
      onComplete={handleSubmit}
      onCancel={onCancel}
      submitLabel={t('taskWizard.submit')}
      cancelLabel={t('actions.cancel')}
    />
  );
}
