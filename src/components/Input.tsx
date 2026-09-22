'use client';

import { clsx } from 'clsx';
import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';

/* ── Text / Number / Date / Email input ──────────────────────── */

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  computed?: boolean; // read-only computed field styling
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, computed, className, id, type = 'text', ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className={clsx('flex flex-col gap-1', className)}>
        <label htmlFor={inputId} className="text-[13px] font-medium text-muted">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={clsx(
            computed && 'computed-field',
            error && 'border-negative ring-1 ring-negative/20',
          )}
          readOnly={computed}
          tabIndex={computed ? -1 : undefined}
          {...props}
        />
        {hint && !error && (
          <span className="text-[12px] text-muted">{hint}</span>
        )}
        {error && (
          <span className="text-[12px] text-negative font-medium">{error}</span>
        )}
      </div>
    );
  }
);
InputField.displayName = 'InputField';

export const TextField = InputField;
export type TextFieldProps = InputFieldProps;

/* ── Select dropdown ─────────────────────────────────────────── */

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id || label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className={clsx('flex flex-col gap-1', className)}>
        <label htmlFor={selectId} className="text-[13px] font-medium text-muted">
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={clsx(error && 'border-negative ring-1 ring-negative/20')}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && (
          <span className="text-[12px] text-negative font-medium">{error}</span>
        )}
      </div>
    );
  }
);
SelectField.displayName = 'SelectField';

/* ── Textarea ────────────────────────────────────────────────── */

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id || label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className={clsx('flex flex-col gap-1', className)}>
        <label htmlFor={textareaId} className="text-[13px] font-medium text-muted">
          {label}
        </label>
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            'min-h-[80px] resize-y',
            error && 'border-negative ring-1 ring-negative/20',
          )}
          {...props}
        />
        {error && (
          <span className="text-[12px] text-negative font-medium">{error}</span>
        )}
      </div>
    );
  }
);
TextareaField.displayName = 'TextareaField';
