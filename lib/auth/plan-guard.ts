// =============================================================================
// lib/auth/plan-guard.ts — Backwards-compatible shim
//
// New code should call getPlanState / requireCanCreateContent /
// requireCanEditContent from lib/auth/plan-state.ts directly. This file keeps
// the legacy boolean shape so existing call sites compile while we migrate.
//
// Both shims now treat soft-downgrade as "locked" for create-style actions —
// matching what the previous boolean meant in spirit.
// =============================================================================

import type { TeacherRow } from '@/lib/db/teachers'
import {
  getPlanState,
  isContentCreateBlocked,
  getCreateBlockedError,
} from '@/lib/auth/plan-state'

/**
 * @deprecated — use `requireCanCreateContent(teacher)` from lib/auth/plan-state
 *
 * Returns true if the teacher is blocked from creating new content (covers
 * both soft-downgraded and hard-locked states).
 */
export function checkPlanLock(teacher: TeacherRow): boolean {
  return isContentCreateBlocked(getPlanState(teacher))
}

/**
 * @deprecated — use `getCreateBlockedError(state)` from lib/auth/plan-state
 *
 * Returns a generic create-blocked error. Prefer the state-aware variant for
 * better copy.
 */
export function getPlanLockError(): {
  success: false
  error: string
  code: string
} {
  return {
    success: false,
    error:
      'Your subscription has expired. Renew to continue creating courses, cohorts, or sessions.',
    code: 'PLAN_LOCKED',
  }
}

// Re-export the new helpers so callers can migrate one import at a time.
export {
  getPlanState,
  getEffectivePlan,
  isHardLocked,
  isContentCreateBlocked,
  isContentEditBlocked,
  getCreateBlockedError,
  getEditBlockedError,
  requireCanCreateContent,
  requireCanEditContent,
  type PlanState,
  type PlanLockError,
} from '@/lib/auth/plan-state'
