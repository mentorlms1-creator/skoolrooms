'use server'

// =============================================================================
// lib/actions/subscriptions.ts — Server actions for subscription management
//
// - subscribeAction: teacher initiates subscription (trial or screenshot)
// - submitSubscriptionScreenshotAction: upload payment screenshot
// - approveSubscriptionAction: admin approves subscription screenshot
// - rejectSubscriptionAction: admin rejects subscription screenshot
// =============================================================================

import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId, updateTeacher } from '@/lib/db/teachers'
import {
  createSubscription,
  getSubscriptionById,
  approveSubscription,
  rejectSubscription,
  createPlanSnapshot,
  hasPriorPaidPlan,
} from '@/lib/db/subscriptions'
import { sendEmail } from '@/lib/email/sender'
import type { ApiResponse } from '@/types/api'
import type { PlanSlug } from '@/types/domain'
import { PLANS, TIMING } from '@/constants/plans'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  const teacher = await getTeacherByAuthId(user.id)
  return teacher
}

const VALID_PAID_PLANS: ReadonlySet<string> = new Set(['solo', 'academy'])

// -----------------------------------------------------------------------------
// subscribeAction — Teacher initiates subscription
// If first time on paid plan: start trial (set trial_ends_at = now + 14 days)
// Otherwise: return needs_screenshot = true (upload screenshot form)
// -----------------------------------------------------------------------------

export async function subscribeAction(
  formData: FormData
): Promise<ApiResponse<{ trialStarted: boolean; planSlug: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  const planSlug = (formData.get('planSlug') as string | null)?.trim() ?? ''

  if (!VALID_PAID_PLANS.has(planSlug)) {
    return { success: false, error: 'Invalid plan selected' }
  }

  // Check if teacher has already been on a paid plan (trial eligibility)
  const hadPriorPaidPlan = await hasPriorPaidPlan(teacher.id)

  if (!hadPriorPaidPlan) {
    // First time on paid plan — start trial
    const trialDays = TIMING.TRIAL_DAYS
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)

    const updated = await updateTeacher(teacher.id, {
      plan: planSlug,
      trial_ends_at: trialEndsAt.toISOString(),
      // Free plan has null plan_expires_at. Trial also has null plan_expires_at.
      // Only grace period / paid subscription sets plan_expires_at.
      plan_expires_at: null,
      grace_until: null,
    })

    if (!updated) {
      return { success: false, error: 'Failed to start trial. Please try again.' }
    }

    return {
      success: true,
      data: { trialStarted: true, planSlug },
    }
  }

  // Not first time — they need to upload a screenshot
  return {
    success: true,
    data: { trialStarted: false, planSlug },
  }
}

// -----------------------------------------------------------------------------
// submitSubscriptionScreenshotAction — Upload screenshot, create subscription
// -----------------------------------------------------------------------------

export async function submitSubscriptionScreenshotAction(
  formData: FormData
): Promise<ApiResponse<{ subscriptionId: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  const planSlug = (formData.get('planSlug') as string | null)?.trim() ?? ''
  const screenshotUrl = (formData.get('screenshotUrl') as string | null)?.trim() ?? ''
  const transactionId = (formData.get('transactionId') as string | null)?.trim() ?? ''

  if (!VALID_PAID_PLANS.has(planSlug)) {
    return { success: false, error: 'Invalid plan selected' }
  }

  if (!screenshotUrl) {
    return { success: false, error: 'Screenshot is required' }
  }

  // Validate screenshot URL starts with https://
  if (!screenshotUrl.startsWith('https://')) {
    return { success: false, error: 'Invalid screenshot URL' }
  }

  const plan = PLANS[planSlug as PlanSlug]
  if (!plan) {
    return { success: false, error: 'Plan not found' }
  }

  // Calculate period: now to now + 30 days
  const now = new Date()
  const periodStart = now.toISOString().split('T')[0]
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const subscription = await createSubscription({
    teacherId: teacher.id,
    plan: planSlug,
    amountPkr: plan.price_pkr,
    paymentMethod: 'screenshot',
    screenshotUrl,
    gatewayTransactionId: transactionId || undefined,
    status: 'pending_verification',
    periodStart,
    periodEnd,
  })

  if (!subscription) {
    return { success: false, error: 'Failed to create subscription. Please try again.' }
  }

  // Notify admin about new screenshot
  await sendEmail({
    to: process.env.ADMIN_EMAIL ?? 'admin@skoolrooms.com',
    type: 'new_subscription_screenshot',
    recipientId: 'admin',
    recipientType: 'teacher', // admin notifications use teacher type for routing
    data: {
      teacherName: teacher.name,
      teacherEmail: teacher.email,
      planSlug,
      amountPkr: plan.price_pkr,
      subscriptionId: subscription.id,
    },
  })

  return {
    success: true,
    data: { subscriptionId: subscription.id },
  }
}

// -----------------------------------------------------------------------------
// approveSubscriptionAction — Admin approves subscription
// Sets teacher plan, plan_expires_at, clears grace/trial, creates snapshot
// -----------------------------------------------------------------------------

export async function approveSubscriptionAction(
  subscriptionId: string
): Promise<ApiResponse<null>> {
  // Verify admin
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  // Get subscription
  const subscription = await getSubscriptionById(subscriptionId)
  if (!subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'pending_verification') {
    return { success: false, error: 'Subscription is not pending verification' }
  }

  // Approve the subscription record
  const approved = await approveSubscription(subscriptionId)
  if (!approved) {
    return { success: false, error: 'Failed to approve subscription' }
  }

  // Update teacher plan
  const updated = await updateTeacher(subscription.teacher_id, {
    plan: subscription.plan,
    plan_expires_at: new Date(subscription.period_end + 'T23:59:59Z').toISOString(),
    grace_until: null,
    trial_ends_at: null,
  })

  if (!updated) {
    return { success: false, error: 'Failed to update teacher plan' }
  }

  // Get plan row ID for snapshot
  const adminSupabase = createAdminClient()
  const { data: planRow } = await adminSupabase
    .from('plans')
    .select('id, max_courses, max_students, max_cohorts_active, max_storage_mb, max_teachers, name, slug, price_pkr, transaction_cut_percent')
    .eq('slug', subscription.plan)
    .single()

  if (planRow) {
    // Get plan features
    const { data: features } = await adminSupabase
      .from('plan_features')
      .select('feature_key, is_enabled')
      .eq('plan_id', planRow.id as string)

    const featuresMap: Record<string, boolean> = {}
    if (features) {
      for (const f of features) {
        featuresMap[f.feature_key as string] = f.is_enabled as boolean
      }
    }

    // Create snapshot
    await createPlanSnapshot(subscription.teacher_id, planRow.id as string, {
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
      approvedAt: new Date().toISOString(),
      periodStart: subscription.period_start,
      periodEnd: subscription.period_end,
    })
  }

  // Send approval email to teacher
  await sendEmail({
    to: updated.email,
    type: 'payment_approved',
    recipientId: subscription.teacher_id,
    recipientType: 'teacher',
    data: {
      teacherName: updated.name,
      planName: subscription.plan,
      periodEnd: subscription.period_end,
    },
  })

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// rejectSubscriptionAction — Admin rejects subscription with reason
// -----------------------------------------------------------------------------

export async function rejectSubscriptionAction(
  subscriptionId: string,
  formData: FormData
): Promise<ApiResponse<null>> {
  // Verify admin
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const reason = (formData.get('reason') as string | null)?.trim() ?? 'No reason provided'

  // Get subscription
  const subscription = await getSubscriptionById(subscriptionId)
  if (!subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'pending_verification') {
    return { success: false, error: 'Subscription is not pending verification' }
  }

  // Reject the subscription
  const rejected = await rejectSubscription(subscriptionId, reason)
  if (!rejected) {
    return { success: false, error: 'Failed to reject subscription' }
  }

  // Get teacher info for email
  const adminSupabase = createAdminClient()
  const { data: teacher } = await adminSupabase
    .from('teachers')
    .select('name, email')
    .eq('id', subscription.teacher_id)
    .single()

  if (teacher) {
    // Send rejection email to teacher
    await sendEmail({
      to: teacher.email as string,
      type: 'payment_rejected',
      recipientId: subscription.teacher_id,
      recipientType: 'teacher',
      data: {
        teacherName: teacher.name,
        planName: subscription.plan,
        reason,
      },
    })
  }

  return { success: true, data: null }
}
