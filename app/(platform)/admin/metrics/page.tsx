import { requireAdmin } from '@/lib/auth/guards'
import { getMrrTimeSeries, getAdminKpiMetrics } from '@/lib/db/admin-metrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MrrChart } from './MrrChart'
import { KpiCards } from './KpiCards'
import Link from 'next/link'

type SearchParams = { months?: string }

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireAdmin()

  const { months: monthsParam } = await searchParams
  const months = Number(monthsParam ?? '12')
  const validMonths = [3, 6, 12].includes(months) ? months : 12

  const [mrrData, kpiMetrics] = await Promise.all([
    getMrrTimeSeries(validMonths),
    getAdminKpiMetrics(),
  ])

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Metrics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            MRR trends, churn, conversion, and LTV
          </p>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {([3, 6, 12] as const).map((m) => (
            <Link
              key={m}
              href={`/admin/metrics?months=${m}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                validMonths === m
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {m}M
            </Link>
          ))}
        </div>
      </div>

      {/* KPI summary cards */}
      <KpiCards metrics={kpiMetrics} />

      {/* MRR chart */}
      <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-2xl bg-card">
        <CardHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Monthly Recurring Revenue ({validMonths}M)
            </CardTitle>
            <span className="text-sm font-medium text-muted-foreground">
              Current MRR: ₨{kpiMetrics.mrr.toLocaleString()}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <MrrChart data={mrrData} />
        </CardContent>
      </Card>

      {/* Active paid teachers context */}
      <div className="text-sm text-muted-foreground">
        {kpiMetrics.activePaidTeachers} active paid teachers —{' '}
        {kpiMetrics.grandfatheredCount > 0 && (
          <Link href="/admin/plans/grandfathered" className="text-primary underline-offset-4 hover:underline">
            {kpiMetrics.grandfatheredCount} grandfathered
          </Link>
        )}
        {kpiMetrics.grandfatheredCount === 0 && '0 grandfathered'}
      </div>

      {/* Advanced analytics link */}
      <div className="border-t border-border pt-4">
        <Link
          href="/admin/metrics/advanced"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          View advanced analytics →
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          Net revenue retention and cohort-level teacher performance.
        </p>
      </div>
    </div>
  )
}
