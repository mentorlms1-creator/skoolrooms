'use server'

// =============================================================================
// lib/actions/admin.ts — Server actions for admin operations
// All admin mutations use Server Actions per CLAUDE.md rule 12.
// =============================================================================

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { logAdminActivity, updatePlatformSetting } from '@/lib/db/admin'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// changePlanAction — Admin changes teacher plan
// -----------------------------------------------------------------------------
export async function changePlanAction(
  teacherId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()
  const newPlan = (formData.get('plan') as string | null)?.trim()

  if (!newPlan || !['free', 'solo', 'academy'].includes(newPlan)) {
    return { success: false, error: 'Invalid plan selected.' }
  }

  const supabase = createAdminClient()

  // Get current teacher
  const { data: teacher, error: fetchError } = await supabase
    .from('teachers')
    .select('plan')
    .eq('id', teacherId)
    .single()

  if (fetchError || !teacher) {
    return { success: false, error: 'Teacher not found.' }
  }

  const oldPlan = teacher.plan as string

  if (oldPlan === newPlan) {
    return { success: false, error: 'Teacher is already on this plan.' }
  }

  // Update plan
  const { error: updateError } = await supabase
    .from('teachers')
    .update({
      plan: newPlan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', teacherId)

  if (updateError) {
    return { success: false, error: 'Failed to update plan.' }
  }

  await logAdminActivity({
    teacherId,
    actionType: 'change_plan',
    performedBy: admin.email ?? admin.id,
    metadata: { old_plan: oldPlan, new_plan: newPlan },
  })

  revalidatePath(`/admin/teachers/${teacherId}`)
  revalidatePath('/admin/teachers')
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// extendExpiryAction — Extend plan_expires_at by N days
// -----------------------------------------------------------------------------
export async function extendExpiryAction(
  teacherId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()
  const daysStr = formData.get('days') as string | null
  const days = Number(daysStr)

  if (!daysStr || isNaN(days) || days < 1 || days > 365) {
    return { success: false, error: 'Days must be between 1 and 365.' }
  }

  const supabase = createAdminClient()

  const { data: teacher, error: fetchError } = await supabase
    .from('teachers')
    .select('plan_expires_at')
    .eq('id', teacherId)
    .single()

  if (fetchError || !teacher) {
    return { success: false, error: 'Teacher not found.' }
  }

  const currentExpiry = teacher.plan_expires_at
    ? new Date(teacher.plan_expires_at as string)
    : new Date()

  const newExpiry = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000)

  const { error: updateError } = await supabase
    .from('teachers')
    .update({
      plan_expires_at: newExpiry.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', teacherId)

  if (updateError) {
    return { success: false, error: 'Failed to extend expiry.' }
  }

  await logAdminActivity({
    teacherId,
    actionType: 'extend_expiry',
    performedBy: admin.email ?? admin.id,
    metadata: { days, new_expiry: newExpiry.toISOString() },
  })

  revalidatePath(`/admin/teachers/${teacherId}`)
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// extendTrialAction — Extend trial_ends_at by N days
// -----------------------------------------------------------------------------
export async function extendTrialAction(
  teacherId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()
  const daysStr = formData.get('days') as string | null
  const days = Number(daysStr)

  if (!daysStr || isNaN(days) || days < 1 || days > 365) {
    return { success: false, error: 'Days must be between 1 and 365.' }
  }

  const supabase = createAdminClient()

  const { data: teacher, error: fetchError } = await supabase
    .from('teachers')
    .select('trial_ends_at')
    .eq('id', teacherId)
    .single()

  if (fetchError || !teacher) {
    return { success: false, error: 'Teacher not found.' }
  }

  const currentTrialEnd = teacher.trial_ends_at
    ? new Date(teacher.trial_ends_at as string)
    : new Date()

  const newTrialEnd = new Date(currentTrialEnd.getTime() + days * 24 * 60 * 60 * 1000)

  const { error: updateError } = await supabase
    .from('teachers')
    .update({
      trial_ends_at: newTrialEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', teacherId)

  if (updateError) {
    return { success: false, error: 'Failed to extend trial.' }
  }

  await logAdminActivity({
    teacherId,
    actionType: 'extend_trial',
    performedBy: admin.email ?? admin.id,
    metadata: { days, new_trial_end: newTrialEnd.toISOString() },
  })

  revalidatePath(`/admin/teachers/${teacherId}`)
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// suspendTeacherAction — Set is_suspended=true
// -----------------------------------------------------------------------------
export async function suspendTeacherAction(
  teacherId: string
): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('teachers')
    .update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', teacherId)

  if (error) {
    return { success: false, error: 'Failed to suspend teacher.' }
  }

  await logAdminActivity({
    teacherId,
    actionType: 'suspend_teacher',
    performedBy: admin.email ?? admin.id,
  })

  revalidatePath(`/admin/teachers/${teacherId}`)
  revalidatePath('/admin/teachers')
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// reactivateTeacherAction — Set is_suspended=false
// -----------------------------------------------------------------------------
export async function reactivateTeacherAction(
  teacherId: string
): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('teachers')
    .update({
      is_suspended: false,
      suspended_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', teacherId)

  if (error) {
    return { success: false, error: 'Failed to reactivate teacher.' }
  }

  await logAdminActivity({
    teacherId,
    actionType: 'reactivate_teacher',
    performedBy: admin.email ?? admin.id,
  })

  revalidatePath(`/admin/teachers/${teacherId}`)
  revalidatePath('/admin/teachers')
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// updatePlatformSettingsAction — Update platform settings
// -----------------------------------------------------------------------------
export async function updatePlatformSettingsAction(
  formData: FormData
): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()

  const entries = Array.from(formData.entries())

  for (const [key, value] of entries) {
    const success = await updatePlatformSetting(key, String(value))
    if (!success) {
      return { success: false, error: `Failed to update setting: ${key}` }
    }
  }

  await logAdminActivity({
    actionType: 'update_platform_settings',
    performedBy: admin.email ?? admin.id,
    metadata: { updated_keys: entries.map(([k]) => k) },
  })

  revalidatePath('/admin/settings')
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// approveSubscriptionAction — Approve a pending subscription
// -----------------------------------------------------------------------------
export async function approveSubscriptionAction(
  subscriptionId: string
): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()
  const supabase = createAdminClient()

  // Get subscription
  const { data: sub, error: fetchError } = await supabase
    .from('teacher_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()

  if (fetchError || !sub) {
    return { success: false, error: 'Subscription not found.' }
  }

  if ((sub.status as string) !== 'pending_verification') {
    return { success: false, error: 'Subscription is not pending verification.' }
  }

  // Approve
  const { error: updateError } = await supabase
    .from('teacher_subscriptions')
    .update({
      status: 'active',
      approved_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    return { success: false, error: 'Failed to approve subscription.' }
  }

  // Update teacher plan and expiry
  const teacherId = sub.teacher_id as string
  const { error: teacherError } = await supabase
    .from('teachers')
    .update({
      plan: sub.plan as string,
      plan_expires_at: (sub.period_end as string) + 'T23:59:59.999Z',
      updated_at: new Date().toISOString(),
    })
    .eq('id', teacherId)

  if (teacherError) {
    return { success: false, error: 'Failed to update teacher plan.' }
  }

  await logAdminActivity({
    teacherId,
    actionType: 'approve_subscription',
    performedBy: admin.email ?? admin.id,
    metadata: { subscription_id: subscriptionId, plan: sub.plan },
  })

  revalidatePath('/admin/payments')
  revalidatePath(`/admin/teachers/${teacherId}`)
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// rejectSubscriptionAction — Reject a pending subscription
// -----------------------------------------------------------------------------
export async function rejectSubscriptionAction(
  subscriptionId: string
): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()
  const supabase = createAdminClient()

  const { data: sub, error: fetchError } = await supabase
    .from('teacher_subscriptions')
    .select('teacher_id, status')
    .eq('id', subscriptionId)
    .single()

  if (fetchError || !sub) {
    return { success: false, error: 'Subscription not found.' }
  }

  if ((sub.status as string) !== 'pending_verification') {
    return { success: false, error: 'Subscription is not pending verification.' }
  }

  const { error: updateError } = await supabase
    .from('teacher_subscriptions')
    .update({ status: 'rejected' })
    .eq('id', subscriptionId)

  if (updateError) {
    return { success: false, error: 'Failed to reject subscription.' }
  }

  await logAdminActivity({
    teacherId: sub.teacher_id as string,
    actionType: 'reject_subscription',
    performedBy: admin.email ?? admin.id,
    metadata: { subscription_id: subscriptionId },
  })

  revalidatePath('/admin/payments')
  return { success: true, data: null }
}
