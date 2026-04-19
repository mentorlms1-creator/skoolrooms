import type { SignupCohortRow } from '@/lib/db/admin-advanced-metrics'

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-PK', {
    month: 'short',
    year: 'numeric',
  })
}

function pctCell(v: number | null) {
  if (v === null) return <span className="text-muted-foreground">—</span>
  const tone =
    v >= 80
      ? 'text-foreground'
      : v >= 50
        ? 'text-muted-foreground'
        : 'text-destructive/80'
  return <span className={`font-medium ${tone}`}>{v}%</span>
}

export function CohortRetentionTable({ rows }: { rows: SignupCohortRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No teacher cohorts to display yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            <th className="px-3 py-2 font-semibold">Cohort Month</th>
            <th className="px-3 py-2 text-right font-semibold">Signed Up</th>
            <th className="px-3 py-2 text-right font-semibold">+1m</th>
            <th className="px-3 py-2 text-right font-semibold">+3m</th>
            <th className="px-3 py-2 text-right font-semibold">+6m</th>
            <th className="px-3 py-2 text-right font-semibold">+12m</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.cohortMonth}
              className="border-b border-border/60 last:border-b-0"
            >
              <td className="px-3 py-2.5 font-medium text-foreground">
                {monthLabel(r.cohortMonth)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                {r.signedUp}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {pctCell(r.retention1m)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {pctCell(r.retention3m)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {pctCell(r.retention6m)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {pctCell(r.retention12m)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
