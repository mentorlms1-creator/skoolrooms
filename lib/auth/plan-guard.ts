// =============================================================================
// lib/auth/plan-guard.ts — Plan lock enforcement for content-write actions
//
// Hard lock: teacher's paid plan expired AND grace period also expired.
// Free plan never expires (plan_expires_at = NULL), so free teachers are NEVER locked.
//
// When locked, teacher can: read content, update profile, request payout, renew subscription.
// When locked, teacher CANNOT: create/edit courses, cohorts, sessions, announcements, assignments.
// =============================================================================

import type { TeacherRow } from '@/lib/db/teachers'

/**
 * Returns true if the teacher is hard-locked (plan expired + grace expired).
 * Free plan (plan_expires_at = null) never locks.
 */
export function checkPlanLock(teacher: TeacherRow): boolean {
  // Free plan never expires
  if (!teacher.plan_expires_at) return false

  const now = new Date()
  const planExpired = new Date(teacher.plan_expires_at) < now

  if (!planExpired) return false

  // Plan expired — check grace period
  if (teacher.grace_until) {
    const graceExpired = new Date(teacher.grace_until) < now
    return graceExpired
  }

  // No grace period set yet — but plan is expired
  // The cron job will set grace_until. Until then, they're not locked
  // because grace period hasn't been initiated yet.
  // However, if plan_expires_at < now and grace_until IS NULL,
  // the cron hasn't run yet — we shouldn't lock them preemptively.
  // The grace period cron will set it, and after grace_until passes, they lock.
  return false
}

/**
 * Result type for plan lock check in server actions.
 * If locked, returns an error response object matching ApiResponse pattern.
 */
export function getPlanLockError(): {
  success: false
  error: string
  code: string
} {
  return {
    success: false,
    error:
      'Your plan has expired and the grace period has ended. Please renew your subscription to continue creating and editing content.',
    code: 'PLAN_LOCKED',
  }
}
