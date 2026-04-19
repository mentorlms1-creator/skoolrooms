'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { MrrDataPoint } from '@/lib/db/admin-metrics'

export function MrrChart({ data }: { data: MrrDataPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(`${d.month}-01T00:00:00Z`).toLocaleDateString('en-PK', {
      month: 'short',
      year: '2-digit',
    }),
  }))

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
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
            tickFormatter={(v: number) => `₨${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
          />
          <Tooltip
            formatter={(v) => [`₨${Number(v).toLocaleString()}`, 'MRR']}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              fontSize: '12px',
            }}
          />
          <Line
            type="monotone"
            dataKey="mrr"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--primary)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Revenue recognized in each month (confirmed subscriptions). Not a snapshot of active recurring balance.
      </p>
    </div>
  )
}
