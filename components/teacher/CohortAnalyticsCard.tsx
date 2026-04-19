/**
 * components/teacher/CohortAnalyticsCard.tsx
 * Per-cohort revenue + projection + completion rate. Server-rendered.
 */

import { Card } from '@/components/ui/card'
import type { CohortAnalytics } from '@/lib/db/cohorts'

type Props = {
  analytics: CohortAnalytics | null
  locked?: boolean
}

export function CohortAnalyticsCard({ analytics, locked }: Props) {
  if (locked) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Revenue analytics is available on a paid plan. Upgrade to see collected revenue,
          pending payments, and projected income for this cohort.
        </p>
      </Card>
    )
  }

  if (!analytics) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
        <p className="mt-2 text-sm text-muted-foreground">No analytics available.</p>
      </Card>
    )
  }

  const hasAnyData =
    analytics.revenue_collected_pkr > 0 ||
    analytics.revenue_pending_pkr > 0 ||
    analytics.projected_revenue_pkr > 0 ||
    analytics.enrolled_total > 0

  if (!hasAnyData) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No revenue data yet. Stats will populate once students enroll.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Analytics</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Collected"
          value={`Rs. ${analytics.revenue_collected_pkr.toLocaleString()}`}
          hint={
            analytics.manual_revenue_pkr > 0
              ? `Includes Rs. ${analytics.manual_revenue_pkr.toLocaleString()} marked as paid offline`
              : undefined
          }
        />
        <Stat
          label="Pending"
          value={`Rs. ${analytics.revenue_pending_pkr.toLocaleString()}`}
        />
        <Stat
          label="Projected"
          value={`Rs. ${analytics.projected_revenue_pkr.toLocaleString()}`}
          hint={analytics.projection_horizon_label ?? undefined}
        />
        <Stat
          label="Completion rate"
          value={
            analytics.completion_rate !== null ? `${analytics.completion_rate}%` : '—'
          }
          hint={
            analytics.completion_rate === null
              ? 'Available once cohort is archived'
              : undefined
          }
        />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {analytics.enrolled_active} active of {analytics.enrolled_total} total enrollments
      </p>
    </Card>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
