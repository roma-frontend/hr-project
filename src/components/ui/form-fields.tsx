/**
 * Form Field Components
 *
 * Reusable form components with validation error display.
 * Designed to work with React Hook Form + Zod validation.
 */

import React from 'react';
import { UseFormRegister, FieldError, FieldValues, Path } from 'react-hook-form';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

// ─────────────────────────────────────────────────────────────────────────────
// FORM FIELD WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

interface FormFieldProps<T extends FieldValues> {
  label: string;
  error?: FieldError;
  children: React.ReactNode;
  required?: boolean;
  description?: string;
}

export function FormField<T extends FieldValues>({
  label,
  error,
  children,
  required,
  description,
}: FormFieldProps<T>) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {children}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT FIELD
// ─────────────────────────────────────────────────────────────────────────────

interface FormInputProps<T extends FieldValues> {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  error?: FieldError;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  description?: string;
  autoComplete?: string;
}

export function FormInput<T extends FieldValues>({
  label,
  name,
  register,
  error,
  type = 'text',
  placeholder,
  required,
  disabled,
  description,
  autoComplete,
}: FormInputProps<T>) {
  return (
    <FormField<T> label={label} error={error} required={required} description={description}>
      <input
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm 
          placeholder:text-muted-foreground
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          disabled:cursor-not-allowed disabled:opacity-50
          ${error ? 'border-destructive' : 'border-input'}
        `}
        {...register(name)}
      />
    </FormField>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXTAREA FIELD
// ─────────────────────────────────────────────────────────────────────────────

interface FormTextareaProps<T extends FieldValues> {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  error?: FieldError;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  description?: string;
}

export function FormTextarea<T extends FieldValues>({
  label,
  name,
  register,
  error,
  placeholder,
  required,
  disabled,
  rows = 4,
  maxLength,
  description,
}: FormTextareaProps<T>) {
  return (
    <FormField<T> label={label} error={error} required={required} description={description}>
      <textarea
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={!!error}
        className={`flex w-full rounded-md border bg-background px-3 py-2 text-sm 
          placeholder:text-muted-foreground
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          disabled:cursor-not-allowed disabled:opacity-50
          ${error ? 'border-destructive' : 'border-input'}
        `}
        {...register(name)}
      />
    </FormField>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECT FIELD
// ─────────────────────────────────────────────────────────────────────────────

interface FormSelectProps<T extends FieldValues> {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  error?: FieldError;
  required?: boolean;
  disabled?: boolean;
  description?: string;
  children: React.ReactNode;
}

export function FormSelect<T extends FieldValues>({
  label,
  name,
  register,
  error,
  required,
  disabled,
  description,
  children,
}: FormSelectProps<T>) {
  return (
    <FormField<T> label={label} error={error} required={required} description={description}>
      <select
        disabled={disabled}
        aria-invalid={!!error}
        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm 
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          disabled:cursor-not-allowed disabled:opacity-50
          ${error ? 'border-destructive' : 'border-input'}
        `}
        {...register(name)}
      >
        {children}
      </select>
    </FormField>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT BUTTON
// ─────────────────────────────────────────────────────────────────────────────

interface SubmitButtonProps {
  children: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SubmitButton({ children, isLoading, disabled, className = '' }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={isLoading || disabled}
      className={`flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium 
        text-primary-foreground bg-primary hover:bg-primary/90
        disabled:pointer-events-none disabled:opacity-50
        ${className}
      `}
    >
      {isLoading ? (
        <span className="flex items-center justify-center">
          <ShieldLoader size="xs" variant="inline" />
        </span>
      ) : (
        children
      )}
    </button>
  );
}
