'use server'

// =============================================================================
// lib/actions/feedback.ts — Server actions for cohort feedback
// =============================================================================

import { createClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getCohortById } from '@/lib/db/cohorts'
import {
  submitCohortFeedback,
  getFeedbackByCohort,
  getStudentFeedbackForCohort,
  type CohortFeedbackRow,
} from '@/lib/db/feedback'
import { createAdminClient } from '@/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/types/api'

async function getAuthenticatedStudent() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return getStudentByAuthId(user.id)
}

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return getTeacherByAuthId(user.id)
}

// -----------------------------------------------------------------------------
// submitFeedbackAction — Student submits feedback for an archived cohort
// -----------------------------------------------------------------------------
export async function submitFeedbackAction(
  cohortId: string,
  rating: number,
  comment?: string
): Promise<ApiResponse<null>> {
  const student = await getAuthenticatedStudent()
  if (!student) return { success: false, error: 'Not authenticated' }

  if (!rating || rating < 1 || rating > 5) {
    return { success: false, error: 'Rating must be between 1 and 5.' }
  }

  // Verify cohort is archived
  const cohort = await getCohortById(cohortId)
  if (!cohort) return { success: false, error: 'Cohort not found.' }

  if (cohort.status !== 'archived') {
    return { success: false, error: 'Feedback can only be submitted for archived cohorts.' }
  }

  // Verify student was enrolled in this cohort
  const adminSupabase = createAdminClient()
  const { data: enrollment } = await adminSupabase
    .from('enrollments')
    .select('id')
    .eq('cohort_id', cohortId)
    .eq('student_id', student.id)
    .limit(1)
    .single()

  if (!enrollment) {
    return { success: false, error: 'You were not enrolled in this cohort.' }
  }

  const result = await submitCohortFeedback({
    cohortId,
    studentId: student.id,
    rating,
    comment: comment?.trim() || null,
  })

  if (result.error === 'ALREADY_SUBMITTED') {
    return { success: false, error: 'You have already submitted feedback for this cohort.', code: 'ALREADY_SUBMITTED' }
  }

  if (result.error) {
    return { success: false, error: 'Failed to submit feedback. Please try again.' }
  }

  revalidatePath('/student')

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// getCohortFeedbackAction — Teacher fetches feedback for their cohort
// -----------------------------------------------------------------------------
export async function getCohortFeedbackAction(
  cohortId: string
): Promise<ApiResponse<CohortFeedbackRow[]>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  // Verify cohort belongs to this teacher
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found.' }
  }

  const feedback = await getFeedbackByCohort(cohortId)
  return { success: true, data: feedback }
}
