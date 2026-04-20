'use server'

// =============================================================================
// lib/actions/admin.ts — Server actions for admin operations
// All admin mutations use Server Actions per CLAUDE.md rule 12.
// =============================================================================

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { logAdminActivity, updatePlatformSetting } from '@/lib/db/admin'
import { createPlanSnapshot } from '@/lib/db/subscriptions'
import { revalidateTeacherPlan } from '@/lib/db/teachers'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from '@/lib/cache/tags'
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

  // For paid plans, set plan_expires_at to now + 30 days. For free, set to null.
  const isPaidPlan = newPlan !== 'free'
  const planExpiresAt = isPaidPlan
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null

  // Update plan, clear grace/trial, set expiry
  const { error: updateError } = await supabase
    .from('teachers')
    .update({
      plan: newPlan,
      plan_expires_at: planExpiresAt,
      grace_until: null,
      trial_ends_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', teacherId)

  if (updateError) {
    return { success: false, error: 'Failed to update plan.' }
  }

  // Create plan snapshot
  const { data: planRow } = await supabase
    .from('plans')
    .select('id, max_courses, max_students, max_cohorts_active, max_storage_mb, max_teachers, name, slug, price_pkr, transaction_cut_percent')
    .eq('slug', newPlan)
    .single()

  if (planRow) {
    const { data: features } = await supabase
      .from('plan_features')
      .select('feature_key, is_enabled')
      .eq('plan_id', planRow.id as string)

    const featuresMap: Record<string, boolean> = {}
    if (features) {
      for (const f of features) {
        featuresMap[f.feature_key as string] = f.is_enabled as boolean
      }
    }

    await createPlanSnapshot(teacherId, planRow.id as string, {
      planName: planRow.name,
      planSlug: planRow.slug,
      pricePkr: planRow.price_pkr,
      transactionCutPercent: planRow.transaction_cut_percent,
      limits: {
        max_courses: planRow.max_courses,
        max_students: planRow.max_students,
        max_cohorts_active: planRow.max_cohorts_active,
        max_storage_mb: planRow.max_storage_mb,
        max_teachers: planRow.max_teachers,
      },
      features: featuresMap,
      changedAt: new Date().toISOString(),
      changedBy: admin.email ?? admin.id,
      oldPlan: oldPlan,
    })
  }

  await logAdminActivity({
    teacherId,
    actionType: 'change_plan',
    performedBy: admin.email ?? admin.id,
    metadata: { old_plan: oldPlan, new_plan: newPlan },
  })

  revalidateTeacherPlan(teacherId)
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

  // Extend plan_expires_at and clear grace_until (unlocks hard-locked teacher)
  const { error: updateError } = await supabase
    .from('teachers')
    .update({
      plan_expires_at: newExpiry.toISOString(),
      grace_until: null,
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
    metadata: { days, new_expiry: newExpiry.toISOString(), grace_cleared: true },
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

  // Check that trial is actually active (trial_ends_at exists and is in the future)
  if (!teacher.trial_ends_at) {
    return { success: false, error: 'Teacher is not on an active trial.' }
  }

  const currentTrialEnd = new Date(teacher.trial_ends_at as string)
  if (currentTrialEnd < new Date()) {
    return { success: false, error: 'Teacher is not on an active trial.' }
  }

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
  // Suspended teachers must drop off the public explore page immediately.
  revalidateTag(`teacher:${teacherId}`)
  revalidateTag('explore-list')
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
  revalidateTag(`teacher:${teacherId}`)
  revalidateTag('explore-list')
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

// NOTE: approveSubscriptionAction and rejectSubscriptionAction live in
// lib/actions/subscriptions.ts — they are the canonical versions that
// create snapshots, clear grace/trial, and send emails.
