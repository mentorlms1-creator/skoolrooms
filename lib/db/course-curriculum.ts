// =============================================================================
// lib/db/course-curriculum.ts — Course curriculum CRUD queries (service layer)
// All database queries for course_curriculum_items go through this file.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

export type CurriculumItem = {
  id: string
  course_id: string
  week_number: number
  title: string
  description: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export async function getCurriculumByCourse(
  courseId: string,
): Promise<CurriculumItem[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('course_curriculum_items')
    .select('*')
    .eq('course_id', courseId)
    .order('display_order', { ascending: true })

  if (error || !data) return []
  return data as CurriculumItem[]
}

export type CreateCurriculumItemInput = {
  courseId: string
  weekNumber: number
  title: string
  description?: string | null
  displayOrder?: number
}

export async function createCurriculumItem(
  input: CreateCurriculumItemInput,
): Promise<CurriculumItem | null> {
  const supabase = createAdminClient()

  let displayOrder = input.displayOrder
  if (displayOrder === undefined) {
    // Append at end: max(display_order) + 1
    const { data: existing } = await supabase
      .from('course_curriculum_items')
      .select('display_order')
      .eq('course_id', input.courseId)
      .order('display_order', { ascending: false })
      .limit(1)
    const top = (existing?.[0]?.display_order as number | undefined) ?? -1
    displayOrder = top + 1
  }

  const { data, error } = await supabase
    .from('course_curriculum_items')
    .insert({
      course_id: input.courseId,
      week_number: input.weekNumber,
      title: input.title,
      description: input.description ?? null,
      display_order: displayOrder,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return data as CurriculumItem
}

export async function updateCurriculumItem(
  itemId: string,
  courseId: string,
  updates: Partial<{
    weekNumber: number
    title: string
    description: string | null
    displayOrder: number
  }>,
): Promise<CurriculumItem | null> {
  const supabase = createAdminClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.weekNumber !== undefined) patch.week_number = updates.weekNumber
  if (updates.title !== undefined) patch.title = updates.title
  if (updates.description !== undefined) patch.description = updates.description
  if (updates.displayOrder !== undefined) patch.display_order = updates.displayOrder

  const { data, error } = await supabase
    .from('course_curriculum_items')
    .update(patch)
    .eq('id', itemId)
    .eq('course_id', courseId)
    .select('*')
    .single()

  if (error || !data) return null
  return data as CurriculumItem
}

export async function deleteCurriculumItem(
  itemId: string,
  courseId: string,
): Promise<boolean> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('course_curriculum_items')
    .delete()
    .eq('id', itemId)
    .eq('course_id', courseId)

  return !error
}

export async function reorderCurriculumItems(
  courseId: string,
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Sequential updates — reorder is rare, simpler than a CTE roundtrip.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('course_curriculum_items')
      .update({ display_order: i, updated_at: now })
      .eq('id', orderedIds[i])
      .eq('course_id', courseId)
    if (error) return false
  }
  return true
}
