// =============================================================================
// lib/db/cohorts.ts — Cohort CRUD queries (service layer)
// All database queries for cohorts go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { CohortStatus, FeeType } from '@/types/domain'

// -----------------------------------------------------------------------------
// Row types (mirrors the cohorts table from 001_initial_schema.sql)
// These will be replaced by auto-generated types once `npx supabase gen types`
// is run. Until then, we define them manually.
// -----------------------------------------------------------------------------

export type CohortRow = {
  id: string
  course_id: string
  teacher_id: string
  name: string
  session_type: string
  start_date: string
  end_date: string
  max_students: number | null
  fee_type: string
  fee_pkr: number
  billing_day: number | null
  invite_token: string
  status: string
  is_registration_open: boolean
  pending_can_see_schedule: boolean
  pending_can_see_announcements: boolean
  waitlist_enabled: boolean
  archived_at: string | null
  deleted_at: string | null
  updated_at: string
  created_at: string
}

// Cohort row joined with course info (for invite token lookups)
export type CohortWithCourse = CohortRow & {
  courses: {
    id: string
    title: string
    description: string | null
    status: string
    thumbnail_url: string | null
    teacher_id: string
  }
}

// Input type for creating a cohort
export type CreateCohortInput = {
  teacherId: string
  courseId: string
  name: string
  startDate: string
  endDate: string
  maxStudents: number | null
  feeType: FeeType
  feePkr: number
  billingDay: number | null
  isRegistrationOpen: boolean
  waitlistEnabled: boolean
  pendingCanSeeSchedule: boolean
  pendingCanSeeAnnouncements: boolean
}

// -----------------------------------------------------------------------------
// getCohortsByTeacher — All non-deleted cohorts for a teacher, newest first
// -----------------------------------------------------------------------------
export async function getCohortsByTeacher(
  teacherId: string
): Promise<CohortRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohorts')
    .select('*')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as CohortRow[]
}

// -----------------------------------------------------------------------------
// getCohortsByCourse — All non-deleted cohorts for a course
// -----------------------------------------------------------------------------
export async function getCohortsByCourse(
  courseId: string
): Promise<CohortRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohorts')
    .select('*')
    .eq('course_id', courseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as CohortRow[]
}

// -----------------------------------------------------------------------------
// getCohortById — Single cohort by ID (must not be soft-deleted)
// -----------------------------------------------------------------------------
export async function getCohortById(
  cohortId: string
): Promise<CohortRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohorts')
    .select('*')
    .eq('id', cohortId)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data as CohortRow
}

// -----------------------------------------------------------------------------
// getCohortByInviteToken — Look up cohort by invite token, join with course
// Returns null if not found or soft-deleted
// -----------------------------------------------------------------------------
export async function getCohortByInviteToken(
  token: string
): Promise<CohortWithCourse | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohorts')
    .select('*, courses!inner(id, title, description, status, thumbnail_url, teacher_id)')
    .eq('invite_token', token)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data as CohortWithCourse
}

// -----------------------------------------------------------------------------
// createCohort — Insert a new cohort with status='upcoming'
// Generates a UUID v4 invite_token via crypto.randomUUID()
// -----------------------------------------------------------------------------
export async function createCohort(
  input: CreateCohortInput
): Promise<CohortRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohorts')
    .insert({
      teacher_id: input.teacherId,
      course_id: input.courseId,
      name: input.name,
      start_date: input.startDate,
      end_date: input.endDate,
      max_students: input.maxStudents,
      fee_type: input.feeType,
      fee_pkr: input.feePkr,
      billing_day: input.billingDay,
      invite_token: crypto.randomUUID(),
      status: 'upcoming' satisfies CohortStatus,
      is_registration_open: input.isRegistrationOpen,
      waitlist_enabled: input.waitlistEnabled,
      pending_can_see_schedule: input.pendingCanSeeSchedule,
      pending_can_see_announcements: input.pendingCanSeeAnnouncements,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as CohortRow
}

// -----------------------------------------------------------------------------
// updateCohort — Partial update with teacher_id ownership filter + updated_at
// -----------------------------------------------------------------------------
export async function updateCohort(
  cohortId: string,
  teacherId: string,
  updates: Record<string, unknown>
): Promise<CohortRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cohorts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', cohortId)
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error || !data) return null
  return data as CohortRow
}

// -----------------------------------------------------------------------------
// archiveCohort — Set status='archived', archived_at=now, close registration
// Uses teacher_id filter for ownership enforcement.
// -----------------------------------------------------------------------------
export async function archiveCohort(
  cohortId: string,
  teacherId: string
): Promise<CohortRow | null> {
  const supabase = createAdminClient()

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('cohorts')
    .update({
      status: 'archived' satisfies CohortStatus,
      archived_at: now,
      is_registration_open: false,
      updated_at: now,
    })
    .eq('id', cohortId)
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error || !data) return null
  return data as CohortRow
}

// -----------------------------------------------------------------------------
// countActiveCohorts — Count for plan limit enforcement
// Active = status 'active' OR (status 'upcoming' with start_date <= today)
// -----------------------------------------------------------------------------
export async function countActiveCohorts(
  teacherId: string
): Promise<number> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Count status='active'
  const { count: activeCount } = await supabase
    .from('cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'active')
    .is('deleted_at', null)

  // Count status='upcoming' where start_date <= today (should have transitioned)
  const { count: startedUpcomingCount } = await supabase
    .from('cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'upcoming')
    .lte('start_date', today)
    .is('deleted_at', null)

  return (activeCount ?? 0) + (startedUpcomingCount ?? 0)
}

// -----------------------------------------------------------------------------
// getWaitlistCount — Count waiting entries for a cohort
// -----------------------------------------------------------------------------
export async function getWaitlistCount(
  cohortId: string
): Promise<number> {
  const supabase = createAdminClient()

  const { count } = await supabase
    .from('cohort_waitlist')
    .select('*', { count: 'exact', head: true })
    .eq('cohort_id', cohortId)
    .eq('status', 'waiting')

  return count ?? 0
}

// -----------------------------------------------------------------------------
// getActiveEnrollmentCount — Count active enrollments for a cohort
// -----------------------------------------------------------------------------
export async function getActiveEnrollmentCount(
  cohortId: string
): Promise<number> {
  const supabase = createAdminClient()

  const { count } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('cohort_id', cohortId)
    .eq('status', 'active')

  return count ?? 0
}

// -----------------------------------------------------------------------------
// computeCohortDisplayStatus — Pure function, no DB call
// Returns a human-readable display status based on cohort state.
//
// Logic:
//   archived → 'archived'
//   draft → 'draft'
//   upcoming and start_date > today → 'upcoming'
//   active or (upcoming and started):
//     if !is_registration_open → 'closed'
//     if full (max_students != null && enrollmentCount >= max_students) → 'full'
//     else → 'open'
// -----------------------------------------------------------------------------
export function computeCohortDisplayStatus(
  cohort: Pick<CohortRow, 'status' | 'start_date' | 'is_registration_open' | 'max_students'>,
  enrollmentCount: number
): string {
  if (cohort.status === 'archived') return 'archived'
  if (cohort.status === 'draft') return 'draft'

  const today = new Date().toISOString().split('T')[0]
  const hasStarted = cohort.start_date <= today

  if (cohort.status === 'upcoming' && !hasStarted) return 'upcoming'

  // active, or upcoming that has started
  if (!cohort.is_registration_open) return 'closed'
  if (cohort.max_students !== null && enrollmentCount >= cohort.max_students) return 'full'
  return 'open'
}
