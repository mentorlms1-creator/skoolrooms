// =============================================================================
// lib/db/admin-dashboard.ts — Admin dashboard widget queries
//
// All read-only queries that feed the bento widgets on /admin. Kept separate
// from lib/db/admin.ts to avoid bloating that file (already ~1300 LOC).
//
// PKT timezone caveat: "today" means PKT day (UTC+5). We compute PKT midnight
// boundaries explicitly rather than relying on system tz.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import { currentPKT } from '@/lib/time/pkt'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type AdminAlertSeverity = 'critical' | 'warning' | 'info'

export type AdminAlertItem = {
  id: string                       // stable key per alert source (e.g. 'stale-payments')
  severity: AdminAlertSeverity
  title: string                    // short, e.g. "3 payments waiting"
  detail: string                   // one-line context
  href: string                     // where clicking takes the admin
  count: number                    // for sorting + badge
}

export type ConversionFunnel = {
  signed_up: number
  created_cohort: number
  got_enrollment: number
  got_payment: number
}

export type TodayTicker = {
  signups_today: number
  subscription_approvals_today: number     // teacher subs approved (platform revenue)
  student_payments_today: number           // student payments confirmed (teacher revenue, not platform)
  classes_today: number                    // class_sessions scheduled in PKT today
  revenue_today_pkr: number                // sum of teacher subscription amounts approved today
}

export type TopTeacherRow = {
  teacher_id: string
  name: string
  email: string
  plan: string
  student_count: number
  /** Lifetime gross student payments through this teacher's cohorts (status='confirmed'). */
  lifetime_gross_pkr: number
}

// -----------------------------------------------------------------------------
// PKT day boundaries
// -----------------------------------------------------------------------------

/** Returns [startUtcIso, endUtcIso) bracketing the current PKT calendar day. */
function pktDayBounds(): { startIso: string; endIso: string } {
  const nowPkt = currentPKT()
  // currentPKT() returns a Date offset to PKT, so its UTC fields are PKT wall time.
  const year = nowPkt.getUTCFullYear()
  const month = nowPkt.getUTCMonth()
  const day = nowPkt.getUTCDate()
  // PKT midnight at start of day → UTC = PKT-5h
  const startUtc = new Date(Date.UTC(year, month, day, -5, 0, 0))
  const endUtc = new Date(Date.UTC(year, month, day + 1, -5, 0, 0))
  return { startIso: startUtc.toISOString(), endIso: endUtc.toISOString() }
}

// -----------------------------------------------------------------------------
// getAdminAlerts — Multi-source feed of things needing admin attention
//
// Sources (priority order):
// - critical: pending teacher subscription payments older than 48h
// - critical: teachers in grace period right now
// - warning:  teachers on trial expiring within 3 days
// - warning:  paid plans expiring within 3 days (haven't renewed)
// - info:     onboarding stalled >7d
//
// Returns at most one row per source. The widget can show all of them — the
// admin sees the full state, not just the top-priority item.
// -----------------------------------------------------------------------------
export async function getAdminAlerts(): Promise<AdminAlertItem[]> {
  const supabase = createAdminClient()
  const now = new Date()
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const nowIso = now.toISOString()

  const [
    stalePaymentsRes,
    inGraceRes,
    trialExpiringRes,
    planExpiringRes,
    stalledOnboardingRes,
  ] = await Promise.all([
    supabase
      .from('teacher_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_verification')
      .lt('created_at', fortyEightHoursAgo),
    supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .not('grace_until', 'is', null)
      .gt('grace_until', nowIso)
      .lt('plan_expires_at', nowIso),
    supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('plan', 'free')
      .not('trial_ends_at', 'is', null)
      .lte('trial_ends_at', threeDaysFromNow)
      .gte('trial_ends_at', nowIso),
    supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .in('plan', ['solo', 'academy'])
      .lte('plan_expires_at', threeDaysFromNow)
      .gte('plan_expires_at', nowIso),
    supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('onboarding_completed', false)
      .lt('created_at', sevenDaysAgo),
  ])

  const alerts: AdminAlertItem[] = []

  const stalePayments = stalePaymentsRes.count ?? 0
  if (stalePayments > 0) {
    alerts.push({
      id: 'stale-payments',
      severity: 'critical',
      title: `${stalePayments} payment${stalePayments === 1 ? '' : 's'} awaiting review`,
      detail: `Pending more than 48 hours — teachers are blocked.`,
      href: '/admin/payments',
      count: stalePayments,
    })
  }

  const inGrace = inGraceRes.count ?? 0
  if (inGrace > 0) {
    alerts.push({
      id: 'in-grace',
      severity: 'critical',
      title: `${inGrace} teacher${inGrace === 1 ? '' : 's'} in grace period`,
      detail: `Plan expired, waiting on renewal before soft-downgrade.`,
      href: '/admin/teachers',
      count: inGrace,
    })
  }

  const trialExpiring = trialExpiringRes.count ?? 0
  if (trialExpiring > 0) {
    alerts.push({
      id: 'trial-expiring',
      severity: 'warning',
      title: `${trialExpiring} trial${trialExpiring === 1 ? '' : 's'} ending within 3 days`,
      detail: `Will auto-downgrade to free if not converted.`,
      href: '/admin/teachers',
      count: trialExpiring,
    })
  }

  const planExpiring = planExpiringRes.count ?? 0
  if (planExpiring > 0) {
    alerts.push({
      id: 'plan-expiring',
      severity: 'warning',
      title: `${planExpiring} paid plan${planExpiring === 1 ? '' : 's'} expiring within 3 days`,
      detail: `No renewal payment yet — grace period starts soon.`,
      href: '/admin/teachers',
      count: planExpiring,
    })
  }

  const stalledOnboarding = stalledOnboardingRes.count ?? 0
  if (stalledOnboarding > 0) {
    alerts.push({
      id: 'stalled-onboarding',
      severity: 'info',
      title: `${stalledOnboarding} stalled signup${stalledOnboarding === 1 ? '' : 's'}`,
      detail: `Signed up over a week ago, never finished onboarding.`,
      href: '/admin/teachers',
      count: stalledOnboarding,
    })
  }

  return alerts
}

// -----------------------------------------------------------------------------
// getConversionFunnel — Teachers at each lifecycle stage (all-time, cumulative)
//
// Stages:
//   1. signed_up       — all teacher accounts
//   2. created_cohort  — teachers with ≥1 non-deleted cohort
//   3. got_enrollment  — teachers with ≥1 enrollment (any status)
//   4. got_payment     — teachers with ≥1 confirmed student_payment
//
// Counts are not strictly nested (a teacher could have a payment but no
// "active" cohort if the cohort was archived), but in practice the funnel
// will read top-to-bottom. We compute by joining teacher_id back from each
// stage's source table.
// -----------------------------------------------------------------------------
export async function getConversionFunnel(): Promise<ConversionFunnel> {
  const supabase = createAdminClient()

  const [
    { count: signedUp },
    { data: cohortRows },
    { data: enrollmentRows },
    { data: paymentRows },
  ] = await Promise.all([
    supabase.from('teachers').select('id', { count: 'exact', head: true }),
    supabase.from('cohorts').select('id, teacher_id').is('deleted_at', null),
    supabase.from('enrollments').select('id, cohort_id'),
    supabase.from('student_payments').select('enrollment_id').eq('status', 'confirmed'),
  ])

  const cohortToTeacher = new Map<string, string>()
  const teachersWithCohort = new Set<string>()
  for (const row of cohortRows ?? []) {
    const tid = row.teacher_id as string
    cohortToTeacher.set(row.id as string, tid)
    teachersWithCohort.add(tid)
  }

  const enrollmentToTeacher = new Map<string, string>()
  const teachersWithEnrollment = new Set<string>()
  for (const row of enrollmentRows ?? []) {
    const tid = cohortToTeacher.get(row.cohort_id as string)
    if (!tid) continue
    enrollmentToTeacher.set(row.id as string, tid)
    teachersWithEnrollment.add(tid)
  }

  const teachersWithPayment = new Set<string>()
  for (const row of paymentRows ?? []) {
    const tid = enrollmentToTeacher.get(row.enrollment_id as string)
    if (tid) teachersWithPayment.add(tid)
  }

  return {
    signed_up: signedUp ?? 0,
    created_cohort: teachersWithCohort.size,
    got_enrollment: teachersWithEnrollment.size,
    got_payment: teachersWithPayment.size,
  }
}

// -----------------------------------------------------------------------------
// getTodayTicker — Things happening in PKT today
// -----------------------------------------------------------------------------
export async function getTodayTicker(): Promise<TodayTicker> {
  const supabase = createAdminClient()
  const { startIso, endIso } = pktDayBounds()

  const [
    signupsRes,
    subsRes,
    studentPaymentsRes,
    classesRes,
  ] = await Promise.all([
    supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('teacher_subscriptions')
      .select('amount_pkr, approved_at')
      .eq('status', 'active')
      .gte('approved_at', startIso)
      .lt('approved_at', endIso),
    supabase
      .from('student_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('verified_at', startIso)
      .lt('verified_at', endIso),
    supabase
      .from('class_sessions')
      .select('*', { count: 'exact', head: true })
      .is('cancelled_at', null)
      .is('deleted_at', null)
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso),
  ])

  const subs = (subsRes.data ?? []) as Array<{ amount_pkr: number }>
  const revenueToday = subs.reduce((sum, s) => sum + (s.amount_pkr ?? 0), 0)

  return {
    signups_today: signupsRes.count ?? 0,
    subscription_approvals_today: subs.length,
    student_payments_today: studentPaymentsRes.count ?? 0,
    classes_today: classesRes.count ?? 0,
    revenue_today_pkr: revenueToday,
  }
}

// -----------------------------------------------------------------------------
// getTopTeachers — Top teachers by lifetime gross student payments
//
// "Gross" = sum of student_payments.amount_pkr where status='confirmed'.
// This is teacher revenue, not platform revenue (Phase 1 caveat applies).
// We rank by it because it's the strongest signal of "who runs a real
// business on the platform" — those are the teachers admin should care
// about retaining.
// -----------------------------------------------------------------------------
export async function getTopTeachers(limit: number = 5): Promise<TopTeacherRow[]> {
  const supabase = createAdminClient()

  // Pull all teachers + plan, then enrich with cohorts → enrollments → payments.
  // Volume is small (Phase 1: hundreds, not millions), so in-memory aggregation
  // is fine.
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, email, plan')
    .eq('is_suspended', false)

  if (!teachers || teachers.length === 0) return []

  const teacherIds = teachers.map((t) => t.id as string)

  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, teacher_id')
    .in('teacher_id', teacherIds)
    .is('deleted_at', null)

  const cohortIds = (cohorts ?? []).map((c) => c.id as string)
  const cohortToTeacher = new Map<string, string>()
  for (const c of cohorts ?? []) {
    cohortToTeacher.set(c.id as string, c.teacher_id as string)
  }

  const studentCount: Record<string, number> = {}
  const grossPkr: Record<string, number> = {}

  if (cohortIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, cohort_id')
      .in('cohort_id', cohortIds)
      .eq('status', 'active')

    const enrollIds: string[] = []
    const enrollToTeacher = new Map<string, string>()
    for (const e of enrollments ?? []) {
      const tid = cohortToTeacher.get(e.cohort_id as string)
      if (!tid) continue
      studentCount[tid] = (studentCount[tid] ?? 0) + 1
      enrollIds.push(e.id as string)
      enrollToTeacher.set(e.id as string, tid)
    }

    if (enrollIds.length > 0) {
      const { data: payments } = await supabase
        .from('student_payments')
        .select('enrollment_id, amount_pkr')
        .in('enrollment_id', enrollIds)
        .eq('status', 'confirmed')

      for (const p of payments ?? []) {
        const tid = enrollToTeacher.get(p.enrollment_id as string)
        if (!tid) continue
        grossPkr[tid] = (grossPkr[tid] ?? 0) + ((p.amount_pkr as number) ?? 0)
      }
    }
  }

  return teachers
    .map((t) => ({
      teacher_id: t.id as string,
      name: t.name as string,
      email: t.email as string,
      plan: t.plan as string,
      student_count: studentCount[t.id as string] ?? 0,
      lifetime_gross_pkr: grossPkr[t.id as string] ?? 0,
    }))
    .sort((a, b) => {
      // Primary: gross desc; tie-break: student count desc
      if (b.lifetime_gross_pkr !== a.lifetime_gross_pkr) {
        return b.lifetime_gross_pkr - a.lifetime_gross_pkr
      }
      return b.student_count - a.student_count
    })
    .filter((t) => t.lifetime_gross_pkr > 0 || t.student_count > 0)
    .slice(0, limit)
}

// -----------------------------------------------------------------------------
// searchAdminEntities — Global search for the admin command palette
//
// Searches teachers (name/email/subdomain), students (name/email), cohorts
// (name). Returns at most `perTypeLimit` of each. Case-insensitive ILIKE.
// -----------------------------------------------------------------------------
export type AdminSearchHit = {
  type: 'teacher' | 'student' | 'cohort'
  id: string
  label: string                    // primary display ("Saad Ahmed")
  sublabel: string | null          // secondary ("saad@example.com" or "Math 101 • Class A")
  href: string
}

export async function searchAdminEntities(
  query: string,
  perTypeLimit: number = 5,
): Promise<AdminSearchHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const supabase = createAdminClient()
  const like = `%${trimmed.replace(/[%_]/g, (m) => `\\${m}`)}%`

  const [teachersRes, studentsRes, cohortsRes] = await Promise.all([
    supabase
      .from('teachers')
      .select('id, name, email, subdomain')
      .or(`name.ilike.${like},email.ilike.${like},subdomain.ilike.${like}`)
      .limit(perTypeLimit),
    supabase
      .from('students')
      .select('id, name, email')
      .or(`name.ilike.${like},email.ilike.${like}`)
      .limit(perTypeLimit),
    supabase
      .from('cohorts')
      .select('id, name, course_id, teacher_id')
      .ilike('name', like)
      .is('deleted_at', null)
      .limit(perTypeLimit),
  ])

  const hits: AdminSearchHit[] = []

  for (const t of teachersRes.data ?? []) {
    hits.push({
      type: 'teacher',
      id: t.id as string,
      label: t.name as string,
      sublabel: (t.email as string) ?? null,
      href: `/admin/teachers/${t.id as string}`,
    })
  }

  for (const s of studentsRes.data ?? []) {
    hits.push({
      type: 'student',
      id: s.id as string,
      label: s.name as string,
      sublabel: (s.email as string) ?? null,
      href: `/admin/teachers?student=${s.id as string}`,
    })
  }

  for (const c of cohortsRes.data ?? []) {
    hits.push({
      type: 'cohort',
      id: c.id as string,
      label: c.name as string,
      sublabel: null,
      // Cohorts live under teacher → course routes; admin doesn't have a
      // dedicated cohort detail page. Best we can do is jump to the teacher.
      href: `/admin/teachers/${c.teacher_id as string}`,
    })
  }

  return hits
}
