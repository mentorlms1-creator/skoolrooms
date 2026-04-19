// =============================================================================
// lib/db/admin-metrics.ts — Admin metrics queries (MRR, churn, conversion, ARPU, LTV)
// All queries use createAdminClient (service role, bypasses RLS — intentional).
// =============================================================================

import { createAdminClient } from '@/supabase/server'

export type MrrDataPoint = {
  month: string  // 'YYYY-MM'
  mrr: number    // PKR integer
}

// Revenue recognized per month from confirmed teacher subscriptions.
// Groups by date_trunc('month', period_start).
export async function getMrrTimeSeries(months: number = 12): Promise<MrrDataPoint[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teacher_subscriptions')
    .select('amount_pkr, period_start')
    .eq('status', 'confirmed')
    .order('period_start', { ascending: false })

  if (error || !data) return []

  // Group by year-month
  const monthMap: Record<string, number> = {}
  for (const row of data) {
    const d = new Date(row.period_start as string)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    monthMap[key] = (monthMap[key] ?? 0) + (row.amount_pkr as number)
  }

  // Build last N months (fill zeros for gaps)
  const result: MrrDataPoint[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    result.push({ month: key, mrr: monthMap[key] ?? 0 })
  }

  return result
}

export type ChurnMetrics = {
  churnRate: number    // percentage 0-100
  churned: number      // count
  baseSize: number     // count of paid teachers at start of period
}

// Approximation: teachers who had a confirmed subscription in the prior period
// but currently have plan='free' OR is_suspended=true OR plan_expires_at < now.
export async function getChurnMetrics(): Promise<ChurnMetrics> {
  const supabase = createAdminClient()

  // Teachers with at least one confirmed subscription (ever paid)
  const { data: paidHistory } = await supabase
    .from('teacher_subscriptions')
    .select('teacher_id')
    .eq('status', 'confirmed')

  if (!paidHistory || paidHistory.length === 0) {
    return { churnRate: 0, churned: 0, baseSize: 0 }
  }

  const uniqueIds = [...new Set(paidHistory.map((r) => r.teacher_id as string))]

  // Of those teachers, how many are currently NOT on a paid active plan?
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, plan, is_suspended, plan_expires_at')
    .in('id', uniqueIds)

  if (!teachers) return { churnRate: 0, churned: 0, baseSize: uniqueIds.length }

  const now = new Date()
  const churned = teachers.filter((t) => {
    const expired = t.plan_expires_at ? new Date(t.plan_expires_at as string) < now : false
    return t.plan === 'free' || (t.is_suspended as boolean) || expired
  }).length

  const baseSize = uniqueIds.length
  const churnRate = baseSize > 0 ? Math.round((churned / baseSize) * 100) : 0

  return { churnRate, churned, baseSize }
}

export type ConversionMetrics = {
  conversionRate: number // percentage 0-100
  converted: number
  totalFree: number
}

// Conversion: teachers who moved from free → paid (have any confirmed subscription).
export async function getConversionMetrics(): Promise<ConversionMetrics> {
  const supabase = createAdminClient()

  const { count: totalTeachers } = await supabase
    .from('teachers')
    .select('*', { count: 'exact', head: true })

  const { data: converted } = await supabase
    .from('teacher_subscriptions')
    .select('teacher_id')
    .eq('status', 'confirmed')

  const uniqueConverted = new Set((converted ?? []).map((r) => r.teacher_id as string)).size
  const total = totalTeachers ?? 0
  const conversionRate = total > 0 ? Math.round((uniqueConverted / total) * 100) : 0

  return {
    conversionRate,
    converted: uniqueConverted,
    totalFree: total,
  }
}

export type KpiMetrics = {
  mrr: number
  activePaidTeachers: number
  arpu: number
  ltv: number
  churn: ChurnMetrics
  conversion: ConversionMetrics
  grandfatheredCount: number
}

export async function getAdminKpiMetrics(): Promise<KpiMetrics> {
  const supabase = createAdminClient()

  // Current MRR: sum confirmed subscriptions this calendar month
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const { data: thisMonthSubs } = await supabase
    .from('teacher_subscriptions')
    .select('amount_pkr')
    .eq('status', 'confirmed')
    .gte('period_start', monthStart)

  const mrr = (thisMonthSubs ?? []).reduce((s, r) => s + (r.amount_pkr as number), 0)

  // Active paid teachers
  const { count: activePaidTeachers } = await supabase
    .from('teachers')
    .select('*', { count: 'exact', head: true })
    .in('plan', ['solo', 'academy'])
    .eq('is_suspended', false)
    .gt('plan_expires_at', now.toISOString())

  const active = activePaidTeachers ?? 0
  const arpu = active > 0 ? Math.round(mrr / active) : 0

  const [churn, conversion] = await Promise.all([getChurnMetrics(), getConversionMetrics()])

  const ltv = churn.churnRate > 0 ? Math.round(arpu / (churn.churnRate / 100)) : 0

  // Grandfathered count
  const { count: grandfatheredCount } = await supabase
    .from('teacher_plan_snapshot')
    .select('*', { count: 'exact', head: true })

  return {
    mrr,
    activePaidTeachers: active,
    arpu,
    ltv,
    churn,
    conversion,
    grandfatheredCount: grandfatheredCount ?? 0,
  }
}
