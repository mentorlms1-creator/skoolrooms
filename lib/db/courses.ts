// =============================================================================
// lib/db/courses.ts — Course CRUD queries (service layer)
// All database queries for courses go through this file.
// =============================================================================

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/supabase/server'
import { revalidateTeacherUsage } from '@/lib/db/teachers'

// -----------------------------------------------------------------------------
// Row types (mirrors the courses table from 001_initial_schema.sql)
// These will be replaced by auto-generated types once `npx supabase gen types`
// is run. Until then, we define them manually.
// -----------------------------------------------------------------------------

export type CourseRow = {
  id: string
  teacher_id: string
  title: string
  description: string | null
  status: string
  thumbnail_url: string | null
  category: string | null
  tags: string[]
  created_at: string
  deleted_at: string | null
  updated_at: string
}

// -----------------------------------------------------------------------------
// getTeacherCourses — All non-deleted courses for a teacher, newest first
// -----------------------------------------------------------------------------
export async function getTeacherCourses(
  teacherId: string
): Promise<CourseRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('teacher_id', teacherId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as CourseRow[]
}

// -----------------------------------------------------------------------------
// getCourseById — Single course by ID (must not be soft-deleted)
// -----------------------------------------------------------------------------
export async function getCourseById(
  courseId: string
): Promise<CourseRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null
  return data as CourseRow
}

// -----------------------------------------------------------------------------
// getPublishedCoursesByTeacher — Published, non-deleted courses for a teacher
// -----------------------------------------------------------------------------
export async function getPublishedCoursesByTeacher(
  teacherId: string
): Promise<CourseRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as CourseRow[]
}

// Curriculum item (mirrors course_curriculum_items, see migration 012)
export type CurriculumItemRow = {
  id: string
  course_id: string
  week_number: number
  title: string
  description: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export type CourseWithCurriculum = CourseRow & {
  curriculum: CurriculumItemRow[]
}

// -----------------------------------------------------------------------------
// getPublishedCoursesByTeacherWithCurriculum — Published courses with their
// curriculum items nested. Used by the public teacher subdomain page.
// -----------------------------------------------------------------------------
async function _getPublishedCoursesByTeacherWithCurriculumImpl(
  teacherId: string,
): Promise<CourseWithCurriculum[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .select('*, course_curriculum_items(*)')
    .eq('teacher_id', teacherId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return (data as Array<CourseRow & { course_curriculum_items: CurriculumItemRow[] | null }>).map(
    (row) => {
      const items = (row.course_curriculum_items ?? []).slice().sort(
        (a, b) => a.display_order - b.display_order,
      )
      const { course_curriculum_items: _ignored, ...rest } = row
      void _ignored
      return { ...(rest as CourseRow), curriculum: items }
    },
  )
}

/**
 * Cached export. Tag `teacher-courses:<id>` lets course mutations invalidate
 * just that teacher's public profile without nuking the whole explore cache.
 */
export async function getPublishedCoursesByTeacherWithCurriculum(
  teacherId: string,
): Promise<CourseWithCurriculum[]> {
  const fetcher = unstable_cache(
    async (id: string) => _getPublishedCoursesByTeacherWithCurriculumImpl(id),
    ['teacher-courses-with-curriculum', teacherId],
    { revalidate: 3600, tags: [`teacher-courses:${teacherId}`] },
  )
  return fetcher(teacherId)
}

// -----------------------------------------------------------------------------
// createCourse — Insert a new course with status='draft'
// -----------------------------------------------------------------------------
export async function createCourse(
  teacherId: string,
  title: string,
  description: string | null,
  category: string | null = null,
  tags: string[] = [],
): Promise<CourseRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .insert({
      teacher_id: teacherId,
      title,
      description,
      status: 'draft',
      category,
      tags,
    })
    .select('*')
    .single()

  if (error || !data) return null
  // Newly-created course is draft so usage count is unchanged, but invalidate
  // anyway — cheap, and keeps us safe if status default ever changes.
  revalidateTeacherUsage(teacherId)
  return data as CourseRow
}

// -----------------------------------------------------------------------------
// updateCourse — Partial update with automatic updated_at
// -----------------------------------------------------------------------------
export async function updateCourse(
  courseId: string,
  updates: Record<string, unknown>
): Promise<CourseRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', courseId)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error || !data) return null
  if ('status' in updates) {
    revalidateTeacherUsage((data as CourseRow).teacher_id)
  }
  return data as CourseRow
}

// -----------------------------------------------------------------------------
// softDeleteCourse — Set deleted_at (only if no active cohorts)
// Returns { success: true } or { success: false, error: string }
// -----------------------------------------------------------------------------
export async function softDeleteCourse(
  courseId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = createAdminClient()

  // Check for active/upcoming cohorts that would block deletion
  const { count, error: countError } = await supabase
    .from('cohorts')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .is('deleted_at', null)
    .in('status', ['upcoming', 'active'])

  if (countError) {
    return { success: false, error: 'Failed to check active cohorts' }
  }

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error:
        'Cannot delete a course with active or upcoming cohorts. Archive or delete the cohorts first.',
    }
  }

  // Safe to soft-delete — capture teacher_id for cache invalidation.
  const { data: deleted, error: deleteError } = await supabase
    .from('courses')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', courseId)
    .is('deleted_at', null)
    .select('teacher_id')
    .single()

  if (deleteError) {
    return { success: false, error: 'Failed to delete course' }
  }

  if (deleted) revalidateTeacherUsage((deleted as { teacher_id: string }).teacher_id)
  return { success: true }
}

// -----------------------------------------------------------------------------
// countPublishedCourses — Count for plan limit enforcement
// -----------------------------------------------------------------------------
export async function countPublishedCourses(
  teacherId: string
): Promise<number> {
  const supabase = createAdminClient()

  const { count } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'published')
    .is('deleted_at', null)

  return count ?? 0
}
