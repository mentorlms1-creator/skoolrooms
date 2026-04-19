import type { NrrCohortPoint } from '@/lib/db/admin-advanced-metrics'
import { Card, CardContent } from '@/components/ui/card'

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-PK', {
    month: 'short',
    year: 'numeric',
  })
}

function NrrCard({
  horizonLabel,
  point,
  primary = false,
}: {
  horizonLabel: string
  point: NrrCohortPoint | null
  primary?: boolean
}) {
  const valueText = point ? `${point.nrrPercent}%` : '—'
  const subText = point
    ? `${horizonLabel}: ${monthLabel(point.cohortMonth)} → ${monthLabel(addMonthsLabel(point.cohortMonth, point.horizonMonths))}`
    : `${horizonLabel}: no paying teachers in cohort`

  return (
    <Card
      className={`border-none shadow-sm rounded-2xl bg-card ${
        primary ? 'ring-2 ring-primary/40' : 'ring-1 ring-foreground/5'
      }`}
    >
      <CardContent className="p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
          NRR {horizonLabel}
        </p>
        <p
          className={`mt-1 text-3xl font-bold ${
            point && point.nrrPercent >= 100 ? 'text-primary' : 'text-foreground'
          }`}
        >
          {valueText}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{subText}</p>
        {point && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            ₨{point.retainedMrr.toLocaleString()} retained of ₨
            {point.startingMrr.toLocaleString()} ·{' '}
            {point.retainedTeacherCount}/{point.startingTeacherCount} teachers
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function addMonthsLabel(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function NrrCards({
  nrr3,
  nrr6,
  nrr12,
}: {
  nrr3: NrrCohortPoint | null
  nrr6: NrrCohortPoint | null
  nrr12: NrrCohortPoint | null
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <NrrCard horizonLabel="3-month" point={nrr3} />
      <NrrCard horizonLabel="6-month" point={nrr6} />
      <NrrCard horizonLabel="12-month" point={nrr12} primary />
    </div>
  )
}
