/**
 * Create Ticket Wizard
 * Пошаговая форма создания тикета
 */

"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Wizard, WizardStep } from "@/components/ui/wizard";
import {
  TextInputStep,
  TextareaStep,
  SelectStep,
  CardSelectionStep,
} from "@/components/ui/wizard-step-components";
import { Ticket, AlertCircle, Info, FileText } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface CreateTicketWizardProps {
  userId: Id<"users">;
  onComplete?: () => void;
  onCancel?: () => void;
}

// Wrapper component to accept stepData and updateStepData props
const StepWrapper = ({
  stepData,
  updateStepData,
  children
}: {
  stepData?: Record<string, string | number | boolean | null>;
  updateStepData?: (key: string, value: string | number | boolean | null) => void;
  children: (props: {
    stepData: Record<string, string | number | boolean | null>;
    updateStepData: (key: string, value: string | number | boolean | null) => void;
  }) => React.ReactNode;
}) => {
  return <>{children({ stepData: stepData || {}, updateStepData: updateStepData || (() => {}) })}</>;
};

export function CreateTicketWizard({
  userId,
  onComplete,
  onCancel,
}: CreateTicketWizardProps) {
  const { t } = useTranslation();
  const createTicket = useMutation(api.tickets.createTicket);

  const steps: WizardStep[] = [
    {
      id: "type",
      title: t("help.wizard.step1.title"),
      description: t("help.wizard.step1.description"),
      icon: <Ticket className="w-5 h-5" />,
      content: (
        <CardSelectionStep
          stepData={{}}
          updateStepData={() => {}}
          field="type"
          label={t("help.wizard.step1.typeLabel")}
          options={[
            {
              value: "question",
              title: t("help.wizard.step1.types.question"),
              description: t("help.wizard.step1.types.questionDesc"),
              icon: <Info className="w-6 h-6" />,
              color: "bg-blue-500/10 text-blue-600",
            },
            {
              value: "issue",
              title: t("help.wizard.step1.types.issue"),
              description: t("help.wizard.step1.types.issueDesc"),
              icon: <AlertCircle className="w-6 h-6" />,
              color: "bg-red-500/10 text-red-600",
            },
            {
              value: "feature",
              title: t("help.wizard.step1.types.feature"),
              description: t("help.wizard.step1.types.featureDesc"),
              icon: <FileText className="w-6 h-6" />,
              color: "bg-green-500/10 text-green-600",
            },
          ]}
          columns={3}
          required
        />
      ),
      validation: () => true, // Will be validated by component
    },
    {
      id: "details",
      title: t("help.wizard.step2.title"),
      description: t("help.wizard.step2.description"),
      icon: <FileText className="w-5 h-5" />,
      content: (
        <StepWrapper>
          {({ stepData, updateStepData }) => (
            <div className="space-y-4">
              <TextInputStep
                stepData={stepData}
                updateStepData={updateStepData}
                field="title"
                label={t("help.wizard.step2.titleLabel")}
                placeholder={t("help.wizard.step2.titlePlaceholder")}
                required
              />
              <TextareaStep
                stepData={stepData}
                updateStepData={updateStepData}
                field="description"
                label={t("help.wizard.step2.descriptionLabel")}
                placeholder={t("help.wizard.step2.descriptionPlaceholder")}
                rows={6}
                required
              />
            </div>
          )}
        </StepWrapper>
      ),
    },
    {
      id: "priority",
      title: t("help.wizard.step3.title"),
      description: t("help.wizard.step3.description"),
      icon: <AlertCircle className="w-5 h-5" />,
      content: (
        <StepWrapper>
          {({ stepData, updateStepData }) => (
            <div className="space-y-4">
              <SelectStep
                stepData={stepData}
                updateStepData={updateStepData}
                field="priority"
                label={t("help.wizard.step3.priorityLabel")}
                options={[
                  { value: "low", label: t("priority.low") },
                  { value: "medium", label: t("priority.medium") },
                  { value: "high", label: t("priority.high") },
                  { value: "critical", label: t("priority.critical") },
                ]}
                placeholder={t("help.wizard.step3.priorityPlaceholder")}
                required
              />
              <SelectStep
                stepData={stepData}
                updateStepData={updateStepData}
                field="category"
                label={t("help.wizard.step3.categoryLabel")}
                options={[
                  { value: "technical", label: t("help.categories.technical") },
                  { value: "billing", label: t("help.categories.billing") },
                  { value: "account", label: t("help.categories.account") },
                  { value: "feature", label: t("help.categories.feature") },
                  { value: "other", label: t("help.categories.other") },
                ]}
                placeholder={t("help.wizard.step3.categoryPlaceholder")}
              />
            </div>
          )}
        </StepWrapper>
      ),
    },
  ];

  const handleSubmit = async (data: Record<string, string | number | boolean | null>) => {
    try {
      await createTicket({
        userId,
        title: String(data.title),
        description: String(data.description),
        type: String(data.type) as "question" | "issue" | "bug" | "feature",
        priority: (String(data.priority) || "medium") as "low" | "medium" | "high" | "critical",
        category: String(data.category) || "other",
      });

      toast.success(t("help.alerts.ticketCreated"));
      onComplete?.();
    } catch (error) {
      toast.error(t("help.alerts.errorCreatingTicket"));
      console.error(error);
    }
  };

  return (
    <Wizard
      steps={steps}
      onComplete={handleSubmit}
      onCancel={onCancel}
      submitLabel={t("help.wizard.submit")}
      cancelLabel={t("actions.cancel")}
    />
  );
}
