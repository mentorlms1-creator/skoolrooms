'use client'

import type { KpiMetrics } from '@/lib/db/admin-metrics'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-2xl bg-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function KpiCards({ metrics }: { metrics: KpiMetrics }) {
  const { arpu, ltv, churn, conversion } = metrics

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard
        label="ARPU"
        value={`₨${arpu.toLocaleString()}`}
        sub="avg revenue per paid teacher"
        icon={Wallet}
      />
      <StatCard
        label="LTV (est.)"
        value={ltv > 0 ? `₨${ltv.toLocaleString()}` : '—'}
        sub={ltv > 0 ? 'ARPU ÷ churn rate' : 'insufficient data'}
        icon={TrendingUp}
      />
      <StatCard
        label="Churn Rate"
        value={`${churn.churnRate}%`}
        sub={`${churn.churned} of ${churn.baseSize} ever-paid`}
        icon={TrendingDown}
      />
      <StatCard
        label="Conversion"
        value={`${conversion.conversionRate}%`}
        sub={`${conversion.converted} of ${conversion.totalFree} teachers`}
        icon={Users}
      />
    </div>
  )
}
