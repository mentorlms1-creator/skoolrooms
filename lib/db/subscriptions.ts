// =============================================================================
// lib/db/subscriptions.ts — Subscription CRUD queries (service layer)
// All database queries for teacher subscriptions go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

// -----------------------------------------------------------------------------
// Row type (mirrors teacher_subscriptions table)
// -----------------------------------------------------------------------------

export type SubscriptionRow = {
  id: string
  teacher_id: string
  plan: string
  amount_pkr: number
  payment_method: string
  gateway_transaction_id: string | null
  screenshot_url: string | null
  status: string
  period_start: string
  period_end: string
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
}

export type SubscriptionWithTeacher = SubscriptionRow & {
  teacher_name: string
  teacher_email: string
  teacher_subdomain: string
}

// -----------------------------------------------------------------------------
// createSubscription — Insert a new teacher_subscriptions row
// -----------------------------------------------------------------------------
export async function createSubscription(input: {
  teacherId: string
  plan: string
  amountPkr: number
  paymentMethod: string
  screenshotUrl?: string
  gatewayTransactionId?: string
  status: string
  periodStart: string
  periodEnd: string
}): Promise<SubscriptionRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_subscriptions')
    .insert({
      teacher_id: input.teacherId,
      plan: input.plan,
      amount_pkr: input.amountPkr,
      payment_method: input.paymentMethod,
      screenshot_url: input.screenshotUrl ?? null,
      gateway_transaction_id: input.gatewayTransactionId ?? null,
      status: input.status,
      period_start: input.periodStart,
      period_end: input.periodEnd,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as SubscriptionRow
}

// -----------------------------------------------------------------------------
// getSubscriptionById — Single subscription by ID
// -----------------------------------------------------------------------------
export async function getSubscriptionById(
  id: string
): Promise<SubscriptionRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_subscriptions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as SubscriptionRow
}

// -----------------------------------------------------------------------------
// getPendingSubscriptions — All pending_verification subscriptions with teacher info
// -----------------------------------------------------------------------------
export async function getPendingSubscriptions(): Promise<SubscriptionWithTeacher[]> {
  const supabase = createAdminClient()

  // Supabase JS doesn't support joins across tables cleanly for this,
  // so we do a two-step: get pending subscriptions, then get teacher info
  const { data: subs, error: subsError } = await supabase
    .from('teacher_subscriptions')
    .select('*')
    .eq('status', 'pending_verification')
    .order('created_at', { ascending: true })

  if (subsError || !subs || subs.length === 0) return []

  const teacherIds = [...new Set(subs.map((s) => s.teacher_id as string))]

  const { data: teachers, error: teachersError } = await supabase
    .from('teachers')
    .select('id, name, email, subdomain')
    .in('id', teacherIds)

  if (teachersError || !teachers) return []

  const teacherMap = new Map(
    teachers.map((t) => [
      t.id as string,
      { name: t.name as string, email: t.email as string, subdomain: t.subdomain as string },
    ])
  )

  return subs.map((s) => {
    const teacher = teacherMap.get(s.teacher_id as string)
    return {
      ...(s as SubscriptionRow),
      teacher_name: teacher?.name ?? '',
      teacher_email: teacher?.email ?? '',
      teacher_subdomain: teacher?.subdomain ?? '',
    }
  })
}

// -----------------------------------------------------------------------------
// approveSubscription — Set status to 'active', approved_at to now
// -----------------------------------------------------------------------------
export async function approveSubscription(
  id: string
): Promise<SubscriptionRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_subscriptions')
    .update({
      status: 'active',
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending_verification')
    .select('*')
    .single()

  if (error || !data) return null
  return data as SubscriptionRow
}

// -----------------------------------------------------------------------------
// rejectSubscription — Set status to 'rejected' with optional reason
// -----------------------------------------------------------------------------
export async function rejectSubscription(
  id: string,
  reason: string
): Promise<SubscriptionRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_subscriptions')
    .update({
      status: 'rejected',
      rejection_reason: reason,
    })
    .eq('id', id)
    .eq('status', 'pending_verification')
    .select('*')
    .single()

  if (error || !data) return null
  return data as SubscriptionRow
}

// -----------------------------------------------------------------------------
// getTeacherSubscriptions — Subscription history for a teacher
// -----------------------------------------------------------------------------
export async function getTeacherSubscriptions(
  teacherId: string
): Promise<SubscriptionRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_subscriptions')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as SubscriptionRow[]
}

// -----------------------------------------------------------------------------
// createPlanSnapshot — Insert teacher_plan_snapshot
// -----------------------------------------------------------------------------
export async function createPlanSnapshot(
  teacherId: string,
  planId: string,
  snapshotJson: Record<string, unknown>
): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('teacher_plan_snapshot')
    .insert({
      teacher_id: teacherId,
      plan_id: planId,
      snapshot_json: snapshotJson,
    })

  return !error
}

// -----------------------------------------------------------------------------
// hasExistingSubscription — Check if teacher has ever had a paid subscription
// Used to determine trial eligibility (first time on paid plan = trial)
// -----------------------------------------------------------------------------
export async function hasExistingSubscription(
  teacherId: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const { count, error } = await supabase
    .from('teacher_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)

  if (error) return false
  return (count ?? 0) > 0
}

// -----------------------------------------------------------------------------
// hasPriorPaidPlan — Check if teacher has ever been on a paid plan
// Checks trial_ends_at presence or any subscription record
// -----------------------------------------------------------------------------
export async function hasPriorPaidPlan(
  teacherId: string
): Promise<boolean> {
  const supabase = createAdminClient()

  // Check if teacher has trial_ends_at set (means they've had a trial)
  const { data: teacher } = await supabase
    .from('teachers')
    .select('trial_ends_at')
    .eq('id', teacherId)
    .single()

  if (teacher?.trial_ends_at) return true

  // Also check if they have any subscription record
  return hasExistingSubscription(teacherId)
}
