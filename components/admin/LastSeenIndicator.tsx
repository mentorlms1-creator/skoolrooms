// =============================================================================
// components/admin/LastSeenIndicator.tsx
//
// Renders a teacher's "last active" timestamp with three visual modes:
//   • Online  — a green dot + "Online" (last seen within 5 min)
//   • Recent  — amber dot + relative time   (last seen within 1 hour)
//   • Stale   — neutral text only           (older than 1 hour, or never)
//
// Used in the admin teachers list and detail page. Server-compatible.
// =============================================================================

import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'

type Props = {
  lastSeenAt: string | null
  /** size 'sm' for the table column, 'md' for the detail card. */
  size?: 'sm' | 'md'
  className?: string
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000
const RECENT_WINDOW_MS = 60 * 60 * 1000

export function LastSeenIndicator({ lastSeenAt, size = 'sm', className }: Props) {
  if (!lastSeenAt) {
    return (
      <span
        className={cn(
          size === 'sm' ? 'text-sm' : 'text-[15px]',
          'text-muted-foreground/60',
          className,
        )}
        title="This teacher has never opened the dashboard since tracking began."
      >
        Never
      </span>
    )
  }

  const ageMs = Date.now() - new Date(lastSeenAt).getTime()
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
  const textSize = size === 'sm' ? 'text-sm' : 'text-[15px]'

  if (ageMs < ONLINE_WINDOW_MS) {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5 font-semibold text-success', textSize, className)}
        title={formatPKT(lastSeenAt, 'datetime')}
      >
        <span className={cn('rounded-full bg-success', dotSize)} />
        Online
      </span>
    )
  }

  if (ageMs < RECENT_WINDOW_MS) {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5 font-medium text-warning', textSize, className)}
        title={formatPKT(lastSeenAt, 'datetime')}
      >
        <span className={cn('rounded-full bg-warning', dotSize)} />
        {formatPKT(lastSeenAt, 'relative')}
      </span>
    )
  }

  return (
    <span
      className={cn(textSize, 'text-muted-foreground', className)}
      title={formatPKT(lastSeenAt, 'datetime')}
    >
      {formatPKT(lastSeenAt, 'relative')}
    </span>
  )
}
