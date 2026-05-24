// =============================================================================
// components/admin/TodayTicker.tsx
// Compact "today in numbers" strip for admin dashboard. Shows signups,
// approvals, payments, and classes happening on the current PKT day.
// =============================================================================

import { UserPlus, CheckCircle, Wallet, Video } from 'lucide-react'
import type { TodayTicker } from '@/lib/db/admin-dashboard'

const ITEMS: Array<{
  key: keyof TodayTicker
  label: string
  icon: typeof UserPlus
  fmt: (n: number) => string
}> = [
  { key: 'signups_today', label: 'Signups', icon: UserPlus, fmt: (n) => String(n) },
  {
    key: 'subscription_approvals_today',
    label: 'Subs approved',
    icon: CheckCircle,
    fmt: (n) => String(n),
  },
  {
    key: 'student_payments_today',
    label: 'Student payments',
    icon: Wallet,
    fmt: (n) => String(n),
  },
  { key: 'classes_today', label: 'Classes today', icon: Video, fmt: (n) => String(n) },
]

export function TodayTickerWidget({ data }: { data: TodayTicker }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {ITEMS.map((item) => {
        const Icon = item.icon
        const value = data[item.key] as number
        return (
          <div
            key={item.key}
            className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] px-4 py-3.5"
          >
            <div className="flex items-center gap-1.5 text-muted-foreground/70 mb-1.5">
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
                {item.label}
              </span>
            </div>
            <p className="text-2xl font-extrabold tabular-nums text-foreground leading-none">
              {item.fmt(value)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
