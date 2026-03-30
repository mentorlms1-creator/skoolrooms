'use client'

/**
 * components/teacher/PlanLimitGuard.tsx — Client-side plan limit wrapper
 *
 * Wraps children with plan-limit awareness:
 *   - At limit (100%): shows UpgradeNudge (danger) and hides children
 *   - Near limit (>=80%): shows UpgradeNudge (warning) above children
 *   - Below 80% or unlimited: renders children only
 *
 * Uses useTeacherContext() to read the current plan limits.
 * This is UI-only feedback — all write routes MUST also enforce limits server-side.
 */

import type { ReactNode } from 'react'
import { useTeacherContext } from '@/providers/TeacherProvider'
import { USAGE_THRESHOLDS, UNLIMITED_VALUE } from '@/constants/plans'
import { UpgradeNudge } from '@/components/teacher/UpgradeNudge'

type PlanLimitGuardProps = {
  limitKey: string
  current: number
  label: string
  children: ReactNode
}

export function PlanLimitGuard({ limitKey, current, label, children }: PlanLimitGuardProps) {
  const { plan } = useTeacherContext()
  const max = plan.limits[limitKey]

  // Unlimited: null, undefined, or >= UNLIMITED_VALUE — render children only
  if (max === null || max === undefined || max >= UNLIMITED_VALUE) {
    return <>{children}</>
  }

  const percentage = (current / max) * 100
  const isAtLimit = percentage >= USAGE_THRESHOLDS.BLOCK_PERCENT
  const isNearLimit = percentage >= USAGE_THRESHOLDS.WARNING_PERCENT

  // At limit: show danger nudge, hide children
  if (isAtLimit) {
    return <UpgradeNudge label={label} current={current} max={max} severity="danger" />
  }

  // Near limit: show warning nudge above children
  if (isNearLimit) {
    return (
      <>
        <UpgradeNudge label={label} current={current} max={max} severity="warning" />
        {children}
      </>
    )
  }

  // Below threshold: render children only
  return <>{children}</>
}
