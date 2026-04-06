/**
 * components/ui/PageHeader.tsx — Consistent page header with title, description, and action
 * Server-compatible (no 'use client' needed).
 */

import Link from 'next/link'

type PageHeaderProps = {
  title: string
  description?: string
  action?: React.ReactNode
  backHref?: string
}

export function PageHeader({ title, description, action, backHref }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="flex items-center justify-center rounded-md p-2.5 min-h-[44px] min-w-[44px] text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
