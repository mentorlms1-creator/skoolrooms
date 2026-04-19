'use client'

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
import type { NrrWaterfall } from '@/lib/db/admin-advanced-metrics'

type WaterfallBar = {
  label: string
  value: number
  base: number
  display: number
  fill: string
}

export function NrrWaterfallChart({ waterfall }: { waterfall: NrrWaterfall }) {
  const { starting, expansion, churn, contraction, ending } = waterfall

  // Stacked-bar trick: each bar has [base, value] so middle bars float.
  let cursor = starting
  const data: WaterfallBar[] = [
    {
      label: 'Starting',
      value: starting,
      base: 0,
      display: starting,
      fill: 'var(--primary)',
    },
  ]

  data.push({
    label: 'Expansion',
    value: expansion,
    base: cursor,
    display: expansion,
    fill: 'var(--chart-2, oklch(0.7 0.18 145))',
  })
  cursor += expansion

  data.push({
    label: 'Churn',
    value: churn,
    base: cursor - churn,
    display: -churn,
    fill: 'var(--destructive)',
  })
  cursor -= churn

  data.push({
    label: 'Contraction',
    value: contraction,
    base: cursor - contraction,
    display: -contraction,
    fill: 'var(--chart-4, oklch(0.75 0.15 60))',
  })
  cursor -= contraction

  data.push({
    label: 'Ending',
    value: ending,
    base: 0,
    display: ending,
    fill: 'var(--primary)',
  })

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
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
            cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
            formatter={(_v, _name, props) => {
              const d = props.payload as WaterfallBar
              const sign = d.display < 0 ? '-' : ''
              return [`${sign}₨${Math.abs(d.display).toLocaleString()}`, d.label]
            }}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              fontSize: '12px',
            }}
          />
          {/* Invisible base for floating bars */}
          <Bar dataKey="base" stackId="a" fill="transparent" />
          <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
