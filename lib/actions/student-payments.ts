'use server'

// =============================================================================
// lib/actions/student-payments.ts — Server actions for student payment operations
// =============================================================================

import { createClient, createAdminClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { getEnrollmentById } from '@/lib/db/enrollments'
import { getPaymentsByEnrollment, updatePaymentStatus } from '@/lib/db/student-payments'
import { getCohortById } from '@/lib/db/cohorts'
import { sendEmail } from '@/lib/email/sender'
import type { ApiResponse } from '@/types/api'
import { PaymentStatus } from '@/types/domain'

// -----------------------------------------------------------------------------
// submitScreenshotAction — Student uploads a payment screenshot
// Updates the student_payments row with the screenshot URL.
// Sends enrollment_pending email to the teacher.
// -----------------------------------------------------------------------------

export async function submitScreenshotAction(
  enrollmentId: string,
  screenshotUrl: string,
): Promise<ApiResponse<null>> {
  // 1. Auth check — must be a student
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in to submit a payment screenshot.' }
  }

  const student = await getStudentByAuthId(user.id)
  if (!student) {
    return { success: false, error: 'Student profile not found.' }
  }

  // 2. Validate screenshot URL: must be hosted on our R2 bucket.
  // Without this check a student could submit any https:// URL as their proof.
  const r2PublicPrefix = process.env.CLOUDFLARE_R2_PUBLIC_URL
  if (
    !screenshotUrl ||
    !r2PublicPrefix ||
    !screenshotUrl.startsWith(`${r2PublicPrefix}/screenshots/`)
  ) {
    return { success: false, error: 'Invalid screenshot URL.' }
  }

  // 3. Fetch enrollment and verify it belongs to this student
  const enrollment = await getEnrollmentById(enrollmentId)
  if (!enrollment) {
    return { success: false, error: 'Enrollment not found.' }
  }

  if (enrollment.student_id !== student.id) {
    return { success: false, error: 'Enrollment not found.' }
  }

  // 4. Enrollment must be in pending status
  if (enrollment.status !== 'pending') {
    return { success: false, error: 'This enrollment is not pending payment.' }
  }

  // 5. Get the most recent payment for this enrollment
  const payments = await getPaymentsByEnrollment(enrollmentId)
  const payment = payments[0]

  if (!payment) {
    return { success: false, error: 'Payment record not found.' }
  }

  // Payment must be pending_verification or rejected (allow re-upload on rejection)
  if (
    payment.status !== PaymentStatus.PENDING_VERIFICATION &&
    payment.status !== PaymentStatus.REJECTED
  ) {
    return { success: false, error: 'Payment is not awaiting a screenshot.' }
  }

  // 6. Update payment record with screenshot URL and reset to pending_verification
  const updatedPayment = await updatePaymentStatus(
    payment.id,
    PaymentStatus.PENDING_VERIFICATION,
    {
      screenshot_url: screenshotUrl,
      rejection_reason: null, // Clear any previous rejection reason on re-upload
    },
  )

  if (!updatedPayment) {
    return { success: false, error: 'Failed to save screenshot. Please try again.' }
  }

  // 7. Send enrollment_pending email to the teacher
  const cohort = await getCohortById(enrollment.cohort_id)
  if (cohort) {
    // Fetch teacher info via admin client (teacher_id is on cohort)
    const adminSupabase = createAdminClient()

    const { data: teacher } = await adminSupabase
      .from('teachers')
      .select('id, name, email')
      .eq('id', cohort.teacher_id)
      .single()

    if (teacher) {
      await sendEmail({
        to: teacher.email as string,
        type: 'enrollment_pending',
        recipientId: teacher.id as string,
        recipientType: 'teacher',
        data: {
          teacherName: teacher.name as string,
          studentName: student.name,
          cohortName: cohort.name,
          referenceCode: enrollment.reference_code,
          amountPkr: payment.discounted_amount_pkr,
        },
      })
    }
  }

  return { success: true, data: null }
}
