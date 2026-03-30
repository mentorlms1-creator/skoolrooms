'use server'

// =============================================================================
// lib/actions/enrollments.ts — Server actions for enrollment + payment approval
// =============================================================================

import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import {
  getEnrollmentById,
  updateEnrollmentStatus,
  generateReferenceCode,
  checkExistingEnrollment,
} from '@/lib/db/enrollments'
import {
  getPaymentsByEnrollment,
  updatePaymentStatus,
  createPayment,
} from '@/lib/db/student-payments'
import { getCohortById } from '@/lib/db/cohorts'
import { getStudentById, getStudentByEmail, createStudent } from '@/lib/db/students'
import { sendEmail } from '@/lib/email/sender'
import type { ApiResponse } from '@/types/api'
import type { EnrollmentStatus, PaymentMethod, PaymentStatus } from '@/types/domain'

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

/**
 * Fetches the teacher's plan transaction_cut_percent from the plans table.
 * Returns the cut percent (e.g. 5.00 for 5%) or null if not found.
 */
async function getTeacherTransactionCutPercent(
  teacherPlanSlug: string
): Promise<number | null> {
  const supabase = createAdminClient()

  const { data: plan, error } = await supabase
    .from('plans')
    .select('transaction_cut_percent')
    .eq('slug', teacherPlanSlug)
    .single()

  if (error || !plan) return null
  return Number(plan.transaction_cut_percent)
}

// -----------------------------------------------------------------------------
// approveEnrollmentAction — Teacher approves a pending enrollment
// Calculates platform cut, credits teacher balance, sends emails
// -----------------------------------------------------------------------------

export async function approveEnrollmentAction(
  enrollmentId: string
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch enrollment
  const enrollment = await getEnrollmentById(enrollmentId)
  if (!enrollment) {
    return { success: false, error: 'Enrollment not found' }
  }

  // Verify ownership: enrollment's cohort must belong to this teacher
  const cohort = await getCohortById(enrollment.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Enrollment not found' }
  }

  // Archived cohort guard
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort has been archived. No changes can be made.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // Enrollment must be pending
  if (enrollment.status !== 'pending') {
    return {
      success: false,
      error: 'This enrollment is not pending approval.',
    }
  }

  // Get the payment for this enrollment (most recent first)
  const payments = await getPaymentsByEnrollment(enrollment.id)
  const payment = payments[0]
  if (!payment) {
    return { success: false, error: 'Payment record not found for this enrollment.' }
  }

  // Get teacher's plan to calculate platform cut
  const cutPercent = await getTeacherTransactionCutPercent(teacher.plan)
  if (cutPercent === null) {
    return { success: false, error: 'Failed to determine plan details. Please try again.' }
  }

  const platformCutPkr = Math.round(
    payment.discounted_amount_pkr * (cutPercent / 100)
  )
  const teacherPayoutAmountPkr = payment.discounted_amount_pkr - platformCutPkr

  // Update payment: confirmed with platform cut, payout amounts, and verified_at
  const updatedPayment = await updatePaymentStatus(payment.id, 'confirmed' satisfies PaymentStatus, {
    verified_at: new Date().toISOString(),
    platform_cut_pkr: platformCutPkr,
    teacher_payout_amount_pkr: teacherPayoutAmountPkr,
  })
  if (!updatedPayment) {
    return { success: false, error: 'Failed to update payment. Please try again.' }
  }

  const supabaseAdmin = createAdminClient()

  // Update enrollment status to active
  const updatedEnrollment = await updateEnrollmentStatus(
    enrollmentId,
    'active' satisfies EnrollmentStatus
  )
  if (!updatedEnrollment) {
    return { success: false, error: 'Failed to activate enrollment. Please try again.' }
  }

  // Credit teacher balance via Supabase RPC (screenshot payments credit balance)
  if (teacherPayoutAmountPkr > 0) {
    await supabaseAdmin.rpc('credit_teacher_balance', {
      p_teacher_id: teacher.id,
      p_amount: teacherPayoutAmountPkr,
      p_deduct_outstanding: true,
    })
  }

  // Get student info for emails
  const student = await getStudentById(enrollment.student_id)

  // Send enrollment_confirmed email to student
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
      },
    })
  }

  // Send new_enrollment_notification email to teacher (informational)
  await sendEmail({
    to: teacher.email,
    type: 'new_enrollment_notification',
    recipientId: teacher.id,
    recipientType: 'teacher',
    data: {
      teacherName: teacher.name,
      studentName: student?.name ?? 'A student',
      cohortName: cohort.name,
      amountPkr: payment.discounted_amount_pkr,
    },
  })

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// rejectEnrollmentAction — Teacher rejects a pending enrollment
// Updates enrollment + payment status, sends rejection email
// -----------------------------------------------------------------------------

export async function rejectEnrollmentAction(
  enrollmentId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch enrollment
  const enrollment = await getEnrollmentById(enrollmentId)
  if (!enrollment) {
    return { success: false, error: 'Enrollment not found' }
  }

  // Verify ownership
  const cohort = await getCohortById(enrollment.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Enrollment not found' }
  }

  // Archived cohort guard
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort has been archived. No changes can be made.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // Enrollment must be pending
  if (enrollment.status !== 'pending') {
    return {
      success: false,
      error: 'This enrollment is not pending approval.',
    }
  }

  const reason = (formData.get('reason') as string | null)?.trim() ?? ''

  // Update enrollment status to rejected
  const updatedEnrollment = await updateEnrollmentStatus(
    enrollmentId,
    'rejected' satisfies EnrollmentStatus
  )
  if (!updatedEnrollment) {
    return { success: false, error: 'Failed to reject enrollment. Please try again.' }
  }

  // Update payment status to rejected with reason
  const payments = await getPaymentsByEnrollment(enrollment.id)
  const payment = payments[0]
  if (payment) {
    await updatePaymentStatus(payment.id, 'rejected' satisfies PaymentStatus, {
      rejection_reason: reason || undefined,
    })
  }

  // Send enrollment_rejected email to student
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
        reason: reason || 'No reason provided',
      },
    })
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// manualEnrollAction — Teacher manually enrolls a student
// Creates student if needed, creates enrollment as 'active' immediately,
// creates payment with platform_cut_pkr=0 (cash went directly to teacher)
// Does NOT credit teacher_balances
// -----------------------------------------------------------------------------

export async function manualEnrollAction(
  formData: FormData
): Promise<ApiResponse<{ enrollmentId: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  const cohortId = (formData.get('cohort_id') as string | null)?.trim() ?? ''
  const studentId = (formData.get('student_id') as string | null)?.trim() ?? ''
  const amountPkrRaw = formData.get('amount_pkr') as string | null
  const note = (formData.get('note') as string | null)?.trim() ?? ''

  // New student fields (used when studentId is not provided)
  const studentName = (formData.get('student_name') as string | null)?.trim() ?? ''
  const studentEmail = (formData.get('student_email') as string | null)?.trim() ?? ''
  const studentPhone = (formData.get('student_phone') as string | null)?.trim() ?? ''

  // --- Validation ---
  if (!cohortId) {
    return { success: false, error: 'Cohort is required.' }
  }

  const amountPkr = amountPkrRaw ? parseInt(amountPkrRaw, 10) : 0
  if (isNaN(amountPkr) || amountPkr < 0) {
    return { success: false, error: 'Amount must be a valid positive number.' }
  }

  // Verify cohort ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Cohort not found' }
  }

  // Archived cohort guard
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort has been archived. No changes can be made.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // Resolve or create student
  let resolvedStudentId = studentId

  if (!resolvedStudentId) {
    // Creating a new student — validate fields
    if (!studentName || studentName.length < 2) {
      return { success: false, error: 'Student name must be at least 2 characters.' }
    }
    if (!studentEmail || !studentEmail.includes('@')) {
      return { success: false, error: 'A valid student email is required.' }
    }
    if (!studentPhone) {
      return { success: false, error: 'Student phone number is required.' }
    }

    // Check if student with this email already exists
    const existingStudent = await getStudentByEmail(studentEmail)
    if (existingStudent) {
      resolvedStudentId = existingStudent.id
    } else {
      // Create Supabase auth account for the student with a temp password
      const supabaseAdmin = createAdminClient()
      const tempPassword = crypto.randomUUID().slice(0, 12)

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: studentEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { role: 'student', name: studentName },
        })

      if (authError || !authData.user) {
        return {
          success: false,
          error: 'Failed to create student account. The email may already be in use.',
        }
      }

      // Create student record in students table
      const newStudent = await createStudent({
        supabaseAuthId: authData.user.id,
        name: studentName,
        email: studentEmail,
        phone: studentPhone,
      })

      if (!newStudent) {
        return { success: false, error: 'Failed to create student record. Please try again.' }
      }

      resolvedStudentId = newStudent.id
    }
  } else {
    // Verify existing student exists
    const existingStudent = await getStudentById(resolvedStudentId)
    if (!existingStudent) {
      return { success: false, error: 'Student not found.' }
    }
  }

  // Check for duplicate enrollment
  const existingEnrollment = await checkExistingEnrollment(resolvedStudentId, cohortId)
  if (existingEnrollment) {
    return {
      success: false,
      error: 'This student is already enrolled in this cohort.',
    }
  }

  // Generate reference code
  const referenceCode = await generateReferenceCode()

  // Create enrollment with status='active' (skip pending for manual enrollments)
  const supabaseAdmin = createAdminClient()
  const { data: enrollmentData, error: enrollmentError } = await supabaseAdmin
    .from('enrollments')
    .insert({
      student_id: resolvedStudentId,
      cohort_id: cohortId,
      reference_code: referenceCode,
      status: 'active' satisfies EnrollmentStatus,
    })
    .select('*')
    .single()

  if (enrollmentError || !enrollmentData) {
    return { success: false, error: 'Failed to create enrollment. Please try again.' }
  }

  const enrollmentId = enrollmentData.id as string

  // Create payment with manual method — platform_cut_pkr=0, teacher_payout=0
  // Cash went directly to teacher outside the platform
  await createPayment({
    enrollmentId,
    amountPkr,
    discountedAmountPkr: amountPkr,
    platformCutPkr: 0,
    teacherPayoutAmountPkr: 0,
    paymentMethod: 'manual' satisfies PaymentMethod,
    referenceCode,
    status: 'confirmed' satisfies PaymentStatus,
    idempotencyKey: `manual-${enrollmentId}-${Date.now()}`,
  })

  // Do NOT credit teacher_balances — cash went directly to teacher

  // Send enrollment_confirmed email to student
  const student = await getStudentById(resolvedStudentId)
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
        referenceCode,
        note: note || undefined,
      },
    })
  }

  return { success: true, data: { enrollmentId } }
}

// -----------------------------------------------------------------------------
// createAndEnrollAction — Teacher creates a new student and enrolls them
// This is a convenience alias for manualEnrollAction with new student fields.
// Keeping it separate for API clarity at the call site.
// -----------------------------------------------------------------------------

export async function createAndEnrollAction(
  formData: FormData
): Promise<ApiResponse<{ studentId: string; enrollmentId: string }>> {
  // Validate that new student fields are provided
  const studentName = (formData.get('student_name') as string | null)?.trim() ?? ''
  const studentEmail = (formData.get('student_email') as string | null)?.trim() ?? ''
  const studentPhone = (formData.get('student_phone') as string | null)?.trim() ?? ''

  if (!studentName || studentName.length < 2) {
    return { success: false, error: 'Student name must be at least 2 characters.' }
  }
  if (!studentEmail || !studentEmail.includes('@')) {
    return { success: false, error: 'A valid student email is required.' }
  }
  if (!studentPhone) {
    return { success: false, error: 'Student phone number is required.' }
  }

  // Ensure student_id is cleared (force new student creation path)
  const enrichedFormData = new FormData()
  // Copy all fields from original formData
  for (const [key, value] of formData.entries()) {
    if (key !== 'student_id') {
      enrichedFormData.append(key, value)
    }
  }

  // Call manualEnrollAction which handles both existing and new students
  const result = await manualEnrollAction(enrichedFormData)

  if (!result.success) {
    return result
  }

  // Resolve the student ID for the response
  const existingStudent = await getStudentByEmail(studentEmail)
  const resolvedStudentId = existingStudent?.id ?? ''

  return {
    success: true,
    data: {
      studentId: resolvedStudentId,
      enrollmentId: result.data.enrollmentId,
    },
  }
}
