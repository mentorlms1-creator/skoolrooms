'use server'

// =============================================================================
// lib/actions/class-sessions.ts — Server actions for class session CRUD
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getCohortById } from '@/lib/db/cohorts'
import {
  createSession,
  createSessionsBatch,
  cancelSession,
  getSessionById,
  markSessionRescheduled,
  softDeleteSession,
} from '@/lib/db/class-sessions'
import { RRule } from 'rrule'
import { canUseFeature } from '@/lib/plans/features'
import { checkPlanLock, getPlanLockError } from '@/lib/auth/plan-guard'
import { sendEmail } from '@/lib/email/sender'
import { formatPKT } from '@/lib/time/pkt'
import { createAdminClient } from '@/supabase/server'
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

// -----------------------------------------------------------------------------
// createSessionAction — Create single or recurring class sessions
// -----------------------------------------------------------------------------

export async function createSessionAction(
  formData: FormData,
): Promise<ApiResponse<{ sessionIds: string[] }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  const cohortId = formData.get('cohort_id') as string | null
  const meetLink = (formData.get('meet_link') as string | null)?.trim() ?? ''
  const scheduledAt = formData.get('scheduled_at') as string | null
  const durationMinutes = parseInt(
    (formData.get('duration_minutes') as string | null) ?? '60',
    10,
  )
  const isRecurring = formData.get('is_recurring') === 'true'
  const recurrenceRule = formData.get('recurrence_rule') as string | null

  // Validate required fields
  if (!cohortId) {
    return { success: false, error: 'Cohort is required' }
  }
  if (!meetLink) {
    return { success: false, error: 'Meet link is required' }
  }
  if (!meetLink.startsWith('https://')) {
    return { success: false, error: 'Meet link must be a valid HTTPS URL' }
  }
  if (!scheduledAt) {
    return { success: false, error: 'Date and time is required' }
  }

  // Verify cohort ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found' }
  }

  // Archived cohort write guard
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is archived. No changes allowed.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // --- Recurring session expansion ---
  if (isRecurring && recurrenceRule) {
    // Plan feature check: recurring_classes disabled on Free plan
    const canRecur = await canUseFeature(teacher.id, 'recurring_classes')
    if (!canRecur) {
      return {
        success: false,
        error: 'Recurring classes are not available on your current plan. Upgrade to use this feature.',
        code: 'FEATURE_NOT_AVAILABLE',
      }
    }

    try {
      // Parse the recurrence rule string and merge with dtstart/until
      const parsedOptions = RRule.parseString(recurrenceRule)
      const startDt = new Date(scheduledAt)
      const endDt = new Date(cohort.end_date + 'T23:59:59Z')

      const rule = new RRule({
        ...parsedOptions,
        dtstart: startDt,
        until: endDt,
      })

      // Generate all occurrence dates
      const dates = rule.all()

      if (dates.length === 0) {
        return {
          success: false,
          error:
            'No sessions generated for the given schedule. Check your dates and recurrence rule.',
        }
      }

      // Preserve the time-of-day from scheduledAt (UTC hours/minutes)
      const hours = startDt.getUTCHours()
      const minutes = startDt.getUTCMinutes()
      const seconds = startDt.getUTCSeconds()

      // Build batch insert array
      const sessions = dates.map((date, index) => {
        // Set the time portion to match the original scheduledAt (UTC)
        const sessionDate = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            hours,
            minutes,
            seconds,
          ),
        )

        return {
          cohort_id: cohortId,
          meet_link: meetLink,
          scheduled_at: sessionDate.toISOString(),
          duration_minutes: durationMinutes,
          is_recurring: true,
          // Only the first session stores the recurrence rule
          recurrence_rule: index === 0 ? recurrenceRule : null,
        }
      })

      const created = await createSessionsBatch(sessions)

      if (created.length === 0) {
        return {
          success: false,
          error: 'Failed to create sessions. Please try again.',
        }
      }

      return {
        success: true,
        data: { sessionIds: created.map((s) => s.id) },
      }
    } catch {
      return { success: false, error: 'Invalid recurrence rule format' }
    }
  }

  // --- Single session ---
  const session = await createSession({
    cohortId,
    meetLink,
    scheduledAt,
    durationMinutes,
    isRecurring: false,
    recurrenceRule: null,
  })

  if (!session) {
    return {
      success: false,
      error: 'Failed to create session. Please try again.',
    }
  }

  return { success: true, data: { sessionIds: [session.id] } }
}

// -----------------------------------------------------------------------------
// cancelSessionAction — Cancel a single class session
// -----------------------------------------------------------------------------

export async function cancelSessionAction(
  sessionId: string,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  const session = await getSessionById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  // Verify ownership via cohort
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

  // Already cancelled guard
  if (session.cancelled_at) {
    return { success: false, error: 'Session is already cancelled' }
  }

  const result = await cancelSession(sessionId)

  if (!result) {
    return {
      success: false,
      error: 'Failed to cancel session. Please try again.',
    }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// rescheduleSessionAction — Cancel original + create replacement linked via
// rescheduled_to_id. Sends class_rescheduled email to enrolled students.
// -----------------------------------------------------------------------------

export async function rescheduleSessionAction(
  sessionId: string,
  formData: FormData,
): Promise<ApiResponse<{ newSessionId: string; notified: number }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  const session = await getSessionById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  const cohort = await getCohortById(session.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Session not found' }
  }

  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort is archived. No changes allowed.',
      code: 'COHORT_ARCHIVED',
    }
  }

  if (session.cancelled_at) {
    return { success: false, error: 'Cannot reschedule a cancelled session.' }
  }

  if (session.rescheduled_to_id) {
    return { success: false, error: 'This session has already been rescheduled.' }
  }

  const newScheduledAt = (formData.get('new_scheduled_at') as string | null)?.trim() ?? ''
  const newMeetLinkRaw = (formData.get('new_meet_link') as string | null)?.trim() ?? ''
  const reason = ((formData.get('reason') as string | null) ?? '').trim()

  if (!newScheduledAt) {
    return { success: false, error: 'New date and time is required.' }
  }
  const parsed = Date.parse(newScheduledAt)
  if (isNaN(parsed)) {
    return { success: false, error: 'Invalid date.' }
  }
  if (parsed <= Date.now()) {
    return { success: false, error: 'New time must be in the future.' }
  }
  if (reason.length > 500) {
    return { success: false, error: 'Reason must be 500 characters or fewer.' }
  }
  const newMeetLink = newMeetLinkRaw || session.meet_link
  if (!newMeetLink.startsWith('https://')) {
    return { success: false, error: 'Meet link must be a valid HTTPS URL.' }
  }

  // Step 1: insert new session
  const newSession = await createSession({
    cohortId: session.cohort_id,
    meetLink: newMeetLink,
    scheduledAt: new Date(parsed).toISOString(),
    durationMinutes: session.duration_minutes,
    isRecurring: false,
    recurrenceRule: null,
  })

  if (!newSession) {
    return { success: false, error: 'Failed to create rescheduled session.' }
  }

  // Step 2: mark original as rescheduled
  const updated = await markSessionRescheduled(sessionId, newSession.id)
  if (!updated) {
    // Rollback: soft-delete the new session so we don't orphan it
    await softDeleteSession(newSession.id)
    return { success: false, error: 'Failed to reschedule session. Please try again.' }
  }

  // Step 3: notify enrolled students (active + pending honoring schedule visibility)
  const supabaseAdmin = createAdminClient()
  const { data: enrollmentRows } = await supabaseAdmin
    .from('enrollments')
    .select('status, students!inner(id, name, email)')
    .eq('cohort_id', session.cohort_id)
    .in('status', ['active', 'pending'])

  type EnrollRow = { status: string; students: { id: string; name: string; email: string } }
  const recipients = ((enrollmentRows ?? []) as unknown as EnrollRow[]).filter((row) => {
    if (row.status === 'active') return true
    return cohort.pending_can_see_schedule
  })

  let notified = 0
  for (const r of recipients) {
    try {
      await sendEmail({
        to: r.students.email,
        type: 'class_rescheduled',
        recipientId: r.students.id,
        recipientType: 'student',
        data: {
          studentName: r.students.name,
          teacherName: teacher.name,
          cohortName: cohort.name,
          oldTimePKT: formatPKT(session.scheduled_at, 'datetime'),
          newTimePKT: formatPKT(newSession.scheduled_at, 'datetime'),
          meetLink: newSession.meet_link,
          reason,
        },
      })
      notified++
    } catch (err) {
      console.error('[rescheduleSessionAction] email failed:', err)
    }
  }

  return { success: true, data: { newSessionId: newSession.id, notified } }
}
