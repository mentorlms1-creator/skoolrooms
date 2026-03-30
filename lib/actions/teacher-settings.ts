'use server'

// =============================================================================
// lib/actions/teacher-settings.ts — Server actions for teacher settings
// Payment settings, notification preferences, and profile updates.
// =============================================================================

import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId, updateTeacher } from '@/lib/db/teachers'
import { completeOnboardingStep } from '@/lib/actions/onboarding'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/types/api'

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

// -----------------------------------------------------------------------------
// updatePaymentSettingsAction — Save bank/mobile wallet details
// -----------------------------------------------------------------------------
export async function updatePaymentSettingsAction(
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  const bankName = (formData.get('bank_name') as string | null)?.trim() || null
  const accountTitle = (formData.get('account_title') as string | null)?.trim() || null
  const iban = (formData.get('iban') as string | null)?.trim() || null
  const jazzcashNumber = (formData.get('jazzcash_number') as string | null)?.trim() || null
  const easypaisaNumber = (formData.get('easypaisa_number') as string | null)?.trim() || null
  const instructions = (formData.get('instructions') as string | null)?.trim() || null
  const qrCodeUrl = (formData.get('qr_code_url') as string | null)?.trim() || null

  // At least one payment method must be set
  if (!iban && !jazzcashNumber && !easypaisaNumber) {
    return {
      success: false,
      error: 'Please provide at least one payment method (IBAN, JazzCash, or EasyPaisa).',
    }
  }

  const supabase = createAdminClient()

  // Upsert payment settings
  const { error: upsertError } = await supabase
    .from('teacher_payment_settings')
    .upsert(
      {
        teacher_id: teacher.id,
        payout_bank_name: bankName,
        payout_account_title: accountTitle,
        payout_iban: iban,
        jazzcash_number: jazzcashNumber,
        easypaisa_number: easypaisaNumber,
        qr_code_url: qrCodeUrl,
        instructions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'teacher_id' }
    )

  if (upsertError) {
    return { success: false, error: 'Failed to save payment settings.' }
  }

  // Mark onboarding step complete
  await completeOnboardingStep('payment_details_set')

  revalidatePath('/dashboard/settings/payments')
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// updateNotificationPreferencesAction — Save notification toggles
// -----------------------------------------------------------------------------

/**
 * Business-critical email types that CANNOT be opted out.
 * These are forced to true before saving preferences.
 */
const MANDATORY_EMAIL_TYPES: readonly string[] = [
  'payment_approved',
  'payment_rejected',
  'enrollment_confirmed',
  'enrollment_rejected',
  'enrollment_revoked',
  'subscription_approved',
  'subscription_rejected',
  'plan_downgraded',
  'payout_processed',
  'payout_failed',
  'refund_debit_recorded',
  'refund_debit_recovered',
  'cohort_archived',
] as const

export async function updateNotificationPreferencesAction(
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Build preferences object from form data
  // Form submits checkboxes as "on" when checked, absent when unchecked
  const preferences: Record<string, boolean> = {
    enrollment_confirmed: formData.get('enrollment_confirmed') === 'on',
    payment_approved: formData.get('payment_approved') === 'on',
    payment_rejected: formData.get('payment_rejected') === 'on',
    new_enrollment: formData.get('new_enrollment') === 'on',
    student_comment: formData.get('student_comment') === 'on',
    class_reminder: formData.get('class_reminder') === 'on',
    fee_reminder: formData.get('fee_reminder') === 'on',
    payout_processed: formData.get('payout_processed') === 'on',
  }

  // Enforce business-critical email types — force to true regardless of input
  for (const key of MANDATORY_EMAIL_TYPES) {
    preferences[key] = true
  }

  const updated = await updateTeacher(teacher.id, {
    notification_preferences_json: preferences,
  })

  if (!updated) {
    return { success: false, error: 'Failed to save notification preferences.' }
  }

  revalidatePath('/dashboard/settings/notifications')
  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// updateProfileAction — Update teacher profile (name, bio, photo, etc.)
// -----------------------------------------------------------------------------
export async function updateProfileAction(
  formData: FormData
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  const name = (formData.get('name') as string | null)?.trim()
  const bio = (formData.get('bio') as string | null)?.trim() || null
  const city = (formData.get('city') as string | null)?.trim() || null
  const profilePhotoUrl = (formData.get('profile_photo_url') as string | null)?.trim() || null
  const isPubliclyListed = formData.get('is_publicly_listed') === 'on'

  // Parse subject tags and teaching levels from comma-separated strings
  const subjectTagsRaw = (formData.get('subject_tags') as string | null)?.trim() ?? ''
  const teachingLevelsRaw = (formData.get('teaching_levels') as string | null)?.trim() ?? ''

  const subjectTags = subjectTagsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const teachingLevels = teachingLevelsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (!name || name.length < 2) {
    return { success: false, error: 'Name must be at least 2 characters.' }
  }

  const updates: Record<string, unknown> = {
    name,
    bio,
    city,
    is_publicly_listed: isPubliclyListed,
    subject_tags: subjectTags,
    teaching_levels: teachingLevels,
  }

  // Only update photo URL if provided
  if (profilePhotoUrl) {
    updates.profile_photo_url = profilePhotoUrl
  }

  const updated = await updateTeacher(teacher.id, updates)

  if (!updated) {
    return { success: false, error: 'Failed to save profile.' }
  }

  revalidatePath('/dashboard/settings')
  return { success: true, data: null }
}
