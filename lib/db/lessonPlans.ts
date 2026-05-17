// =============================================================================
// lib/db/lessonPlans.ts — Lesson plan CRUD queries (service layer)
// All DB access for lesson_plans goes through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'
import type { Database } from '@/types/database'

export type LessonPlanRow = Database['public']['Tables']['lesson_plans']['Row']
export type LessonPlanInsert = Database['public']['Tables']['lesson_plans']['Insert']

// -----------------------------------------------------------------------------
// getLessonPlansForCourse — All plans for a course, newest first
// -----------------------------------------------------------------------------
export async function getLessonPlansForCourse(
  teacherId: string,
  courseId: string
): Promise<LessonPlanRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('course_id', courseId)
    .order('updated_at', { ascending: false })

  if (error || !data) return []
  return data
}

// -----------------------------------------------------------------------------
// getLessonPlanById — Single plan, scoped to the owning teacher
// -----------------------------------------------------------------------------
export async function getLessonPlanById(
  teacherId: string,
  planId: string
): Promise<LessonPlanRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('id', planId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

// -----------------------------------------------------------------------------
// insertLessonPlan — Direct insert (used outside the atomic-quota RPC path)
// -----------------------------------------------------------------------------
export async function insertLessonPlan(
  row: LessonPlanInsert
): Promise<LessonPlanRow> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('lesson_plans')
    .insert(row)
    .select()
    .single()

  if (error) throw error
  return data
}

// -----------------------------------------------------------------------------
// updateLessonPlan — Partial update of body/title/chat_history
// -----------------------------------------------------------------------------
export async function updateLessonPlan(
  teacherId: string,
  planId: string,
  patch: Partial<Pick<LessonPlanRow, 'title' | 'body_markdown' | 'chat_history'>>
): Promise<LessonPlanRow> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('lesson_plans')
    .update(patch)
    .eq('teacher_id', teacherId)
    .eq('id', planId)
    .select()
    .single()

  if (error) throw error
  return data
}

// -----------------------------------------------------------------------------
// deleteLessonPlan — Hard delete, scoped to owner
// -----------------------------------------------------------------------------
export async function deleteLessonPlan(
  teacherId: string,
  planId: string
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('lesson_plans')
    .delete()
    .eq('teacher_id', teacherId)
    .eq('id', planId)

  if (error) throw error
}
