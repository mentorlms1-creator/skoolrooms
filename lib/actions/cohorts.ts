'use server'

// =============================================================================
// lib/actions/cohorts.ts — Server actions for cohort CRUD
// =============================================================================

import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import {
  createCohort,
  getCohortById,
  updateCohort,
  archiveCohort,
  countActiveCohorts,
  getWaitlistCount,
  duplicateCohort,
} from '@/lib/db/cohorts'
import type { CreateCohortInput } from '@/lib/db/cohorts'
import { countActiveConfirmedEnrollments } from '@/lib/db/enrollments'
import { getCourseById } from '@/lib/db/courses'
import { getLimit } from '@/lib/plans/limits'
import { checkPlanLock, getPlanLockError } from '@/lib/auth/plan-guard'
import { completeOnboardingStep } from '@/lib/actions/onboarding'
import { sendEmail } from '@/lib/email/sender'
import type { ApiResponse } from '@/types/api'
import type { FeeType } from '@/types/domain'

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

const VALID_FEE_TYPES: ReadonlySet<string> = new Set(['one_time', 'monthly'])

// -----------------------------------------------------------------------------
// createCohortAction — Create a new cohort for a course
// -----------------------------------------------------------------------------

export async function createCohortAction(
  formData: FormData,
): Promise<ApiResponse<{ cohortId: string; inviteToken: string }>> {
  const teacher = await getAuthenticatedTeacher()

  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  // Extract fields from FormData
  const courseId = (formData.get('course_id') as string | null)?.trim() ?? ''
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const startDate = (formData.get('start_date') as string | null)?.trim() ?? ''
  const endDate = (formData.get('end_date') as string | null)?.trim() ?? ''
  const feeType = (formData.get('fee_type') as string | null)?.trim() ?? ''
  const feePkrRaw = formData.get('fee_pkr') as string | null
  const billingDayRaw = formData.get('billing_day') as string | null
  const maxStudentsRaw = formData.get('max_students') as string | null
  const isRegistrationOpen = formData.get('is_registration_open') !== 'false'
  const waitlistEnabled = formData.get('waitlist_enabled') === 'true'
  const pendingCanSeeSchedule = formData.get('pending_can_see_schedule') === 'true'
  const pendingCanSeeAnnouncements = formData.get('pending_can_see_announcements') === 'true'

  // --- Validation ---

  if (!courseId) {
    return { success: false, error: 'Course is required.' }
  }

  if (name.length < 2) {
    return {
      success: false,
      error: 'Cohort name must be at least 2 characters.',
    }
  }

  if (!startDate || !endDate) {
    return { success: false, error: 'Start date and end date are required.' }
  }

  // Validate date formats (YYYY-MM-DD)
  const startDateParsed = Date.parse(startDate)
  const endDateParsed = Date.parse(endDate)

  if (isNaN(startDateParsed) || isNaN(endDateParsed)) {
    return { success: false, error: 'Invalid date format.' }
  }

  if (endDateParsed <= startDateParsed) {
    return { success: false, error: 'End date must be after start date.' }
  }

  if (!VALID_FEE_TYPES.has(feeType)) {
    return {
      success: false,
      error: 'Fee type must be "one_time" or "monthly".',
    }
  }

  const feePkr = feePkrRaw !== null ? parseInt(feePkrRaw, 10) : NaN
  if (isNaN(feePkr) || feePkr < 0) {
    return { success: false, error: 'Fee must be 0 or more (in PKR).' }
  }

  // billing_day validation: required and must be 1-28 for monthly cohorts
  let billingDay: number | null = null
  if (feeType === 'monthly') {
    if (billingDayRaw === null || billingDayRaw.trim() === '') {
      return {
        success: false,
        error: 'Billing day is required for monthly fee cohorts.',
      }
    }
    billingDay = parseInt(billingDayRaw, 10)
    if (isNaN(billingDay) || billingDay < 1 || billingDay > 28) {
      return {
        success: false,
        error: 'Billing day must be between 1 and 28.',
      }
    }
  }

  const maxStudents =
    maxStudentsRaw !== null && maxStudentsRaw.trim() !== ''
      ? parseInt(maxStudentsRaw, 10)
      : null

  if (maxStudents !== null && (isNaN(maxStudents) || maxStudents < 1)) {
    return { success: false, error: 'Max students must be at least 1.' }
  }

  // --- Course ownership check ---
  const course = await getCourseById(courseId)
  if (!course || course.teacher_id !== teacher.id) {
    return { success: false, error: 'Course not found.' }
  }

  // --- Plan limit check ---
  const [activeCohortCount, maxCohorts] = await Promise.all([
    countActiveCohorts(teacher.id),
    getLimit(teacher.id, 'max_cohorts_active'),
  ])

  if (activeCohortCount >= maxCohorts) {
    return {
      success: false,
      error: `You have reached your plan limit of ${maxCohorts} active cohort${maxCohorts === 1 ? '' : 's'}. Upgrade your plan to create more.`,
      code: 'PLAN_LIMIT_REACHED',
    }
  }

  // --- Create cohort ---
  const input: CreateCohortInput = {
    teacherId: teacher.id,
    courseId,
    name,
    startDate,
    endDate,
    maxStudents,
    feeType: feeType as FeeType,
    feePkr,
    billingDay,
    isRegistrationOpen,
    waitlistEnabled,
    pendingCanSeeSchedule,
    pendingCanSeeAnnouncements,
  }

  const cohort = await createCohort(input)

  if (!cohort) {
    return { success: false, error: 'Failed to create cohort. Please try again.' }
  }

  // Mark onboarding step complete
  await completeOnboardingStep('cohort_created')

  return {
    success: true,
    data: { cohortId: cohort.id, inviteToken: cohort.invite_token },
  }
}

// -----------------------------------------------------------------------------
// updateCohortAction — Update cohort settings
// -----------------------------------------------------------------------------

export async function updateCohortAction(
  cohortId: string,
  formData: FormData,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()

  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  // Verify ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found.' }
  }

  // Archived cohort write guard
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is archived and cannot be modified.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // --- Extract updateable fields ---
  const updates: Record<string, unknown> = {}

  const name = formData.get('name') as string | null
  if (name !== null) {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      return {
        success: false,
        error: 'Cohort name must be at least 2 characters.',
      }
    }
    updates.name = trimmed
  }

  const startDate = formData.get('start_date') as string | null
  if (startDate !== null) {
    if (isNaN(Date.parse(startDate))) {
      return { success: false, error: 'Invalid start date.' }
    }
    updates.start_date = startDate.trim()
  }

  const endDate = formData.get('end_date') as string | null
  if (endDate !== null) {
    if (isNaN(Date.parse(endDate))) {
      return { success: false, error: 'Invalid end date.' }
    }
    updates.end_date = endDate.trim()
  }

  // Cross-validate: end must be after start (using updated or existing values)
  const effectiveStart = (updates.start_date as string | undefined) ?? cohort.start_date
  const effectiveEnd = (updates.end_date as string | undefined) ?? cohort.end_date
  if (Date.parse(effectiveEnd) <= Date.parse(effectiveStart)) {
    return { success: false, error: 'End date must be after start date.' }
  }

  const feeType = formData.get('fee_type') as string | null
  if (feeType !== null) {
    if (!VALID_FEE_TYPES.has(feeType)) {
      return {
        success: false,
        error: 'Fee type must be "one_time" or "monthly".',
      }
    }
    updates.fee_type = feeType
  }

  const feePkrRaw = formData.get('fee_pkr') as string | null
  if (feePkrRaw !== null) {
    const feePkr = parseInt(feePkrRaw, 10)
    if (isNaN(feePkr) || feePkr < 0) {
      return { success: false, error: 'Fee must be 0 or more (in PKR).' }
    }
    updates.fee_pkr = feePkr
  }

  // billing_day validation
  const billingDayRaw = formData.get('billing_day') as string | null
  if (billingDayRaw !== null) {
    const billingDay = parseInt(billingDayRaw, 10)
    if (isNaN(billingDay) || billingDay < 1 || billingDay > 28) {
      return {
        success: false,
        error: 'Billing day must be between 1 and 28.',
      }
    }
    updates.billing_day = billingDay
  }

  // Lock fee_type / billing_day when active enrollments have confirmed payments.
  // Switching mid-stream would break billing semantics for students already
  // committed under the original terms (and break the cron's payment_month
  // idempotency window for billing_day changes). The asymmetry — fee_type
  // locks unconditionally but billing_day only locks when fee_type was
  // already monthly — is intentional: billing_day is meaningless for one_time
  // cohorts so changing it there has no real effect on billing.
  const feeTypeChanging =
    updates.fee_type !== undefined && updates.fee_type !== cohort.fee_type
  const billingDayChanging =
    updates.billing_day !== undefined &&
    updates.billing_day !== cohort.billing_day &&
    cohort.fee_type === 'monthly'

  if (feeTypeChanging || billingDayChanging) {
    const lockedCount = await countActiveConfirmedEnrollments(cohortId)
    if (lockedCount > 0) {
      const subject = lockedCount === 1 ? 'student has' : `${lockedCount} students have`
      const subjectPrefix = lockedCount === 1 ? `${lockedCount} ${subject}` : subject
      if (feeTypeChanging) {
        return {
          success: false,
          error: `Cannot change fee type — ${subjectPrefix} confirmed payments. Archive this cohort and create a new one to switch.`,
          code: 'FEE_TYPE_LOCKED',
        }
      }
      return {
        success: false,
        error: `Cannot change billing day — ${subjectPrefix} confirmed payments. Archive this cohort and create a new one to change billing day.`,
        code: 'BILLING_DAY_LOCKED',
      }
    }
  }

  // Validate billing_day is present for monthly fee type (current or updated)
  const effectiveFeeType = (updates.fee_type as string | undefined) ?? cohort.fee_type
  const effectiveBillingDay = (updates.billing_day as number | undefined) ?? cohort.billing_day
  if (effectiveFeeType === 'monthly' && effectiveBillingDay === null) {
    return {
      success: false,
      error: 'Billing day is required for monthly fee cohorts.',
    }
  }

  const maxStudentsRaw = formData.get('max_students') as string | null
  const previousMaxStudents = cohort.max_students
  if (maxStudentsRaw !== null) {
    if (maxStudentsRaw.trim() === '') {
      updates.max_students = null
    } else {
      const maxStudents = parseInt(maxStudentsRaw, 10)
      if (isNaN(maxStudents) || maxStudents < 1) {
        return { success: false, error: 'Max students must be at least 1.' }
      }
      updates.max_students = maxStudents
    }
  }

  const isRegistrationOpen = formData.get('is_registration_open') as string | null
  if (isRegistrationOpen !== null) {
    updates.is_registration_open = isRegistrationOpen !== 'false'
  }

  const waitlistEnabled = formData.get('waitlist_enabled') as string | null
  if (waitlistEnabled !== null) {
    updates.waitlist_enabled = waitlistEnabled === 'true'
  }

  const pendingCanSeeSchedule = formData.get('pending_can_see_schedule') as string | null
  if (pendingCanSeeSchedule !== null) {
    updates.pending_can_see_schedule = pendingCanSeeSchedule === 'true'
  }

  const pendingCanSeeAnnouncements = formData.get('pending_can_see_announcements') as string | null
  if (pendingCanSeeAnnouncements !== null) {
    updates.pending_can_see_announcements = pendingCanSeeAnnouncements === 'true'
  }

  // --- Apply update ---
  const updated = await updateCohort(cohortId, teacher.id, updates)

  if (!updated) {
    return { success: false, error: 'Failed to update cohort. Please try again.' }
  }

  // If max_students was increased (or removed cap) and waitlist has entries,
  // notify teacher about available slots
  const newMaxStudents = (updates.max_students as number | null | undefined) ?? previousMaxStudents
  const maxIncreased =
    previousMaxStudents !== null &&
    (newMaxStudents === null || newMaxStudents > previousMaxStudents)

  if (maxIncreased) {
    const waitlistCount = await getWaitlistCount(cohortId)
    if (waitlistCount > 0) {
      await sendEmail({
        to: teacher.email,
        type: 'waitlist_slots_available',
        recipientId: teacher.id,
        recipientType: 'teacher',
        data: {
          teacherName: teacher.name,
          cohortName: updated.name,
          waitlistCount,
        },
      })
    }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// duplicateCohortAction — Duplicate a cohort as a new draft
// -----------------------------------------------------------------------------

export async function duplicateCohortAction(
  cohortId: string,
): Promise<ApiResponse<{ cohortId: string; inviteToken: string }>> {
  const teacher = await getAuthenticatedTeacher()

  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  const newCohort = await duplicateCohort(cohortId, teacher.id)

  if (!newCohort) {
    return { success: false, error: 'Cohort not found or you do not have permission to duplicate it.' }
  }

  return {
    success: true,
    data: { cohortId: newCohort.id, inviteToken: newCohort.invite_token },
  }
}

// -----------------------------------------------------------------------------
// archiveCohortAction — Archive a cohort permanently
// Also rejects pending enrollments and expires waitlist entries.
// -----------------------------------------------------------------------------

export async function archiveCohortAction(
  cohortId: string,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()

  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found.' }
  }

  // Already archived — error
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is already archived.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // Archive the cohort
  const archived = await archiveCohort(cohortId, teacher.id)

  if (!archived) {
    return { success: false, error: 'Failed to archive cohort. Please try again.' }
  }

  // Bulk cleanup: reject pending enrollments + expire waitlist entries
  // Using createAdminClient (sync!) for direct bulk updates
  const supabaseAdmin = createAdminClient()

  // Auto-reject pending enrollments
  await supabaseAdmin
    .from('enrollments')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('cohort_id', cohortId)
    .eq('status', 'pending')

  // Expire waitlist entries
  await supabaseAdmin
    .from('cohort_waitlist')
    .update({ status: 'expired' })
    .eq('cohort_id', cohortId)
    .eq('status', 'waiting')

  return { success: true, data: null }
}
