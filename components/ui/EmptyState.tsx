/**
 * components/ui/EmptyState.tsx — Empty state placeholder for lists and pages
 * Server-compatible (no 'use client' needed).
 */

import type { ComponentType, SVGProps } from 'react'

type EmptyStateProps = {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="mb-4">
          <Icon className="h-12 w-12 text-muted" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
