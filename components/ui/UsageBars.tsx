'use client'

/**
 * components/ui/UsageBars.tsx — Usage progress bars for plan limits
 * Shows label, progress bar, and "X / Y" text (or "X / Unlimited").
 * Colors shift from brand -> warning -> danger based on usage percentage.
 */

import { USAGE_THRESHOLDS, UNLIMITED_VALUE } from '@/constants/plans'

type UsageItem = {
  label: string
  current: number
  max: number | null
  unit?: string
}

type UsageBarsProps = {
  items: UsageItem[]
}

function getBarColor(percent: number): string {
  if (percent >= USAGE_THRESHOLDS.DANGER_PERCENT) return 'bg-destructive'
  if (percent >= USAGE_THRESHOLDS.WARNING_PERCENT) return 'bg-warning'
  return 'bg-primary/90'
}

function formatValue(value: number, unit?: string): string {
  if (unit) return `${value} ${unit}`
  return String(value)
}

function isUnlimited(max: number | null): boolean {
  return max === null || max >= UNLIMITED_VALUE
}

export function UsageBars({ items }: UsageBarsProps) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const unlimited = isUnlimited(item.max)
        const percent = unlimited ? 0 : Math.min(100, (item.current / item.max!) * 100)
        const barColor = unlimited ? 'bg-primary/90' : getBarColor(percent)
        const barWidth = unlimited ? Math.min(30, item.current > 0 ? 15 : 0) : percent

        return (
          <div key={item.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="text-muted-foreground">
                {formatValue(item.current, item.unit)} /{' '}
                {unlimited ? 'Unlimited' : formatValue(item.max!, item.unit)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-border">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
