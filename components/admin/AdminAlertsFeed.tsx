// =============================================================================
// components/admin/AdminAlertsFeed.tsx
// Multi-item alerts feed for the admin dashboard. Replaces the single
// "Smart Priority Alert" card with a list of every active alert source.
// =============================================================================

import { Link } from 'next-view-transitions'
import { AlertOctagon, AlertTriangle, Info, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { AdminAlertItem } from '@/lib/db/admin-dashboard'
import { cn } from '@/lib/utils'

const SEVERITY_META: Record<
  AdminAlertItem['severity'],
  { icon: typeof AlertOctagon; pill: string; iconClass: string }
> = {
  critical: {
    icon: AlertOctagon,
    pill: 'bg-destructive/10 text-destructive',
    iconClass: 'text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    pill: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    pill: 'bg-foreground/[0.06] text-muted-foreground',
    iconClass: 'text-muted-foreground',
  },
}

export function AdminAlertsFeed({ alerts }: { alerts: AdminAlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-[15px] font-bold text-foreground">All clear</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Nothing urgent on the platform right now.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ul className="space-y-2.5">
      {alerts.map((alert) => {
        const meta = SEVERITY_META[alert.severity]
        const Icon = meta.icon
        return (
          <li key={alert.id}>
            <Link
              href={alert.href}
              className="group flex items-start gap-4 rounded-2xl px-4 py-3.5 ring-1 ring-foreground/[0.04] hover:ring-foreground/10 hover:bg-foreground/[0.02] transition-all"
            >
              <div
                className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                  meta.pill,
                )}
              >
                <Icon className={cn('h-4 w-4', meta.iconClass)} strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-foreground leading-snug">
                  {alert.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
              </div>
              <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:translate-x-0.5 group-hover:text-muted-foreground transition-all" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
