'use client'

/**
 * app/(platform)/admin/PlanChart.tsx — Plan distribution donut chart
 *
 * Client Component (Recharts requires browser APIs).
 * Receives pre-fetched plan distribution data from the server component.
 */

import { Cell, Label, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

type PlanChartProps = {
  data: { plan: string; count: number }[]
}

const PLAN_COLORS: Record<string, string> = {
  free: 'var(--chart-3)',
  solo: 'var(--chart-1)',
  academy: 'var(--chart-4)',
}

export function PlanChart({ data }: PlanChartProps) {
  if (data.length === 0) {
    return (
      <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No teachers yet.
      </p>
    )
  }

  const total = data.reduce((sum, item) => sum + item.count, 0)

  const chartConfig: ChartConfig = {}
  for (const item of data) {
    chartConfig[item.plan] = {
      label: item.plan.charAt(0).toUpperCase() + item.plan.slice(1),
      color: PLAN_COLORS[item.plan] ?? 'var(--chart-5)',
    }
  }

  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="plan"
              formatter={(value) => `${value} teachers`}
            />
          }
        />
        <Pie
          data={data}
          dataKey="count"
          nameKey="plan"
          innerRadius={60}
          outerRadius={90}
          strokeWidth={2}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell
              key={entry.plan}
              fill={PLAN_COLORS[entry.plan] ?? 'var(--chart-5)'}
            />
          ))}
          <Label
            content={({ viewBox }) => {
              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) - 10}
                      className="fill-foreground text-[15px] font-bold"
                    >
                      {total}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 12}
                      className="fill-muted-foreground text-[11px] font-medium"
                    >
                      Teachers
                    </tspan>
                  </text>
                )
              }
              return null
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
