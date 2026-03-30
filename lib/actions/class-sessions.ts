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
} from '@/lib/db/class-sessions'
import { RRule } from 'rrule'
import { canUseFeature } from '@/lib/plans/features'
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
