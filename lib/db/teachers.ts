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
// getTeacherPlanSnapshot — Returns the snapshot row for a teacher (or null).
// Snapshot represents grandfathered terms captured at subscription time.
// -----------------------------------------------------------------------------
export type TeacherPlanSnapshot = {
  isGrandfathered: boolean
  capturedAt: string | null
  features: Record<string, boolean>
  limits: Record<string, number>
}

export async function getTeacherPlanSnapshot(
  teacherId: string,
  livePlanDetails: PlanDetails | null,
): Promise<TeacherPlanSnapshot | null> {
  const supabase = createAdminClient()

  const { data: row } = await supabase
    .from('teacher_plan_snapshot')
    .select('snapshot_json, created_at')
    .eq('teacher_id', teacherId)
    .single()

  if (!row || !row.snapshot_json) return null

  const snapshot = row.snapshot_json as {
    features?: Record<string, boolean>
    limits?: Record<string, number>
  }
  const snapshotFeatures = snapshot.features ?? {}
  const snapshotLimits = snapshot.limits ?? {}

  // Treat snapshot as grandfathered only when it actually differs from live.
  let differs = false
  if (livePlanDetails) {
    for (const [key, value] of Object.entries(snapshotFeatures)) {
      if (livePlanDetails.features[key] !== value) {
        differs = true
        break
      }
    }
    if (!differs) {
      for (const [key, value] of Object.entries(snapshotLimits)) {
        const live = livePlanDetails.limits[key]
        if (live !== value) {
          differs = true
          break
        }
      }
    }
  } else {
    differs = true
  }

  return {
    isGrandfathered: differs,
    capturedAt: (row.created_at as string | null) ?? null,
    features: snapshotFeatures,
    limits: snapshotLimits,
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

// -----------------------------------------------------------------------------
// Dashboard Stats — Aggregated stats for the teacher dashboard bento grid
// -----------------------------------------------------------------------------

export type TeacherDashboardStats = {
  activeCourses: number
  totalStudents: number
  pendingPayments: number
  totalRevenuePkr: number
  accountCreatedAt: string
}

/**
 * getTeacherDashboardStats — Fetch aggregated numbers for the dashboard stat cards.
 * Returns course count, student count, pending payment count, and total revenue.
 */
export async function getTeacherDashboardStats(
  teacherId: string
): Promise<TeacherDashboardStats> {
  const supabase = createAdminClient()

  // Count published courses
  const { count: courseCount } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'published')
    .is('deleted_at', null)

  // Get all cohort IDs for this teacher
  const { data: cohortRows } = await supabase
    .from('cohorts')
    .select('id')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)

  const cohortIds = cohortRows?.map((c) => c.id as string) ?? []

  let studentCount = 0
  let pendingPaymentCount = 0
  let totalRevenue = 0

  if (cohortIds.length > 0) {
    // Count active enrollments
    const { count: enrollCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .in('cohort_id', cohortIds)
      .eq('status', 'active')

    studentCount = enrollCount ?? 0

    // Count pending screenshot payments (status = 'pending_verification')
    const { data: pendingPayments } = await supabase
      .from('student_payments')
      .select('id, enrollment_id, enrollments!inner(cohort_id)')
      .eq('status', 'pending_verification')
      .in('enrollments.cohort_id', cohortIds)

    pendingPaymentCount = pendingPayments?.length ?? 0

    // Sum verified payments for total revenue
    const { data: verifiedPayments } = await supabase
      .from('student_payments')
      .select('teacher_payout_amount_pkr, enrollment_id, enrollments!inner(cohort_id)')
      .eq('status', 'verified')
      .in('enrollments.cohort_id', cohortIds)

    if (verifiedPayments) {
      totalRevenue = verifiedPayments.reduce(
        (sum, p) => sum + ((p.teacher_payout_amount_pkr as number) ?? 0),
        0
      )
    }
  }

  // Get teacher created_at for "active days" calculation
  const { data: teacherRow } = await supabase
    .from('teachers')
    .select('created_at')
    .eq('id', teacherId)
    .single()

  return {
    activeCourses: courseCount ?? 0,
    totalStudents: studentCount,
    pendingPayments: pendingPaymentCount,
    totalRevenuePkr: totalRevenue,
    accountCreatedAt: (teacherRow?.created_at as string) ?? new Date().toISOString(),
  }
}

// -----------------------------------------------------------------------------
// Revenue by month — For the revenue trend chart
// -----------------------------------------------------------------------------

export type MonthlyRevenue = {
  month: string // "Jan", "Feb", etc.
  revenue: number
}

/**
 * getTeacherMonthlyRevenue — Returns last 6 months of revenue data
 * for the teacher dashboard revenue chart.
 */
export async function getTeacherMonthlyRevenue(
  teacherId: string
): Promise<MonthlyRevenue[]> {
  const supabase = createAdminClient()

  // Get all teacher cohort IDs
  const { data: cohortRows } = await supabase
    .from('cohorts')
    .select('id')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)

  const cohortIds = cohortRows?.map((c) => c.id as string) ?? []

  if (cohortIds.length === 0) {
    return buildEmptyMonths()
  }

  // Fetch all verified payments in the last 6 months
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const { data: payments } = await supabase
    .from('student_payments')
    .select('teacher_payout_amount_pkr, verified_at, enrollment_id, enrollments!inner(cohort_id)')
    .eq('status', 'verified')
    .in('enrollments.cohort_id', cohortIds)
    .gte('verified_at', sixMonthsAgo.toISOString())

  // Aggregate by month
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthMap = new Map<string, number>()

  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
    monthMap.set(key, 0)
  }

  if (payments) {
    for (const p of payments) {
      if (p.verified_at) {
        const date = new Date(p.verified_at as string)
        const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
        if (monthMap.has(key)) {
          monthMap.set(key, (monthMap.get(key) ?? 0) + ((p.teacher_payout_amount_pkr as number) ?? 0))
        }
      }
    }
  }

  return Array.from(monthMap.entries()).map(([month, revenue]) => ({
    month: month.split(' ')[0], // Just the short month name for chart display
    revenue,
  }))
}

function buildEmptyMonths(): MonthlyRevenue[] {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const result: MonthlyRevenue[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    result.push({ month: monthNames[d.getMonth()], revenue: 0 })
  }
  return result
}

// -----------------------------------------------------------------------------
// Recent Enrollments — For the dashboard recent enrollments list
// -----------------------------------------------------------------------------

export type RecentEnrollmentRow = {
  id: string
  studentName: string
  cohortName: string
  courseName: string
  status: string
  createdAt: string
}

/**
 * getRecentEnrollmentsByTeacher — Returns the latest enrollments across
 * all teacher cohorts for the dashboard list card.
 */
export async function getRecentEnrollmentsByTeacher(
  teacherId: string,
  limit: number
): Promise<RecentEnrollmentRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id, status, created_at,
      students!inner(name),
      cohorts!inner(name, teacher_id, courses!inner(title))
    `)
    .eq('cohorts.teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((row) => {
    // Supabase returns !inner joins as objects (single), but TS sees them loosely
    const student = row.students as unknown as { name: string }
    const cohort = row.cohorts as unknown as { name: string; courses: { title: string } }

    return {
      id: row.id as string,
      studentName: student.name,
      cohortName: cohort.name,
      courseName: cohort.courses.title,
      status: row.status as string,
      createdAt: row.created_at as string,
    }
  })
}
