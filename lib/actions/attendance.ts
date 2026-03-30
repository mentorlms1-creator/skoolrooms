'use server'

// =============================================================================
// lib/actions/attendance.ts — Server actions for attendance marking
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getCohortById } from '@/lib/db/cohorts'
import { getSessionById } from '@/lib/db/class-sessions'
import {
  bulkUpsertAttendance,
  upsertAttendance,
  isAttendanceEditable,
  getAttendanceByCohortSession,
} from '@/lib/db/attendance'
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

  if (error || !user) return null
  const teacher = await getTeacherByAuthId(user.id)
  return teacher
}

// -----------------------------------------------------------------------------
// markAttendanceAction — Bulk upsert attendance for all students in the form
// -----------------------------------------------------------------------------

export async function markAttendanceAction(
  formData: FormData,
): Promise<ApiResponse<{ count: number }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  const sessionId = formData.get('session_id') as string | null
  const studentsJson = formData.get('students') as string | null

  if (!sessionId) {
    return { success: false, error: 'Session is required' }
  }
  if (!studentsJson) {
    return { success: false, error: 'Student attendance data is required' }
  }

  let records: Array<{ studentId: string; present: boolean }>
  try {
    records = JSON.parse(studentsJson) as Array<{ studentId: string; present: boolean }>
  } catch {
    return { success: false, error: 'Invalid attendance data format' }
  }

  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: 'No attendance records provided' }
  }

  // Fetch session
  const session = await getSessionById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  // Check session is not cancelled
  if (session.cancelled_at) {
    return { success: false, error: 'Cannot mark attendance for a cancelled session' }
  }

  // Verify cohort ownership
  const cohort = await getCohortById(session.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Session not found' }
  }

  // Archived cohort write guard
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is archived. No changes allowed.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // Check 24h edit window for existing records
  const existingRecords = await getAttendanceByCohortSession(sessionId)
  const existingByStudent = new Map(
    existingRecords.map((r) => [r.student_id, r])
  )

  // Filter out records that are past the 24h edit window
  const editableRecords = records.filter((record) => {
    const existing = existingByStudent.get(record.studentId)
    // New records (no existing entry) are always allowed
    if (!existing) return true
    // Existing records must be within the 24h edit window
    return isAttendanceEditable(existing.marked_at)
  })

  if (editableRecords.length === 0) {
    return {
      success: false,
      error: 'All attendance records are past the 24-hour edit window.',
    }
  }

  // Bulk upsert only the editable records
  const result = await bulkUpsertAttendance(sessionId, editableRecords)

  if (!result.success) {
    return { success: false, error: 'Failed to save attendance. Please try again.' }
  }

  return { success: true, data: { count: result.count } }
}

// -----------------------------------------------------------------------------
// updateAttendanceAction — Update a single student's attendance
// Checks 24h edit window via isAttendanceEditable
// -----------------------------------------------------------------------------

export async function updateAttendanceAction(
  sessionId: string,
  studentId: string,
  present: boolean,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  // Fetch session
  const session = await getSessionById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  // Check session is not cancelled
  if (session.cancelled_at) {
    return { success: false, error: 'Cannot update attendance for a cancelled session' }
  }

  // Verify cohort ownership
  const cohort = await getCohortById(session.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Session not found' }
  }

  // Archived cohort write guard
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is archived. No changes allowed.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // Check 24h edit window — if there's an existing record, verify it's editable
  const existingRecords = await getAttendanceByCohortSession(sessionId)
  const existingRecord = existingRecords.find((r) => r.student_id === studentId)

  if (existingRecord && !isAttendanceEditable(existingRecord.marked_at)) {
    return {
      success: false,
      error: 'Attendance can only be edited within 24 hours of being marked.',
    }
  }

  const result = await upsertAttendance(sessionId, studentId, present)
  if (!result) {
    return { success: false, error: 'Failed to update attendance. Please try again.' }
  }

  return { success: true, data: null }
}
