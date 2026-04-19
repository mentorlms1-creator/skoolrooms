// =============================================================================
// lib/db/class-sessions.ts — Class session CRUD queries (service layer)
// All database queries for class sessions go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

// -----------------------------------------------------------------------------
// Row types (mirrors the class_sessions table from 001_initial_schema.sql)
// These will be replaced by auto-generated types once `npx supabase gen types`
// is run. Until then, we define them manually.
// -----------------------------------------------------------------------------

export type ClassSessionRow = {
  id: string
  cohort_id: string
  meet_link: string
  scheduled_at: string
  duration_minutes: number
  is_recurring: boolean
  recurrence_rule: string | null
  cancelled_at: string | null
  rescheduled_to_id: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// Class session with joined cohort info (for teacher's upcoming sessions view)
export type ClassSessionWithCohort = ClassSessionRow & {
  cohorts: {
    id: string
    name: string
    course_id: string
    teacher_id: string
  }
}

// Input type for creating a single session
export type CreateSessionInput = {
  cohortId: string
  meetLink: string
  scheduledAt: string
  durationMinutes: number
  isRecurring: boolean
  recurrenceRule: string | null
}

// Input type for batch insert (recurring expansion)
export type BatchSessionInput = {
  cohort_id: string
  meet_link: string
  scheduled_at: string
  duration_minutes: number
  is_recurring: boolean
  recurrence_rule: string | null
}

// -----------------------------------------------------------------------------
// getSessionsByCohort — All non-deleted sessions for a cohort, earliest first
// -----------------------------------------------------------------------------
export async function getSessionsByCohort(
  cohortId: string
): Promise<ClassSessionRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('cohort_id', cohortId)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true })

  if (error || !data) return []
  return data as ClassSessionRow[]
}

// -----------------------------------------------------------------------------
// getSessionById — Single session by ID (must not be soft-deleted)
// -----------------------------------------------------------------------------
export async function getSessionById(
  sessionId: string
): Promise<ClassSessionRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('id', sessionId)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data as ClassSessionRow
}

// -----------------------------------------------------------------------------
// getUpcomingSessionsByTeacher — Future non-cancelled sessions across all
// teacher's cohorts. Joins with cohorts to get cohort name and course_id.
// Limited to `limit` results, ordered by scheduled_at asc.
// -----------------------------------------------------------------------------
export async function getUpcomingSessionsByTeacher(
  teacherId: string,
  limit: number
): Promise<ClassSessionWithCohort[]> {
  const supabase = createAdminClient()

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('class_sessions')
    .select('*, cohorts!inner(id, name, course_id, teacher_id)')
    .eq('cohorts.teacher_id', teacherId)
    .gt('scheduled_at', now)
    .is('cancelled_at', null)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return data as ClassSessionWithCohort[]
}

// -----------------------------------------------------------------------------
// createSession — Insert a single class session
// -----------------------------------------------------------------------------
export async function createSession(
  input: CreateSessionInput
): Promise<ClassSessionRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('class_sessions')
    .insert({
      cohort_id: input.cohortId,
      meet_link: input.meetLink,
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes,
      is_recurring: input.isRecurring,
      recurrence_rule: input.recurrenceRule,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as ClassSessionRow
}

// -----------------------------------------------------------------------------
// createSessionsBatch — Batch insert for recurring session expansion
// Accepts pre-formatted rows (snake_case) ready for Supabase insert.
// -----------------------------------------------------------------------------
export async function createSessionsBatch(
  sessions: BatchSessionInput[]
): Promise<ClassSessionRow[]> {
  if (sessions.length === 0) return []

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('class_sessions')
    .insert(sessions)
    .select('*')

  if (error || !data) return []
  return data as ClassSessionRow[]
}

// -----------------------------------------------------------------------------
// cancelSession — Set cancelled_at = now (soft cancel, not delete)
// -----------------------------------------------------------------------------
export async function cancelSession(
  sessionId: string
): Promise<ClassSessionRow | null> {
  const supabase = createAdminClient()

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('class_sessions')
    .update({
      cancelled_at: now,
      updated_at: now,
    })
    .eq('id', sessionId)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error || !data) return null
  return data as ClassSessionRow
}

// -----------------------------------------------------------------------------
// markSessionRescheduled — Cancel original + link to replacement.
// Updates the original session row: cancelled_at = now, rescheduled_to_id = newId.
// Does NOT mutate scheduled_at (auditability — original time stays visible).
// -----------------------------------------------------------------------------
export async function markSessionRescheduled(
  oldId: string,
  newId: string,
): Promise<ClassSessionRow | null> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('class_sessions')
    .update({
      cancelled_at: now,
      rescheduled_to_id: newId,
      updated_at: now,
    })
    .eq('id', oldId)
    .is('deleted_at', null)
    .select('*')
    .single()
  if (error || !data) return null
  return data as ClassSessionRow
}

// -----------------------------------------------------------------------------
// softDeleteSession — Hard rollback for a single session id (used when
// a follow-up write fails after createSession succeeded).
// -----------------------------------------------------------------------------
export async function softDeleteSession(sessionId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('class_sessions')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', sessionId)
  return !error
}

// -----------------------------------------------------------------------------
// deleteFutureSessions — Soft delete all future non-cancelled sessions
// for a cohort. Sets deleted_at = now on sessions where scheduled_at > now.
// -----------------------------------------------------------------------------
export async function deleteFutureSessions(
  cohortId: string
): Promise<number> {
  const supabase = createAdminClient()

  const now = new Date().toISOString()

  const { count, error } = await supabase
    .from('class_sessions')
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq('cohort_id', cohortId)
    .gt('scheduled_at', now)
    .is('cancelled_at', null)
    .is('deleted_at', null)

  if (error) return 0
  return count ?? 0
}

// -----------------------------------------------------------------------------
// Student session types — sessions joined with cohort, course, and teacher info
// for student-facing views
// -----------------------------------------------------------------------------

export type StudentSessionWithDetails = ClassSessionRow & {
  cohorts: {
    id: string
    name: string
    course_id: string
    teacher_id: string
    pending_can_see_schedule: boolean
    courses: {
      id: string
      title: string
    }
    teachers: {
      id: string
      name: string
    }
  }
}

// -----------------------------------------------------------------------------
// getUpcomingSessionsByStudent — Future non-cancelled sessions across all
// cohorts where the student has an active or pending enrollment.
// Joins with cohorts → courses → teachers for display info.
// Respects pending_can_see_schedule: if enrollment is 'pending' and
// cohort.pending_can_see_schedule is false, those sessions are excluded.
// Limited to `limit` results, ordered by scheduled_at asc.
// -----------------------------------------------------------------------------
export async function getUpcomingSessionsByStudent(
  studentId: string,
  limit: number
): Promise<StudentSessionWithDetails[]> {
  const supabase = createAdminClient()

  const now = new Date().toISOString()

  // First, get the student's enrollments (active and pending)
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('cohort_id, status')
    .eq('student_id', studentId)
    .in('status', ['active', 'pending'])

  if (enrollError || !enrollments || enrollments.length === 0) return []

  const cohortIds = enrollments.map((e) => e.cohort_id)

  // Fetch upcoming sessions for those cohorts
  const { data, error } = await supabase
    .from('class_sessions')
    .select(`
      *,
      cohorts!inner(
        id, name, course_id, teacher_id, pending_can_see_schedule,
        courses!inner(id, title),
        teachers!inner(id, name)
      )
    `)
    .in('cohort_id', cohortIds)
    .gt('scheduled_at', now)
    .is('cancelled_at', null)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error || !data) return []

  const sessions = data as StudentSessionWithDetails[]

  // Build a map of enrollment status by cohort_id
  const enrollmentStatusMap = new Map<string, string>()
  for (const e of enrollments) {
    enrollmentStatusMap.set(e.cohort_id, e.status)
  }

  // Filter out sessions where enrollment is pending and
  // cohort.pending_can_see_schedule is false
  return sessions.filter((session) => {
    const status = enrollmentStatusMap.get(session.cohort_id)
    if (status === 'pending' && !session.cohorts.pending_can_see_schedule) {
      return false
    }
    return true
  })
}
