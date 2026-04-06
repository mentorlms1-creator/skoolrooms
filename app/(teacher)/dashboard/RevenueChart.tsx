'use client'

/**
 * app/(teacher)/dashboard/RevenueChart.tsx — Revenue trend bar chart
 *
 * Client component using Recharts. Must be dynamically imported with { ssr: false }
 * from the Server Component page to avoid SSR issues with Recharts.
 */

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

type MonthlyRevenue = {
  month: string
  revenue: number
}

type RevenueChartProps = {
  data: MonthlyRevenue[]
}

function formatPKR(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
  }
  return String(value)
}

export function RevenueChart({ data }: RevenueChartProps) {
  const hasData = data.some((d) => d.revenue > 0)

  if (!hasData) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No revenue data yet. Verified payments will appear here.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="hsl(var(--border))"
        />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={formatPKR}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--accent))' }}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'hsl(var(--foreground))',
          }}
          formatter={(value) => [`PKR ${Number(value).toLocaleString()}`, 'Revenue']}
        />
        <Bar
          dataKey="revenue"
          fill="hsl(var(--primary))"
          radius={[8, 8, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
