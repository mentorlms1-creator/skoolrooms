'use server'

// =============================================================================
// lib/actions/student-payments.ts — Server actions for student payment operations
// =============================================================================

import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getStudentByAuthId, getStudentById } from '@/lib/db/students'
import { getEnrollmentById, generateReferenceCode } from '@/lib/db/enrollments'
import {
  getPaymentsByEnrollment,
  getPaymentById,
  getPaymentByEnrollmentAndMonth,
  createPayment,
  updatePaymentStatus,
  PAYMENT_ALREADY_EXISTS,
  type StudentPaymentRow,
} from '@/lib/db/student-payments'
import { getCohortById } from '@/lib/db/cohorts'
import { sendEmail } from '@/lib/email/sender'
import { monthlyBillingSchedule } from '@/lib/time/pkt'
import type { ApiResponse } from '@/types/api'
import { PaymentStatus, PaymentMethod } from '@/types/domain'
import type { TeacherRow } from '@/lib/db/teachers'

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
  return getTeacherByAuthId(user.id)
}

async function getTeacherTransactionCutPercent(teacherPlanSlug: string): Promise<number | null> {
  const supabase = createAdminClient()
  const { data: plan, error } = await supabase
    .from('plans')
    .select('transaction_cut_percent')
    .eq('slug', teacherPlanSlug)
    .single()
  if (error || !plan) return null
  return Number((plan as { transaction_cut_percent: number }).transaction_cut_percent)
}

// Shared core: calculate cut, update payment to confirmed, credit teacher balance.
// Extracted from approveEnrollmentAction so monthly payments can reuse the same logic.
export async function confirmPaymentAndCreditBalance(
  payment: StudentPaymentRow,
  teacher: TeacherRow,
  _cohort: { id: string },
): Promise<{ success: false; error: string } | { success: true }> {
  const cutPercent = await getTeacherTransactionCutPercent(teacher.plan)
  if (cutPercent === null) {
    return { success: false, error: 'Failed to determine plan details. Please try again.' }
  }

  const platformCutPkr = Math.round(payment.discounted_amount_pkr * (cutPercent / 100))
  const teacherPayoutAmountPkr = payment.discounted_amount_pkr - platformCutPkr

  const updatedPayment = await updatePaymentStatus(payment.id, PaymentStatus.CONFIRMED, {
    verified_at: new Date().toISOString(),
    platform_cut_pkr: platformCutPkr,
    teacher_payout_amount_pkr: teacherPayoutAmountPkr,
  })
  if (!updatedPayment) {
    return { success: false, error: 'Failed to update payment. Please try again.' }
  }

  if (teacherPayoutAmountPkr > 0) {
    const supabaseAdmin = createAdminClient()

    // Read debit before credit to detect if debit recovery happens
    const { data: balanceBefore } = await supabaseAdmin
      .from('teacher_balances')
      .select('outstanding_debit_pkr')
      .eq('teacher_id', teacher.id)
      .single()

    const debitBefore = (balanceBefore as { outstanding_debit_pkr: number } | null)
      ?.outstanding_debit_pkr ?? 0

    await supabaseAdmin.rpc('credit_teacher_balance', {
      p_teacher_id: teacher.id,
      p_amount: teacherPayoutAmountPkr,
      p_deduct_outstanding: true,
    })

    // If debit was > 0 before, check if it hit 0 now → send refund_debit_recovered
    if (debitBefore > 0) {
      const { data: balanceAfter } = await supabaseAdmin
        .from('teacher_balances')
        .select('outstanding_debit_pkr')
        .eq('teacher_id', teacher.id)
        .single()

      const debitAfter = (balanceAfter as { outstanding_debit_pkr: number } | null)
        ?.outstanding_debit_pkr ?? debitBefore

      if (debitAfter === 0) {
        const { data: teacherRow } = await supabaseAdmin
          .from('teachers')
          .select('email, name')
          .eq('id', teacher.id)
          .single()

        if (teacherRow) {
          await sendEmail({
            to: (teacherRow as { email: string; name: string }).email,
            type: 'refund_debit_recovered',
            recipientId: teacher.id,
            recipientType: 'teacher',
            data: {
              teacherName: (teacherRow as { name: string }).name,
              recoveredAmountPkr: debitBefore,
            },
          })
        }
      }
    }
  }

  return { success: true }
}

// -----------------------------------------------------------------------------
// submitScreenshotAction — Student uploads a payment screenshot
// Updates the student_payments row with the screenshot URL.
// Sends enrollment_pending email to the teacher.
// Optional 3rd param `paymentId` targets a specific payment row (used for
// monthly re-uploads where the latest may not be the right one).
// -----------------------------------------------------------------------------

export async function submitScreenshotAction(
  enrollmentId: string,
  screenshotUrl: string,
  paymentId?: string,
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

  // 4. Resolve target payment.
  // For initial enrollment uploads we expect status='pending'. For monthly
  // re-uploads (where the enrollment is already 'active'), the caller passes
  // an explicit paymentId so we don't reject based on enrollment status.
  let payment: StudentPaymentRow | null
  if (paymentId) {
    payment = await getPaymentById(paymentId)
    if (!payment || payment.enrollment_id !== enrollmentId) {
      return { success: false, error: 'Payment record not found.' }
    }
  } else {
    // Initial-enrollment path — enrollment must still be pending
    if (enrollment.status !== 'pending') {
      return { success: false, error: 'This enrollment is not pending payment.' }
    }
    const payments = await getPaymentsByEnrollment(enrollmentId)
    payment = payments[0] ?? null
    if (!payment) {
      return { success: false, error: 'Payment record not found.' }
    }
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

// -----------------------------------------------------------------------------
// createNextMonthPaymentAction — Student initiates payment for a future month
// of a monthly cohort. Idempotent: if a payment row for the same
// (enrollment_id, payment_month) already exists, return its id (or reset a
// rejected one back to pending_verification).
// -----------------------------------------------------------------------------

export async function createNextMonthPaymentAction(
  enrollmentId: string,
  paymentMonth: string,
): Promise<ApiResponse<{ paymentId: string }>> {
  // 1. Auth — must be a student
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in.' }
  }

  const student = await getStudentByAuthId(user.id)
  if (!student) {
    return { success: false, error: 'Student profile not found.' }
  }

  // 2. Validate paymentMonth shape: 'YYYY-MM-01'
  if (!/^\d{4}-\d{2}-01$/.test(paymentMonth)) {
    return { success: false, error: 'Invalid payment month.' }
  }

  // 3. Fetch enrollment, verify ownership
  const enrollment = await getEnrollmentById(enrollmentId)
  if (!enrollment || enrollment.student_id !== student.id) {
    return { success: false, error: 'Enrollment not found.' }
  }

  // 4. Fetch cohort + validate
  const cohort = await getCohortById(enrollment.cohort_id)
  if (!cohort) {
    return { success: false, error: 'Cohort not found.' }
  }

  if (cohort.fee_type !== 'monthly') {
    return { success: false, error: 'This cohort is not monthly.' }
  }

  if (cohort.status === 'archived') {
    return { success: false, error: 'This cohort has been archived.' }
  }

  const schedule = monthlyBillingSchedule(cohort.start_date, cohort.end_date)
  if (!schedule.includes(paymentMonth)) {
    return { success: false, error: 'This month is not part of the cohort billing schedule.' }
  }

  // 5. Check for existing payment row for this month
  const existing = await getPaymentByEnrollmentAndMonth(enrollmentId, paymentMonth)

  if (existing) {
    if (existing.status === PaymentStatus.CONFIRMED) {
      return { success: false, error: 'This month is already paid.' }
    }
    if (existing.status === PaymentStatus.PENDING_VERIFICATION) {
      // Idempotent — caller will redirect to the same payment page
      return { success: true, data: { paymentId: existing.id } }
    }
    if (existing.status === PaymentStatus.REJECTED) {
      // Reset rejected payment to pending_verification, clear screenshot + reason
      const reset = await updatePaymentStatus(
        existing.id,
        PaymentStatus.PENDING_VERIFICATION,
        {
          screenshot_url: null,
          rejection_reason: null,
        },
      )
      if (!reset) {
        return { success: false, error: 'Failed to reset payment. Please try again.' }
      }
      return { success: true, data: { paymentId: existing.id } }
    }
    // refunded or unknown — block
    return { success: false, error: 'A payment for this month already exists.' }
  }

  // 6. No existing payment — create one
  const referenceCode = await generateReferenceCode()
  const idempotencyKey = `monthly-${enrollmentId}-${paymentMonth}`

  const newRow = await createPayment({
    enrollmentId,
    amountPkr: cohort.fee_pkr,
    discountedAmountPkr: cohort.fee_pkr,
    platformCutPkr: 0,
    teacherPayoutAmountPkr: 0,
    paymentMethod: PaymentMethod.SCREENSHOT,
    referenceCode,
    idempotencyKey,
    status: PaymentStatus.PENDING_VERIFICATION,
    paymentMonth,
  })

  if (newRow === PAYMENT_ALREADY_EXISTS) {
    // Concurrent insert won the race — fetch and return the existing row
    const raced = await getPaymentByEnrollmentAndMonth(enrollmentId, paymentMonth)
    if (raced) return { success: true, data: { paymentId: raced.id } }
    return { success: false, error: 'Failed to retrieve existing payment. Please try again.' }
  }

  if (!newRow) {
    return { success: false, error: 'Failed to create payment. Please try again.' }
  }

  return { success: true, data: { paymentId: newRow.id } }
}

// -----------------------------------------------------------------------------
// approveMonthlyPaymentAction — Teacher approves a monthly payment screenshot
// Auth: teacher. Verifies cohort ownership. Calls confirmPaymentAndCreditBalance.
// Sends enrollment_confirmed email to student with paymentMonth context.
// -----------------------------------------------------------------------------

export async function approveMonthlyPaymentAction(
  paymentId: string,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const payment = await getPaymentById(paymentId)
  if (!payment) return { success: false, error: 'Payment not found.' }

  if (payment.status !== PaymentStatus.PENDING_VERIFICATION) {
    return { success: false, error: 'Payment is not pending verification.' }
  }
  if (!payment.screenshot_url) {
    return { success: false, error: 'No screenshot uploaded for this payment.' }
  }
  if (payment.payment_method === 'manual') {
    return { success: false, error: 'Manual payments cannot be approved here.' }
  }

  const enrollment = await getEnrollmentById(payment.enrollment_id)
  if (!enrollment) return { success: false, error: 'Enrollment not found.' }

  const cohort = await getCohortById(enrollment.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Payment not found.' }
  }

  const result = await confirmPaymentAndCreditBalance(payment, teacher, cohort)
  if (!result.success) return result

  const student = await getStudentById(enrollment.student_id)
  if (student) {
    await sendEmail({
      to: student.email,
      type: 'enrollment_confirmed',
      recipientId: student.id,
      recipientType: 'student',
      data: {
        studentName: student.name,
        teacherName: teacher.name,
        cohortName: cohort.name,
        referenceCode: enrollment.reference_code,
        paymentMonth: payment.payment_month ?? undefined,
      },
    })
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// rejectMonthlyPaymentAction — Teacher rejects a monthly payment screenshot
// Auth: teacher. Verifies cohort ownership. Marks payment rejected + reason.
// Sends enrollment_rejected email to student with paymentMonth context.
// -----------------------------------------------------------------------------

export async function rejectMonthlyPaymentAction(
  paymentId: string,
  reason: string,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const payment = await getPaymentById(paymentId)
  if (!payment) return { success: false, error: 'Payment not found.' }

  if (payment.status !== PaymentStatus.PENDING_VERIFICATION) {
    return { success: false, error: 'Payment is not pending verification.' }
  }

  const enrollment = await getEnrollmentById(payment.enrollment_id)
  if (!enrollment) return { success: false, error: 'Enrollment not found.' }

  const cohort = await getCohortById(enrollment.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Payment not found.' }
  }

  const updated = await updatePaymentStatus(payment.id, PaymentStatus.REJECTED, {
    rejection_reason: reason.trim() || 'No reason provided',
  })
  if (!updated) return { success: false, error: 'Failed to reject payment. Please try again.' }

  const student = await getStudentById(enrollment.student_id)
  if (student) {
    await sendEmail({
      to: student.email,
      type: 'enrollment_rejected',
      recipientId: student.id,
      recipientType: 'student',
      data: {
        studentName: student.name,
        teacherName: teacher.name,
        cohortName: cohort.name,
        reason: reason.trim() || 'No reason provided',
        paymentMonth: payment.payment_month ?? undefined,
      },
    })
  }

  return { success: true, data: null }
}
