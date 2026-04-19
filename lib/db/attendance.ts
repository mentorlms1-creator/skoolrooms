// =============================================================================
// lib/db/attendance.ts — Attendance CRUD queries (service layer)
// All database queries for attendance go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

// -----------------------------------------------------------------------------
// Row types (mirrors the attendance table from 001_initial_schema.sql)
// -----------------------------------------------------------------------------

export type AttendanceRow = {
  id: string
  class_session_id: string
  student_id: string
  present: boolean
  marked_at: string
}

// Attendance with student info (for teacher-facing views)
export type AttendanceWithStudent = AttendanceRow & {
  students: {
    id: string
    name: string
    email: string
  }
}

// Attendance with session info (for student-facing views)
export type AttendanceWithSession = AttendanceRow & {
  class_sessions: {
    id: string
    cohort_id: string
    scheduled_at: string
    duration_minutes: number
    cancelled_at: string | null
  }
}

// Attendance summary for a student in a cohort
export type AttendanceSummary = {
  attended: number
  total: number
  percentage: number
}

// One row per scheduled session for a student/cohort timeline view
export type AttendanceTimelineEntry = {
  session_id: string
  scheduled_at: string
  cancelled: boolean
  present: boolean
}

// Input type for bulk upsert
export type BulkAttendanceRecord = {
  studentId: string
  present: boolean
}

// -----------------------------------------------------------------------------
// getAttendanceByCohortSession — All attendance records for a session
// with student info
// -----------------------------------------------------------------------------
export async function getAttendanceByCohortSession(
  sessionId: string
): Promise<AttendanceWithStudent[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('attendance')
    .select(`
      *,
      students!inner(id, name, email)
    `)
    .eq('class_session_id', sessionId)

  if (error || !data) return []
  return data as AttendanceWithStudent[]
}

// -----------------------------------------------------------------------------
// getAttendanceByStudent — Attendance records for a student in a cohort
// (joined with class_sessions to get session details)
// -----------------------------------------------------------------------------
export async function getAttendanceByStudent(
  studentId: string,
  cohortId: string
): Promise<AttendanceWithSession[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('attendance')
    .select(`
      *,
      class_sessions!inner(id, cohort_id, scheduled_at, duration_minutes, cancelled_at)
    `)
    .eq('student_id', studentId)
    .eq('class_sessions.cohort_id', cohortId)
    .order('marked_at', { ascending: false })

  if (error || !data) return []
  return data as AttendanceWithSession[]
}

// -----------------------------------------------------------------------------
// upsertAttendance — Insert or update a single attendance record.
// Uses .upsert() with onConflict on the UNIQUE(class_session_id, student_id)
// constraint.
// -----------------------------------------------------------------------------
export async function upsertAttendance(
  sessionId: string,
  studentId: string,
  present: boolean
): Promise<AttendanceRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      {
        class_session_id: sessionId,
        student_id: studentId,
        present,
        marked_at: new Date().toISOString(),
      },
      { onConflict: 'class_session_id,student_id' }
    )
    .select('*')
    .single()

  if (error || !data) return null
  return data as AttendanceRow
}

// -----------------------------------------------------------------------------
// isAttendanceEditable — Pure function: check if within 24h of marked_at
// Returns true if the attendance record can still be edited.
// -----------------------------------------------------------------------------
export function isAttendanceEditable(markedAt: string): boolean {
  const markedTime = new Date(markedAt).getTime()
  const now = Date.now()
  const twentyFourHoursMs = 24 * 60 * 60 * 1000
  return now - markedTime <= twentyFourHoursMs
}

// -----------------------------------------------------------------------------
// getAttendanceSummary — X of Y non-cancelled classes attended.
// Excludes cancelled sessions from the denominator.
// Uses two-step approach (Supabase .in() doesn't accept subqueries).
// -----------------------------------------------------------------------------
export async function getAttendanceSummary(
  studentId: string,
  cohortId: string
): Promise<AttendanceSummary> {
  const supabase = createAdminClient()

  // 1. Get all non-cancelled session IDs for this cohort
  const { data: sessions, error: sessionError } = await supabase
    .from('class_sessions')
    .select('id')
    .eq('cohort_id', cohortId)
    .is('cancelled_at', null)
    .is('deleted_at', null)

  if (sessionError || !sessions || sessions.length === 0) {
    return { attended: 0, total: 0, percentage: 0 }
  }

  const sessionIds = (sessions as Array<{ id: string }>).map((s) => s.id)
  const total = sessionIds.length

  // 2. Count attendance records where present=true for these sessions
  const { count, error: attendError } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('present', true)
    .in('class_session_id', sessionIds)

  if (attendError) {
    return { attended: 0, total, percentage: 0 }
  }

  const attended = count ?? 0
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0

  return { attended, total, percentage }
}

// -----------------------------------------------------------------------------
// getOverallAttendanceSummary — Aggregate attendance across ALL cohorts the
// student is actively enrolled in. Returns total attended / total sessions
// and an overall percentage.
// -----------------------------------------------------------------------------
export async function getOverallAttendanceSummary(
  studentId: string
): Promise<AttendanceSummary> {
  const supabase = createAdminClient()

  // 1. Get active enrollment cohort IDs
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('cohort_id')
    .eq('student_id', studentId)
    .eq('status', 'active')

  if (enrollError || !enrollments || enrollments.length === 0) {
    return { attended: 0, total: 0, percentage: 0 }
  }

  const cohortIds = (enrollments as Array<{ cohort_id: string }>).map(
    (e) => e.cohort_id
  )

  // 2. Get all non-cancelled session IDs across those cohorts
  const { data: sessions, error: sessionError } = await supabase
    .from('class_sessions')
    .select('id')
    .in('cohort_id', cohortIds)
    .is('cancelled_at', null)
    .is('deleted_at', null)

  if (sessionError || !sessions || sessions.length === 0) {
    return { attended: 0, total: 0, percentage: 0 }
  }

  const sessionIds = (sessions as Array<{ id: string }>).map((s) => s.id)
  const total = sessionIds.length

  // 3. Count attendance records where present=true
  const { count, error: attendError } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('present', true)
    .in('class_session_id', sessionIds)

  if (attendError) {
    return { attended: 0, total, percentage: 0 }
  }

  const attended = count ?? 0
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0

  return { attended, total, percentage }
}

// -----------------------------------------------------------------------------
// getAttendanceTimelineForStudent — Returns one row per non-deleted session in
// the cohort, projecting whether the student was present and whether the
// session was cancelled. Canonical source for both UI timeline + Lane H PDF.
// -----------------------------------------------------------------------------
export async function getAttendanceTimelineForStudent(
  studentId: string,
  cohortId: string,
): Promise<AttendanceTimelineEntry[]> {
  const supabase = createAdminClient()

  const { data: sessions, error: sessionError } = await supabase
    .from('class_sessions')
    .select('id, scheduled_at, cancelled_at')
    .eq('cohort_id', cohortId)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: true })

  if (sessionError || !sessions || sessions.length === 0) return []

  const sessionIds = (sessions as Array<{ id: string }>).map((s) => s.id)

  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('class_session_id, present')
    .eq('student_id', studentId)
    .in('class_session_id', sessionIds)

  const presentMap = new Map<string, boolean>()
  if (attendanceRows) {
    for (const row of attendanceRows as Array<{ class_session_id: string; present: boolean }>) {
      presentMap.set(row.class_session_id, row.present)
    }
  }

  return (sessions as Array<{ id: string; scheduled_at: string; cancelled_at: string | null }>).map(
    (s) => ({
      session_id: s.id,
      scheduled_at: s.scheduled_at,
      cancelled: s.cancelled_at !== null,
      present: presentMap.get(s.id) ?? false,
    }),
  )
}

// -----------------------------------------------------------------------------
// bulkUpsertAttendance — Batch upsert for marking attendance for a whole class.
// Uses .upsert() with onConflict on the UNIQUE(class_session_id, student_id)
// constraint.
// -----------------------------------------------------------------------------
export async function bulkUpsertAttendance(
  sessionId: string,
  records: BulkAttendanceRecord[]
): Promise<{ success: boolean; count: number }> {
  const supabase = createAdminClient()

  if (records.length === 0) {
    return { success: true, count: 0 }
  }

  const now = new Date().toISOString()

  const rows = records.map((r) => ({
    class_session_id: sessionId,
    student_id: r.studentId,
    present: r.present,
    marked_at: now,
  }))

  const { error, data } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'class_session_id,student_id' })
    .select('id')

  if (error) return { success: false, count: 0 }
  return { success: true, count: data?.length ?? records.length }
}
