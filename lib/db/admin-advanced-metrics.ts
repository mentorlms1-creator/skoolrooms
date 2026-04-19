// =============================================================================
// lib/db/admin-advanced-metrics.ts — Cohort-relative admin analytics
// (Net Revenue Retention + signup cohort retention).
// Sibling to lib/db/admin-metrics.ts (Lane D); do not edit that file.
// All queries use createAdminClient (service role, bypasses RLS — intentional).
// =============================================================================

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/supabase/server'
import { firstOfMonthPKT } from '@/lib/time/pkt'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type NrrCohortPoint = {
  cohortMonth: string
  horizonMonths: number
  startingMrr: number
  retainedMrr: number
  retainedTeacherCount: number
  churnedTeacherCount: number
  startingTeacherCount: number
  nrrPercent: number
}

export type NrrWaterfall = {
  starting: number
  expansion: number
  churn: number
  contraction: number
  ending: number
}

export type NrrMetrics = {
  nrr3: NrrCohortPoint | null
  nrr6: NrrCohortPoint | null
  nrr12: NrrCohortPoint | null
  waterfall: NrrWaterfall | null
}

export type SignupCohortRow = {
  cohortMonth: string
  signedUp: number
  active1m: number | null
  active3m: number | null
  active6m: number | null
  active12m: number | null
  retention1m: number | null
  retention3m: number | null
  retention6m: number | null
  retention12m: number | null
}

export type CohortRetentionTable = {
  rows: SignupCohortRow[]
}

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

type SubRow = {
  teacher_id: string
  plan: string
  amount_pkr: number
  period_start: string
  period_end: string
  created_at: string
}

// PKT month ('YYYY-MM-01') → UTC ISO range [start, endExclusive).
// PKT is a fixed UTC+5 offset (no DST in Pakistan), so we subtract 5h from
// the PKT midnight to get the UTC instant.
function pktMonthToUtcRange(pktMonthFirst: string): { startUtc: string; endUtc: string } {
  const [y, m] = pktMonthFirst.split('-').map(Number)
  const startPktMs = Date.UTC(y, m - 1, 1) - 5 * 60 * 60 * 1000
  const endPktMs = Date.UTC(y, m, 1) - 5 * 60 * 60 * 1000
  return { startUtc: new Date(startPktMs).toISOString(), endUtc: new Date(endPktMs).toISOString() }
}

// Add N months to a 'YYYY-MM-01' PKT month string, return same format.
function addMonths(pktMonthFirst: string, n: number): string {
  const [y, m] = pktMonthFirst.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

// Compare two 'YYYY-MM-01' strings lexicographically (works correctly for ISO dates).
function monthLte(a: string, b: string): boolean {
  return a <= b
}

// Returns the latest confirmed sub overlapping a given PKT month for each teacher.
// Filters to subs in [scopeStart, scopeEnd] for efficiency, then dedupes in memory
// by (teacher_id) keeping the row with max (period_start, created_at).
function latestPerTeacherInMonth(
  subs: SubRow[],
  monthFirst: string,
): Map<string, SubRow> {
  const monthEndExclusive = addMonths(monthFirst, 1)
  // period_start <= last day of month  AND  period_end >= first day of month
  // We have first-of-next-month exclusive, so use period_start < monthEndExclusive
  // and period_end >= monthFirst.
  const out = new Map<string, SubRow>()
  for (const s of subs) {
    if (s.amount_pkr <= 0) continue
    const startsOk = s.period_start < monthEndExclusive
    const endsOk = s.period_end >= monthFirst
    if (!startsOk || !endsOk) continue
    const prev = out.get(s.teacher_id)
    if (
      !prev ||
      s.period_start > prev.period_start ||
      (s.period_start === prev.period_start && s.created_at > prev.created_at)
    ) {
      out.set(s.teacher_id, s)
    }
  }
  return out
}

// -----------------------------------------------------------------------------
// getNrrMetrics
// -----------------------------------------------------------------------------

export async function getNrrMetrics(): Promise<NrrMetrics> {
  const supabase = createAdminClient()

  const currentMonthFirst = firstOfMonthPKT(new Date())

  const horizons = [3, 6, 12] as const

  // For each horizon N, the cohort month M is current - (N+1) months
  // (so that M+N is the most recent fully-completed month).
  const cohortMonths = new Map<number, string>()
  for (const n of horizons) {
    cohortMonths.set(n, addMonths(currentMonthFirst, -(n + 1)))
  }
  const earliestCohort = cohortMonths.get(12)!
  const earliestCohortRange = pktMonthToUtcRange(earliestCohort)

  // Single fetch: all confirmed subs whose period_end is on/after the earliest
  // cohort month start (PKT) — bucket in memory.
  const { data: subsRaw, error: subsErr } = await supabase
    .from('teacher_subscriptions')
    .select('teacher_id, plan, amount_pkr, period_start, period_end, created_at')
    .eq('status', 'confirmed')
    .gte('period_end', earliestCohortRange.startUtc.slice(0, 10))

  if (subsErr || !subsRaw) {
    return { nrr3: null, nrr6: null, nrr12: null, waterfall: null }
  }

  const subs = subsRaw as SubRow[]

  // Fetch suspension state (current snapshot — documented limitation).
  const teacherIds = [...new Set(subs.map((s) => s.teacher_id))]
  let suspendedSet = new Set<string>()
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, is_suspended')
      .in('id', teacherIds)
    if (teachers) {
      for (const t of teachers) {
        if (t.is_suspended) suspendedSet.add(t.id as string)
      }
    }
  }

  function computeForHorizon(n: number): { point: NrrCohortPoint | null; waterfall: NrrWaterfall | null } {
    const startingMonth = cohortMonths.get(n)!
    const endingMonth = addMonths(startingMonth, n)

    const startingMap = latestPerTeacherInMonth(subs, startingMonth)
    if (startingMap.size === 0) return { point: null, waterfall: null }

    const endingMap = latestPerTeacherInMonth(subs, endingMonth)

    let startingMrr = 0
    let retainedMrr = 0
    let expansion = 0
    let contraction = 0
    let churn = 0
    let retainedCount = 0
    let churnedCount = 0

    for (const [teacherId, startSub] of startingMap.entries()) {
      const startAmount = startSub.amount_pkr
      startingMrr += startAmount

      const endSub = endingMap.get(teacherId)
      const isSuspended = suspendedSet.has(teacherId)
      const endAmount = !endSub || isSuspended ? 0 : endSub.amount_pkr

      if (endAmount === 0) {
        churn += startAmount
        churnedCount += 1
        continue
      }

      retainedMrr += endAmount
      retainedCount += 1
      const delta = endAmount - startAmount
      if (delta > 0) expansion += delta
      else if (delta < 0) contraction += -delta
    }

    const nrrPercent = startingMrr > 0 ? Math.round((retainedMrr / startingMrr) * 100) : 0

    const point: NrrCohortPoint = {
      cohortMonth: startingMonth.slice(0, 7),
      horizonMonths: n,
      startingMrr,
      retainedMrr,
      retainedTeacherCount: retainedCount,
      churnedTeacherCount: churnedCount,
      startingTeacherCount: startingMap.size,
      nrrPercent,
    }

    const waterfall: NrrWaterfall = {
      starting: startingMrr,
      expansion,
      churn,
      contraction,
      ending: startingMrr + expansion - churn - contraction,
    }

    return { point, waterfall }
  }

  const r3 = computeForHorizon(3)
  const r6 = computeForHorizon(6)
  const r12 = computeForHorizon(12)

  return {
    nrr3: r3.point,
    nrr6: r6.point,
    nrr12: r12.point,
    waterfall: r12.waterfall,
  }
}

// -----------------------------------------------------------------------------
// getCohortRetentionTable
// -----------------------------------------------------------------------------

const COHORT_WINDOW_MONTHS = 18
const RETENTION_HORIZONS = [1, 3, 6, 12] as const

export async function getCohortRetentionTable(): Promise<CohortRetentionTable> {
  const supabase = createAdminClient()

  const currentMonthFirst = firstOfMonthPKT(new Date())
  // Most recent COMPLETED PKT month is current - 1.
  const newestCohort = addMonths(currentMonthFirst, -1)
  const oldestCohort = addMonths(newestCohort, -(COHORT_WINDOW_MONTHS - 1))

  // Build cohort month list, newest first.
  const cohortMonths: string[] = []
  for (let i = 0; i < COHORT_WINDOW_MONTHS; i++) {
    cohortMonths.push(addMonths(newestCohort, -i))
  }

  // Single teachers fetch (cohort signups + suspension state).
  const oldestRange = pktMonthToUtcRange(oldestCohort)
  const newestRange = pktMonthToUtcRange(newestCohort)
  const { data: teachersData } = await supabase
    .from('teachers')
    .select('id, created_at, is_suspended')
    .gte('created_at', oldestRange.startUtc)
    .lt('created_at', newestRange.endUtc)

  const teachers = (teachersData ?? []) as Array<{
    id: string
    created_at: string
    is_suspended: boolean
  }>

  // Bucket teachers by their PKT signup month.
  const cohortToTeachers = new Map<string, string[]>()
  for (const cm of cohortMonths) cohortToTeachers.set(cm, [])
  for (const t of teachers) {
    const signupMonth = firstOfMonthPKT(new Date(t.created_at))
    const bucket = cohortToTeachers.get(signupMonth)
    if (bucket) bucket.push(t.id)
  }

  const suspendedSet = new Set<string>()
  for (const t of teachers) if (t.is_suspended) suspendedSet.add(t.id)

  // Single subs fetch covering the entire span we'll inspect:
  // earliest possible horizon = oldest cohort, latest = newest cohort + 12 months.
  const horizonEnd = addMonths(newestCohort, 12)
  const horizonRange = pktMonthToUtcRange(addMonths(horizonEnd, 0))
  const subsStart = oldestRange.startUtc.slice(0, 10)
  const subsEnd = horizonRange.endUtc.slice(0, 10)

  const allCohortIds = teachers.map((t) => t.id)
  let subs: SubRow[] = []
  if (allCohortIds.length > 0) {
    const { data: subsData } = await supabase
      .from('teacher_subscriptions')
      .select('teacher_id, plan, amount_pkr, period_start, period_end, created_at')
      .eq('status', 'confirmed')
      .gt('amount_pkr', 0)
      .in('teacher_id', allCohortIds)
      .lte('period_start', subsEnd)
      .gte('period_end', subsStart)
    subs = (subsData ?? []) as SubRow[]
  }

  // Index subs by teacher for quick lookup.
  const subsByTeacher = new Map<string, SubRow[]>()
  for (const s of subs) {
    if (!subsByTeacher.has(s.teacher_id)) subsByTeacher.set(s.teacher_id, [])
    subsByTeacher.get(s.teacher_id)!.push(s)
  }

  function isActiveAt(teacherId: string, monthFirst: string): boolean {
    if (suspendedSet.has(teacherId)) return false
    const list = subsByTeacher.get(teacherId)
    if (!list) return false
    const monthEndExclusive = addMonths(monthFirst, 1)
    for (const s of list) {
      if (s.period_start < monthEndExclusive && s.period_end >= monthFirst) return true
    }
    return false
  }

  const rows: SignupCohortRow[] = []
  for (const cm of cohortMonths) {
    const teacherIds = cohortToTeachers.get(cm) ?? []
    const signedUp = teacherIds.length
    if (signedUp === 0) continue

    const cells: Record<number, number | null> = {}
    for (const h of RETENTION_HORIZONS) {
      const horizonMonth = addMonths(cm, h)
      // Horizon must be a fully-completed PKT month (strictly before currentMonthFirst).
      if (!monthLte(addMonths(horizonMonth, 1), currentMonthFirst)) {
        cells[h] = null
        continue
      }
      let active = 0
      for (const id of teacherIds) {
        if (isActiveAt(id, horizonMonth)) active += 1
      }
      cells[h] = active
    }

    const pct = (n: number | null) =>
      n === null ? null : signedUp > 0 ? Math.round((n / signedUp) * 100) : 0

    rows.push({
      cohortMonth: cm.slice(0, 7),
      signedUp,
      active1m: cells[1],
      active3m: cells[3],
      active6m: cells[6],
      active12m: cells[12],
      retention1m: pct(cells[1]),
      retention3m: pct(cells[3]),
      retention6m: pct(cells[6]),
      retention12m: pct(cells[12]),
    })
  }

  return { rows }
}

// -----------------------------------------------------------------------------
// Cached wrappers (1h TTL). Page calls these; tests can call raw functions.
// -----------------------------------------------------------------------------

export const getNrrMetricsCached = unstable_cache(
  async () => getNrrMetrics(),
  ['admin-nrr-metrics'],
  { revalidate: 3600, tags: ['admin-metrics'] },
)

export const getCohortRetentionTableCached = unstable_cache(
  async () => getCohortRetentionTable(),
  ['admin-cohort-retention'],
  { revalidate: 3600, tags: ['admin-metrics'] },
)
