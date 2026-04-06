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
    <div className={cn('mb-10', className)}>
      <div className="flex flex-col gap-1">
        {backHref && (
          <Link
            href={backHref}
            className="mb-4 flex items-center justify-center rounded-xl p-2.5 min-h-[44px] min-w-[44px] w-fit text-muted-foreground bg-card shadow-sm ring-1 ring-foreground/5 hover:text-foreground transition-all"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-[2.5rem] font-bold tracking-tight text-foreground leading-[1.1]">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-[17px] font-medium text-muted-foreground/80">
                {description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {filter && <div className="shrink-0">{filter}</div>}
            {action && <div className="shrink-0">{action}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
