'use client'

/**
 * app/(platform)/admin/RevenueChart.tsx — Revenue by Cohort bar chart
 *
 * Client Component (Recharts requires browser APIs).
 * Receives pre-fetched data from the server component.
 */

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

type RevenueChartProps = {
  data: { cohortName: string; revenue: number }[]
}

const chartConfig = {
  revenue: {
    label: 'Revenue (PKR)',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No revenue data yet.
      </p>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <BarChart
        data={data}
        margin={{ top: 20, right: 0, bottom: 0, left: -20 }}
        barGap={8}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="cohortName"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }}
          tickMargin={12}
          tickFormatter={(value: string) =>
            value.length > 10 ? `${value.slice(0, 10)}...` : value
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }}
          tickMargin={8}
          tickFormatter={(value: number) =>
            value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
          }
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', radius: 12 }}
          content={
            <ChartTooltipContent
              className="bg-card shadow-xl border-none rounded-xl"
              formatter={(value) => `PKR ${Number(value).toLocaleString()}`}
            />
          }
        />
        <Bar
          dataKey="revenue"
          fill="var(--chart-1)"
          radius={[10, 10, 10, 10]}
          barSize={45}
          animationDuration={1500}
          animationEasing="ease-out"
        />
      </BarChart>
    </ChartContainer>
  )
}
