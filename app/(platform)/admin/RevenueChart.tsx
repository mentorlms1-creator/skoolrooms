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
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="cohortName"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) =>
            value.length > 12 ? `${value.slice(0, 12)}...` : value
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          tickFormatter={(value: number) =>
            value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `PKR ${Number(value).toLocaleString()}`}
            />
          }
        />
        <Bar
          dataKey="revenue"
          fill="var(--color-revenue)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}
