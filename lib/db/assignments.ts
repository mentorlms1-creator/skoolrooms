// =============================================================================
// lib/db/assignments.ts — Assignment + Submission CRUD queries (service layer)
// All database queries for assignments and submissions go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

// -----------------------------------------------------------------------------
// Row types (mirrors assignments / assignment_submissions tables from
// 001_initial_schema.sql)
// -----------------------------------------------------------------------------

export type AssignmentRow = {
  id: string
  cohort_id: string
  teacher_id: string
  title: string
  description: string
  file_url: string | null
  due_date: string
  created_at: string
  deleted_at: string | null
}

export type SubmissionRow = {
  id: string
  assignment_id: string
  student_id: string
  text_answer: string | null
  file_url: string | null
  submitted_at: string
  reviewed_at: string | null
  status: string
}

// Submission joined with student info (for teacher-facing views)
export type SubmissionWithStudent = SubmissionRow & {
  students: {
    id: string
    name: string
    email: string
  }
}

// Input types
export type CreateAssignmentInput = {
  cohortId: string
  teacherId: string
  title: string
  description: string
  fileUrl?: string
  dueDate: string
}

export type CreateSubmissionInput = {
  assignmentId: string
  studentId: string
  textAnswer?: string
  fileUrl?: string
}

// Overdue student type (students who haven't submitted past due_date)
export type OverdueStudent = {
  assignment_id: string
  assignment_title: string
  due_date: string
  student_id: string
  student_name: string
  student_email: string
}

// -----------------------------------------------------------------------------
// getAssignmentsByCohort — All non-deleted assignments for a cohort,
// ordered by due_date ascending
// -----------------------------------------------------------------------------
export async function getAssignmentsByCohort(
  cohortId: string
): Promise<AssignmentRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('cohort_id', cohortId)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })

  if (error || !data) return []
  return data as AssignmentRow[]
}

// -----------------------------------------------------------------------------
// getAssignmentById — Single assignment by ID
// -----------------------------------------------------------------------------
export async function getAssignmentById(
  id: string
): Promise<AssignmentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data as AssignmentRow
}

// -----------------------------------------------------------------------------
// createAssignment — Insert a new assignment
// -----------------------------------------------------------------------------
export async function createAssignment(
  input: CreateAssignmentInput
): Promise<AssignmentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('assignments')
    .insert({
      cohort_id: input.cohortId,
      teacher_id: input.teacherId,
      title: input.title,
      description: input.description,
      file_url: input.fileUrl ?? null,
      due_date: input.dueDate,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as AssignmentRow
}

// -----------------------------------------------------------------------------
// updateAssignment — Partial update with teacher_id ownership filter
// -----------------------------------------------------------------------------
export async function updateAssignment(
  id: string,
  teacherId: string,
  updates: {
    title?: string
    description?: string
    fileUrl?: string | null
    dueDate?: string
  }
): Promise<AssignmentRow | null> {
  const supabase = createAdminClient()

  const updatePayload: Record<string, unknown> = {}
  if (updates.title !== undefined) updatePayload.title = updates.title
  if (updates.description !== undefined)
    updatePayload.description = updates.description
  if (updates.fileUrl !== undefined) updatePayload.file_url = updates.fileUrl
  if (updates.dueDate !== undefined) updatePayload.due_date = updates.dueDate

  const { data, error } = await supabase
    .from('assignments')
    .update(updatePayload)
    .eq('id', id)
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error || !data) return null
  return data as AssignmentRow
}

// -----------------------------------------------------------------------------
// deleteAssignment — Soft delete with ownership filter
// -----------------------------------------------------------------------------
export async function deleteAssignment(
  id: string,
  teacherId: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const { error, count } = await supabase
    .from('assignments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)

  return !error && (count === null || count > 0)
}

// -----------------------------------------------------------------------------
// getSubmissionsByAssignment — All submissions with student info,
// ordered by submitted_at
// -----------------------------------------------------------------------------
export async function getSubmissionsByAssignment(
  assignmentId: string
): Promise<SubmissionWithStudent[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('assignment_submissions')
    .select(`
      *,
      students!inner(id, name, email)
    `)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: true })

  if (error || !data) return []
  return data as SubmissionWithStudent[]
}

// -----------------------------------------------------------------------------
// getSubmissionByStudent — Single submission for a student on an assignment
// (UNIQUE constraint ensures at most one)
// -----------------------------------------------------------------------------
export async function getSubmissionByStudent(
  assignmentId: string,
  studentId: string
): Promise<SubmissionRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .single()

  if (error || !data) return null
  return data as SubmissionRow
}

// -----------------------------------------------------------------------------
// createSubmission — Insert with status='submitted'. If submitted_at >
// assignment.due_date, set status='overdue'.
// -----------------------------------------------------------------------------
export async function createSubmission(
  input: CreateSubmissionInput
): Promise<SubmissionRow | null> {
  const supabase = createAdminClient()

  // 1. Fetch the assignment to check due_date
  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .select('due_date')
    .eq('id', input.assignmentId)
    .is('deleted_at', null)
    .single()

  if (assignmentError || !assignment) return null

  const now = new Date()
  const dueDate = new Date(
    (assignment as { due_date: string }).due_date
  )
  const status = now > dueDate ? 'overdue' : 'submitted'

  // 2. Insert the submission
  const { data, error } = await supabase
    .from('assignment_submissions')
    .insert({
      assignment_id: input.assignmentId,
      student_id: input.studentId,
      text_answer: input.textAnswer ?? null,
      file_url: input.fileUrl ?? null,
      status,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as SubmissionRow
}

// -----------------------------------------------------------------------------
// updateSubmission — For re-submission (reset reviewed_at to null)
// -----------------------------------------------------------------------------
export async function updateSubmission(
  submissionId: string,
  updates: { textAnswer?: string; fileUrl?: string | null; status?: string }
): Promise<SubmissionRow | null> {
  const supabase = createAdminClient()

  const updatePayload: Record<string, unknown> = {
    reviewed_at: null,
    submitted_at: new Date().toISOString(),
    status: updates.status ?? 'submitted',
  }
  if (updates.textAnswer !== undefined)
    updatePayload.text_answer = updates.textAnswer
  if (updates.fileUrl !== undefined) updatePayload.file_url = updates.fileUrl

  const { data, error } = await supabase
    .from('assignment_submissions')
    .update(updatePayload)
    .eq('id', submissionId)
    .select('*')
    .single()

  if (error || !data) return null
  return data as SubmissionRow
}

// -----------------------------------------------------------------------------
// markSubmissionReviewed — Set reviewed_at=now, status='reviewed'
// -----------------------------------------------------------------------------
export async function markSubmissionReviewed(
  submissionId: string
): Promise<SubmissionRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('assignment_submissions')
    .update({
      reviewed_at: new Date().toISOString(),
      status: 'reviewed',
    })
    .eq('id', submissionId)
    .select('*')
    .single()

  if (error || !data) return null
  return data as SubmissionRow
}

// -----------------------------------------------------------------------------
// getSubmissionById — Single submission by ID
// -----------------------------------------------------------------------------
export async function getSubmissionById(
  id: string
): Promise<SubmissionRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as SubmissionRow
}

// -----------------------------------------------------------------------------
// getSubmissionCountsByAssignment — Count total, submitted, reviewed, overdue
// for an assignment
// -----------------------------------------------------------------------------
export async function getSubmissionCountsByAssignment(
  assignmentId: string
): Promise<{ total: number; submitted: number; reviewed: number; overdue: number }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('status')
    .eq('assignment_id', assignmentId)

  if (error || !data) return { total: 0, submitted: 0, reviewed: 0, overdue: 0 }

  const rows = data as Array<{ status: string }>
  return {
    total: rows.length,
    submitted: rows.filter((r) => r.status === 'submitted').length,
    reviewed: rows.filter((r) => r.status === 'reviewed').length,
    overdue: rows.filter((r) => r.status === 'overdue').length,
  }
}

// -----------------------------------------------------------------------------
// getSubmissionsByStudentForCohort — All submissions by a student for
// assignments in a given cohort. Returns a Map keyed by assignment_id.
// Used by student assignment view to show submission status.
// -----------------------------------------------------------------------------
export async function getSubmissionsByStudentForCohort(
  studentId: string,
  assignmentIds: string[]
): Promise<Map<string, SubmissionRow>> {
  if (assignmentIds.length === 0) return new Map()

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('student_id', studentId)
    .in('assignment_id', assignmentIds)

  if (error || !data) return new Map()

  const map = new Map<string, SubmissionRow>()
  for (const row of data as SubmissionRow[]) {
    map.set(row.assignment_id, row)
  }
  return map
}

// -----------------------------------------------------------------------------
// getUpcomingAssignmentsByStudent — Upcoming (not yet due) assignments across
// all cohorts the student is actively enrolled in. Returns up to `limit`
// assignments, soonest due first, with cohort + course + teacher info.
// -----------------------------------------------------------------------------
export type AssignmentForStudentDashboard = AssignmentRow & {
  cohorts: {
    id: string
    name: string
    courses: { id: string; title: string }
    teachers: { id: string; name: string }
  }
}

export async function getUpcomingAssignmentsByStudent(
  studentId: string,
  limit: number
): Promise<AssignmentForStudentDashboard[]> {
  const supabase = createAdminClient()

  // 1. Get cohort IDs for active enrollments
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('cohort_id')
    .eq('student_id', studentId)
    .eq('status', 'active')

  if (enrollError || !enrollments || enrollments.length === 0) return []

  const cohortIds = (enrollments as Array<{ cohort_id: string }>).map(
    (e) => e.cohort_id
  )

  const now = new Date().toISOString()

  // 2. Fetch upcoming assignments (due_date > now)
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      *,
      cohorts!inner(
        id, name,
        courses!inner(id, title),
        teachers!inner(id, name)
      )
    `)
    .in('cohort_id', cohortIds)
    .is('deleted_at', null)
    .gt('due_date', now)
    .order('due_date', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return data as AssignmentForStudentDashboard[]
}

// -----------------------------------------------------------------------------
// getOverdueSubmissions — Students who haven't submitted past due_date.
// Uses two-step approach: fetch past-due assignments, then find enrolled
// students without submissions.
// -----------------------------------------------------------------------------
export async function getOverdueSubmissions(
  cohortId: string
): Promise<OverdueStudent[]> {
  const supabase = createAdminClient()

  // 1. Get all assignments past due_date for this cohort
  const { data: assignments, error: assignError } = await supabase
    .from('assignments')
    .select('id, title, due_date')
    .eq('cohort_id', cohortId)
    .is('deleted_at', null)
    .lt('due_date', new Date().toISOString())

  if (assignError || !assignments || assignments.length === 0) return []

  const typedAssignments = assignments as Array<{
    id: string
    title: string
    due_date: string
  }>
  const assignmentIds = typedAssignments.map((a) => a.id)

  // 2. Get all active enrolled students for this cohort
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('student_id, students!inner(id, name, email)')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')

  if (enrollError || !enrollments || enrollments.length === 0) return []

  const typedEnrollments = (enrollments as unknown) as Array<{
    student_id: string
    students: { id: string; name: string; email: string }
  }>

  // 3. Get all existing submissions for these assignments
  const { data: submissions, error: subError } = await supabase
    .from('assignment_submissions')
    .select('assignment_id, student_id')
    .in('assignment_id', assignmentIds)

  if (subError) return []

  const typedSubmissions = submissions as Array<{
    assignment_id: string
    student_id: string
  }> | null

  // Build a set of "assignment_id:student_id" for quick lookup
  const submittedSet = new Set(
    (typedSubmissions ?? []).map((s) => `${s.assignment_id}:${s.student_id}`)
  )

  // 4. Find students who haven't submitted for each past-due assignment
  const overdue: OverdueStudent[] = []

  for (const assignment of typedAssignments) {
    for (const enrollment of typedEnrollments) {
      const key = `${assignment.id}:${enrollment.student_id}`
      if (!submittedSet.has(key)) {
        overdue.push({
          assignment_id: assignment.id,
          assignment_title: assignment.title,
          due_date: assignment.due_date,
          student_id: enrollment.student_id,
          student_name: enrollment.students.name,
          student_email: enrollment.students.email,
        })
      }
    }
  }

  return overdue
}
