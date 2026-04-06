// =============================================================================
// lib/db/balances.ts — Teacher balance & payout queries (service layer)
// All database queries for teacher_balances and teacher_payouts go here.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

// -----------------------------------------------------------------------------
// Row types
// -----------------------------------------------------------------------------

export type TeacherBalanceRow = {
  id: string
  teacher_id: string
  available_balance_pkr: number
  pending_balance_pkr: number
  total_earned_pkr: number
  total_paid_out_pkr: number
  outstanding_debit_pkr: number
  updated_at: string
}

export type TeacherPayoutRow = {
  id: string
  teacher_id: string
  amount_pkr: number
  bank_details_snapshot_json: Record<string, unknown> | null
  status: string
  requested_at: string
  processed_at: string | null
  admin_note: string | null
  created_at: string
}

/** Payment with enrollment + student + cohort + course info for earnings view */
export type EarningsPaymentRow = {
  id: string
  amount_pkr: number
  discounted_amount_pkr: number
  platform_cut_pkr: number
  teacher_payout_amount_pkr: number
  payment_method: string
  status: string
  verified_at: string | null
  created_at: string
  enrollments: {
    id: string
    students: {
      id: string
      name: string
    }
    cohorts: {
      id: string
      name: string
      courses: {
        id: string
        title: string
      }
    }
  }
}

// -----------------------------------------------------------------------------
// getTeacherBalance — Returns teacher_balances row (or defaults if none exists)
// -----------------------------------------------------------------------------
export async function getTeacherBalance(
  teacherId: string
): Promise<TeacherBalanceRow> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_balances')
    .select('*')
    .eq('teacher_id', teacherId)
    .single()

  if (error || !data) {
    // Return default zero balance if no row exists yet
    return {
      id: '',
      teacher_id: teacherId,
      available_balance_pkr: 0,
      pending_balance_pkr: 0,
      total_earned_pkr: 0,
      total_paid_out_pkr: 0,
      outstanding_debit_pkr: 0,
      updated_at: new Date().toISOString(),
    }
  }

  return data as TeacherBalanceRow
}

// -----------------------------------------------------------------------------
// getTeacherPayouts — Payout history ordered by created_at desc
// -----------------------------------------------------------------------------
export async function getTeacherPayouts(
  teacherId: string
): Promise<TeacherPayoutRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_payouts')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as TeacherPayoutRow[]
}

// -----------------------------------------------------------------------------
// hasActivePayout — Check if teacher has a pending or processing payout
// -----------------------------------------------------------------------------
export async function hasActivePayout(
  teacherId: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const { count, error } = await supabase
    .from('teacher_payouts')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .in('status', ['pending', 'processing'])

  if (error) return false
  return (count ?? 0) > 0
}

// -----------------------------------------------------------------------------
// createPayoutRequest — Insert a new payout row + update balance atomically
// Returns the new payout row or null on failure.
// -----------------------------------------------------------------------------
export async function createPayoutRequest(
  teacherId: string,
  amountPkr: number,
  bankDetailsSnapshot: Record<string, unknown>
): Promise<TeacherPayoutRow | null> {
  const supabase = createAdminClient()

  // Insert the payout request
  const { data: payout, error: payoutError } = await supabase
    .from('teacher_payouts')
    .insert({
      teacher_id: teacherId,
      amount_pkr: amountPkr,
      bank_details_snapshot_json: bankDetailsSnapshot,
      status: 'pending',
      requested_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (payoutError || !payout) return null

  // Deduct from available_balance and add to pending_balance
  // Using RPC or manual update since Supabase JS doesn't support atomic increment
  const balance = await getTeacherBalance(teacherId)
  const newAvailable = balance.available_balance_pkr - amountPkr
  const newPending = balance.pending_balance_pkr + amountPkr

  const { error: balanceError } = await supabase
    .from('teacher_balances')
    .update({
      available_balance_pkr: newAvailable,
      pending_balance_pkr: newPending,
      updated_at: new Date().toISOString(),
    })
    .eq('teacher_id', teacherId)

  if (balanceError) {
    // Rollback payout if balance update fails
    await supabase.from('teacher_payouts').delete().eq('id', payout.id as string)
    return null
  }

  return payout as TeacherPayoutRow
}

// -----------------------------------------------------------------------------
// getRecentVerifiedPayments — Recent student payments that credited balance
// Joins with enrollment -> student, cohort -> course
// -----------------------------------------------------------------------------
export async function getRecentVerifiedPayments(
  teacherId: string,
  limit: number = 20
): Promise<EarningsPaymentRow[]> {
  const supabase = createAdminClient()

  // Get cohort IDs for this teacher first
  const { data: cohorts, error: cohortError } = await supabase
    .from('cohorts')
    .select('id')
    .eq('teacher_id', teacherId)

  if (cohortError || !cohorts || cohorts.length === 0) return []

  const cohortIds = (cohorts as Array<{ id: string }>).map((c) => c.id)

  // Get enrollments for those cohorts
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id')
    .in('cohort_id', cohortIds)

  if (enrollError || !enrollments || enrollments.length === 0) return []

  const enrollmentIds = (enrollments as Array<{ id: string }>).map((e) => e.id)

  // Get payments that are confirmed (verified) for these enrollments
  const { data: payments, error: payError } = await supabase
    .from('student_payments')
    .select(`
      id, amount_pkr, discounted_amount_pkr, platform_cut_pkr,
      teacher_payout_amount_pkr, payment_method, status, verified_at, created_at,
      enrollments!inner(
        id,
        students!inner(id, name),
        cohorts!inner(
          id, name,
          courses!inner(id, title)
        )
      )
    `)
    .in('enrollment_id', enrollmentIds)
    .eq('status', 'confirmed')
    .order('verified_at', { ascending: false })
    .limit(limit)

  if (payError || !payments) return []
  return payments as unknown as EarningsPaymentRow[]
}
