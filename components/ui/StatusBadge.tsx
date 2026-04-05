/**
 * components/ui/StatusBadge.tsx — Universal status badge for all entity statuses
 * Maps status strings to appropriate colors. Server-compatible.
 */

type StatusBadgeSize = 'sm' | 'md'

type StatusBadgeProps = {
  status: string
  size?: StatusBadgeSize
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
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  muted: 'bg-muted/10 text-muted',
}

const sizeClasses: Record<StatusBadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[13px]',
  md: 'px-2.5 py-1 text-sm',
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

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const color = statusColorMap[status] || 'muted'

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium whitespace-nowrap
        ${colorClasses[color]}
        ${sizeClasses[size]}
      `}
    >
      {formatStatusText(status)}
    </span>
  )
}
