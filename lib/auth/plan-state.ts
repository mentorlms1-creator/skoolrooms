// =============================================================================
// lib/auth/plan-state.ts — Single source of truth for a teacher's plan state
//
// Replaces the boolean checkPlanLock() with a discriminated union covering all
// six possible states. Every gate in the codebase (server actions, page guards,
// banners, cron filters) should derive intent from this module instead of
// poking at plan / plan_expires_at / grace_until / downgraded_at directly.
//
// Day timeline:
//   Day 0   paid plan_expires_at hits          → state: grace
//   Day 5   grace_until hits                   → state: soft_downgraded
//   Day 35  downgraded_at + 30d hits           → state: hard_locked
//
// Cron-lag safety: state is derived from timestamps, NOT from whether the cron
// has run. If grace_until is in the past but downgraded_at is still NULL (cron
// hasn't fired yet), getPlanState() still reports soft_downgraded. The cron
// just makes it official + sends the email.
// =============================================================================

import { TIMING } from '@/constants/plans'
import type { PlanSlug } from '@/types/domain'

type TeacherPlanFields = {
  plan: string
  plan_expires_at: string | null
  grace_until: string | null
  downgraded_at: string | null
  trial_ends_at: string | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type PlanState =
  /** Free-tier user who has never paid. plan='free' AND plan_expires_at=null. */
  | { kind: 'free' }
  /** Paid plan, in good standing. */
  | { kind: 'active' }
  /** Paid plan, currently in trial period. */
  | { kind: 'trialing'; trialEndsAt: string }
  /** Paid plan expired, within grace period. Full access still. */
  | { kind: 'grace'; graceUntil: string }
  /**
   * Plan flipped to free, existing data grandfathered, write surface restricted.
   * `downgradedAt` is the start of the 30-day clock to hard cancel.
   */
  | {
      kind: 'soft_downgraded'
      downgradedAt: string
      hardCancelAt: string
      daysUntilHardCancel: number
    }
  /** 30+ days post-downgrade. Teacher read-only, students lose access. */
  | { kind: 'hard_locked'; downgradedAt: string }

/**
 * Pure function. Derives plan state from the teacher row's timestamps.
 *
 * Precedence: hard_locked > soft_downgraded > grace > trialing > active > free.
 * This means a teacher whose grace expired but whose cron hasn't run is still
 * reported as soft_downgraded — fail safe rather than fail open.
 */
export function getPlanState(teacher: TeacherPlanFields): PlanState {
  const now = Date.now()

  // Hard cancel: downgraded_at is older than the cancel cutoff.
  if (teacher.downgraded_at) {
    const downgradedAtMs = new Date(teacher.downgraded_at).getTime()
    const hardCancelAtMs =
      downgradedAtMs + TIMING.SOFT_DOWNGRADE_TO_HARD_CANCEL_DAYS * MS_PER_DAY
    if (now >= hardCancelAtMs) {
      return { kind: 'hard_locked', downgradedAt: teacher.downgraded_at }
    }
    const daysUntilHardCancel = Math.max(
      0,
      Math.ceil((hardCancelAtMs - now) / MS_PER_DAY),
    )
    return {
      kind: 'soft_downgraded',
      downgradedAt: teacher.downgraded_at,
      hardCancelAt: new Date(hardCancelAtMs).toISOString(),
      daysUntilHardCancel,
    }
  }

  // Cron-lag safety net: grace_until passed but cron hasn't downgraded yet.
  // Only paid plans have a meaningful grace_until — free plans never set it.
  if (
    teacher.grace_until &&
    new Date(teacher.grace_until).getTime() < now &&
    teacher.plan !== 'free'
  ) {
    const downgradedAt = teacher.grace_until
    const downgradedAtMs = new Date(downgradedAt).getTime()
    const hardCancelAtMs =
      downgradedAtMs + TIMING.SOFT_DOWNGRADE_TO_HARD_CANCEL_DAYS * MS_PER_DAY
    if (now >= hardCancelAtMs) {
      return { kind: 'hard_locked', downgradedAt }
    }
    return {
      kind: 'soft_downgraded',
      downgradedAt,
      hardCancelAt: new Date(hardCancelAtMs).toISOString(),
      daysUntilHardCancel: Math.max(
        0,
        Math.ceil((hardCancelAtMs - now) / MS_PER_DAY),
      ),
    }
  }

  // In grace.
  if (
    teacher.grace_until &&
    new Date(teacher.grace_until).getTime() >= now &&
    teacher.plan_expires_at &&
    new Date(teacher.plan_expires_at).getTime() < now
  ) {
    return { kind: 'grace', graceUntil: teacher.grace_until }
  }

  // Trialing.
  if (
    teacher.trial_ends_at &&
    new Date(teacher.trial_ends_at).getTime() > now
  ) {
    return { kind: 'trialing', trialEndsAt: teacher.trial_ends_at }
  }

  // Free-tier vs paid-active.
  if (teacher.plan === 'free' || !teacher.plan_expires_at) {
    return { kind: 'free' }
  }

  return { kind: 'active' }
}

// -----------------------------------------------------------------------------
// Effective plan
//
// Many feature gates (canUseFeature, getLimit) read teacher.plan directly. If
// the cron hasn't run yet, a teacher whose grace expired could still be
// reported as plan='solo' in the DB. getEffectivePlan() returns 'free' in that
// case, so feature gating is consistent with display state.
// -----------------------------------------------------------------------------

export function getEffectivePlan(teacher: TeacherPlanFields): PlanSlug {
  const state = getPlanState(teacher)
  if (state.kind === 'soft_downgraded' || state.kind === 'hard_locked') {
    return 'free'
  }
  return teacher.plan as PlanSlug
}

// -----------------------------------------------------------------------------
// Predicates
// -----------------------------------------------------------------------------

/** True when the teacher is in the day-30+ read-only state. */
export function isHardLocked(state: PlanState): boolean {
  return state.kind === 'hard_locked'
}

/**
 * True when the teacher should be blocked from creating new content
 * (courses, cohorts, sessions, enrollments, payouts, paid features).
 *
 * Soft-downgrade and hard-lock both qualify.
 */
export function isContentCreateBlocked(state: PlanState): boolean {
  return state.kind === 'soft_downgraded' || state.kind === 'hard_locked'
}

/**
 * True when the teacher should be blocked from editing existing content.
 * Only hard-lock qualifies — soft-downgraded teachers can still tweak existing
 * cohorts, mark attendance, post announcements, etc.
 */
export function isContentEditBlocked(state: PlanState): boolean {
  return state.kind === 'hard_locked'
}

// -----------------------------------------------------------------------------
// Error responses
//
// These match the ApiResponse<T> shape used by server actions. Callers narrow
// with `'code' in result` to detect the specific reason.
// -----------------------------------------------------------------------------

export type PlanLockError = {
  success: false
  error: string
  code: 'PLAN_SOFT_DOWNGRADED' | 'PLAN_HARD_CANCELLED'
}

export function getCreateBlockedError(state: PlanState): PlanLockError {
  if (state.kind === 'hard_locked') {
    return {
      success: false,
      error:
        'Your account has been cancelled. Renew your subscription to restore access.',
      code: 'PLAN_HARD_CANCELLED',
    }
  }
  return {
    success: false,
    error:
      'Your subscription expired and you’re on the Free plan. Renew to create new courses, cohorts, or accept new students.',
    code: 'PLAN_SOFT_DOWNGRADED',
  }
}

export function getEditBlockedError(): PlanLockError {
  return {
    success: false,
    error:
      'Your account has been cancelled. Renew your subscription to edit existing content.',
    code: 'PLAN_HARD_CANCELLED',
  }
}

// -----------------------------------------------------------------------------
// Action-side guard sugar
//
// Server actions typically `return getCreateBlockedError(state)` early. These
// helpers wrap the common pattern in a single check.
// -----------------------------------------------------------------------------

/**
 * Returns a PlanLockError if the teacher cannot create new content; null
 * otherwise. Use at the top of create-style server actions.
 */
export function requireCanCreateContent(
  teacher: TeacherPlanFields,
): PlanLockError | null {
  const state = getPlanState(teacher)
  return isContentCreateBlocked(state) ? getCreateBlockedError(state) : null
}

/**
 * Returns a PlanLockError if the teacher cannot edit existing content; null
 * otherwise. Use at the top of edit-style server actions (update, archive,
 * mark attendance, post to existing cohort, etc.).
 */
export function requireCanEditContent(
  teacher: TeacherPlanFields,
): PlanLockError | null {
  const state = getPlanState(teacher)
  return isContentEditBlocked(state) ? getEditBlockedError() : null
}
