/**
 * components/ui/StatusBadge.tsx — Universal status badge for all entity statuses
 * Wraps shadcn Badge with status-specific color mapping. Server-compatible.
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusBadgeSize = 'sm' | 'md'

type StatusBadgeProps = {
  status: string
  size?: StatusBadgeSize
  className?: string
}

type StatusColor = 'success' | 'warning' | 'danger' | 'muted'

const statusColorMap: Record<string, StatusColor> = {
  // Success states
  active: 'success',
  confirmed: 'success',
  completed: 'success',
  published: 'success',
  enrolled: 'success',
  reviewed: 'success',
  approved: 'success',

  // Warning states
  pending: 'warning',
  pending_verification: 'warning',
  processing: 'warning',
  upcoming: 'warning',
  submitted: 'warning',
  waiting: 'warning',

  // Danger states
  rejected: 'danger',
  revoked: 'danger',
  failed: 'danger',
  danger: 'danger',
  overdue: 'danger',
  expired: 'danger',
  refunded: 'danger',
  cancelled: 'danger',

  // Muted states
  draft: 'muted',
  withdrawn: 'muted',
  archived: 'muted',
  removed: 'muted',
}

const colorClasses: Record<StatusColor, string> = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-destructive/10 text-destructive border-destructive/20',
  muted: 'bg-muted text-muted-foreground border-border',
}

/**
 * Formats a status string for display.
 * pending_verification -> Pending Verification
 */
function formatStatusText(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, '_')
  const color = statusColorMap[normalized] || 'muted'

  return (
    <Badge
      variant="outline"
      className={cn(
        colorClasses[color],
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
        className
      )}
    >
      {formatStatusText(status)}
    </Badge>
  )
}
