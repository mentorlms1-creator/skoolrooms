/**
 * components/ui/Textarea.tsx — Multi-line text input with label and error display
 * Forwarded ref component. Server-compatible (no 'use client' needed).
 */

import { forwardRef, type TextareaHTMLAttributes } from 'react'

type TextareaProps = {
  label?: string
  error?: string
} & TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, className = '', id, ...rest }, ref) {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full rounded-md border border-border bg-card px-3 py-2
            text-sm text-foreground placeholder:text-muted-foreground
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary
            disabled:opacity-50 disabled:cursor-not-allowed
            min-h-[80px] resize-y
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
