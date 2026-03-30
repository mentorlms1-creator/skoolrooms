// =============================================================================
// lib/db/courses.ts — Course CRUD queries (service layer)
// All database queries for courses go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

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

// -----------------------------------------------------------------------------
// createCourse — Insert a new course with status='draft'
// -----------------------------------------------------------------------------
export async function createCourse(
  teacherId: string,
  title: string,
  description: string | null
): Promise<CourseRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .insert({
      teacher_id: teacherId,
      title,
      description,
      status: 'draft',
    })
    .select('*')
    .single()

  if (error || !data) return null
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

  // Safe to soft-delete
  const { error: deleteError } = await supabase
    .from('courses')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', courseId)
    .is('deleted_at', null)

  if (deleteError) {
    return { success: false, error: 'Failed to delete course' }
  }

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
