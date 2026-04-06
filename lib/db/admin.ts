// =============================================================================
// lib/db/admin.ts — Admin CRUD queries (service layer)
// All database queries for admin operations go through this file.
// Uses createAdminClient (sync, bypasses RLS — intentional for admin).
// =============================================================================

import { createAdminClient } from '@/supabase/server'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type AdminTeacherListItem = {
  id: string
  name: string
  email: string
  subdomain: string
  plan: string
  is_suspended: boolean
  created_at: string
  updated_at: string
  student_count: number
}

export type AdminTeacherDetail = {
  id: string
  name: string
  email: string
  subdomain: string
  plan: string
  plan_expires_at: string | null
  grace_until: string | null
  trial_ends_at: string | null
  onboarding_completed: boolean
  onboarding_steps_json: Record<string, boolean>
  is_publicly_listed: boolean
  subject_tags: string[]
  teaching_levels: string[]
  profile_photo_url: string | null
  city: string | null
  bio: string | null
  is_suspended: boolean
  suspended_at: string | null
  created_at: string
  updated_at: string
  student_count: number
  subscription_history: SubscriptionHistoryItem[]
  activity_log: ActivityLogItem[]
}

export type SubscriptionHistoryItem = {
  id: string
  plan: string
  amount_pkr: number
  payment_method: string
  status: string
  period_start: string
  period_end: string
  created_at: string
}

export type ActivityLogItem = {
  id: string
  teacher_id: string | null
  action_type: string
  performed_by: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export type DashboardStats = {
  mrr: number
  signupsThisWeek: number
  signupsLastWeek: number
  signupsThisMonth: number
  signupsLastMonth: number
  planDistribution: { plan: string; count: number }[]
}

export type OperationsStats = {
  totalActiveCohorts: number
  totalStudents: number
  pendingPaymentCount: number
}

export type PlatformSettingRow = {
  id: string
  key: string
  value: string
  description: string
  updated_at: string
}

// -----------------------------------------------------------------------------
// getAllTeachers — List teachers with student count
// -----------------------------------------------------------------------------
export async function getAllTeachers(): Promise<AdminTeacherListItem[]> {
  const supabase = createAdminClient()

  // Get all teachers
  const { data: teachers, error } = await supabase
    .from('teachers')
    .select('id, name, email, subdomain, plan, is_suspended, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error || !teachers) return []

  // Get student counts per teacher via cohorts -> enrollments
  const teacherIds = teachers.map((t) => t.id as string)
  if (teacherIds.length === 0) return []

  // Get all cohort IDs grouped by teacher
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, teacher_id')
    .in('teacher_id', teacherIds)
    .is('deleted_at', null)

  const teacherCohortIds: Record<string, string[]> = {}
  if (cohorts) {
    for (const c of cohorts) {
      const tid = c.teacher_id as string
      if (!teacherCohortIds[tid]) teacherCohortIds[tid] = []
      teacherCohortIds[tid].push(c.id as string)
    }
  }

  // Get all active enrollment counts per cohort
  const allCohortIds = cohorts?.map((c) => c.id as string) ?? []
  const enrollmentCounts: Record<string, number> = {}

  if (allCohortIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('cohort_id')
      .in('cohort_id', allCohortIds)
      .eq('status', 'active')

    if (enrollments) {
      for (const e of enrollments) {
        const cid = e.cohort_id as string
        enrollmentCounts[cid] = (enrollmentCounts[cid] ?? 0) + 1
      }
    }
  }

  return teachers.map((t) => {
    const tid = t.id as string
    const cohortIdsForTeacher = teacherCohortIds[tid] ?? []
    const studentCount = cohortIdsForTeacher.reduce(
      (sum, cid) => sum + (enrollmentCounts[cid] ?? 0),
      0
    )

    return {
      id: tid,
      name: t.name as string,
      email: t.email as string,
      subdomain: t.subdomain as string,
      plan: t.plan as string,
      is_suspended: t.is_suspended as boolean,
      created_at: t.created_at as string,
      updated_at: t.updated_at as string,
      student_count: studentCount,
    }
  })
}

// -----------------------------------------------------------------------------
// getTeacherDetail — Full teacher profile for admin detail page
// -----------------------------------------------------------------------------
export async function getTeacherDetail(
  teacherId: string
): Promise<AdminTeacherDetail | null> {
  const supabase = createAdminClient()

  // Get teacher
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', teacherId)
    .single()

  if (teacherError || !teacher) return null

  // Get subscription history
  const { data: subscriptions } = await supabase
    .from('teacher_subscriptions')
    .select('id, plan, amount_pkr, payment_method, status, period_start, period_end, created_at')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  // Get activity log
  const { data: activity } = await supabase
    .from('admin_activity_log')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Get student count
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)

  let studentCount = 0
  if (cohorts && cohorts.length > 0) {
    const cohortIds = cohorts.map((c) => c.id as string)
    const { count } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .in('cohort_id', cohortIds)
      .eq('status', 'active')
    studentCount = count ?? 0
  }

  return {
    id: teacher.id as string,
    name: teacher.name as string,
    email: teacher.email as string,
    subdomain: teacher.subdomain as string,
    plan: teacher.plan as string,
    plan_expires_at: teacher.plan_expires_at as string | null,
    grace_until: teacher.grace_until as string | null,
    trial_ends_at: teacher.trial_ends_at as string | null,
    onboarding_completed: teacher.onboarding_completed as boolean,
    onboarding_steps_json: (teacher.onboarding_steps_json ?? {}) as Record<string, boolean>,
    is_publicly_listed: teacher.is_publicly_listed as boolean,
    subject_tags: (teacher.subject_tags ?? []) as string[],
    teaching_levels: (teacher.teaching_levels ?? []) as string[],
    profile_photo_url: teacher.profile_photo_url as string | null,
    city: teacher.city as string | null,
    bio: teacher.bio as string | null,
    is_suspended: teacher.is_suspended as boolean,
    suspended_at: teacher.suspended_at as string | null,
    created_at: teacher.created_at as string,
    updated_at: teacher.updated_at as string,
    student_count: studentCount,
    subscription_history: (subscriptions ?? []).map((s) => ({
      id: s.id as string,
      plan: s.plan as string,
      amount_pkr: s.amount_pkr as number,
      payment_method: s.payment_method as string,
      status: s.status as string,
      period_start: s.period_start as string,
      period_end: s.period_end as string,
      created_at: s.created_at as string,
    })),
    activity_log: (activity ?? []).map((a) => ({
      id: a.id as string,
      teacher_id: a.teacher_id as string | null,
      action_type: a.action_type as string,
      performed_by: a.performed_by as string,
      metadata: (a.metadata ?? null) as Record<string, unknown> | null,
      created_at: a.created_at as string,
    })),
  }
}

// -----------------------------------------------------------------------------
// logAdminActivity — Insert to admin_activity_log
// -----------------------------------------------------------------------------
export async function logAdminActivity(input: {
  teacherId?: string
  actionType: string
  performedBy: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('admin_activity_log').insert({
    teacher_id: input.teacherId ?? null,
    action_type: input.actionType,
    performed_by: input.performedBy,
    metadata: input.metadata ?? null,
  })
}

// -----------------------------------------------------------------------------
// getActivityLog — Filtered activity log
// -----------------------------------------------------------------------------
export async function getActivityLog(
  teacherId?: string
): Promise<ActivityLogItem[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('admin_activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (teacherId) {
    query = query.eq('teacher_id', teacherId)
  }

  const { data, error } = await query

  if (error || !data) return []

  return data.map((a) => ({
    id: a.id as string,
    teacher_id: a.teacher_id as string | null,
    action_type: a.action_type as string,
    performed_by: a.performed_by as string,
    metadata: (a.metadata ?? null) as Record<string, unknown> | null,
    created_at: a.created_at as string,
  }))
}

// -----------------------------------------------------------------------------
// getAdminDashboardStats — MRR, signups, plan distribution
// -----------------------------------------------------------------------------
export async function getAdminDashboardStats(): Promise<DashboardStats> {
  const supabase = createAdminClient()

  // MRR: Sum of active paid subscriptions
  const { data: activeTeachers } = await supabase
    .from('teachers')
    .select('plan')
    .in('plan', ['solo', 'academy'])
    .eq('is_suspended', false)

  const { data: plans } = await supabase
    .from('plans')
    .select('slug, price_pkr')

  const planPrices: Record<string, number> = {}
  if (plans) {
    for (const p of plans) {
      planPrices[p.slug as string] = p.price_pkr as number
    }
  }

  const mrr = (activeTeachers ?? []).reduce((sum, t) => {
    return sum + (planPrices[t.plan as string] ?? 0)
  }, 0)

  // Signups: this week vs last week, this month vs last month
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const { count: signupsThisWeek } = await supabase
    .from('teachers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo.toISOString())

  const { count: signupsLastWeek } = await supabase
    .from('teachers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', twoWeeksAgo.toISOString())
    .lt('created_at', weekAgo.toISOString())

  const { count: signupsThisMonth } = await supabase
    .from('teachers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', monthAgo.toISOString())

  const { count: signupsLastMonth } = await supabase
    .from('teachers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', twoMonthsAgo.toISOString())
    .lt('created_at', monthAgo.toISOString())

  // Plan distribution
  const { data: allTeachers } = await supabase
    .from('teachers')
    .select('plan')

  const planCounts: Record<string, number> = {}
  if (allTeachers) {
    for (const t of allTeachers) {
      const plan = t.plan as string
      planCounts[plan] = (planCounts[plan] ?? 0) + 1
    }
  }

  const planDistribution = Object.entries(planCounts).map(([plan, count]) => ({
    plan,
    count,
  }))

  return {
    mrr,
    signupsThisWeek: signupsThisWeek ?? 0,
    signupsLastWeek: signupsLastWeek ?? 0,
    signupsThisMonth: signupsThisMonth ?? 0,
    signupsLastMonth: signupsLastMonth ?? 0,
    planDistribution,
  }
}

// -----------------------------------------------------------------------------
// getPlatformSettings — All settings
// -----------------------------------------------------------------------------
export async function getPlatformSettings(): Promise<PlatformSettingRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .order('key')

  if (error || !data) return []

  return data.map((s) => ({
    id: s.id as string,
    key: s.key as string,
    value: s.value as string,
    description: s.description as string,
    updated_at: s.updated_at as string,
  }))
}

// -----------------------------------------------------------------------------
// updatePlatformSetting — Update single setting
// -----------------------------------------------------------------------------
export async function updatePlatformSetting(
  key: string,
  value: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('platform_settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key)

  return !error
}

// -----------------------------------------------------------------------------
// getOperationsStats — Active cohorts, total students, pending payments
// -----------------------------------------------------------------------------
export async function getOperationsStats(): Promise<OperationsStats> {
  const supabase = createAdminClient()

  const { count: totalActiveCohorts } = await supabase
    .from('cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .is('deleted_at', null)

  const { count: totalStudents } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })

  const { count: pendingPaymentCount } = await supabase
    .from('student_payments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending_verification')

  return {
    totalActiveCohorts: totalActiveCohorts ?? 0,
    totalStudents: totalStudents ?? 0,
    pendingPaymentCount: pendingPaymentCount ?? 0,
  }
}

// -----------------------------------------------------------------------------
// getTeacherPaymentSettings — Get payment settings for a teacher
// -----------------------------------------------------------------------------
export type TeacherPaymentSettingsRow = {
  id: string
  teacher_id: string
  payout_bank_name: string | null
  payout_account_title: string | null
  payout_iban: string | null
  jazzcash_number: string | null
  easypaisa_number: string | null
  qr_code_url: string | null
  instructions: string | null
  updated_at: string
}

export async function getTeacherPaymentSettings(
  teacherId: string
): Promise<TeacherPaymentSettingsRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_payment_settings')
    .select('*')
    .eq('teacher_id', teacherId)
    .single()

  if (error || !data) return null

  return {
    id: data.id as string,
    teacher_id: data.teacher_id as string,
    payout_bank_name: data.payout_bank_name as string | null,
    payout_account_title: data.payout_account_title as string | null,
    payout_iban: data.payout_iban as string | null,
    jazzcash_number: data.jazzcash_number as string | null,
    easypaisa_number: data.easypaisa_number as string | null,
    qr_code_url: data.qr_code_url as string | null,
    instructions: data.instructions as string | null,
    updated_at: data.updated_at as string,
  }
}

// -----------------------------------------------------------------------------
// getTeacherAnalytics — Revenue data for teacher analytics page
// -----------------------------------------------------------------------------
export type TeacherAnalyticsData = {
  revenueThisMonth: number
  revenueLastMonth: number
  pendingAmount: number
  perCohortBreakdown: {
    cohortId: string
    cohortName: string
    courseName: string
    revenue: number
    studentCount: number
  }[]
  recentStudents: {
    id: string
    name: string
    email: string
    cohortName: string
    enrolledAt: string
  }[]
}

export async function getTeacherAnalytics(
  teacherId: string
): Promise<TeacherAnalyticsData> {
  const supabase = createAdminClient()

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  // Get cohorts for this teacher
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, name, course_id')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)

  if (!cohorts || cohorts.length === 0) {
    return {
      revenueThisMonth: 0,
      revenueLastMonth: 0,
      pendingAmount: 0,
      perCohortBreakdown: [],
      recentStudents: [],
    }
  }

  const cohortIds = cohorts.map((c) => c.id as string)

  // Get course names
  const courseIds = [...new Set(cohorts.map((c) => c.course_id as string))]
  const { data: courses } = await supabase
    .from('courses')
    .select('id, title')
    .in('id', courseIds)

  const courseNames: Record<string, string> = {}
  if (courses) {
    for (const c of courses) {
      courseNames[c.id as string] = c.title as string
    }
  }

  // Get enrollments for these cohorts
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, cohort_id')
    .in('cohort_id', cohortIds)
    .eq('status', 'active')

  const enrollmentIds = (enrollments ?? []).map((e) => e.id as string)
  const enrollmentCohortMap: Record<string, string> = {}
  if (enrollments) {
    for (const e of enrollments) {
      enrollmentCohortMap[e.id as string] = e.cohort_id as string
    }
  }

  if (enrollmentIds.length === 0) {
    return {
      revenueThisMonth: 0,
      revenueLastMonth: 0,
      pendingAmount: 0,
      perCohortBreakdown: cohorts.map((c) => ({
        cohortId: c.id as string,
        cohortName: c.name as string,
        courseName: courseNames[c.course_id as string] ?? 'Unknown',
        revenue: 0,
        studentCount: 0,
      })),
      recentStudents: [],
    }
  }

  // Get payments — this month
  const { data: thisMonthPayments } = await supabase
    .from('student_payments')
    .select('teacher_payout_amount_pkr, enrollment_id')
    .in('enrollment_id', enrollmentIds)
    .eq('status', 'confirmed')
    .gte('created_at', thisMonthStart.toISOString())

  // Get payments — last month
  const { data: lastMonthPayments } = await supabase
    .from('student_payments')
    .select('teacher_payout_amount_pkr')
    .in('enrollment_id', enrollmentIds)
    .eq('status', 'confirmed')
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString())

  // Get pending payments
  const { data: pendingPayments } = await supabase
    .from('student_payments')
    .select('teacher_payout_amount_pkr')
    .in('enrollment_id', enrollmentIds)
    .eq('status', 'pending_verification')

  const revenueThisMonth = (thisMonthPayments ?? []).reduce(
    (sum, p) => sum + (p.teacher_payout_amount_pkr as number),
    0
  )

  const revenueLastMonth = (lastMonthPayments ?? []).reduce(
    (sum, p) => sum + (p.teacher_payout_amount_pkr as number),
    0
  )

  const pendingAmount = (pendingPayments ?? []).reduce(
    (sum, p) => sum + (p.teacher_payout_amount_pkr as number),
    0
  )

  // Per-cohort breakdown — revenue and student count
  const cohortRevenue: Record<string, number> = {}
  const cohortStudentCount: Record<string, number> = {}

  if (thisMonthPayments) {
    for (const p of thisMonthPayments) {
      const cohortId = enrollmentCohortMap[p.enrollment_id as string]
      if (cohortId) {
        cohortRevenue[cohortId] = (cohortRevenue[cohortId] ?? 0) + (p.teacher_payout_amount_pkr as number)
      }
    }
  }

  if (enrollments) {
    for (const e of enrollments) {
      const cid = e.cohort_id as string
      cohortStudentCount[cid] = (cohortStudentCount[cid] ?? 0) + 1
    }
  }

  const perCohortBreakdown = cohorts.map((c) => ({
    cohortId: c.id as string,
    cohortName: c.name as string,
    courseName: courseNames[c.course_id as string] ?? 'Unknown',
    revenue: cohortRevenue[c.id as string] ?? 0,
    studentCount: cohortStudentCount[c.id as string] ?? 0,
  }))

  // Recent students (last 7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const { data: recentEnrollments } = await supabase
    .from('enrollments')
    .select('id, student_id, cohort_id, created_at')
    .in('cohort_id', cohortIds)
    .eq('status', 'active')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  const recentStudents: TeacherAnalyticsData['recentStudents'] = []

  if (recentEnrollments && recentEnrollments.length > 0) {
    const studentIds = recentEnrollments.map((e) => e.student_id as string)
    const { data: students } = await supabase
      .from('students')
      .select('id, name, email')
      .in('id', studentIds)

    const studentMap: Record<string, { name: string; email: string }> = {}
    if (students) {
      for (const s of students) {
        studentMap[s.id as string] = { name: s.name as string, email: s.email as string }
      }
    }

    const cohortMap: Record<string, string> = {}
    for (const c of cohorts) {
      cohortMap[c.id as string] = c.name as string
    }

    for (const e of recentEnrollments) {
      const student = studentMap[e.student_id as string]
      if (student) {
        recentStudents.push({
          id: e.student_id as string,
          name: student.name,
          email: student.email,
          cohortName: cohortMap[e.cohort_id as string] ?? 'Unknown',
          enrolledAt: e.created_at as string,
        })
      }
    }
  }

  return {
    revenueThisMonth,
    revenueLastMonth,
    pendingAmount,
    perCohortBreakdown,
    recentStudents,
  }
}

// -----------------------------------------------------------------------------
// getRecentTeachers — Last 5 teacher signups for admin dashboard
// -----------------------------------------------------------------------------
export type RecentTeacherRow = {
  id: string
  name: string
  email: string
  plan: string
  created_at: string
}

export async function getRecentTeachers(): Promise<RecentTeacherRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('id, name, email, plan, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error || !data) return []

  return data.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    email: t.email as string,
    plan: t.plan as string,
    created_at: t.created_at as string,
  }))
}

// -----------------------------------------------------------------------------
// getRevenueByCohort — Top cohorts by revenue (platform-wide) for admin dashboard
// Returns up to 6 cohorts with the most confirmed revenue.
// -----------------------------------------------------------------------------
export type RevenueByCohortRow = {
  cohortName: string
  revenue: number
}

export async function getRevenueByCohort(): Promise<RevenueByCohortRow[]> {
  const supabase = createAdminClient()

  // Get all cohorts
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, name')
    .is('deleted_at', null)

  if (!cohorts || cohorts.length === 0) return []

  const cohortIds = cohorts.map((c) => c.id as string)
  const cohortNames: Record<string, string> = {}
  for (const c of cohorts) {
    cohortNames[c.id as string] = c.name as string
  }

  // Get enrollments for these cohorts
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, cohort_id')
    .in('cohort_id', cohortIds)

  if (!enrollments || enrollments.length === 0) return []

  const enrollmentIds = enrollments.map((e) => e.id as string)
  const enrollmentCohortMap: Record<string, string> = {}
  for (const e of enrollments) {
    enrollmentCohortMap[e.id as string] = e.cohort_id as string
  }

  // Get confirmed payments
  const { data: payments } = await supabase
    .from('student_payments')
    .select('amount_pkr, enrollment_id')
    .in('enrollment_id', enrollmentIds)
    .eq('status', 'confirmed')

  if (!payments || payments.length === 0) return []

  const cohortRevenue: Record<string, number> = {}
  for (const p of payments) {
    const cohortId = enrollmentCohortMap[p.enrollment_id as string]
    if (cohortId) {
      cohortRevenue[cohortId] = (cohortRevenue[cohortId] ?? 0) + (p.amount_pkr as number)
    }
  }

  // Sort by revenue descending, take top 6
  return Object.entries(cohortRevenue)
    .map(([cohortId, revenue]) => ({
      cohortName: cohortNames[cohortId] ?? 'Unknown',
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
}

// -----------------------------------------------------------------------------
// getPendingSubscriptions — For admin payments page
// -----------------------------------------------------------------------------
export type PendingSubscriptionRow = {
  id: string
  teacher_id: string
  teacher_name: string
  teacher_email: string
  plan: string
  amount_pkr: number
  payment_method: string
  screenshot_url: string | null
  status: string
  period_start: string
  period_end: string
  created_at: string
}

export async function getPendingSubscriptions(): Promise<PendingSubscriptionRow[]> {
  const supabase = createAdminClient()

  const { data: subs, error } = await supabase
    .from('teacher_subscriptions')
    .select('*')
    .eq('status', 'pending_verification')
    .order('created_at', { ascending: true })

  if (error || !subs || subs.length === 0) return []

  const teacherIds = subs.map((s) => s.teacher_id as string)
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, email')
    .in('id', teacherIds)

  const teacherMap: Record<string, { name: string; email: string }> = {}
  if (teachers) {
    for (const t of teachers) {
      teacherMap[t.id as string] = { name: t.name as string, email: t.email as string }
    }
  }

  return subs.map((s) => {
    const teacher = teacherMap[s.teacher_id as string] ?? { name: 'Unknown', email: '' }
    return {
      id: s.id as string,
      teacher_id: s.teacher_id as string,
      teacher_name: teacher.name,
      teacher_email: teacher.email,
      plan: s.plan as string,
      amount_pkr: s.amount_pkr as number,
      payment_method: s.payment_method as string,
      screenshot_url: s.screenshot_url as string | null,
      status: s.status as string,
      period_start: s.period_start as string,
      period_end: s.period_end as string,
      created_at: s.created_at as string,
    }
  })
}
