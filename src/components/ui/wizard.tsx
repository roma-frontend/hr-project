/**
 * Multi-step Wizard Component
 * Универсальный компонент для пошаговых форм
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from '@/lib/cssMotion';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepContent {
  stepData: Record<string, string | number | boolean | null>;
  updateStepData: (key: string, value: unknown) => void;
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  content: React.ReactElement;
  validation?: (data: Record<string, string | number | boolean | null>) => boolean;
}

interface WizardProps {
  steps: WizardStep[];
  onComplete?: (data: Record<string, string | number | boolean | null>) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  showStepper?: boolean;
  className?: string;
  defaultStepData?: Record<string, string | number | boolean | null>;
}

export function Wizard({
  steps,
  onComplete,
  onCancel,
  submitLabel,
  cancelLabel,
  showStepper = true,
  className,
  defaultStepData = {},
}: WizardProps): React.ReactElement {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [stepData, setStepData] =
    useState<Record<string, string | number | boolean | null>>(defaultStepData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepData = steps[currentStep];

  const canGoNext = useCallback(() => {
    if (!currentStepData?.validation) return true;
    return currentStepData.validation(stepData);
  }, [currentStepData, stepData]);

  const handleNext = () => {
    if (currentStep < steps.length - 1 && canGoNext()) {
      setCurrentStep((prev) => prev + 1);
    } else if (currentStep === steps.length - 1) {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onComplete?.(stepData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStepData = (key: string, value: string | number | boolean | null) => {
    setStepData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Content Area */}
      <div className="flex-1 px-3 py-4 md:px-6 md:py-6">
        {/* Stepper */}
        {showStepper && (
          <div className="mb-4 md:mb-6">
            {/* Progress Bar */}
            <div className="relative h-1.5 bg-(--background-subtle) rounded-full overflow-hidden mb-3 md:mb-5">
              <motion.div
                className="absolute inset-y-0 left-0 bg-(--primary)"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              />
            </div>

            {/* Steps */}
            <div className="flex items-center justify-between gap-1">
              {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center flex-1 min-w-0">
                      <motion.div
                        className={cn(
                          'w-6 h-6 md:w-9 md:h-9 rounded-full flex items-center justify-center border-2 transition-colors shrink-0',
                          isCompleted
                            ? 'bg-(--primary) border-(--primary) text-white'
                            : isCurrent
                              ? 'border-(--primary) bg-(--background) text-(--primary)'
                              : 'border-(--border) bg-(--background) text-(--muted-foreground)',
                        )}
                        initial={{ scale: 1 }}
                        animate={{ scale: isCurrent ? 1.1 : 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                        ) : (
                          <span className="text-[10px] md:text-xs font-semibold">{index + 1}</span>
                        )}
                      </motion.div>
                      <div className="mt-1 md:mt-1.5 text-center w-full px-0.5">
                        <p
                          className={cn(
                            'text-[8px] md:text-[10px] font-medium transition-colors leading-tight',
                            isCurrent ? 'text-(--primary)' : 'text-(--muted-foreground)',
                          )}
                        >
                          {step.title}
                        </p>
                        {step.description && (
                          <p className="text-[7px] md:text-[9px] text-(--muted-foreground) mt-0.5 hidden md:block truncate">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {index < steps.length - 1 && (
                      <div className="flex-1 h-0.5 bg-(--border) mx-0.5 md:mx-1.5 max-w-4 md:max-w-none">
                        <motion.div
                          className={cn(
                            'h-full transition-colors',
                            isCompleted ? 'bg-(--primary)' : 'bg-(--border)',
                          )}
                          initial={{ width: '0%' }}
                          animate={{ width: isCompleted ? '100%' : '0%' }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="mb-4 md:mb-5">
              <h2 className="text-base md:text-xl font-bold text-(--text-primary) mb-1 md:mb-2">
                {currentStepData?.title}
              </h2>
              {currentStepData?.description && (
                <p className="text-xs md:text-sm text-(--text-muted)">
                  {currentStepData?.description}
                </p>
              )}
            </div>

            <div className="space-y-3 md:space-y-4">
              {React.isValidElement(currentStepData?.content) &&
              typeof currentStepData.content.type !== 'string'
                ? React.cloneElement(
                    currentStepData.content as React.ReactElement<{
                      stepData: Record<string, string | number | boolean | null>;
                      updateStepData: (
                        key: string,
                        value: string | number | boolean | null,
                      ) => void;
                    }>,
                    {
                      stepData,
                      updateStepData,
                    },
                  )
                : currentStepData?.content}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="flex-shrink-0 px-3 py-3 md:px-6 md:py-4 border-t mt-4">
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 || isSubmitting}
            className="border-(--border) bg-(--background) hover:bg-(--background-subtle) text-(--foreground) w-full sm:w-auto text-sm"
          >
            <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            {t('wizard.back', 'Back')}
          </Button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="border-(--border) bg-(--background) hover:bg-(--background-subtle) text-(--foreground) w-full sm:w-auto text-sm"
              >
                {cancelLabel || t('wizard.cancel', 'Cancel')}
              </Button>
            )}

            <Button
              onClick={handleNext}
              disabled={!canGoNext() || isSubmitting}
              className={cn(
                'gap-1 md:gap-2 w-full sm:w-auto text-sm',
                currentStep === steps.length - 1
                  ? 'bg-(--primary) hover:bg-(--primary-hover) text-white'
                  : 'bg-(--primary) hover:bg-(--primary-hover) text-white',
              )}
            >
              {isSubmitting ? (
                t('wizard.processing', 'Processing...')
              ) : currentStep === steps.length - 1 ? (
                submitLabel || t('wizard.submit', 'Submit')
              ) : (
                <>
                  {t('wizard.next', 'Next')}
                  <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
