/**
 * components/ui/Input.tsx — Text input with label and error display
 * Forwarded ref component. Server-compatible (no 'use client' needed).
 */

import { forwardRef, type InputHTMLAttributes } from 'react'

type InputProps = {
  label?: string
  error?: string
} & InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, className = '', id, ...rest }, ref) {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-ink"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-md border border-border bg-surface px-3 py-2 min-h-[2.75rem]
            text-sm text-ink placeholder:text-muted
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-danger focus:ring-danger focus:border-danger' : ''}
            ${className}
          `}
          {...rest}
        />
        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
      </div>
    )
  },
)
