/**
 * components/ui/PlanFeatureIcon.tsx
 * Icon used by the Plan/Pricing surfaces to indicate whether a feature is
 * included or locked on a plan tier.
 */

import { Check, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  enabled: boolean
  className?: string
}

export function PlanFeatureIcon({ enabled, className }: Props) {
  if (enabled) {
    return (
      <Check
        aria-hidden="true"
        className={cn('h-4 w-4 shrink-0 text-success', className)}
      />
    )
  }
  return (
    <Lock
      aria-hidden="true"
      className={cn('h-4 w-4 shrink-0 text-muted-foreground/60', className)}
    />
  )
}
