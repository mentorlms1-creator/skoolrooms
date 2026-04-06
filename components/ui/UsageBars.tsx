'use client'

/**
 * components/ui/UsageBars.tsx — Usage progress bars for plan limits
 * Shows label, progress bar, and "X / Y" text (or "X / Unlimited").
 * Colors shift from primary -> warning -> destructive based on usage percentage.
 * Built on shadcn Progress component.
 */

import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { USAGE_THRESHOLDS, UNLIMITED_VALUE } from '@/constants/plans'

type UsageItem = {
  label: string
  current: number
  max: number | null
  unit?: string
}

type UsageBarsProps = {
  items: UsageItem[]
  className?: string
}

function formatValue(value: number, unit?: string): string {
  if (unit) return `${value} ${unit}`
  return String(value)
}

function isUnlimited(max: number | null): boolean {
  return max === null || max >= UNLIMITED_VALUE
}

export function UsageBars({ items, className }: UsageBarsProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {items.map((item) => {
        const unlimited = isUnlimited(item.max)
        const percentage = unlimited ? 0 : Math.min(100, (item.current / item.max!) * 100)

        return (
          <div key={item.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="text-muted-foreground">
                {formatValue(item.current, item.unit)} /{' '}
                {unlimited ? 'Unlimited' : formatValue(item.max!, item.unit)}
              </span>
            </div>
            <Progress
              value={unlimited ? (item.current > 0 ? 15 : 0) : percentage}
              className={cn(
                'h-2',
                percentage >= USAGE_THRESHOLDS.DANGER_PERCENT
                  ? '[&_[data-slot=progress-indicator]]:bg-destructive'
                  : percentage >= USAGE_THRESHOLDS.WARNING_PERCENT
                    ? '[&_[data-slot=progress-indicator]]:bg-warning'
                    : '[&_[data-slot=progress-indicator]]:bg-primary',
              )}
            />
          </div>
        )
      })}
    </div>
  )
}
