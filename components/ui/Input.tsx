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
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-md border border-border bg-card px-3 py-2 min-h-[2.75rem]
            text-sm text-foreground placeholder:text-muted-foreground
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-destructive focus:ring-destructive focus:border-destructive' : ''}
            ${className}
          `}
          {...rest}
        />
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    )
  },
)
