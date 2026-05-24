'use client'

// =============================================================================
// app/(platform)/admin/earnings/RevenueChart.tsx
// Bar chart of monthly subscription revenue (admin-approved). Cash basis —
// buckets by approved_at month.
// =============================================================================

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { MonthlyRevenuePoint } from '@/lib/db/admin-earnings'

export function RevenueChart({ data }: { data: MonthlyRevenuePoint[] }) {
  const formatted = data.map((d, i) => ({
    ...d,
    label: new Date(`${d.month}-01T00:00:00Z`).toLocaleDateString('en-PK', {
      month: 'short',
      year: '2-digit',
    }),
    isCurrent: i === data.length - 1,
  }))

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `₨${Math.round(v / 1000)}k` : `₨${v}`)}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            formatter={(v) => [`₨${Number(v).toLocaleString()}`, 'Revenue']}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="revenuePkr" radius={[8, 8, 0, 0]}>
            {formatted.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isCurrent ? 'var(--primary)' : 'var(--primary)'}
                fillOpacity={entry.isCurrent ? 1 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Revenue recognized when admin approved the subscription (cash basis).
      </p>
    </div>
  )
}
