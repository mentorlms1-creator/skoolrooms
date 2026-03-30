// =============================================================================
// lib/db/teachers.ts — Teacher CRUD queries (service layer)
// All database queries for teachers go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { PlanDetails, UsageData } from '@/providers/TeacherProvider'
import type { PlanSlug } from '@/types/domain'

// -----------------------------------------------------------------------------
// Row types (mirrors the teachers table from 001_initial_schema.sql)
// These will be replaced by auto-generated types once `npx supabase gen types`
// is run. Until then, we define them manually.
// -----------------------------------------------------------------------------

export type TeacherRow = {
  id: string
  supabase_auth_id: string | null
  name: string
  email: string
  pending_email: string | null
  email_verified_at: string | null
  subdomain: string
  subdomain_changed_at: string | null
  plan: string
  plan_expires_at: string | null
  grace_until: string | null
  trial_ends_at: string | null
  onboarding_completed: boolean
  onboarding_steps_json: Record<string, boolean>
  referral_code: string | null
  is_publicly_listed: boolean
  subject_tags: string[]
  teaching_levels: string[]
  profile_photo_url: string | null
  city: string | null
  bio: string | null
  notification_preferences_json: Record<string, unknown>
  is_suspended: boolean
  suspended_at: string | null
  created_at: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// getTeacherByAuthId — Look up teacher by Supabase Auth user ID
// -----------------------------------------------------------------------------
export async function getTeacherByAuthId(
  authId: string
): Promise<TeacherRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('supabase_auth_id', authId)
    .single()

  if (error || !data) return null
  return data as TeacherRow
}

// -----------------------------------------------------------------------------
// getTeacherById — Look up teacher by primary key
// -----------------------------------------------------------------------------
export async function getTeacherById(
  id: string
): Promise<TeacherRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as TeacherRow
}

// -----------------------------------------------------------------------------
// getTeacherBySubdomain — Look up non-suspended teacher by subdomain
// -----------------------------------------------------------------------------
export async function getTeacherBySubdomain(
  subdomain: string
): Promise<TeacherRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('subdomain', subdomain)
    .eq('is_suspended', false)
    .single()

  if (error || !data) return null
  return data as TeacherRow
}

// -----------------------------------------------------------------------------
// updateTeacher — Partial update with automatic updated_at
// -----------------------------------------------------------------------------
export async function updateTeacher(
  teacherId: string,
  updates: Record<string, unknown>
): Promise<TeacherRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teachers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', teacherId)
    .select('*')
    .single()

  if (error || !data) return null
  return data as TeacherRow
}

// -----------------------------------------------------------------------------
// getTeacherPlanDetails — Build PlanDetails shape for TeacherProvider
// Fetches the plan row by slug, then all plan_features for that plan.
// -----------------------------------------------------------------------------
export async function getTeacherPlanDetails(
  teacherId: string
): Promise<PlanDetails | null> {
  const supabase = createAdminClient()

  // Step 1: Get teacher's plan slug
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('plan')
    .eq('id', teacherId)
    .single()

  if (teacherError || !teacher) return null

  const planSlug = teacher.plan as string

  // Step 2: Get the plan row
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('slug', planSlug)
    .single()

  if (planError || !plan) return null

  // Step 3: Get plan features
  const { data: features, error: featuresError } = await supabase
    .from('plan_features')
    .select('feature_key, is_enabled')
    .eq('plan_id', plan.id as string)

  if (featuresError) return null

  // Build the features record
  const featuresMap: Record<string, boolean> = {}
  if (features) {
    for (const f of features) {
      featuresMap[f.feature_key as string] = f.is_enabled as boolean
    }
  }

  // Build the limits record from the plan row
  const limits: Record<string, number | null> = {
    max_courses: plan.max_courses as number,
    max_students: plan.max_students as number,
    max_cohorts_active: plan.max_cohorts_active as number,
    max_storage_mb: plan.max_storage_mb as number,
    max_teachers: (plan.max_teachers as number | null) ?? 1,
  }

  return {
    name: plan.name as string,
    slug: planSlug as PlanSlug,
    pricePerMonth: plan.price_pkr as number,
    limits,
    features: featuresMap,
  }
}

// -----------------------------------------------------------------------------
// getTeacherUsage — Build UsageData shape for TeacherProvider
// Counts published courses, active enrollments, and active cohorts.
// -----------------------------------------------------------------------------
export async function getTeacherUsage(
  teacherId: string
): Promise<UsageData> {
  const supabase = createAdminClient()

  // Count published courses (status='published', not soft-deleted)
  const { count: courseCount } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'published')
    .is('deleted_at', null)

  // Count active cohorts (status='active', not soft-deleted)
  const { count: cohortCount } = await supabase
    .from('cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'active')
    .is('deleted_at', null)

  // Count active enrollments in this teacher's cohorts
  // First get all cohort IDs for this teacher, then count active enrollments
  const { data: cohortIds } = await supabase
    .from('cohorts')
    .select('id')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)

  let studentCount = 0
  if (cohortIds && cohortIds.length > 0) {
    const ids = cohortIds.map((c) => c.id as string)
    const { count } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .in('cohort_id', ids)
      .eq('status', 'active')

    studentCount = count ?? 0
  }

  return {
    courses: courseCount ?? 0,
    students: studentCount,
    cohortsActive: cohortCount ?? 0,
    storageMb: 0, // TODO: Calculate from R2 storage usage once implemented
  }
}

// -----------------------------------------------------------------------------
// hasPaymentSettings — Check if teacher has at least one payment method set
// -----------------------------------------------------------------------------
export async function hasPaymentSettings(
  teacherId: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_payment_settings')
    .select('payout_iban, jazzcash_number, easypaisa_number')
    .eq('teacher_id', teacherId)
    .single()

  if (error || !data) return false

  // At least one payment method must be set
  return !!(
    (data.payout_iban as string | null) ||
    (data.jazzcash_number as string | null) ||
    (data.easypaisa_number as string | null)
  )
}

// -----------------------------------------------------------------------------
// isSubdomainAvailable — Check if subdomain is unique
// Optionally exclude a specific teacher (for updates)
// -----------------------------------------------------------------------------
export async function isSubdomainAvailable(
  subdomain: string,
  excludeTeacherId?: string
): Promise<boolean> {
  const supabase = createAdminClient()

  let query = supabase
    .from('teachers')
    .select('id', { count: 'exact', head: true })
    .eq('subdomain', subdomain)

  if (excludeTeacherId) {
    query = query.neq('id', excludeTeacherId)
  }

  const { count } = await query

  return (count ?? 0) === 0
}
