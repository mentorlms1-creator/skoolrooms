'use server'

// =============================================================================
// lib/actions/enrollment-management.ts — Server actions for enrollment
// revocation, withdrawal, and refund management
// =============================================================================

import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getStudentByAuthId, getStudentById } from '@/lib/db/students'
import {
  getEnrollmentById,
  updateEnrollmentStatus,
} from '@/lib/db/enrollments'
import {
  getPaymentsByEnrollment,
  getPaymentById,
  updatePaymentStatus,
} from '@/lib/db/student-payments'
import { getCohortById } from '@/lib/db/cohorts'
import { sendEmail } from '@/lib/email/sender'
import type { ApiResponse } from '@/types/api'
import type { EnrollmentStatus } from '@/types/domain'

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

async function getAuthenticatedStudent() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const student = await getStudentByAuthId(user.id)
  return student
}

// =============================================================================
// REVOCATION — Teacher revokes a student's enrollment
// =============================================================================

// -----------------------------------------------------------------------------
// revokeEnrollmentAction — Teacher revokes an active enrollment
// Guards: auth (teacher), cohort ownership, reason required
// Sets status='revoked', revoked_at=now, revoke_reason
// Sends enrollment_revoked email to student
// -----------------------------------------------------------------------------

export async function revokeEnrollmentAction(
  enrollmentId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  const reason = (formData.get('reason') as string | null)?.trim() ?? ''
  if (!reason) {
    return { success: false, error: 'A reason for revocation is required.' }
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

  // Archived cohort guard (CLAUDE.md rule #21 — content-write blocked on archived)
  if (cohort.status === 'archived') {
    return {
      success: false,
      error: 'This cohort has been archived. No changes can be made.',
      code: 'COHORT_ARCHIVED',
    }
  }

  // Enrollment must be active to revoke
  if (enrollment.status !== 'active') {
    return {
      success: false,
      error: 'Only active enrollments can be revoked.',
    }
  }

  // Update enrollment: status='revoked', revoked_at=now, revoke_reason
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('enrollments')
    .update({
      status: 'revoked' satisfies EnrollmentStatus,
      revoked_at: now,
      revoke_reason: reason,
      updated_at: now,
    })
    .eq('id', enrollmentId)
    .select('*')
    .single()

  if (updateError || !updated) {
    return { success: false, error: 'Failed to revoke enrollment. Please try again.' }
  }

  // Send enrollment_revoked email to student
  const student = await getStudentById(enrollment.student_id)
  if (student) {
    await sendEmail({
      to: student.email,
      type: 'enrollment_revoked',
      recipientId: student.id,
      recipientType: 'student',
      data: {
        studentName: student.name,
        teacherName: teacher.name,
        cohortName: cohort.name,
        reason,
      },
    })
  }

  return { success: true, data: null }
}

// =============================================================================
// WITHDRAWAL — Student requests, teacher approves/rejects
// =============================================================================

// -----------------------------------------------------------------------------
// requestWithdrawalAction — Student requests withdrawal from a cohort
// Guards: auth (student), enrollment is theirs, enrollment is active
// Sets withdrawal_requested_at=now, withdrawal_reason
// Sends student_withdrawal_requested email to teacher
// -----------------------------------------------------------------------------

export async function requestWithdrawalAction(
  enrollmentId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const student = await getAuthenticatedStudent()
  if (!student) {
    return { success: false, error: 'Not authenticated' }
  }

  const reason = (formData.get('reason') as string | null)?.trim() ?? ''

  // Fetch enrollment and verify it belongs to this student
  const enrollment = await getEnrollmentById(enrollmentId)
  if (!enrollment || enrollment.student_id !== student.id) {
    return { success: false, error: 'Enrollment not found' }
  }

  // Enrollment must be active
  if (enrollment.status !== 'active') {
    return {
      success: false,
      error: 'Only active enrollments can be withdrawn from.',
    }
  }

  // Check if withdrawal already requested
  if (enrollment.withdrawal_requested_at) {
    return {
      success: false,
      error: 'A withdrawal request is already pending for this enrollment.',
    }
  }

  // Update enrollment: set withdrawal_requested_at + withdrawal_reason
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()

  const { error: updateError } = await supabaseAdmin
    .from('enrollments')
    .update({
      withdrawal_requested_at: now,
      withdrawal_reason: reason || null,
      updated_at: now,
    })
    .eq('id', enrollmentId)

  if (updateError) {
    return { success: false, error: 'Failed to request withdrawal. Please try again.' }
  }

  // Get cohort + teacher info for email
  const cohort = await getCohortById(enrollment.cohort_id)
  if (cohort) {
    const supabase = createAdminClient()
    const { data: teacherData } = await supabase
      .from('teachers')
      .select('id, name, email')
      .eq('id', cohort.teacher_id)
      .single()

    if (teacherData) {
      const teacherInfo = teacherData as { id: string; name: string; email: string }
      await sendEmail({
        to: teacherInfo.email,
        type: 'student_withdrawal_requested',
        recipientId: teacherInfo.id,
        recipientType: 'teacher',
        data: {
          teacherName: teacherInfo.name,
          studentName: student.name,
          cohortName: cohort.name,
          reason: reason || 'No reason provided',
        },
      })
    }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// approveWithdrawalAction — Teacher approves a student's withdrawal request
// Guards: auth (teacher), cohort ownership, withdrawal_requested_at must be set
// Sets status='withdrawn'
// Sends withdrawal_approved email to student
// -----------------------------------------------------------------------------

export async function approveWithdrawalAction(
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

  // Verify ownership
  const cohort = await getCohortById(enrollment.cohort_id)
  if (!cohort || cohort.teacher_id !== teacher.id) {
    return { success: false, error: 'Enrollment not found' }
  }

  // Verify withdrawal was requested
  if (!enrollment.withdrawal_requested_at) {
    return {
      success: false,
      error: 'No withdrawal request found for this enrollment.',
    }
  }

  // Update enrollment status to withdrawn
  const updatedEnrollment = await updateEnrollmentStatus(
    enrollmentId,
    'withdrawn' satisfies EnrollmentStatus
  )
  if (!updatedEnrollment) {
    return { success: false, error: 'Failed to approve withdrawal. Please try again.' }
  }

  // Send withdrawal_approved email to student
  const student = await getStudentById(enrollment.student_id)
  if (student) {
    await sendEmail({
      to: student.email,
      type: 'withdrawal_approved',
      recipientId: student.id,
      recipientType: 'student',
      data: {
        studentName: student.name,
        teacherName: teacher.name,
        cohortName: cohort.name,
      },
    })
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// rejectWithdrawalAction — Teacher rejects a student's withdrawal request
// Guards: auth (teacher), cohort ownership, withdrawal_requested_at must be set
// Clears withdrawal_requested_at + withdrawal_reason
// Sends withdrawal_rejected email to student
// -----------------------------------------------------------------------------

export async function rejectWithdrawalAction(
  enrollmentId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  const note = (formData.get('note') as string | null)?.trim() ?? ''

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

  // Verify withdrawal was requested
  if (!enrollment.withdrawal_requested_at) {
    return {
      success: false,
      error: 'No withdrawal request found for this enrollment.',
    }
  }

  // Clear withdrawal request fields
  const supabaseAdmin = createAdminClient()
  const { error: updateError } = await supabaseAdmin
    .from('enrollments')
    .update({
      withdrawal_requested_at: null,
      withdrawal_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId)

  if (updateError) {
    return { success: false, error: 'Failed to reject withdrawal. Please try again.' }
  }

  // Send withdrawal_rejected email to student
  const student = await getStudentById(enrollment.student_id)
  if (student) {
    await sendEmail({
      to: student.email,
      type: 'withdrawal_rejected',
      recipientId: student.id,
      recipientType: 'student',
      data: {
        studentName: student.name,
        teacherName: teacher.name,
        cohortName: cohort.name,
        note: note || 'No additional notes provided',
      },
    })
  }

  return { success: true, data: null }
}

// =============================================================================
// REFUND — Teacher records a refund on a student payment
// =============================================================================

// -----------------------------------------------------------------------------
// recordRefundAction — Teacher records a refund for a payment
// Two modes:
//   1. In-app refund: available_balance >= teacher_payout_amount_pkr
//      Deducts from available_balance, sets payment status='refunded'
//   2. Offline refund: just records refund_note, sets refunded_at
// Guards: auth (teacher), cohort ownership, payment exists
// Refund amount = teacher_payout_amount_pkr (NOT full amount_pkr)
// -----------------------------------------------------------------------------

export async function recordRefundAction(
  enrollmentId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  const refundMode = (formData.get('refund_mode') as string | null)?.trim() ?? ''
  const refundNote = (formData.get('refund_note') as string | null)?.trim() ?? ''
  const explicitPaymentId = (formData.get('paymentId') as string | null)?.trim() ?? ''

  if (!refundMode || !['in_app', 'offline'].includes(refundMode)) {
    return { success: false, error: 'Invalid refund mode.' }
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

  // If a specific paymentId was provided (per-month refund), use it directly.
  // Otherwise fall back to the latest confirmed payment (legacy shortcut).
  let payment
  if (explicitPaymentId) {
    payment = await getPaymentById(explicitPaymentId)
    if (!payment || payment.enrollment_id !== enrollment.id) {
      return { success: false, error: 'Payment not found for this enrollment.' }
    }
    if (payment.status !== 'confirmed') {
      return { success: false, error: 'Only confirmed payments can be refunded.' }
    }
  } else {
    const payments = await getPaymentsByEnrollment(enrollment.id)
    payment = payments.find((p) => p.status === 'confirmed')
    if (!payment) {
      return { success: false, error: 'No confirmed payment found for this enrollment.' }
    }
  }

  // Already refunded guard
  if (payment.refunded_at) {
    return { success: false, error: 'This payment has already been refunded.' }
  }

  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()

  if (refundMode === 'in_app') {
    // In-app refund: deduct teacher_payout_amount_pkr from available_balance
    // Refund amount = teacher_payout_amount_pkr (not full amount_pkr)
    const refundAmount = payment.teacher_payout_amount_pkr

    // Atomic deduction: read current balance and deduct in one UPDATE
    // The .gte() guard ensures the update only succeeds if balance is sufficient,
    // preventing race conditions from concurrent refund requests.
    const { data: balanceData, error: balanceError } = await supabaseAdmin
      .from('teacher_balances')
      .select('available_balance_pkr')
      .eq('teacher_id', teacher.id)
      .single()

    if (balanceError || !balanceData) {
      return { success: false, error: 'Failed to check balance. Please try again.' }
    }

    const balance = balanceData as { available_balance_pkr: number }
    const newBalance = balance.available_balance_pkr - refundAmount

    const { data: updated, error: deductError } = await supabaseAdmin
      .from('teacher_balances')
      .update({
        available_balance_pkr: newBalance,
        updated_at: now,
      })
      .eq('teacher_id', teacher.id)
      .gte('available_balance_pkr', refundAmount)
      .select('id')

    if (deductError) {
      return { success: false, error: 'Failed to deduct balance. Please try again.' }
    }

    if (!updated || updated.length === 0) {
      return {
        success: false,
        error: 'Insufficient balance for in-app refund. The amount may have already been paid out. Use offline refund instead.',
      }
    }

    // Update payment status to refunded
    await updatePaymentStatus(payment.id, 'refunded', {
      refunded_at: now,
      refund_note: refundNote || 'In-app refund',
    })
  } else {
    // Offline refund: just record the refund note + timestamp
    if (!refundNote) {
      return { success: false, error: 'Refund note is required for offline refunds (e.g. "Rs. 3,500 returned via JazzCash").' }
    }

    await updatePaymentStatus(payment.id, 'refunded', {
      refunded_at: now,
      refund_note: refundNote,
    })
  }

  return { success: true, data: null }
}
