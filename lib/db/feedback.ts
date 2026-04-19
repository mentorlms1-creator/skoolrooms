// =============================================================================
// lib/db/feedback.ts — Cohort feedback CRUD queries (service layer)
// =============================================================================

import { createAdminClient } from '@/supabase/server'

export type CohortFeedbackRow = {
  id: string
  cohort_id: string
  student_id: string
  rating: number
  comment: string | null
  created_at: string
}

export type SubmitFeedbackInput = {
  cohortId: string
  studentId: string
  rating: number
  comment?: string | null
}

// -----------------------------------------------------------------------------
// submitCohortFeedback — Insert a feedback record
// UNIQUE(cohort_id, student_id) enforced at DB level
// -----------------------------------------------------------------------------
export async function submitCohortFeedback(
  input: SubmitFeedbackInput
): Promise<{ data: CohortFeedbackRow | null; error: string | null }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohort_feedback')
    .insert({
      cohort_id: input.cohortId,
      student_id: input.studentId,
      rating: input.rating,
      comment: input.comment ?? null,
    })
    .select('*')
    .single()

  if (error) {
    // Unique constraint violation → already submitted
    if (error.code === '23505') {
      return { data: null, error: 'ALREADY_SUBMITTED' }
    }
    return { data: null, error: error.message }
  }

  return { data: data as CohortFeedbackRow, error: null }
}

// -----------------------------------------------------------------------------
// getFeedbackByCohort — All feedback for a cohort (teacher view)
// -----------------------------------------------------------------------------
export async function getFeedbackByCohort(
  cohortId: string
): Promise<CohortFeedbackRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohort_feedback')
    .select('*')
    .eq('cohort_id', cohortId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as CohortFeedbackRow[]
}

// -----------------------------------------------------------------------------
// getStudentFeedbackForCohort — Check if a student already submitted feedback
// Returns the existing row or null
// -----------------------------------------------------------------------------
export async function getStudentFeedbackForCohort(
  cohortId: string,
  studentId: string
): Promise<CohortFeedbackRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohort_feedback')
    .select('*')
    .eq('cohort_id', cohortId)
    .eq('student_id', studentId)
    .single()

  if (error || !data) return null
  return data as CohortFeedbackRow
}

// -----------------------------------------------------------------------------
// getTeacherRatingsMap — Aggregate rating per teacher across their cohorts
// Returns Map keyed by teacher_id; teachers with zero ratings are omitted.
// Soft-deleted cohorts (deleted_at IS NOT NULL) are excluded; archived included.
// -----------------------------------------------------------------------------
export type TeacherRatingAggregate = {
  avg: number   // 0..5, rounded to one decimal
  count: number // total ratings
}

export async function getTeacherRatingsMap(
  teacherIds: string[],
): Promise<Map<string, TeacherRatingAggregate>> {
  if (teacherIds.length === 0) return new Map()

  const supabase = createAdminClient()

  const { data: cohorts, error: cohortError } = await supabase
    .from('cohorts')
    .select('id, teacher_id')
    .in('teacher_id', teacherIds)
    .is('deleted_at', null)

  if (cohortError || !cohorts || cohorts.length === 0) return new Map()

  const cohortToTeacher = new Map<string, string>()
  for (const c of cohorts) {
    cohortToTeacher.set(c.id as string, c.teacher_id as string)
  }

  const cohortIds = [...cohortToTeacher.keys()]

  const { data: ratings, error: ratingError } = await supabase
    .from('cohort_feedback')
    .select('cohort_id, rating')
    .in('cohort_id', cohortIds)

  if (ratingError || !ratings || ratings.length === 0) return new Map()

  const sums = new Map<string, { sum: number; count: number }>()
  for (const r of ratings) {
    const teacherId = cohortToTeacher.get(r.cohort_id as string)
    if (!teacherId) continue
    const acc = sums.get(teacherId) ?? { sum: 0, count: 0 }
    acc.sum += r.rating as number
    acc.count += 1
    sums.set(teacherId, acc)
  }

  const result = new Map<string, TeacherRatingAggregate>()
  for (const [teacherId, { sum, count }] of sums) {
    result.set(teacherId, {
      avg: Math.round((sum / count) * 10) / 10,
      count,
    })
  }

  return result
}
