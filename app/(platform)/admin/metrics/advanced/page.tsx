import { requireAdmin } from '@/lib/auth/guards'
import {
  getNrrMetricsCached,
  getCohortRetentionTableCached,
} from '@/lib/db/admin-advanced-metrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NrrCards } from './NrrCards'
import { CohortRetentionTable } from './CohortRetentionTable'
import { NrrWaterfallChart } from './NrrWaterfallChart'
import { CohortRetentionChart } from './CohortRetentionChart'

export default async function AdvancedMetricsPage() {
  await requireAdmin()

  const [nrr, retention] = await Promise.all([
    getNrrMetricsCached(),
    getCohortRetentionTableCached(),
  ])

  return (
    <div className="space-y-8 p-8">
      <div className="space-y-2">
        <Link
          href="/admin/metrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Metrics
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Advanced Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Net revenue retention and cohort-level teacher performance.
          </p>
        </div>
      </div>

      {/* NRR section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          Net Revenue Retention
        </h2>
        <NrrCards nrr3={nrr.nrr3} nrr6={nrr.nrr6} nrr12={nrr.nrr12} />

        <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-2xl bg-card">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-base font-semibold">
              NRR 12-month Waterfall
              {nrr.nrr12 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  cohort {formatLabel(nrr.nrr12.cohortMonth)} → today
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {nrr.waterfall ? (
              <NrrWaterfallChart waterfall={nrr.waterfall} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Insufficient cohort data to render waterfall.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Cohort retention section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          Teacher Cohort Retention
        </h2>

        <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-2xl bg-card">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-base font-semibold">
              Retention Table
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Of teachers who signed up in month M, the % still paying at +1m / +3m / +6m / +12m.
              Last {18} cohorts, newest first.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <CohortRetentionTable rows={retention.rows} />
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-2xl bg-card">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-base font-semibold">
              Cohort Retention Curves
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Most recent 6 cohorts. Each line shows % active at months since signup.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <CohortRetentionChart rows={retention.rows} />
          </CardContent>
        </Card>
      </section>

      <p className="border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        NRR uses confirmed teacher subscriptions only. Refunds are not subtracted
        (not tracked in current schema). Suspension state is current-snapshot,
        not time-travel accurate. Free plan is excluded from NRR. Metrics are
        cached for 1 hour.
      </p>
    </div>
  )
}

function formatLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-PK', {
    month: 'short',
    year: 'numeric',
  })
}
