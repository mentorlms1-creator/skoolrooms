// =============================================================================
// lib/db/admin-earnings.ts — Queries for /admin/earnings
//
// Phase 1 reality: the platform's actual income is teacher subscription
// revenue — we do not collect per-student transaction cuts (those are recorded
// on student_payments but not yet collected anywhere). All amounts here come
// from teacher_subscriptions where status='active' (i.e. admin-approved).
//
// Time dimension: we use approved_at (the moment admin verified the screenshot
// and the platform recognized the revenue), not period_start. /admin/metrics
// uses period_start for MRR analysis — different lens, intentional.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type EarningsKpi = {
  allTimeRevenuePkr: number
  thisMonthRevenuePkr: number
  lastMonthRevenuePkr: number
  monthOverMonthPct: number | null  // null when last month was 0
  activeSubscribers: number
  pendingVerificationCount: number
  rejectedLast30dCount: number
}

export type RevenueByPlan = {
  planSlug: string
  planName: string
  monthlyPricePkr: number
  activeSubscribers: number
  monthlyContributionPkr: number  // monthly_price * activeSubscribers
  allTimeRevenuePkr: number
}

export type MonthlyRevenuePoint = {
  month: string  // 'YYYY-MM'
  revenuePkr: number
}

export type RecentApproval = {
  id: string
  teacherId: string
  teacherName: string
  teacherEmail: string
  planSlug: string
  amountPkr: number
  paymentMethod: string
  approvedAt: string
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function monthBounds(d: Date): { startIso: string; endIso: string } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

// -----------------------------------------------------------------------------
// getEarningsKpi — Top-of-page summary
// -----------------------------------------------------------------------------

export async function getEarningsKpi(): Promise<EarningsKpi> {
  const supabase = createAdminClient()
  const now = new Date()
  const thisMonth = monthBounds(now)
  const lastMonth = monthBounds(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
  )
  const last30dStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // All-time revenue + this/last month revenue — single query then bucket.
  const { data: approvedSubs } = await supabase
    .from('teacher_subscriptions')
    .select('amount_pkr, approved_at')
    .eq('status', 'active')

  let allTimeRevenuePkr = 0
  let thisMonthRevenuePkr = 0
  let lastMonthRevenuePkr = 0

  for (const row of (approvedSubs ?? []) as Array<{ amount_pkr: number; approved_at: string | null }>) {
    allTimeRevenuePkr += row.amount_pkr
    if (!row.approved_at) continue
    if (row.approved_at >= thisMonth.startIso && row.approved_at < thisMonth.endIso) {
      thisMonthRevenuePkr += row.amount_pkr
    } else if (row.approved_at >= lastMonth.startIso && row.approved_at < lastMonth.endIso) {
      lastMonthRevenuePkr += row.amount_pkr
    }
  }

  const monthOverMonthPct =
    lastMonthRevenuePkr > 0
      ? Math.round(((thisMonthRevenuePkr - lastMonthRevenuePkr) / lastMonthRevenuePkr) * 100)
      : null

  // Active subscribers — teachers currently on a paid plan that hasn't expired.
  const { count: activeSubscribers } = await supabase
    .from('teachers')
    .select('id', { count: 'exact', head: true })
    .neq('plan', 'free')
    .eq('is_suspended', false)
    .gt('plan_expires_at', now.toISOString())

  // Pending verification queue
  const { count: pendingVerificationCount } = await supabase
    .from('teacher_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_verification')

  // Rejected last 30 days
  const { count: rejectedLast30dCount } = await supabase
    .from('teacher_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'rejected')
    .gte('rejected_at', last30dStart)

  return {
    allTimeRevenuePkr,
    thisMonthRevenuePkr,
    lastMonthRevenuePkr,
    monthOverMonthPct,
    activeSubscribers: activeSubscribers ?? 0,
    pendingVerificationCount: pendingVerificationCount ?? 0,
    rejectedLast30dCount: rejectedLast30dCount ?? 0,
  }
}

// -----------------------------------------------------------------------------
// getRevenueByPlan — Per-plan breakdown
// -----------------------------------------------------------------------------

export async function getRevenueByPlan(): Promise<RevenueByPlan[]> {
  const supabase = createAdminClient()
  const now = new Date()

  // All plans (we want to show every plan even if revenue is 0).
  const { data: plans } = await supabase
    .from('plans')
    .select('slug, name, price_pkr, display_order')
    .order('display_order')

  if (!plans) return []

  // All approved subscriptions ever, for all-time revenue per plan.
  const { data: allSubs } = await supabase
    .from('teacher_subscriptions')
    .select('plan, amount_pkr')
    .eq('status', 'active')

  const allTimeByPlan: Record<string, number> = {}
  for (const row of (allSubs ?? []) as Array<{ plan: string; amount_pkr: number }>) {
    allTimeByPlan[row.plan] = (allTimeByPlan[row.plan] ?? 0) + row.amount_pkr
  }

  // Active subscribers per plan — from teachers table, currently in-period.
  const { data: activeTeachers } = await supabase
    .from('teachers')
    .select('plan')
    .neq('plan', 'free')
    .eq('is_suspended', false)
    .gt('plan_expires_at', now.toISOString())

  const activeByPlan: Record<string, number> = {}
  for (const t of (activeTeachers ?? []) as Array<{ plan: string }>) {
    activeByPlan[t.plan] = (activeByPlan[t.plan] ?? 0) + 1
  }

  return (plans as Array<{ slug: string; name: string; price_pkr: number }>)
    .filter((p) => p.slug !== 'free')
    .map((p) => {
      const active = activeByPlan[p.slug] ?? 0
      return {
        planSlug: p.slug,
        planName: p.name,
        monthlyPricePkr: p.price_pkr,
        activeSubscribers: active,
        monthlyContributionPkr: active * p.price_pkr,
        allTimeRevenuePkr: allTimeByPlan[p.slug] ?? 0,
      }
    })
}

// -----------------------------------------------------------------------------
// getMonthlyRevenueSeries — Last N months bucketed by approved_at
// -----------------------------------------------------------------------------

export async function getMonthlyRevenueSeries(
  months: number = 12,
): Promise<MonthlyRevenuePoint[]> {
  const supabase = createAdminClient()
  const now = new Date()
  const earliest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))

  const { data } = await supabase
    .from('teacher_subscriptions')
    .select('amount_pkr, approved_at')
    .eq('status', 'active')
    .gte('approved_at', earliest.toISOString())

  const bucket: Record<string, number> = {}
  for (const row of (data ?? []) as Array<{ amount_pkr: number; approved_at: string | null }>) {
    if (!row.approved_at) continue
    const d = new Date(row.approved_at)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    bucket[key] = (bucket[key] ?? 0) + row.amount_pkr
  }

  const result: MonthlyRevenuePoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    result.push({ month: key, revenuePkr: bucket[key] ?? 0 })
  }
  return result
}

// -----------------------------------------------------------------------------
// getRecentApprovals — Last N approved subscriptions w/ teacher info
// -----------------------------------------------------------------------------

export async function getRecentApprovals(limit: number = 10): Promise<RecentApproval[]> {
  const supabase = createAdminClient()

  const { data: subs } = await supabase
    .from('teacher_subscriptions')
    .select('id, teacher_id, plan, amount_pkr, payment_method, approved_at')
    .eq('status', 'active')
    .not('approved_at', 'is', null)
    .order('approved_at', { ascending: false })
    .limit(limit)

  if (!subs || subs.length === 0) return []

  const teacherIds = [...new Set((subs as Array<{ teacher_id: string }>).map((s) => s.teacher_id))]
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, email')
    .in('id', teacherIds)

  const teacherMap = new Map(
    ((teachers ?? []) as Array<{ id: string; name: string; email: string }>).map((t) => [
      t.id,
      { name: t.name, email: t.email },
    ]),
  )

  return (
    subs as Array<{
      id: string
      teacher_id: string
      plan: string
      amount_pkr: number
      payment_method: string
      approved_at: string
    }>
  ).map((s) => {
    const teacher = teacherMap.get(s.teacher_id)
    return {
      id: s.id,
      teacherId: s.teacher_id,
      teacherName: teacher?.name ?? 'Unknown',
      teacherEmail: teacher?.email ?? '',
      planSlug: s.plan,
      amountPkr: s.amount_pkr,
      paymentMethod: s.payment_method,
      approvedAt: s.approved_at,
    }
  })
}
