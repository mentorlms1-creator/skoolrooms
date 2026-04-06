'use client'

/**
 * components/ui/Button.tsx — Primary action component
 * Variants: primary, secondary, danger, ghost
 * Sizes: sm, md (default), lg
 * Loading state shows spinner and disables the button.
 */

import { type ButtonHTMLAttributes } from 'react'
import { Spinner } from '@/components/ui/Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: React.ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary hover:bg-primary/90 active:bg-primary/5 text-white focus-visible:ring-ring',
  secondary:
    'bg-card border border-border text-foreground hover:bg-background active:bg-border focus-visible:ring-ring',
  outline:
    'bg-transparent border border-primary text-primary hover:bg-primary/10 active:bg-primary/20 focus-visible:ring-ring',
  danger:
    'bg-destructive hover:bg-destructive/90 active:bg-destructive/80 text-white focus-visible:ring-destructive',
  ghost:
    'bg-transparent text-muted-foreground hover:bg-background hover:text-foreground active:bg-border focus-visible:ring-ring',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[44px]',
  md: 'px-4 py-2 text-sm min-h-[44px]',
  lg: 'px-6 py-3 text-base min-h-[2.75rem]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-md font-medium
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...rest}
    >
      {loading && <Spinner size="sm" className="text-current" />}
      {children}
    </button>
  )
}
