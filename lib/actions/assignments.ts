'use server'

// =============================================================================
// lib/actions/assignments.ts — Server actions for assignment + submission CRUD
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getStudentByAuthId } from '@/lib/db/students'
import {
  createAssignment,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  getSubmissionById,
  getSubmissionByStudent,
  createSubmission,
  updateSubmission,
  markSubmissionReviewed,
} from '@/lib/db/assignments'
import { getCohortById } from '@/lib/db/cohorts'
import { checkExistingEnrollment } from '@/lib/db/enrollments'
import { checkPlanLock, getPlanLockError } from '@/lib/auth/plan-guard'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const teacher = await getTeacherByAuthId(user.id)
  return teacher
}

async function getAuthenticatedStudent() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const student = await getStudentByAuthId(user.id)
  return student
}

// -----------------------------------------------------------------------------
// createAssignmentAction — Teacher creates an assignment for a cohort
// Guards: auth, cohort ownership, archived cohort, start_date guard
// -----------------------------------------------------------------------------

export async function createAssignmentAction(
  formData: FormData
): Promise<ApiResponse<{ assignmentId: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  const cohortId = (formData.get('cohort_id') as string | null)?.trim() ?? ''
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null) ?? ''
  const fileUrl = (formData.get('file_url') as string | null)?.trim() || undefined
  const dueDate = (formData.get('due_date') as string | null)?.trim() ?? ''

  // --- Validation ---
  if (!cohortId) {
    return { success: false, error: 'Cohort is required.' }
  }
  if (title.length < 3) {
    return { success: false, error: 'Title must be at least 3 characters.' }
  }
  if (!description) {
    return { success: false, error: 'Description is required.' }
  }
  if (!dueDate) {
    return { success: false, error: 'Due date is required.' }
  }
  if (fileUrl && !fileUrl.startsWith('https://')) {
    return { success: false, error: 'File URL must use HTTPS.' }
  }

  // Verify cohort ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found' }
  }

  // Archived cohort guard
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort has been archived. No changes can be made.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // Start date guard: cannot create assignments before cohort has started
  const today = new Date().toISOString().split('T')[0]
  if (cohort.start_date > today) {
    return {
      success: false,
      error: 'Cannot create assignments before the cohort start date.',
    }
  }

  const assignment = await createAssignment({
    cohortId,
    teacherId: teacher.id,
    title,
    description,
    fileUrl,
    dueDate,
  })

  if (!assignment) {
    return { success: false, error: 'Failed to create assignment. Please try again.' }
  }

  return { success: true, data: { assignmentId: assignment.id } }
}

// -----------------------------------------------------------------------------
// updateAssignmentAction — Teacher updates an existing assignment
// Guards: auth, ownership, archived cohort
// -----------------------------------------------------------------------------

export async function updateAssignmentAction(
  assignmentId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  // Fetch assignment and verify ownership
  const assignment = await getAssignmentById(assignmentId)
  if (!assignment || assignment.teacher_id !== teacher.id) {
    return { success: false, error: 'Assignment not found' }
  }

  // Verify cohort is not archived
  const cohort = await getCohortById(assignment.cohort_id)
  if (!cohort) {
    return { success: false, error: 'Cohort not found' }
  }
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort has been archived. No changes can be made.',
      code: 'COHORT_ARCHIVED',
    }
  }

  const title = (formData.get('title') as string | null)?.trim()
  const description = formData.get('description') as string | null
  const fileUrl = formData.get('file_url') as string | null
  const dueDate = (formData.get('due_date') as string | null)?.trim()

  if (title !== null && title !== undefined && title.length < 3) {
    return { success: false, error: 'Title must be at least 3 characters.' }
  }
  if (fileUrl && !fileUrl.startsWith('https://')) {
    return { success: false, error: 'File URL must use HTTPS.' }
  }

  const updates: {
    title?: string
    description?: string
    fileUrl?: string | null
    dueDate?: string
  } = {}
  if (title) updates.title = title
  if (description !== null) updates.description = description
  if (fileUrl !== null) updates.fileUrl = fileUrl || null
  if (dueDate) updates.dueDate = dueDate

  const updated = await updateAssignment(assignmentId, teacher.id, updates)
  if (!updated) {
    return { success: false, error: 'Failed to update assignment. Please try again.' }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// deleteAssignmentAction — Teacher soft-deletes an assignment
// Guards: auth, ownership
// -----------------------------------------------------------------------------

export async function deleteAssignmentAction(
  assignmentId: string
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  // Fetch assignment and verify ownership
  const assignment = await getAssignmentById(assignmentId)
  if (!assignment || assignment.teacher_id !== teacher.id) {
    return { success: false, error: 'Assignment not found' }
  }

  // Archived cohort write guard
  const cohort = await getCohortById(assignment.cohort_id)
  if (!cohort) {
    return { success: false, error: 'Cohort not found' }
  }
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort has been archived. No changes can be made.',
      code: 'COHORT_ARCHIVED',
    }
  }

  const deleted = await deleteAssignment(assignmentId, teacher.id)
  if (!deleted) {
    return { success: false, error: 'Failed to delete assignment. Please try again.' }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// submitAssignmentAction — Student submits (or re-submits) an assignment
// Guards: auth (student), active enrollment, cohort not archived
// If submitted_at > due_date → status='overdue', else status='submitted'
// -----------------------------------------------------------------------------

export async function submitAssignmentAction(
  formData: FormData
): Promise<ApiResponse<{ submissionId: string }>> {
  const student = await getAuthenticatedStudent()
  if (!student) {
    return { success: false, error: 'Not authenticated' }
  }

  const assignmentId = (formData.get('assignment_id') as string | null)?.trim() ?? ''
  const textAnswer = (formData.get('text_answer') as string | null) ?? undefined
  const fileUrl = (formData.get('file_url') as string | null)?.trim() || undefined

  if (!assignmentId) {
    return { success: false, error: 'Assignment is required.' }
  }

  if (!textAnswer && !fileUrl) {
    return { success: false, error: 'Please provide a text answer or upload a file.' }
  }
  if (fileUrl && !fileUrl.startsWith('https://')) {
    return { success: false, error: 'File URL must use HTTPS.' }
  }

  // Fetch assignment
  const assignment = await getAssignmentById(assignmentId)
  if (!assignment) {
    return { success: false, error: 'Assignment not found' }
  }

  // Verify cohort is not archived
  const cohort = await getCohortById(assignment.cohort_id)
  if (!cohort) {
    return { success: false, error: 'Cohort not found' }
  }
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort has been archived. Submissions are no longer accepted.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // Verify student has an active enrollment in this cohort
  const enrollment = await checkExistingEnrollment(student.id, assignment.cohort_id)
  if (!enrollment || enrollment.status !== 'active') {
    return {
      success: false,
      error: 'You must have an active enrollment in this cohort to submit assignments.',
    }
  }

  // Check if student already has a submission (re-submission case)
  const existing = await getSubmissionByStudent(assignmentId, student.id)

  if (existing) {
    // Re-submission: update existing — determine overdue status
    const now = new Date()
    const dueDate = new Date(assignment.due_date)
    const resubmitStatus = now > dueDate ? 'overdue' : 'submitted'

    const updated = await updateSubmission(existing.id, {
      textAnswer: textAnswer ?? undefined,
      fileUrl: fileUrl ?? undefined,
      status: resubmitStatus,
    })
    if (!updated) {
      return { success: false, error: 'Failed to update submission. Please try again.' }
    }
    return { success: true, data: { submissionId: updated.id } }
  }

  // New submission — createSubmission handles overdue status internally
  const submission = await createSubmission({
    assignmentId,
    studentId: student.id,
    textAnswer,
    fileUrl,
  })

  if (!submission) {
    return { success: false, error: 'Failed to submit assignment. Please try again.' }
  }

  return { success: true, data: { submissionId: submission.id } }
}

// -----------------------------------------------------------------------------
// reviewSubmissionAction — Teacher marks a submission as reviewed
// Guards: auth (teacher), assignment ownership
// -----------------------------------------------------------------------------

export async function reviewSubmissionAction(
  submissionId: string
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch submission
  const submission = await getSubmissionById(submissionId)
  if (!submission) {
    return { success: false, error: 'Submission not found' }
  }

  // Verify the assignment belongs to this teacher
  const assignment = await getAssignmentById(submission.assignment_id)
  if (!assignment || assignment.teacher_id !== teacher.id) {
    return { success: false, error: 'Submission not found' }
  }

  const reviewed = await markSubmissionReviewed(submissionId)
  if (!reviewed) {
    return { success: false, error: 'Failed to mark as reviewed. Please try again.' }
  }

  return { success: true, data: null }
}
