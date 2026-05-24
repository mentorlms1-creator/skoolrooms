'use client'

// =============================================================================
// app/(platform)/admin/TeacherActivityChart.tsx
// Bar chart of weekly-active teachers across the last 30 days. Each bar = WAU
// as of that day (unique teachers with last_seen_at within prior 7d). Today is
// live-computed; the rest come from teacher_activity_snapshots.
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
import type { TeacherActivitySeriesPoint } from '@/lib/db/admin'

export function TeacherActivityChart({ data }: { data: TeacherActivitySeriesPoint[] }) {
  const formatted = data.map((d, i) => ({
    ...d,
    label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-PK', {
      month: 'short',
      day: 'numeric',
    }),
    isToday: i === data.length - 1,
  }))

  return (
    <div className="w-full h-full flex flex-col">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            formatter={(v, name) => [
              `${v} teachers`,
              name === 'weeklyActive' ? 'Weekly active' : 'Daily active',
            ]}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="weeklyActive" radius={[6, 6, 0, 0]}>
            {formatted.map((entry, i) => (
              <Cell
                key={i}
                fill="var(--primary)"
                fillOpacity={entry.isToday ? 1 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
