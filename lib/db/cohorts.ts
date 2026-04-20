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
// getActiveEnrollmentCounts — Batch: count active enrollments for many cohorts
// in a single query. Returns Map<cohortId, count> with 0 for any missing.
// -----------------------------------------------------------------------------
export async function getActiveEnrollmentCounts(
  cohortIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (cohortIds.length === 0) return result
  for (const id of cohortIds) result.set(id, 0)

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('enrollments')
    .select('cohort_id')
    .in('cohort_id', cohortIds)
    .eq('status', 'active')

  for (const row of (data ?? []) as Array<{ cohort_id: string }>) {
    result.set(row.cohort_id, (result.get(row.cohort_id) ?? 0) + 1)
  }
  return result
}

// -----------------------------------------------------------------------------
// duplicateCohort — Create a copy of a cohort with fresh dates + invite_token
// Copies settings only; class_sessions/enrollments/announcements start empty.
// start_date = today+30d, end_date = today+60d, status='draft'
// -----------------------------------------------------------------------------
export async function duplicateCohort(
  sourceCohortId: string,
  teacherId: string,
): Promise<CohortRow | null> {
  const source = await getCohortById(sourceCohortId)
  if (!source || source.teacher_id !== teacherId) return null

  const supabase = createAdminClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() + 30)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 60)

  const { data, error } = await supabase
    .from('cohorts')
    .insert({
      teacher_id: teacherId,
      course_id: source.course_id,
      name: `${source.name} (copy)`,
      session_type: source.session_type,
      fee_type: source.fee_type,
      fee_pkr: source.fee_pkr,
      billing_day: source.billing_day,
      max_students: source.max_students,
      pending_can_see_schedule: source.pending_can_see_schedule,
      pending_can_see_announcements: source.pending_can_see_announcements,
      waitlist_enabled: source.waitlist_enabled,
      is_registration_open: false,
      status: 'draft',
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      invite_token: crypto.randomUUID(),
      archived_at: null,
      deleted_at: null,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as CohortRow
}

// -----------------------------------------------------------------------------
// getCohortAnalytics — Per-cohort revenue + projection + completion rate.
// Returns null when the cohort doesn't belong to the requesting teacher.
// -----------------------------------------------------------------------------
export type CohortAnalytics = {
  revenue_collected_pkr: number
  revenue_pending_pkr: number
  projected_revenue_pkr: number
  projection_horizon_label: string | null
  manual_revenue_pkr: number
  completion_rate: number | null
  enrolled_active: number
  enrolled_total: number
  months_remaining: number | null
}

export async function getCohortAnalytics(
  cohortId: string,
  teacherId: string,
): Promise<CohortAnalytics | null> {
  const supabase = createAdminClient()

  const { data: cohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('id, teacher_id, status, fee_type, fee_pkr, end_date')
    .eq('id', cohortId)
    .is('deleted_at', null)
    .single()

  if (cohortError || !cohort) return null
  if ((cohort.teacher_id as string) !== teacherId) return null

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('cohort_id', cohortId)

  const enrollmentRows = (enrollments as Array<{ id: string; status: string }> | null) ?? []
  const activeEnrollments = enrollmentRows.filter((e) => e.status === 'active')
  const enrolledIds = enrollmentRows.map((e) => e.id)

  let collected = 0
  let pending = 0
  let manual = 0
  if (enrolledIds.length > 0) {
    const { data: payments } = await supabase
      .from('student_payments')
      .select('teacher_payout_amount_pkr, status, payment_method, refunded_at, platform_cut_pkr')
      .in('enrollment_id', enrolledIds)

    for (const p of (payments as Array<{
      teacher_payout_amount_pkr: number
      status: string
      payment_method: string
      refunded_at: string | null
      platform_cut_pkr: number
    }> | null) ?? []) {
      if (p.status === 'confirmed' && !p.refunded_at) {
        collected += p.teacher_payout_amount_pkr
        if (p.platform_cut_pkr === 0 && p.payment_method === 'manual') {
          manual += p.teacher_payout_amount_pkr
        }
      } else if (p.status === 'pending_verification' && !p.refunded_at) {
        pending += p.teacher_payout_amount_pkr
      }
    }
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const feeType = cohort.fee_type as string
  const feePkr = cohort.fee_pkr as number
  const endDateStr = cohort.end_date as string | null

  let monthsRemaining: number | null = null
  let projected = 0
  let horizonLabel: string | null = null

  if (feeType === 'monthly') {
    if (endDateStr) {
      const endDate = new Date(endDateStr)
      const diffMs = endDate.getTime() - today.getTime()
      monthsRemaining = Math.max(0, Math.ceil(diffMs / (30 * 24 * 60 * 60 * 1000)))
      projected = feePkr * activeEnrollments.length * monthsRemaining
      horizonLabel = monthsRemaining > 0 ? `Next ${monthsRemaining} month${monthsRemaining === 1 ? '' : 's'}` : null
    } else {
      monthsRemaining = 12
      projected = feePkr * activeEnrollments.length * 12
      horizonLabel = 'Next 12 months'
    }
  } else {
    const pendingEnrollments = enrollmentRows.filter((e) => e.status === 'pending').length
    projected = feePkr * pendingEnrollments
    horizonLabel = pendingEnrollments > 0 ? 'Pending enrollments' : null
  }

  let completionRate: number | null = null
  if ((cohort.status as string) === 'archived') {
    const counted = enrollmentRows.filter(
      (e) => e.status === 'active' || e.status === 'completed' || e.status === 'withdrawn',
    ).length
    const completed = enrollmentRows.filter((e) => e.status === 'completed').length
    completionRate = counted > 0 ? Math.round((completed / counted) * 100) : null
  }

  // Suppress unused var lint warning; kept for future-need analytics callers.
  void todayStr

  return {
    revenue_collected_pkr: collected,
    revenue_pending_pkr: pending,
    projected_revenue_pkr: projected,
    projection_horizon_label: horizonLabel,
    manual_revenue_pkr: manual,
    completion_rate: completionRate,
    enrolled_active: activeEnrollments.length,
    enrolled_total: enrollmentRows.length,
    months_remaining: monthsRemaining,
  }
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
