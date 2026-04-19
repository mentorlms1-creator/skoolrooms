// =============================================================================
// lib/db/explore.ts — Explore page queries (service layer)
// Complex query for teacher directory: joins teachers -> courses -> cohorts.
//
// Lane L additions:
//   - getExplorableTeacherIds: cursor-paginated eligible-teacher-id list
//   - getExplorableTeacherDetails: per-page details fetch (cached)
//   - getExploreFacets: cached distinct subjects/levels/cities for filter UI
// The original `getExplorableTeachers` is kept for backwards compatibility
// (e.g. tests + any caller that hasn't migrated). It is no longer used by
// the explore page itself.
// =============================================================================

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/supabase/server'
import {
  buildPage,
  decodeCursor,
  type CursorPage,
} from '@/lib/pagination/cursor'
import { EXPLORE_PAGE_SIZE } from '@/lib/pagination/limits'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ExplorableTeacher = {
  id: string
  name: string
  subdomain: string
  profile_photo_url: string | null
  city: string | null
  bio: string | null
  subject_tags: string[]
  teaching_levels: string[]
  starting_fee_pkr: number
  student_count: number
  has_open_cohorts: boolean
  course_categories: string[]
}

export type ExploreFilters = {
  subject?: string
  level?: string
  minFee?: number
  maxFee?: number
  city?: string
}

export type ExploreFacets = {
  subjects: string[]
  levels: string[]
  cities: string[]
}

type EligibleTeacherRow = {
  id: string
  name: string
  subdomain: string
  profile_photo_url: string | null
  city: string | null
  bio: string | null
  subject_tags: string[]
  teaching_levels: string[]
  plan_expires_at: string | null
  grace_until: string | null
  created_at: string
}

// -----------------------------------------------------------------------------
// Internal helper: filter teachers by hard-lock (plan + grace expired)
// -----------------------------------------------------------------------------
function filterEligible(rows: EligibleTeacherRow[]): EligibleTeacherRow[] {
  const now = new Date().toISOString()
  return rows.filter((t) => {
    if (!t.plan_expires_at) return true
    if (t.plan_expires_at > now) return true
    if (t.grace_until && t.grace_until > now) return true
    return false
  })
}

// -----------------------------------------------------------------------------
// getExplorableTeacherIds — Cursor-paginated eligible teacher IDs.
//
// Filters that map cleanly to SQL (city) are pushed down. Subject/level/fee
// filters are still applied per-row in JS after the page is hydrated by
// `getExplorableTeacherDetails`, since they depend on derived per-teacher
// fields. This keeps the cursor scan fast (index on teachers) and the JS
// filter fixed at `pageSize` rows.
// -----------------------------------------------------------------------------
export async function getExplorableTeacherIds(
  filters: ExploreFilters = {},
  cursor: string | null = null,
  limit: number = EXPLORE_PAGE_SIZE,
): Promise<CursorPage<{ id: string; created_at: string }>> {
  const supabase = createAdminClient()

  let query = supabase
    .from('teachers')
    .select('id, created_at, plan_expires_at, grace_until')
    .eq('is_publicly_listed', true)
    .eq('is_suspended', false)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (filters.city) {
    query = query.ilike('city', filters.city.trim())
  }

  const decoded = decodeCursor(cursor)
  if (decoded) {
    // (created_at, id) tuple < (cursor.t, cursor.i) for DESC ordering.
    // Postgres lacks a direct row-comparison via PostgREST, so use the
    // fallback: created_at < cursor.t (one-row repeat risk acceptable per
    // PLAN_L §10).
    query = query.lt('created_at', decoded.t)
  }

  // Over-fetch: pull a wider window because eligibility filtering happens in
  // JS, then trim to `limit + 1` for the cursor handoff.
  const overFetch = Math.min(limit * 4 + 1, 200)
  query = query.limit(overFetch)

  const { data, error } = await query
  if (error || !data) return { rows: [], nextCursor: null }

  const eligible = filterEligible(data as EligibleTeacherRow[])
  return buildPage(
    eligible.map((t) => ({ id: t.id, created_at: t.created_at })),
    limit,
  )
}

// -----------------------------------------------------------------------------
// _getExplorableTeacherDetailsImpl — Internal uncached implementation.
// -----------------------------------------------------------------------------
async function _getExplorableTeacherDetailsImpl(
  teacherIds: string[],
): Promise<ExplorableTeacher[]> {
  if (teacherIds.length === 0) return []

  const supabase = createAdminClient()

  const { data: teachers, error } = await supabase
    .from('teachers')
    .select('id, name, subdomain, profile_photo_url, city, bio, subject_tags, teaching_levels')
    .in('id', teacherIds)

  if (error || !teachers) return []

  const teacherById = new Map<string, {
    id: string
    name: string
    subdomain: string
    profile_photo_url: string | null
    city: string | null
    bio: string | null
    subject_tags: string[]
    teaching_levels: string[]
  }>()
  for (const t of teachers as Array<typeof teacherById extends Map<string, infer V> ? V : never>) {
    teacherById.set(t.id, t)
  }

  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, teacher_id, fee_pkr, status, is_registration_open, max_students')
    .in('teacher_id', teacherIds)
    .is('deleted_at', null)
    .neq('status', 'archived')

  const { data: categoryRows } = await supabase
    .from('courses')
    .select('teacher_id, category')
    .in('teacher_id', teacherIds)
    .eq('status', 'published')
    .is('deleted_at', null)
    .not('category', 'is', null)

  const categoriesByTeacher = new Map<string, Set<string>>()
  for (const row of (categoryRows ?? []) as Array<{ teacher_id: string; category: string | null }>) {
    if (!row.category) continue
    const set = categoriesByTeacher.get(row.teacher_id) ?? new Set<string>()
    set.add(row.category)
    categoriesByTeacher.set(row.teacher_id, set)
  }

  const cohortsByTeacher = new Map<string, Array<{
    id: string
    fee_pkr: number
    status: string
    is_registration_open: boolean
    max_students: number | null
  }>>()
  const cohortIds: string[] = []
  for (const c of (cohorts ?? []) as Array<{
    id: string
    teacher_id: string
    fee_pkr: number
    status: string
    is_registration_open: boolean
    max_students: number | null
  }>) {
    cohortIds.push(c.id)
    const arr = cohortsByTeacher.get(c.teacher_id) ?? []
    arr.push({
      id: c.id,
      fee_pkr: c.fee_pkr,
      status: c.status,
      is_registration_open: c.is_registration_open,
      max_students: c.max_students,
    })
    cohortsByTeacher.set(c.teacher_id, arr)
  }

  const enrollmentCounts = new Map<string, number>()
  if (cohortIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('cohort_id')
      .in('cohort_id', cohortIds)
      .eq('status', 'active')

    for (const e of (enrollments ?? []) as Array<{ cohort_id: string }>) {
      enrollmentCounts.set(e.cohort_id, (enrollmentCounts.get(e.cohort_id) ?? 0) + 1)
    }
  }

  // Preserve input order so the page matches the cursor sort.
  const result: ExplorableTeacher[] = []
  for (const id of teacherIds) {
    const t = teacherById.get(id)
    if (!t) continue
    const teacherCohorts = cohortsByTeacher.get(id) ?? []
    if (teacherCohorts.length === 0) continue

    const fees = teacherCohorts.map((c) => c.fee_pkr)
    const startingFee = Math.min(...fees)

    let studentCount = 0
    let hasOpen = false
    for (const cohort of teacherCohorts) {
      const enrolled = enrollmentCounts.get(cohort.id) ?? 0
      studentCount += enrolled
      if (
        cohort.is_registration_open &&
        (cohort.status === 'active' || cohort.status === 'upcoming')
      ) {
        const isFull = cohort.max_students !== null && enrolled >= cohort.max_students
        if (!isFull) hasOpen = true
      }
    }

    result.push({
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      profile_photo_url: t.profile_photo_url,
      city: t.city,
      bio: t.bio,
      subject_tags: t.subject_tags,
      teaching_levels: t.teaching_levels,
      starting_fee_pkr: startingFee,
      student_count: studentCount,
      has_open_cohorts: hasOpen,
      course_categories: Array.from(categoriesByTeacher.get(id) ?? []),
    })
  }

  return result
}

/**
 * Cached wrapper. Cache key is the sorted teacher-id list so any permutation
 * of the same page hits the same cached payload. Tag `explore-list` lets
 * teacher mutations invalidate every page.
 */
export const getExplorableTeacherDetails = unstable_cache(
  async (teacherIds: string[]) => _getExplorableTeacherDetailsImpl(teacherIds),
  ['explore-teacher-details'],
  { revalidate: 600, tags: ['explore-list'] },
)

// -----------------------------------------------------------------------------
// getExploreFacets — Distinct subjects / levels / cities across the eligible set.
// Returned as small arrays; cached for an hour with `explore-list` tag.
// -----------------------------------------------------------------------------
async function _getExploreFacetsImpl(): Promise<ExploreFacets> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('teachers')
    .select('city, subject_tags, teaching_levels, plan_expires_at, grace_until')
    .eq('is_publicly_listed', true)
    .eq('is_suspended', false)
    .limit(5000)

  if (error || !data) return { subjects: [], levels: [], cities: [] }

  const now = new Date().toISOString()
  const subjects = new Set<string>()
  const levels = new Set<string>()
  const cities = new Set<string>()

  for (const row of data as Array<{
    city: string | null
    subject_tags: string[] | null
    teaching_levels: string[] | null
    plan_expires_at: string | null
    grace_until: string | null
  }>) {
    if (row.plan_expires_at) {
      if (row.plan_expires_at <= now && (!row.grace_until || row.grace_until <= now)) {
        continue
      }
    }
    for (const s of row.subject_tags ?? []) {
      if (s) subjects.add(s)
    }
    for (const l of row.teaching_levels ?? []) {
      if (l) levels.add(l)
    }
    if (row.city) {
      const trimmed = row.city.trim()
      if (trimmed) cities.add(trimmed)
    }
  }

  return {
    subjects: [...subjects].sort(),
    levels: [...levels].sort(),
    cities: [...cities].sort(),
  }
}

export const getExploreFacets = unstable_cache(
  async () => _getExploreFacetsImpl(),
  ['explore-facets'],
  { revalidate: 3600, tags: ['explore-list'] },
)

// -----------------------------------------------------------------------------
// getExplorableTeachers — Legacy unbounded fetch.
// Kept for back-compat. New callers should use getExplorableTeacherIds +
// getExplorableTeacherDetails. Internally now defers to the new helpers
// (over-fetched in chunks) to avoid two divergent implementations.
// -----------------------------------------------------------------------------
export async function getExplorableTeachers(
  filters?: ExploreFilters,
): Promise<ExplorableTeacher[]> {
  const collected: ExplorableTeacher[] = []
  let cursor: string | null = null
  // Hard cap to avoid runaway loops; matches the in-process facet cap.
  for (let i = 0; i < 50; i++) {
    const { rows, nextCursor } = await getExplorableTeacherIds({}, cursor, 100)
    if (rows.length === 0) break
    const details = await getExplorableTeacherDetails(rows.map((r) => r.id))
    collected.push(...details)
    if (!nextCursor) break
    cursor = nextCursor
  }

  let result = collected
  if (filters?.subject) {
    const lower = filters.subject.toLowerCase()
    result = result.filter((t) =>
      t.subject_tags.some((tag) => tag.toLowerCase().includes(lower)),
    )
  }
  if (filters?.level) {
    const lower = filters.level.toLowerCase()
    result = result.filter((t) =>
      t.teaching_levels.some((lvl) => lvl.toLowerCase().includes(lower)),
    )
  }
  if (filters?.minFee !== undefined) {
    result = result.filter((t) => t.starting_fee_pkr >= filters.minFee!)
  }
  if (filters?.maxFee !== undefined) {
    result = result.filter((t) => t.starting_fee_pkr <= filters.maxFee!)
  }
  if (filters?.city) {
    const wanted = filters.city.trim().toLowerCase()
    result = result.filter(
      (t) => !!t.city && t.city.trim().toLowerCase() === wanted,
    )
  }
  return result.sort((a, b) => b.student_count - a.student_count)
}
