/**
 * components/ui/AttendanceRing.tsx
 * Reusable SVG ring showing attendance percentage. Lifted from the student
 * dashboard so the same visual is reused on Progress Dialog + cohort cards.
 */

import { cn } from '@/lib/utils'

type Props = {
  percentage: number
  attended: number
  total: number
  size?: number
  strokeWidth?: number
  showLabel?: boolean
  className?: string
}

export function AttendanceRing({
  percentage,
  attended,
  total,
  size = 96,
  strokeWidth = 8,
  showLabel = true,
  className,
}: Props) {
  const safePct = Math.max(0, Math.min(100, percentage))
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (safePct / 100) * circumference

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        aria-label={`Attendance rate: ${safePct}%`}
        role="img"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground font-bold"
          fontSize={size * 0.2}
        >
          {safePct}%
        </text>
      </svg>
      {showLabel && (
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground/70">Attendance</p>
          <p className="text-sm text-muted-foreground">
            {attended}/{total} classes
          </p>
        </div>
      )}
    </div>
  )
}
