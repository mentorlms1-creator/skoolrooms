/**
 * components/ui/Select.tsx — Dropdown select with label and error display
 * Forwarded ref component. Server-compatible (no 'use client' needed).
 */

import { forwardRef, type SelectHTMLAttributes } from 'react'

type SelectOption = {
  value: string
  label: string
}

type SelectProps = {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, error, options, placeholder, className = '', id, ...rest }, ref) {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-ink"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full rounded-md border border-border bg-surface px-3 py-2
            text-sm text-ink
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-danger focus:ring-danger focus:border-danger' : ''}
            ${className}
          `}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
      </div>
    )
  },
)
