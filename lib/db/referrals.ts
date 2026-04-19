// =============================================================================
// lib/db/referrals.ts — Referral CRUD queries (service layer)
// =============================================================================

import { createAdminClient } from '@/supabase/server'

export type ReferralRow = {
  id: string
  referrer_teacher_id: string
  referred_teacher_id: string
  referral_code: string
  status: string
  credit_applied_at: string | null
  created_at: string
}

// -----------------------------------------------------------------------------
// getReferralByCode — Look up referral by the referral_code column in referrals
// (Note: we look up the teacher who owns this code, then create a referral row)
// -----------------------------------------------------------------------------
export async function getTeacherByReferralCode(
  code: string
): Promise<{ id: string; name: string; email: string } | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('id, name, email')
    .eq('referral_code', code.toUpperCase())
    .single()

  if (error || !data) return null
  return data as { id: string; name: string; email: string }
}

// -----------------------------------------------------------------------------
// getReferralsByReferrer — All referrals where this teacher is the referrer
// -----------------------------------------------------------------------------
export async function getReferralsByReferrer(
  teacherId: string
): Promise<(ReferralRow & { referred: { name: string; email: string } | null })[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('referrals')
    .select(`
      *,
      referred:referred_teacher_id(name, email)
    `)
    .eq('referrer_teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as (ReferralRow & { referred: { name: string; email: string } | null })[]
}

// -----------------------------------------------------------------------------
// getReferralByReferredTeacher — Check if a referral row exists for this teacher
// -----------------------------------------------------------------------------
export async function getReferralByReferredTeacher(
  referredTeacherId: string
): Promise<ReferralRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referred_teacher_id', referredTeacherId)
    .single()

  if (error || !data) return null
  return data as ReferralRow
}

// -----------------------------------------------------------------------------
// createReferral — Insert a new referral row (service role only)
// -----------------------------------------------------------------------------
export async function createReferral(input: {
  referrerTeacherId: string
  referredTeacherId: string
  referralCode: string
}): Promise<ReferralRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('referrals')
    .insert({
      referrer_teacher_id: input.referrerTeacherId,
      referred_teacher_id: input.referredTeacherId,
      referral_code: input.referralCode.toUpperCase(),
      status: 'pending',
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as ReferralRow
}

// -----------------------------------------------------------------------------
// updateReferralStatus — Update referral status + credit_applied_at
// -----------------------------------------------------------------------------
export async function updateReferralStatus(
  id: string,
  status: 'pending' | 'credited',
  creditAppliedAt?: string
): Promise<ReferralRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('referrals')
    .update({
      status,
      credit_applied_at: creditAppliedAt ?? null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) return null
  return data as ReferralRow
}

// -----------------------------------------------------------------------------
// getTeacherReferralCode — Get the teacher's personal referral code
// -----------------------------------------------------------------------------
export async function getTeacherReferralCode(
  teacherId: string
): Promise<string | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('referral_code')
    .eq('id', teacherId)
    .single()

  if (error || !data) return null
  return (data.referral_code as string | null) ?? null
}

// -----------------------------------------------------------------------------
// setTeacherReferralCode — Persist a referral code on the teacher row
// -----------------------------------------------------------------------------
export async function setTeacherReferralCode(
  teacherId: string,
  code: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('teachers')
    .update({ referral_code: code.toUpperCase(), updated_at: new Date().toISOString() })
    .eq('id', teacherId)

  return !error
}
