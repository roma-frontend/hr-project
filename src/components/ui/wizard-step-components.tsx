/**
 * Wizard Step Components
 * Готовые компоненты для использования в шагах Wizard
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useWizardContext } from '@/components/ui/wizard';

// ═══════════════════════════════════════════════════════════════
// Text Input Step
// ═══════════════════════════════════════════════════════════════
interface TextInputStepProps {
  stepData?: Record<string, string | number | boolean | null>;
  updateStepData?: (key: string, value: string | number | boolean | null) => void;
  field: string;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'number' | 'password' | 'date' | 'time';
  defaultValue?: string;
}

export function TextInputStep({
  stepData,
  updateStepData,
  field,
  label,
  placeholder,
  description,
  required = false,
  type = 'text',
  defaultValue,
}: TextInputStepProps) {
  const context = useWizardContext();
  const data = stepData ?? context.stepData;
  const update = updateStepData ?? context.updateStepData;
  const value = (data[field] as string | number | undefined) ?? defaultValue;
  return (
    <div className="space-y-2">
      <Label htmlFor={field} className="text-(--text-primary)">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={field}
        name={field}
        type={type}
        value={value ?? ''}
        onChange={(e) => update(field, e.target.value)}
        placeholder={placeholder}
        className="bg-(--input) border-(--input-border) text-(--text-primary) placeholder-(--text-muted)"
        required={required}
      />
      {description && <p className="text-xs text-(--text-muted)">{description}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Textarea Step
// ═══════════════════════════════════════════════════════════════
interface TextareaStepProps {
  stepData?: Record<string, string | number | boolean | null>;
  updateStepData?: (key: string, value: string | number | boolean | null) => void;
  field: string;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  rows?: number;
}

export function TextareaStep({
  stepData,
  updateStepData,
  field,
  label,
  placeholder,
  description,
  required = false,
  rows = 4,
}: TextareaStepProps) {
  const context = useWizardContext();
  const data = stepData ?? context.stepData;
  const update = updateStepData ?? context.updateStepData;
  const value = data[field] as string | number | undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={field} className="text-(--text-primary)">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Textarea
        id={field}
        name={field}
        value={value ?? ''}
        onChange={(e) => update(field, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="bg-(--input) border-(--input-border) text-(--text-primary) placeholder-(--text-muted) resize-none"
        required={required}
      />
      {description && <p className="text-xs text-(--text-muted)">{description}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Select Step
// ═══════════════════════════════════════════════════════════════
interface SelectStepProps {
  stepData?: Record<string, string | number | boolean | null>;
  updateStepData?: (key: string, value: string | number | boolean | null) => void;
  field: string;
  label: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  placeholder?: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
}

export function SelectStep({
  stepData,
  updateStepData,
  field,
  label,
  options,
  placeholder = 'Select...',
  description,
  required = false,
  defaultValue,
}: SelectStepProps) {
  const context = useWizardContext();
  const data = stepData ?? context.stepData;
  const update = updateStepData ?? context.updateStepData;
  const value = (data[field] as string | undefined) ?? defaultValue;
  return (
    <div className="space-y-2">
      <Label htmlFor={field} className="text-(--text-primary)">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Select
        value={value ?? ''}
        onValueChange={(value) => update(field, value)}
        required={required}
      >
        <SelectTrigger className="bg-(--input) border-(--input-border) text-(--text-primary)">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-(--text-primary)">
              <div className="flex items-center gap-2">
                {option.icon}
                {option.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && <p className="text-xs text-(--text-muted)">{description}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Card Selection Step
// ═══════════════════════════════════════════════════════════════
interface CardSelectionStepProps {
  stepData?: Record<string, string | number | boolean | null>;
  updateStepData?: (key: string, value: string | number | boolean | null) => void;
  field: string;
  label: string;
  options: {
    value: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    color?: string;
  }[];
  description?: string;
  required?: boolean;
  columns?: 2 | 3 | 4;
}

export function CardSelectionStep({
  stepData,
  updateStepData,
  field,
  label,
  options,
  description,
  required = false,
  columns = 2,
}: CardSelectionStepProps) {
  const context = useWizardContext();
  const data = stepData ?? context.stepData;
  const update = updateStepData ?? context.updateStepData;
  const selectedValue = data[field];

  return (
    <div className="space-y-2 md:space-y-3">
      <div>
        <Label className="text-(--text-primary) text-sm md:text-base">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        {description && (
          <p className="text-[10px] md:text-xs text-(--text-muted) mt-1">{description}</p>
        )}
      </div>

      <div
        className={cn(
          'grid gap-2 md:gap-3',
          'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'md:grid-cols-3',
          columns === 4 && 'md:grid-cols-4',
        )}
      >
        {options.map((option) => {
          const isSelected = selectedValue === option.value;

          return (
            <Card
              key={option.value}
              className={cn(
                'cursor-pointer transition-all duration-200 hover:shadow-md',
                isSelected
                  ? 'border-(--primary) bg-(--primary)/5 shadow-md'
                  : 'border-(--border) bg-(--background) hover:bg-(--background-subtle)',
              )}
              onClick={() => update(field, option.value)}
            >
              <CardContent className="p-3 md:p-5 flex flex-col items-center text-center gap-2 md:gap-3">
                <div
                  className={cn(
                    'p-2 md:p-3 rounded-full transition-colors',
                    isSelected
                      ? 'bg-(--primary) text-white'
                      : option.color || 'bg-(--background-subtle) text-(--text-muted)',
                  )}
                >
                  {React.isValidElement(option.icon)
                    ? React.cloneElement(option.icon as React.ReactElement<any>, {
                        className: 'w-4 h-4 md:w-6 md:h-6',
                      })
                    : option.icon}
                </div>
                <div className="space-y-1 md:space-y-1.5">
                  <p
                    className={cn(
                      'font-semibold text-xs md:text-sm leading-tight',
                      isSelected ? 'text-(--primary)' : 'text-(--text-primary)',
                    )}
                  >
                    {option.title}
                  </p>
                  <p className="text-[10px] md:text-xs text-(--text-muted) leading-relaxed line-clamp-2">
                    {option.description}
                  </p>
                </div>
                {isSelected && (
                  <Badge className="bg-(--primary) text-white text-[10px] md:text-xs px-2 py-0.5">
                    ✓ Выбрано
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Radio Group Step
// ═══════════════════════════════════════════════════════════════
interface RadioGroupStepProps {
  stepData?: Record<string, string | number | boolean | null>;
  updateStepData?: (key: string, value: string | number | boolean | null) => void;
  field: string;
  label: string;
  options: { value: string; label: string; description?: string }[];
  description?: string;
  required?: boolean;
  defaultValue?: string;
}

export function RadioGroupStep({
  stepData,
  updateStepData,
  field,
  label,
  options,
  description,
  required = false,
  defaultValue,
}: RadioGroupStepProps) {
  const context = useWizardContext();
  const data = stepData ?? context.stepData;
  const update = updateStepData ?? context.updateStepData;
  const value = (data[field] as string | undefined) ?? defaultValue;
  return (
    <div className="space-y-2 md:space-y-3">
      <div>
        <Label className="text-(--text-primary) text-sm md:text-base">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        {description && (
          <p className="text-[10px] md:text-xs text-(--text-muted) mt-1">{description}</p>
        )}
      </div>

      <RadioGroup
        value={value ?? ''}
        onValueChange={(value) => update(field, value)}
        className="space-y-2"
      >
        {options.map((option) => (
          <div
            key={option.value}
            className="flex items-start space-x-2 md:space-x-3 p-2 md:p-3 rounded-lg border border-(--border) bg-(--background) hover:bg-(--background-subtle) transition-colors cursor-pointer"
            onClick={() => update(field, option.value)}
          >
            <RadioGroupItem
              value={option.value}
              id={`${field}-${option.value}`}
              className="mt-0.5 shrink-0"
            />
            <Label htmlFor={`${field}-${option.value}`} className="flex-1 cursor-pointer">
              <p className="font-medium text-sm md:text-base text-(--text-primary)">
                {option.label}
              </p>
              {option.description && (
                <p className="text-[10px] md:text-xs text-(--text-muted) mt-0.5 md:mt-1">
                  {option.description}
                </p>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Checkbox Step
// ═══════════════════════════════════════════════════════════════
interface CheckboxStepProps {
  stepData?: Record<string, string | number | boolean | null | string[]>;
  updateStepData?: (key: string, value: string | number | boolean | null | string[]) => void;
  field: string;
  label: string;
  options: { value: string; label: string; description?: string }[];
  description?: string;
}

export function CheckboxStep({
  stepData,
  updateStepData,
  field,
  label,
  options,
  description,
}: CheckboxStepProps) {
  const context = useWizardContext();
  const data = stepData ?? context.stepData;
  const update = updateStepData ?? context.updateStepData;
  const values = (data[field] as string[] | undefined) || [];

  const toggleValue = (value: string) => {
    const newValues = values.includes(value)
      ? values.filter((v: string) => v !== value)
      : [...values, value];
    update(field, newValues);
  };

  return (
    <div className="space-y-2 md:space-y-3">
      <div>
        <Label className="text-(--text-primary) text-sm md:text-base">{label}</Label>
        {description && (
          <p className="text-[10px] md:text-xs text-(--text-muted) mt-1">{description}</p>
        )}
      </div>

      <div className="space-y-2">
        {options.map((option) => {
          const isChecked = values.includes(option.value);

          return (
            <div
              key={option.value}
              className="flex items-start space-x-2 md:space-x-3 p-2 md:p-3 rounded-lg border border-(--border) bg-(--background) hover:bg-(--background-subtle) transition-colors cursor-pointer"
              onClick={() => toggleValue(option.value)}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggleValue(option.value)}
                id={`${field}-${option.value}`}
                className="shrink-0 mt-0.5"
              />
              <Label htmlFor={`${field}-${option.value}`} className="flex-1 cursor-pointer">
                <p className="font-medium text-sm md:text-base text-(--text-primary)">
                  {option.label}
                </p>
                {option.description && (
                  <p className="text-[10px] md:text-xs text-(--text-muted) mt-0.5 md:mt-1">
                    {option.description}
                  </p>
                )}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
