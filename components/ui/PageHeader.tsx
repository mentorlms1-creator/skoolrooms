/**
 * components/ui/PageHeader.tsx — Consistent page header with title, description, and action
 * Server-compatible (no 'use client' needed).
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  description?: string
  action?: React.ReactNode
  filter?: React.ReactNode
  backHref?: string
  className?: string
}

export function PageHeader({ title, description, action, filter, backHref, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="flex items-center justify-center rounded-md p-2.5 min-h-[44px] min-w-[44px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {filter && <div className="shrink-0">{filter}</div>}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    </div>
  )
}
