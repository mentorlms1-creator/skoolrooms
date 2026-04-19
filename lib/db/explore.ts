// =============================================================================
// lib/db/explore.ts — Explore page queries (service layer)
// Complex query for teacher directory: joins teachers -> courses -> cohorts.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

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

// -----------------------------------------------------------------------------
// getExplorableTeachers — Fetch all publicly-listed, non-suspended, non-locked
// teachers that have at least one cohort.
//
// Strategy (from ARCHITECTURE.md Section 3 Explore Page Query):
//   1. Fetch teachers where is_publicly_listed=true, is_suspended=false
//   2. Exclude hard-locked teachers (plan expired + grace expired)
//   3. For each teacher, get min cohort fee + student count + open cohort check
// -----------------------------------------------------------------------------
export async function getExplorableTeachers(
  filters?: ExploreFilters,
): Promise<ExplorableTeacher[]> {
  const supabase = createAdminClient()

  // Step 1: Get all publicly-listed, non-suspended teachers
  let teacherQuery = supabase
    .from('teachers')
    .select('id, name, subdomain, profile_photo_url, city, bio, subject_tags, teaching_levels, plan_expires_at, grace_until')
    .eq('is_publicly_listed', true)
    .eq('is_suspended', false)

  const { data: teachers, error: teacherError } = await teacherQuery

  if (teacherError || !teachers || teachers.length === 0) return []

  // Step 2: Filter out hard-locked teachers (plan expired + grace expired)
  const now = new Date().toISOString()
  const eligibleTeachers = (teachers as Array<{
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
  }>).filter((t) => {
    // No expiration = free plan = always eligible
    if (!t.plan_expires_at) return true
    // Plan not expired yet
    if (t.plan_expires_at > now) return true
    // Plan expired but grace period still active
    if (t.grace_until && t.grace_until > now) return true
    // Hard-locked — exclude
    return false
  })

  if (eligibleTeachers.length === 0) return []

  const teacherIds = eligibleTeachers.map((t) => t.id as string)

  // Step 3: Get cohorts for these teachers (non-deleted, non-archived)
  const { data: cohorts, error: cohortError } = await supabase
    .from('cohorts')
    .select('id, teacher_id, fee_pkr, status, is_registration_open, max_students')
    .in('teacher_id', teacherIds)
    .is('deleted_at', null)
    .neq('status', 'archived')

  if (cohortError || !cohorts) return []

  // Fetch published course categories per teacher (distinct, non-null) for
  // the course_categories field on ExplorableTeacher. Lane F filter UI
  // consumes this.
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
    const tid = row.teacher_id
    if (!categoriesByTeacher.has(tid)) categoriesByTeacher.set(tid, new Set())
    categoriesByTeacher.get(tid)!.add(row.category)
  }

  // Build cohort map by teacher
  const cohortsByTeacher = new Map<string, Array<{
    id: string
    fee_pkr: number
    status: string
    is_registration_open: boolean
    max_students: number | null
  }>>()

  for (const c of cohorts) {
    const tid = c.teacher_id as string
    if (!cohortsByTeacher.has(tid)) {
      cohortsByTeacher.set(tid, [])
    }
    cohortsByTeacher.get(tid)!.push({
      id: c.id as string,
      fee_pkr: c.fee_pkr as number,
      status: c.status as string,
      is_registration_open: c.is_registration_open as boolean,
      max_students: c.max_students as number | null,
    })
  }

  // Step 4: Get enrollment counts per cohort for student count + open check
  const cohortIds = cohorts.map((c) => c.id as string)
  let enrollmentCounts = new Map<string, number>()

  if (cohortIds.length > 0) {
    // Fetch enrollment counts grouped by cohort
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('cohort_id')
      .in('cohort_id', cohortIds)
      .eq('status', 'active')

    if (!enrollError && enrollments) {
      for (const e of enrollments) {
        const cid = e.cohort_id as string
        enrollmentCounts.set(cid, (enrollmentCounts.get(cid) ?? 0) + 1)
      }
    }
  }

  // Step 5: Build explorable teacher list
  const result: ExplorableTeacher[] = []

  for (const teacher of eligibleTeachers) {
    const teacherCohorts = cohortsByTeacher.get(teacher.id as string) ?? []

    // Skip teachers with no cohorts
    if (teacherCohorts.length === 0) continue

    // Calculate min fee
    const fees = teacherCohorts.map((c) => c.fee_pkr)
    const startingFee = Math.min(...fees)

    // Calculate total student count across all cohorts
    let studentCount = 0
    let hasOpen = false

    for (const cohort of teacherCohorts) {
      const enrolled = enrollmentCounts.get(cohort.id) ?? 0
      studentCount += enrolled

      // Check if cohort is open for registration
      if (
        cohort.is_registration_open &&
        (cohort.status === 'active' || cohort.status === 'upcoming')
      ) {
        const isFull = cohort.max_students !== null && enrolled >= cohort.max_students
        if (!isFull) {
          hasOpen = true
        }
      }
    }

    // Apply filters
    if (filters?.subject) {
      const subjectLower = filters.subject.toLowerCase()
      const hasSubject = (teacher.subject_tags as string[]).some(
        (tag) => tag.toLowerCase().includes(subjectLower),
      )
      if (!hasSubject) continue
    }

    if (filters?.level) {
      const levelLower = filters.level.toLowerCase()
      const hasLevel = (teacher.teaching_levels as string[]).some(
        (lvl) => lvl.toLowerCase().includes(levelLower),
      )
      if (!hasLevel) continue
    }

    if (filters?.minFee !== undefined && startingFee < filters.minFee) continue
    if (filters?.maxFee !== undefined && startingFee > filters.maxFee) continue

    if (filters?.city) {
      const wanted = filters.city.trim().toLowerCase()
      if (!teacher.city || teacher.city.trim().toLowerCase() !== wanted) continue
    }

    result.push({
      id: teacher.id as string,
      name: teacher.name as string,
      subdomain: teacher.subdomain as string,
      profile_photo_url: teacher.profile_photo_url as string | null,
      city: teacher.city as string | null,
      bio: teacher.bio as string | null,
      subject_tags: teacher.subject_tags as string[],
      teaching_levels: teacher.teaching_levels as string[],
      starting_fee_pkr: startingFee,
      student_count: studentCount,
      has_open_cohorts: hasOpen,
      course_categories: Array.from(categoriesByTeacher.get(teacher.id as string) ?? []),
    })
  }

  // Sort by student count (most popular first)
  result.sort((a, b) => b.student_count - a.student_count)

  return result
}
