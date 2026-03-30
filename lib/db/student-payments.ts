// =============================================================================
// lib/db/student-payments.ts — Student payment CRUD queries (service layer)
// All database queries for student_payments go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { PaymentStatus, PaymentMethod } from '@/types/domain'

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

// Input type for creating a student payment
export type CreateStudentPaymentInput = {
  enrollmentId: string
  amountPkr: number
  discountedAmountPkr: number
  platformCutPkr: number
  teacherPayoutAmountPkr: number
  paymentMethod: PaymentMethod
  referenceCode: string
  idempotencyKey: string
  status: PaymentStatus
  paymentMonth?: string
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
// getPaymentByIdempotencyKey — Look up payment by idempotency key
// Used to prevent duplicate payment creation
// -----------------------------------------------------------------------------
export async function getPaymentByIdempotencyKey(
  idempotencyKey: string
): Promise<StudentPaymentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('student_payments')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .single()

  if (error || !data) return null
  return data as StudentPaymentRow
}

// -----------------------------------------------------------------------------
// getPaymentsByEnrollment — All payments for an enrollment, newest first
// -----------------------------------------------------------------------------
export async function getPaymentsByEnrollment(
  enrollmentId: string
): Promise<StudentPaymentRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('student_payments')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as StudentPaymentRow[]
}

// -----------------------------------------------------------------------------
// createPayment — Insert a new student payment record
// -----------------------------------------------------------------------------
export async function createPayment(
  input: CreateStudentPaymentInput
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
      idempotency_key: input.idempotencyKey,
      status: input.status,
      payment_month: input.paymentMonth ?? null,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as StudentPaymentRow
}

// -----------------------------------------------------------------------------
// updatePaymentStatus — Update payment status + updated_at
// -----------------------------------------------------------------------------
export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  extras?: Record<string, unknown>
): Promise<StudentPaymentRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('student_payments')
    .update({
      status,
      ...extras,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .select('*')
    .single()

  if (error || !data) return null
  return data as StudentPaymentRow
}
