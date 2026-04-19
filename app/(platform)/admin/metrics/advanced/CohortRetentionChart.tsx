'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { SignupCohortRow } from '@/lib/db/admin-advanced-metrics'

const HORIZONS = [0, 1, 3, 6, 12] as const
const COLORS = [
  'var(--primary)',
  'oklch(0.65 0.2 145)',
  'oklch(0.7 0.18 60)',
  'oklch(0.6 0.2 280)',
  'oklch(0.55 0.22 0)',
  'oklch(0.65 0.18 200)',
]

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-PK', {
    month: 'short',
    year: '2-digit',
  })
}

export function CohortRetentionChart({ rows }: { rows: SignupCohortRow[] }) {
  // Take the 6 most-recent cohorts that have at least the +1m point computed.
  const cohorts = rows.filter((r) => r.retention1m !== null).slice(0, 6)

  if (cohorts.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        Not enough cohort data yet to render curves.
      </div>
    )
  }

  // X-axis points: months since signup. Each cohort contributes a series.
  const data = HORIZONS.map((h) => {
    const point: Record<string, number | string | null> = { month: `+${h}m` }
    for (const c of cohorts) {
      const v =
        h === 0
          ? 100
          : h === 1
            ? c.retention1m
            : h === 3
              ? c.retention3m
              : h === 6
                ? c.retention6m
                : c.retention12m
      point[c.cohortMonth] = v
    }
    return point
  })

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(v) => (v === null ? '—' : `${v}%`)}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }}
            formatter={(v) => monthLabel(String(v))}
          />
          {cohorts.map((c, i) => (
            <Line
              key={c.cohortMonth}
              type="monotone"
              dataKey={c.cohortMonth}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
