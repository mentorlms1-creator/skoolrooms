// =============================================================================
// lib/db/student-payments.ts — Student payment CRUD queries (service layer)
// All database queries for student payments go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { PaymentMethod, PaymentStatus } from '@/types/domain'

// -----------------------------------------------------------------------------
// Row types (mirrors the student_payments table from 001_initial_schema.sql)
// These will be replaced by auto-generated types once `npx supabase gen types`
// is run. Until then, we define them manually.
// -----------------------------------------------------------------------------

export type StudentPaymentRow = {
  id: string
  enrollment_id: string
  amount_pkr: number
  discounted_amount_pkr: number
  platform_cut_pkr: number
  teacher_payout_amount_pkr: number
  payment_month: string | null
  payment_method: string
  gateway_transaction_id: string | null
  idempotency_key: string | null
  screenshot_url: string | null
  transaction_id: string | null
  reference_code: string
  discount_code_id: string | null
  status: string
  verified_at: string | null
  rejection_reason: string | null
  refunded_at: string | null
  refund_note: string | null
  platform_absorbed_refund: boolean
  created_at: string
  updated_at: string
}

// Input type for creating a payment
export type CreatePaymentInput = {
  enrollmentId: string
  amountPkr: number
  discountedAmountPkr: number
  platformCutPkr: number
  teacherPayoutAmountPkr: number
  paymentMethod: PaymentMethod
  referenceCode: string
  screenshotUrl?: string
  status: PaymentStatus
  idempotencyKey: string
}

// Payment joined with enrollment + student info (for teacher verification views)
export type PendingPaymentWithDetails = StudentPaymentRow & {
  enrollments: {
    id: string
    student_id: string
    cohort_id: string
    reference_code: string
    status: string
    students: {
      id: string
      name: string
      email: string
      phone: string
    }
    cohorts: {
      id: string
      name: string
      course_id: string
      fee_pkr: number
      fee_type: string
    }
  }
}

// Optional extras when updating payment status
export type PaymentStatusExtras = {
  verifiedAt?: string
  rejectionReason?: string
  refundedAt?: string
  refundNote?: string
  platformAbsorbedRefund?: boolean
}

// -----------------------------------------------------------------------------
// createPayment — Insert a new student_payments row
// All money values are integers in PKR.
// Platform cut is calculated and stored at payment time — never re-derived.
// -----------------------------------------------------------------------------
export async function createPayment(
  input: CreatePaymentInput
): Promise<StudentPaymentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('student_payments')
    .insert({
      enrollment_id: input.enrollmentId,
      amount_pkr: input.amountPkr,
      discounted_amount_pkr: input.discountedAmountPkr,
      platform_cut_pkr: input.platformCutPkr,
      teacher_payout_amount_pkr: input.teacherPayoutAmountPkr,
      payment_method: input.paymentMethod,
      reference_code: input.referenceCode,
      screenshot_url: input.screenshotUrl ?? null,
      status: input.status,
      idempotency_key: input.idempotencyKey,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as StudentPaymentRow
}

// -----------------------------------------------------------------------------
// getPaymentById — Single payment by ID
// -----------------------------------------------------------------------------
export async function getPaymentById(
  id: string
): Promise<StudentPaymentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('student_payments')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as StudentPaymentRow
}

// -----------------------------------------------------------------------------
// getPaymentByEnrollment — Payment(s) for an enrollment, newest first
// Returns the most recent payment for the enrollment
// -----------------------------------------------------------------------------
export async function getPaymentByEnrollment(
  enrollmentId: string
): Promise<StudentPaymentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('student_payments')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as StudentPaymentRow
}

// -----------------------------------------------------------------------------
// getPendingPaymentsByTeacher — Pending verification payments across all
// teacher's cohorts, joined with enrollment + student info
// -----------------------------------------------------------------------------
export async function getPendingPaymentsByTeacher(
  teacherId: string
): Promise<PendingPaymentWithDetails[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('student_payments')
    .select(`
      *,
      enrollments!inner(
        id, student_id, cohort_id, reference_code, status,
        students!inner(id, name, email, phone),
        cohorts!inner(id, name, course_id, fee_pkr, fee_type)
      )
    `)
    .eq('status', 'pending_verification')
    .eq('enrollments.cohorts.teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as PendingPaymentWithDetails[]
}

// -----------------------------------------------------------------------------
// updatePaymentStatus — Update payment status with optional extra fields
// (verified_at, rejection_reason, refunded_at, refund_note)
// -----------------------------------------------------------------------------
export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  extras?: PaymentStatusExtras
): Promise<StudentPaymentRow | null> {
  const supabase = createAdminClient()

  const updateFields: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (extras?.verifiedAt !== undefined) {
    updateFields.verified_at = extras.verifiedAt
  }
  if (extras?.rejectionReason !== undefined) {
    updateFields.rejection_reason = extras.rejectionReason
  }
  if (extras?.refundedAt !== undefined) {
    updateFields.refunded_at = extras.refundedAt
  }
  if (extras?.refundNote !== undefined) {
    updateFields.refund_note = extras.refundNote
  }
  if (extras?.platformAbsorbedRefund !== undefined) {
    updateFields.platform_absorbed_refund = extras.platformAbsorbedRefund
  }

  const { data, error } = await supabase
    .from('student_payments')
    .update(updateFields)
    .eq('id', paymentId)
    .select('*')
    .single()

  if (error || !data) return null
  return data as StudentPaymentRow
}

// -----------------------------------------------------------------------------
// getPaymentByIdempotencyKey — Check for duplicate payment (idempotency)
// Returns existing payment if one was already created with this key
// -----------------------------------------------------------------------------
export async function getPaymentByIdempotencyKey(
  key: string
): Promise<StudentPaymentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('student_payments')
    .select('*')
    .eq('idempotency_key', key)
    .single()

  if (error || !data) return null
  return data as StudentPaymentRow
}
