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
// getLatestPaymentsByEnrollmentIds — Latest payment per enrollment for a list
// of enrollment IDs. Used to surface refund eligibility on the cohort students
// table without N+1 fetches. Returns a Map keyed by enrollment_id.
// -----------------------------------------------------------------------------
export async function getLatestPaymentsByEnrollmentIds(
  enrollmentIds: string[]
): Promise<Map<string, StudentPaymentRow>> {
  if (enrollmentIds.length === 0) return new Map()

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('student_payments')
    .select('*')
    .in('enrollment_id', enrollmentIds)
    .order('created_at', { ascending: false })

  if (error || !data) return new Map()

  const map = new Map<string, StudentPaymentRow>()
  for (const row of data as StudentPaymentRow[]) {
    if (!map.has(row.enrollment_id)) {
      map.set(row.enrollment_id, row)
    }
  }
  return map
}

// -----------------------------------------------------------------------------
// getPaymentByEnrollmentAndMonth — Most recent payment for a given
// enrollment + payment_month, or null. Used by createNextMonthPaymentAction
// for idempotency.
// -----------------------------------------------------------------------------
export async function getPaymentByEnrollmentAndMonth(
  enrollmentId: string,
  paymentMonth: string,
): Promise<StudentPaymentRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('student_payments')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .eq('payment_month', paymentMonth)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as StudentPaymentRow
}

// -----------------------------------------------------------------------------
// getAllPaymentsByEnrollment — All payments for an enrollment ordered by
// payment_month asc (then created_at asc as tiebreaker). NULL payment_months
// sort first. Used by the teacher per-payment view.
// -----------------------------------------------------------------------------
export async function getAllPaymentsByEnrollment(
  enrollmentId: string,
): Promise<StudentPaymentRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('student_payments')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('payment_month', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as StudentPaymentRow[]
}

// -----------------------------------------------------------------------------
// getAllPaymentsByEnrollmentIds — All payments for a batch of enrollments.
// Single query, results grouped into a Map keyed by enrollment_id.
// Used by the cohort students page for monthly cohorts (conditional fetch).
// -----------------------------------------------------------------------------
export async function getAllPaymentsByEnrollmentIds(
  enrollmentIds: string[],
): Promise<Map<string, StudentPaymentRow[]>> {
  if (enrollmentIds.length === 0) return new Map()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('student_payments')
    .select('*')
    .in('enrollment_id', enrollmentIds)
    .order('payment_month', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })

  if (error || !data) return new Map()

  const map = new Map<string, StudentPaymentRow[]>()
  for (const row of data as StudentPaymentRow[]) {
    const existing = map.get(row.enrollment_id)
    if (existing) {
      existing.push(row)
    } else {
      map.set(row.enrollment_id, [row])
    }
  }
  return map
}

// Sentinel returned when a unique-violation (23505) is caught on INSERT,
// meaning another concurrent request already created the row.
export const PAYMENT_ALREADY_EXISTS = 'PAYMENT_ALREADY_EXISTS' as const
export type CreatePaymentResult = StudentPaymentRow | null | typeof PAYMENT_ALREADY_EXISTS

// -----------------------------------------------------------------------------
// createPayment — Insert a new student payment record
// Returns PAYMENT_ALREADY_EXISTS if a unique-constraint violation is caught
// (concurrent concurrent duplicate insert), null on other errors.
// -----------------------------------------------------------------------------
export async function createPayment(
  input: CreateStudentPaymentInput
): Promise<CreatePaymentResult> {
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

  if (error) {
    // Postgres unique-violation: another concurrent request beat us to it
    if (error.code === '23505') {
      return PAYMENT_ALREADY_EXISTS
    }
    console.error('[createPayment] Unexpected DB error:', error.message, error.code)
    return null
  }

  if (!data) return null
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

// -----------------------------------------------------------------------------
// getPendingPaymentCountByStudent — Count of payments with status 'pending'
// or 'screenshot_submitted' across all enrollments for a student.
// Used by student dashboard to show pending fees count.
// -----------------------------------------------------------------------------
export async function getPendingPaymentCountByStudent(
  studentId: string
): Promise<number> {
  const supabase = createAdminClient()

  // 1. Get enrollment IDs
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id')
    .eq('student_id', studentId)
    .in('status', ['active', 'pending'])

  if (enrollError || !enrollments || enrollments.length === 0) return 0

  const enrollmentIds = (enrollments as Array<{ id: string }>).map((e) => e.id)

  // 2. Count pending payments
  const { count, error } = await supabase
    .from('student_payments')
    .select('*', { count: 'exact', head: true })
    .in('enrollment_id', enrollmentIds)
    .in('status', ['pending', 'screenshot_submitted'])

  if (error) return 0
  return count ?? 0
}

// Payment joined with enrollment + cohort + course info (for student billing view)
export type StudentPaymentWithDetails = StudentPaymentRow & {
  enrollments: {
    id: string
    cohort_id: string
    reference_code: string
    cohorts: {
      id: string
      name: string
      fee_pkr: number
      fee_type: string
      courses: {
        id: string
        title: string
        teacher_id: string
      }
      teachers: {
        id: string
        name: string
      }
    }
  }
}

// -----------------------------------------------------------------------------
// getPaymentsByStudent — All payments for a student across all enrollments,
// joined with enrollment → cohort → course → teacher info. Newest first.
// -----------------------------------------------------------------------------
export async function getPaymentsByStudent(
  studentId: string
): Promise<StudentPaymentWithDetails[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('student_payments')
    .select(`
      *,
      enrollments!inner(
        id, cohort_id, reference_code,
        cohorts!inner(
          id, name, fee_pkr, fee_type,
          courses!inner(id, title, teacher_id),
          teachers!inner(id, name)
        )
      )
    `)
    .eq('enrollments.student_id', studentId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as StudentPaymentWithDetails[]
}
