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
