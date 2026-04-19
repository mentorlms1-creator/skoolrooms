// =============================================================================
// lib/db/payouts.ts — Admin payout query layer
// All admin-facing payout DB queries go here.
// Uses createAdminClient (bypasses RLS — server-only, admin operations).
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { TeacherPaymentSettingsRow } from '@/lib/db/admin'

// -----------------------------------------------------------------------------
// Row types
// -----------------------------------------------------------------------------

export type AdminPayoutRow = {
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

export type AdminPayoutWithTeacher = {
  payout: AdminPayoutRow
  teacher: {
    id: string
    name: string
    email: string
  }
  livePaymentSettings: TeacherPaymentSettingsRow | null
  bankDetailsChanged: boolean
}

export type TeacherWithDebit = {
  id: string
  name: string
  email: string
  outstanding_debit_pkr: number
}

export type AdminEarningsSummary = {
  grossCollectedPkr: number
  totalPlatformCutsPkr: number
  totalPayoutsProcessedPkr: number
  netRevenuePkr: number
}

// -----------------------------------------------------------------------------
// getAllPendingPayouts — List pending payouts with teacher + live bank details
// Flags bankDetailsChanged if teacher updated bank details after requesting
// -----------------------------------------------------------------------------
export async function getAllPendingPayouts(): Promise<AdminPayoutWithTeacher[]> {
  const supabase = createAdminClient()

  const { data: payouts, error } = await supabase
    .from('teacher_payouts')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })

  if (error || !payouts || payouts.length === 0) return []

  const teacherIds = [...new Set((payouts as AdminPayoutRow[]).map((p) => p.teacher_id))]

  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, email')
    .in('id', teacherIds)

  const teacherMap: Record<string, { id: string; name: string; email: string }> = {}
  if (teachers) {
    for (const t of teachers as Array<{ id: string; name: string; email: string }>) {
      teacherMap[t.id] = t
    }
  }

  const { data: settings } = await supabase
    .from('teacher_payment_settings')
    .select('*')
    .in('teacher_id', teacherIds)

  const settingsMap: Record<string, TeacherPaymentSettingsRow> = {}
  if (settings) {
    for (const s of settings as TeacherPaymentSettingsRow[]) {
      settingsMap[s.teacher_id] = s
    }
  }

  return (payouts as AdminPayoutRow[]).map((payout) => {
    const teacher = teacherMap[payout.teacher_id] ?? {
      id: payout.teacher_id,
      name: 'Unknown',
      email: '',
    }
    const liveSettings = settingsMap[payout.teacher_id] ?? null

    const bankDetailsChanged =
      liveSettings !== null &&
      new Date(liveSettings.updated_at) > new Date(payout.requested_at)

    return { payout, teacher, livePaymentSettings: liveSettings, bankDetailsChanged }
  })
}

// -----------------------------------------------------------------------------
// getAllPayouts — All payouts (pending + history) for admin queue page
// -----------------------------------------------------------------------------
export async function getAllPayouts(): Promise<AdminPayoutWithTeacher[]> {
  const supabase = createAdminClient()

  const { data: payouts, error } = await supabase
    .from('teacher_payouts')
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(200)

  if (error || !payouts || payouts.length === 0) return []

  const teacherIds = [...new Set((payouts as AdminPayoutRow[]).map((p) => p.teacher_id))]

  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, email')
    .in('id', teacherIds)

  const teacherMap: Record<string, { id: string; name: string; email: string }> = {}
  if (teachers) {
    for (const t of teachers as Array<{ id: string; name: string; email: string }>) {
      teacherMap[t.id] = t
    }
  }

  const { data: settings } = await supabase
    .from('teacher_payment_settings')
    .select('*')
    .in('teacher_id', teacherIds)

  const settingsMap: Record<string, TeacherPaymentSettingsRow> = {}
  if (settings) {
    for (const s of settings as TeacherPaymentSettingsRow[]) {
      settingsMap[s.teacher_id] = s
    }
  }

  return (payouts as AdminPayoutRow[]).map((payout) => {
    const teacher = teacherMap[payout.teacher_id] ?? {
      id: payout.teacher_id,
      name: 'Unknown',
      email: '',
    }
    const liveSettings = settingsMap[payout.teacher_id] ?? null

    const bankDetailsChanged =
      liveSettings !== null &&
      payout.status === 'pending' &&
      new Date(liveSettings.updated_at) > new Date(payout.requested_at)

    return { payout, teacher, livePaymentSettings: liveSettings, bankDetailsChanged }
  })
}

// -----------------------------------------------------------------------------
// getPayoutById — Single payout row with teacher + live bank details
// -----------------------------------------------------------------------------
export async function getPayoutById(
  payoutId: string,
): Promise<AdminPayoutWithTeacher | null> {
  const supabase = createAdminClient()

  const { data: payout, error } = await supabase
    .from('teacher_payouts')
    .select('*')
    .eq('id', payoutId)
    .single()

  if (error || !payout) return null

  const p = payout as AdminPayoutRow

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, name, email')
    .eq('id', p.teacher_id)
    .single()

  const { data: liveSettings } = await supabase
    .from('teacher_payment_settings')
    .select('*')
    .eq('teacher_id', p.teacher_id)
    .single()

  const settings = (liveSettings as TeacherPaymentSettingsRow | null) ?? null
  const bankDetailsChanged =
    settings !== null && new Date(settings.updated_at) > new Date(p.requested_at)

  return {
    payout: p,
    teacher: teacher as { id: string; name: string; email: string } ?? {
      id: p.teacher_id,
      name: 'Unknown',
      email: '',
    },
    livePaymentSettings: settings,
    bankDetailsChanged,
  }
}

// -----------------------------------------------------------------------------
// completePayoutDb — Mark payout completed, write bank snapshot, update balances
// bank snapshot is read LIVE at completion time (per ARCHITECTURE.md §3)
// -----------------------------------------------------------------------------
export async function completePayoutDb(
  payoutId: string,
  adminNote: string,
  bankSnapshot: Record<string, unknown>,
): Promise<boolean> {
  const supabase = createAdminClient()

  const { data: payout, error: fetchError } = await supabase
    .from('teacher_payouts')
    .select('teacher_id, amount_pkr, status')
    .eq('id', payoutId)
    .single()

  if (fetchError || !payout) return false

  const { teacher_id, amount_pkr, status } = payout as {
    teacher_id: string
    amount_pkr: number
    status: string
  }

  if (status !== 'pending' && status !== 'processing') return false

  const now = new Date().toISOString()

  const { error: payoutError } = await supabase
    .from('teacher_payouts')
    .update({
      status: 'completed',
      processed_at: now,
      admin_note: adminNote || null,
      bank_details_snapshot_json: bankSnapshot,
    })
    .eq('id', payoutId)

  if (payoutError) return false

  // Update teacher_balances: pending -= amount, total_paid_out += amount
  const { data: balance } = await supabase
    .from('teacher_balances')
    .select('pending_balance_pkr, total_paid_out_pkr')
    .eq('teacher_id', teacher_id)
    .single()

  if (balance) {
    const { pending_balance_pkr, total_paid_out_pkr } = balance as {
      pending_balance_pkr: number
      total_paid_out_pkr: number
    }
    await supabase
      .from('teacher_balances')
      .update({
        pending_balance_pkr: Math.max(0, pending_balance_pkr - (amount_pkr as number)),
        total_paid_out_pkr: total_paid_out_pkr + (amount_pkr as number),
        updated_at: now,
      })
      .eq('teacher_id', teacher_id)
  }

  return true
}

// -----------------------------------------------------------------------------
// failPayoutDb — Mark payout failed, restore available balance
// -----------------------------------------------------------------------------
export async function failPayoutDb(
  payoutId: string,
  adminNote: string,
): Promise<boolean> {
  const supabase = createAdminClient()

  const { data: payout, error: fetchError } = await supabase
    .from('teacher_payouts')
    .select('teacher_id, amount_pkr, status')
    .eq('id', payoutId)
    .single()

  if (fetchError || !payout) return false

  const { teacher_id, amount_pkr, status } = payout as {
    teacher_id: string
    amount_pkr: number
    status: string
  }

  if (status !== 'pending' && status !== 'processing') return false

  const now = new Date().toISOString()

  const { error: payoutError } = await supabase
    .from('teacher_payouts')
    .update({
      status: 'failed',
      processed_at: now,
      admin_note: adminNote || null,
    })
    .eq('id', payoutId)

  if (payoutError) return false

  // Restore: available += amount, pending -= amount
  const { data: balance } = await supabase
    .from('teacher_balances')
    .select('available_balance_pkr, pending_balance_pkr')
    .eq('teacher_id', teacher_id)
    .single()

  if (balance) {
    const { available_balance_pkr, pending_balance_pkr } = balance as {
      available_balance_pkr: number
      pending_balance_pkr: number
    }
    await supabase
      .from('teacher_balances')
      .update({
        available_balance_pkr: available_balance_pkr + (amount_pkr as number),
        pending_balance_pkr: Math.max(0, pending_balance_pkr - (amount_pkr as number)),
        updated_at: now,
      })
      .eq('teacher_id', teacher_id)
  }

  return true
}

// -----------------------------------------------------------------------------
// getTeachersWithOutstandingDebit — Teachers with outstanding_debit_pkr > 0
// -----------------------------------------------------------------------------
export async function getTeachersWithOutstandingDebit(): Promise<TeacherWithDebit[]> {
  const supabase = createAdminClient()

  const { data: balances, error } = await supabase
    .from('teacher_balances')
    .select('teacher_id, outstanding_debit_pkr')
    .gt('outstanding_debit_pkr', 0)
    .order('outstanding_debit_pkr', { ascending: false })

  if (error || !balances || balances.length === 0) return []

  const teacherIds = (balances as Array<{ teacher_id: string; outstanding_debit_pkr: number }>).map(
    (b) => b.teacher_id,
  )

  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, email')
    .in('id', teacherIds)

  const teacherMap: Record<string, { name: string; email: string }> = {}
  if (teachers) {
    for (const t of teachers as Array<{ id: string; name: string; email: string }>) {
      teacherMap[t.id] = { name: t.name, email: t.email }
    }
  }

  return (balances as Array<{ teacher_id: string; outstanding_debit_pkr: number }>).map((b) => ({
    id: b.teacher_id,
    name: teacherMap[b.teacher_id]?.name ?? 'Unknown',
    email: teacherMap[b.teacher_id]?.email ?? '',
    outstanding_debit_pkr: b.outstanding_debit_pkr,
  }))
}

// -----------------------------------------------------------------------------
// getAdminEarningsSummary — Platform-wide earnings stats
// -----------------------------------------------------------------------------
export async function getAdminEarningsSummary(): Promise<AdminEarningsSummary> {
  const supabase = createAdminClient()

  // Gross collected = sum of all confirmed student payments
  const { data: payments } = await supabase
    .from('student_payments')
    .select('amount_pkr, platform_cut_pkr')
    .eq('status', 'confirmed')

  let grossCollectedPkr = 0
  let totalPlatformCutsPkr = 0

  if (payments) {
    for (const p of payments as Array<{ amount_pkr: number; platform_cut_pkr: number }>) {
      grossCollectedPkr += p.amount_pkr
      totalPlatformCutsPkr += p.platform_cut_pkr
    }
  }

  // Total payouts processed = sum of completed teacher_payouts
  const { data: completedPayouts } = await supabase
    .from('teacher_payouts')
    .select('amount_pkr')
    .eq('status', 'completed')

  let totalPayoutsProcessedPkr = 0
  if (completedPayouts) {
    for (const p of completedPayouts as Array<{ amount_pkr: number }>) {
      totalPayoutsProcessedPkr += p.amount_pkr
    }
  }

  // Net revenue = platform cuts not yet paid out to teachers
  // (cuts accumulate as a liability; when teacher gets paid out, platform collected its share)
  const netRevenuePkr = totalPlatformCutsPkr

  return {
    grossCollectedPkr,
    totalPlatformCutsPkr,
    totalPayoutsProcessedPkr,
    netRevenuePkr,
  }
}
