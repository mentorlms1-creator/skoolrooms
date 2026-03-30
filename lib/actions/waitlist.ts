'use server'

// =============================================================================
// lib/actions/waitlist.ts — Server actions for cohort waitlist
// Public actions (no auth required for joining). Leave requires email or auth.
// =============================================================================

import { headers } from 'next/headers'
import { joinWaitlist, getWaitlistEntry } from '@/lib/db/waitlist'
import { leaveWaitlist } from '@/lib/db/waitlist'
import { getCohortById, getActiveEnrollmentCount, computeCohortDisplayStatus } from '@/lib/db/cohorts'
import { sendEmail } from '@/lib/email/sender'
import { rateLimit } from '@/lib/rate-limit'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// joinWaitlistAction — Public: no auth required
// Validates fields, checks cohort eligibility, inserts waitlist entry
// -----------------------------------------------------------------------------
export async function joinWaitlistAction(
  formData: FormData,
): Promise<ApiResponse<null>> {
  // Rate limit: 10 join attempts per IP per hour
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = rateLimit(`join-waitlist:${ip}`, 10, 60 * 60 * 1000)
  if (!allowed) {
    return { success: false, error: 'Too many requests. Please try again later.' }
  }

  const cohortId = (formData.get('cohort_id') as string | null)?.trim() ?? ''
  const studentName = (formData.get('student_name') as string | null)?.trim() ?? ''
  const studentPhone = (formData.get('student_phone') as string | null)?.trim() ?? ''
  const studentEmail = (formData.get('student_email') as string | null)?.trim().toLowerCase() ?? ''
  const studentId = (formData.get('student_id') as string | null)?.trim() || undefined

  // --- Validation ---
  if (!cohortId) {
    return { success: false, error: 'Cohort is required.' }
  }
  if (!studentName || studentName.length < 2) {
    return { success: false, error: 'Name must be at least 2 characters.' }
  }
  if (!studentPhone) {
    return { success: false, error: 'Phone number is required.' }
  }
  if (!studentEmail || !studentEmail.includes('@')) {
    return { success: false, error: 'A valid email address is required.' }
  }

  // --- Check cohort exists and has waitlist enabled ---
  const cohort = await getCohortById(cohortId)
  if (!cohort) {
    return { success: false, error: 'Cohort not found.' }
  }

  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort has been archived.',
      code: 'COHORT_ARCHIVED',
    }
  }

  if (!cohort.waitlist_enabled) {
    return { success: false, error: 'Waitlist is not enabled for this cohort.' }
  }

  // Verify the cohort is actually full (waitlist only makes sense when full)
  const enrollmentCount = await getActiveEnrollmentCount(cohortId)
  const displayStatus = computeCohortDisplayStatus(cohort, enrollmentCount)

  if (displayStatus !== 'full' && displayStatus !== 'closed') {
    return {
      success: false,
      error: 'This cohort still has open spots. You can enroll directly.',
    }
  }

  // --- Check for existing waitlist entry ---
  const existing = await getWaitlistEntry(cohortId, studentEmail)
  if (existing) {
    if (existing.status === 'waiting') {
      return {
        success: false,
        error: 'You are already on the waitlist for this cohort.',
      }
    }
    // If removed or expired, they can re-join — but the UNIQUE constraint
    // will block a duplicate insert. We need to update instead.
    // For simplicity, return a user-friendly message.
    return {
      success: false,
      error: 'You have a previous waitlist entry for this cohort. Please contact the teacher.',
    }
  }

  // --- Insert waitlist entry ---
  const entry = await joinWaitlist({
    cohortId,
    studentName,
    studentPhone,
    studentEmail,
    studentId,
  })

  if (!entry) {
    return {
      success: false,
      error: 'Failed to join waitlist. You may already be on the list.',
    }
  }

  // --- Send waitlist confirmation email ---
  await sendEmail({
    to: studentEmail,
    type: 'waitlist_joined',
    recipientId: entry.id,
    recipientType: 'student',
    data: {
      studentName,
      cohortName: cohort.name,
    },
  })

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// leaveWaitlistAction — Public: by email
// Removes a student from the waitlist
// -----------------------------------------------------------------------------
export async function leaveWaitlistAction(
  formData: FormData,
): Promise<ApiResponse<null>> {
  const cohortId = (formData.get('cohort_id') as string | null)?.trim() ?? ''
  const studentEmail = (formData.get('student_email') as string | null)?.trim().toLowerCase() ?? ''

  if (!cohortId) {
    return { success: false, error: 'Cohort is required.' }
  }
  if (!studentEmail || !studentEmail.includes('@')) {
    return { success: false, error: 'A valid email address is required.' }
  }

  const success = await leaveWaitlist(cohortId, studentEmail)

  if (!success) {
    return { success: false, error: 'Failed to leave waitlist.' }
  }

  return { success: true, data: null }
}
