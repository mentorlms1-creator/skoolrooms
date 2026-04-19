'use server'

// =============================================================================
// lib/actions/course-curriculum.ts — Server actions for course curriculum CRUD
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getCourseById } from '@/lib/db/courses'
import {
  createCurriculumItem,
  updateCurriculumItem,
  deleteCurriculumItem,
  reorderCurriculumItems,
} from '@/lib/db/course-curriculum'
import { checkPlanLock, getPlanLockError } from '@/lib/auth/plan-guard'
import type { ApiResponse } from '@/types/api'

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return getTeacherByAuthId(user.id)
}

async function ownCourseOrError(courseId: string) {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) {
    return { ok: false as const, response: { success: false as const, error: 'Not authenticated' } }
  }
  if (checkPlanLock(teacher)) {
    return { ok: false as const, response: getPlanLockError() }
  }
  const course = await getCourseById(courseId)
  if (!course || course.teacher_id !== teacher.id) {
    return { ok: false as const, response: { success: false as const, error: 'Course not found' } }
  }
  return { ok: true as const, teacher, course }
}

function validateItemFields(formData: FormData): { ok: true; weekNumber: number; title: string; description: string | null } | { ok: false; error: string } {
  const weekRaw = (formData.get('week_number') as string | null)?.trim() ?? ''
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const description = ((formData.get('description') as string | null) ?? '').trim()

  const weekNumber = parseInt(weekRaw, 10)
  if (isNaN(weekNumber) || weekNumber < 1) {
    return { ok: false, error: 'Week number must be 1 or higher.' }
  }
  if (title.length < 2 || title.length > 120) {
    return { ok: false, error: 'Title must be 2-120 characters.' }
  }
  if (description.length > 2000) {
    return { ok: false, error: 'Description must be 2000 characters or fewer.' }
  }
  return { ok: true, weekNumber, title, description: description || null }
}

export async function createCurriculumItemAction(
  courseId: string,
  formData: FormData,
): Promise<ApiResponse<{ itemId: string }>> {
  const guard = await ownCourseOrError(courseId)
  if (!guard.ok) return guard.response

  const fields = validateItemFields(formData)
  if (!fields.ok) return { success: false, error: fields.error }

  const created = await createCurriculumItem({
    courseId,
    weekNumber: fields.weekNumber,
    title: fields.title,
    description: fields.description,
  })
  if (!created) {
    return { success: false, error: 'Failed to create curriculum item.' }
  }
  return { success: true, data: { itemId: created.id } }
}

export async function updateCurriculumItemAction(
  itemId: string,
  courseId: string,
  formData: FormData,
): Promise<ApiResponse<null>> {
  const guard = await ownCourseOrError(courseId)
  if (!guard.ok) return guard.response

  const fields = validateItemFields(formData)
  if (!fields.ok) return { success: false, error: fields.error }

  const updated = await updateCurriculumItem(itemId, courseId, {
    weekNumber: fields.weekNumber,
    title: fields.title,
    description: fields.description,
  })
  if (!updated) {
    return { success: false, error: 'Failed to update curriculum item.' }
  }
  return { success: true, data: null }
}

export async function deleteCurriculumItemAction(
  itemId: string,
  courseId: string,
): Promise<ApiResponse<null>> {
  const guard = await ownCourseOrError(courseId)
  if (!guard.ok) return guard.response

  const ok = await deleteCurriculumItem(itemId, courseId)
  if (!ok) return { success: false, error: 'Failed to delete curriculum item.' }
  return { success: true, data: null }
}

export async function reorderCurriculumItemsAction(
  courseId: string,
  orderedIds: string[],
): Promise<ApiResponse<null>> {
  const guard = await ownCourseOrError(courseId)
  if (!guard.ok) return guard.response

  if (!Array.isArray(orderedIds) || orderedIds.some((v) => typeof v !== 'string')) {
    return { success: false, error: 'Invalid order payload.' }
  }
  const ok = await reorderCurriculumItems(courseId, orderedIds)
  if (!ok) return { success: false, error: 'Failed to reorder curriculum items.' }
  return { success: true, data: null }
}
