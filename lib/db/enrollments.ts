// =============================================================================
// lib/db/enrollments.ts — Enrollment CRUD queries (service layer)
// All database queries for enrollments go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { EnrollmentStatus } from '@/types/domain'

// -----------------------------------------------------------------------------
// Row types (mirrors the enrollments table from 001_initial_schema.sql)
// These will be replaced by auto-generated types once `npx supabase gen types`
// is run. Until then, we define them manually.
// -----------------------------------------------------------------------------

export type EnrollmentRow = {
  id: string
  student_id: string
  cohort_id: string
  status: string
  reference_code: string
  withdrawal_requested_at: string | null
  withdrawal_reason: string | null
  revoke_reason: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

// Enrollment joined with cohort + course info (for student-facing views)
export type EnrollmentWithCohortAndCourse = EnrollmentRow & {
  cohorts: {
    id: string
    name: string
    start_date: string
    end_date: string
    fee_type: string
    fee_pkr: number
    status: string
    is_registration_open: boolean
    courses: {
      id: string
      title: string
      description: string | null
      thumbnail_url: string | null
      teacher_id: string
    }
  }
}

// Enrollment joined with cohort + course + teacher info (for student portal views)
export type EnrollmentWithCohortCourseTeacher = EnrollmentRow & {
  cohorts: {
    id: string
    name: string
    start_date: string
    end_date: string
    fee_type: string
    fee_pkr: number
    status: string
    is_registration_open: boolean
    pending_can_see_schedule: boolean
    pending_can_see_announcements: boolean
    courses: {
      id: string
      title: string
      description: string | null
      thumbnail_url: string | null
      teacher_id: string
    }
    teachers: {
      id: string
      name: string
    }
  }
}

// Enrollment joined with student info (for teacher-facing views)
export type EnrollmentWithStudent = EnrollmentRow & {
  students: {
    id: string
    name: string
    email: string
    phone: string
  }
}

// Enrollment joined with student info + payment info (for pending review)
export type PendingEnrollmentWithDetails = EnrollmentRow & {
  students: {
    id: string
    name: string
    email: string
    phone: string
  }
  cohorts: {
    id: string
    name: string
    course_id: string
    fee_pkr: number
    fee_type: string
  }
  student_payments: {
    id: string
    amount_pkr: number
    discounted_amount_pkr: number
    payment_method: string
    screenshot_url: string | null
    status: string
    created_at: string
  }[]
}

// Input type for creating an enrollment
export type CreateEnrollmentInput = {
  studentId: string
  cohortId: string
  referenceCode: string
}

// Safe charset for reference codes (no 0/O/1/I/L to avoid confusion)
const REFERENCE_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const REFERENCE_CODE_LENGTH = 6

// -----------------------------------------------------------------------------
// generateReferenceCode — Generate a unique 6-char reference code
// Uses safe charset (no 0/O/1/I/L), retries on collision
// -----------------------------------------------------------------------------
export async function generateReferenceCode(): Promise<string> {
  const supabase = createAdminClient()

  for (let attempt = 0; attempt < 10; attempt++) {
    let code = ''
    for (let i = 0; i < REFERENCE_CODE_LENGTH; i++) {
      const randomIndex = Math.floor(Math.random() * REFERENCE_CODE_CHARSET.length)
      code += REFERENCE_CODE_CHARSET[randomIndex]
    }

    // Check uniqueness in enrollments table
    const { count } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('reference_code', code)

    if ((count ?? 0) === 0) {
      return code
    }
  }

  throw new Error('Failed to generate unique reference code after 10 attempts')
}

// -----------------------------------------------------------------------------
// getEnrollmentById — Single enrollment by ID
// -----------------------------------------------------------------------------
export async function getEnrollmentById(
  id: string
): Promise<EnrollmentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as EnrollmentRow
}

// -----------------------------------------------------------------------------
// getEnrollmentsByStudent — All enrollments for a student, joined with
// cohort + course info, newest first
// -----------------------------------------------------------------------------
export async function getEnrollmentsByStudent(
  studentId: string
): Promise<EnrollmentWithCohortAndCourse[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      cohorts!inner(
        id, name, start_date, end_date, fee_type, fee_pkr, status, is_registration_open,
        courses!inner(id, title, description, thumbnail_url, teacher_id)
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as EnrollmentWithCohortAndCourse[]
}

// -----------------------------------------------------------------------------
// getEnrollmentsByStudentWithTeacher — All enrollments for a student, joined
// with cohort + course + teacher info. Used by student portal pages that need
// teacher names and cohort visibility settings.
// -----------------------------------------------------------------------------
export async function getEnrollmentsByStudentWithTeacher(
  studentId: string
): Promise<EnrollmentWithCohortCourseTeacher[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      cohorts!inner(
        id, name, start_date, end_date, fee_type, fee_pkr, status, is_registration_open,
        pending_can_see_schedule, pending_can_see_announcements,
        courses!inner(id, title, description, thumbnail_url, teacher_id),
        teachers!inner(id, name)
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as EnrollmentWithCohortCourseTeacher[]
}

// -----------------------------------------------------------------------------
// getEnrollmentsByCohort — All enrollments for a cohort, joined with
// student info, newest first
// -----------------------------------------------------------------------------
export async function getEnrollmentsByCohort(
  cohortId: string
): Promise<EnrollmentWithStudent[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      students!inner(id, name, email, phone)
    `)
    .eq('cohort_id', cohortId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as EnrollmentWithStudent[]
}

// -----------------------------------------------------------------------------
// getPendingEnrollmentsByTeacher — Pending enrollments across all teacher's
// cohorts, joined with student info and payment info
// -----------------------------------------------------------------------------
export async function getPendingEnrollmentsByTeacher(
  teacherId: string
): Promise<PendingEnrollmentWithDetails[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      students!inner(id, name, email, phone),
      cohorts!inner(id, name, course_id, fee_pkr, fee_type),
      student_payments(id, amount_pkr, discounted_amount_pkr, payment_method, screenshot_url, status, created_at)
    `)
    .eq('status', 'pending')
    .eq('cohorts.teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as PendingEnrollmentWithDetails[]
}

// -----------------------------------------------------------------------------
// createEnrollment — Insert a new enrollment with status='pending'
// -----------------------------------------------------------------------------
export async function createEnrollment(
  input: CreateEnrollmentInput
): Promise<EnrollmentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('enrollments')
    .insert({
      student_id: input.studentId,
      cohort_id: input.cohortId,
      reference_code: input.referenceCode,
      status: 'pending' satisfies EnrollmentStatus,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as EnrollmentRow
}

// -----------------------------------------------------------------------------
// updateEnrollmentStatus — Update enrollment status + updated_at
// -----------------------------------------------------------------------------
export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus
): Promise<EnrollmentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('enrollments')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId)
    .select('*')
    .single()

  if (error || !data) return null
  return data as EnrollmentRow
}

// -----------------------------------------------------------------------------
// checkExistingEnrollment — Check if a student is already enrolled in a cohort
// Returns the existing enrollment or null if none exists
// Used to prevent double enrollment
// -----------------------------------------------------------------------------
export async function checkExistingEnrollment(
  studentId: string,
  cohortId: string
): Promise<EnrollmentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('student_id', studentId)
    .eq('cohort_id', cohortId)
    .single()

  if (error || !data) return null
  return data as EnrollmentRow
}
