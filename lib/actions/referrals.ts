'use server'

// =============================================================================
// lib/actions/referrals.ts — Server actions for teacher referrals
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import {
  getTeacherByReferralCode,
  getReferralsByReferrer,
  getReferralByReferredTeacher,
  createReferral,
  updateReferralStatus,
  getTeacherReferralCode,
  setTeacherReferralCode,
} from '@/lib/db/referrals'
import { createAdminClient } from '@/supabase/server'
import { sendEmail } from '@/lib/email/sender'
import { platformUrl } from '@/lib/platform/domain'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/types/api'

// Safe charset — no 0/O/1/I/L ambiguity, exact 6 chars per plan
const REFERRAL_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const REFERRAL_CODE_LENGTH = 6

function generateCode(): string {
  let code = ''
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_CHARSET[Math.floor(Math.random() * REFERRAL_CODE_CHARSET.length)]
  }
  return code
}

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return getTeacherByAuthId(user.id)
}

// -----------------------------------------------------------------------------
// generateReferralCodeAction — Teacher gets or generates their referral code
// -----------------------------------------------------------------------------
export async function generateReferralCodeAction(): Promise<
  ApiResponse<{ referralCode: string; referralUrl: string }>
> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  // Return existing code if already set
  const existing = await getTeacherReferralCode(teacher.id)
  if (existing) {
    const referralUrl = platformUrl(`/signup?ref=${existing}`)
    return { success: true, data: { referralCode: existing, referralUrl } }
  }

  // Generate unique code (retry on conflict)
  const supabase = createAdminClient()
  let code = ''
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode()
    const { count } = await supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('referral_code', candidate)

    if ((count ?? 0) === 0) {
      code = candidate
      break
    }
  }

  if (!code) {
    return { success: false, error: 'Failed to generate a unique referral code. Please try again.' }
  }

  const saved = await setTeacherReferralCode(teacher.id, code)
  if (!saved) {
    return { success: false, error: 'Failed to save referral code.' }
  }

  revalidatePath('/dashboard/settings/referrals')

  const referralUrl = platformUrl(`/signup?ref=${code}`)
  return { success: true, data: { referralCode: code, referralUrl } }
}

// -----------------------------------------------------------------------------
// convertReferralAction — Called at teacher signup when a referral code is present
// Creates a pending referrals row. Idempotent.
// Exported for Lane G (signup) to call.
// -----------------------------------------------------------------------------
export async function convertReferralAction(
  referralCode: string,
  newTeacherId: string
): Promise<ApiResponse<null>> {
  if (!referralCode || !newTeacherId) return { success: false, error: 'Missing parameters.' }

  // Look up the referrer teacher by their referral code
  const referrer = await getTeacherByReferralCode(referralCode)
  if (!referrer) return { success: false, error: 'Referral code not found.' }

  // Prevent self-referral
  if (referrer.id === newTeacherId) {
    return { success: false, error: 'Cannot refer yourself.' }
  }

  // Idempotent: if referral row already exists for this referred teacher, skip
  const existing = await getReferralByReferredTeacher(newTeacherId)
  if (existing) return { success: true, data: null }

  await createReferral({
    referrerTeacherId: referrer.id,
    referredTeacherId: newTeacherId,
    referralCode: referralCode.toUpperCase(),
  })

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// creditReferralAction — Called after referred teacher's first paid subscription
// Extends both teachers' plan_expires_at by 30 days, sends referral_converted email
// Guard: only runs if referral is still 'pending'
// -----------------------------------------------------------------------------
export async function creditReferralAction(
  referredTeacherId: string
): Promise<ApiResponse<null>> {
  if (!referredTeacherId) return { success: false, error: 'Missing teacher ID.' }

  const referral = await getReferralByReferredTeacher(referredTeacherId)

  // No referral row or already credited — nothing to do
  if (!referral || referral.status !== 'pending') return { success: true, data: null }

  const supabase = createAdminClient()

  // Extend both teachers' plan_expires_at by 30 days
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

  for (const teacherId of [referral.referrer_teacher_id, referral.referred_teacher_id]) {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('plan_expires_at')
      .eq('id', teacherId)
      .single()

    if (!teacher) continue

    const currentExpiry = teacher.plan_expires_at
      ? new Date(teacher.plan_expires_at as string)
      : new Date()

    // If expired (in the past), start from now
    const baseDate = currentExpiry < new Date() ? new Date() : currentExpiry
    const newExpiry = new Date(baseDate.getTime() + thirtyDaysMs)

    await supabase
      .from('teachers')
      .update({
        plan_expires_at: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', teacherId)
  }

  // Mark referral as credited
  await updateReferralStatus(referral.id, 'credited', new Date().toISOString())

  // Send referral_converted email to referrer
  const { data: referrerTeacher } = await supabase
    .from('teachers')
    .select('name, email')
    .eq('id', referral.referrer_teacher_id)
    .single()

  const { data: referredTeacher } = await supabase
    .from('teachers')
    .select('name')
    .eq('id', referral.referred_teacher_id)
    .single()

  if (referrerTeacher) {
    await sendEmail({
      to: referrerTeacher.email as string,
      type: 'referral_converted',
      recipientId: referral.referrer_teacher_id,
      recipientType: 'teacher',
      data: {
        teacherName: referrerTeacher.name as string,
        referredName: (referredTeacher?.name as string) ?? 'A teacher',
        bonusDays: 30,
      },
    })
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// getReferralsAction — Teacher fetches their referral list
// -----------------------------------------------------------------------------
export async function getReferralsAction(): Promise<
  ApiResponse<Awaited<ReturnType<typeof getReferralsByReferrer>>>
> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated' }

  const referrals = await getReferralsByReferrer(teacher.id)
  return { success: true, data: referrals }
}
