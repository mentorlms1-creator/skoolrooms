// =============================================================================
// lib/auth/teacher-access.ts — Student-side helper for "is this teacher live?"
//
// Wraps getPlanState with the only question student surfaces care about:
// can the student see their teacher's content right now?
//
// Soft-downgraded teachers stay accessible for existing students — they paid
// for the cohort and finish it. Hard-cancelled teachers (day 30+) lose access:
// course pages return an unavailable notice, schedule hides their sessions.
// =============================================================================

import { getPlanState } from '@/lib/auth/plan-state'

type TeacherFields = {
  plan: string
  plan_expires_at: string | null
  grace_until: string | null
  downgraded_at: string | null
  trial_ends_at: string | null
}

/**
 * True when this teacher's content should still be visible to the students
 * enrolled in their cohorts. False once the teacher hits day-30 hard cancel.
 */
export function canStudentAccessTeacher(teacher: TeacherFields): boolean {
  const state = getPlanState(teacher)
  return state.kind !== 'hard_locked'
}
