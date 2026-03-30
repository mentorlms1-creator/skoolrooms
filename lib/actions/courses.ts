'use server'

// =============================================================================
// lib/actions/courses.ts — Server actions for course CRUD
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId, hasPaymentSettings } from '@/lib/db/teachers'
import {
  createCourse,
  getCourseById,
  updateCourse,
  softDeleteCourse,
  countPublishedCourses,
} from '@/lib/db/courses'
import { getLimit } from '@/lib/plans/limits'
import { checkPlanLock, getPlanLockError } from '@/lib/auth/plan-guard'
import { completeOnboardingStep } from '@/lib/actions/onboarding'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const teacher = await getTeacherByAuthId(user.id)
  return teacher
}

// -----------------------------------------------------------------------------
// createCourseAction — Create a new draft course
// -----------------------------------------------------------------------------

export async function createCourseAction(
  formData: FormData,
): Promise<ApiResponse<{ courseId: string }>> {
  const teacher = await getAuthenticatedTeacher()

  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null) ?? null

  if (title.length < 3) {
    return {
      success: false,
      error: 'Course title must be at least 3 characters.',
    }
  }

  // No plan limit check on draft creation — only published courses count
  // toward max_courses. The limit is enforced in updateCourseAction when
  // status is set to 'published'.
  const course = await createCourse(teacher.id, title, description)

  if (!course) {
    return { success: false, error: 'Failed to create course. Please try again.' }
  }

  return { success: true, data: { courseId: course.id } }
}

// -----------------------------------------------------------------------------
// updateCourseAction — Update a course (title, description, status, thumbnail)
// -----------------------------------------------------------------------------

export async function updateCourseAction(
  courseId: string,
  formData: FormData,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()

  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  // Verify ownership
  const course = await getCourseById(courseId)
  if (!course || course.teacher_id !== teacher.id) {
    return { success: false, error: 'Course not found' }
  }

  const title = (formData.get('title') as string | null)?.trim()
  const description = formData.get('description') as string | null
  const status = formData.get('status') as string | null
  const thumbnailUrl = formData.get('thumbnail_url') as string | null

  if (title !== null && title !== undefined && title.length < 3) {
    return {
      success: false,
      error: 'Course title must be at least 3 characters.',
    }
  }

  // If publishing, enforce payment settings and plan limits
  if (status === 'published') {
    const paymentReady = await hasPaymentSettings(teacher.id)
    if (!paymentReady) {
      return {
        success: false,
        error:
          'You need to set up at least one payment method before publishing a course. Go to Settings > Payments to add your bank details.',
        code: 'PAYMENT_SETUP_REQUIRED',
      }
    }

    const [publishedCount, maxCourses] = await Promise.all([
      countPublishedCourses(teacher.id),
      getLimit(teacher.id, 'max_courses'),
    ])

    if (publishedCount >= maxCourses) {
      return {
        success: false,
        error: `You have reached your plan limit of ${maxCourses} published course${maxCourses === 1 ? '' : 's'}. Upgrade your plan to publish more.`,
        code: 'PLAN_LIMIT_REACHED',
      }
    }

    // Mark onboarding step complete on first publish
    await completeOnboardingStep('course_created')
  }

  // Build update fields
  const updates: Record<string, unknown> = {}
  if (title !== null && title !== undefined) updates.title = title
  if (description !== null) updates.description = description
  if (status !== null) updates.status = status
  if (thumbnailUrl !== null) updates.thumbnail_url = thumbnailUrl

  const updated = await updateCourse(courseId, updates)

  if (!updated) {
    return { success: false, error: 'Failed to update course. Please try again.' }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// deleteCourseAction — Soft-delete a course
// -----------------------------------------------------------------------------

export async function deleteCourseAction(
  courseId: string,
): Promise<ApiResponse<null>> {
  const teacher = await getAuthenticatedTeacher()

  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  // Hard lock check: block content-write when plan + grace expired
  if (checkPlanLock(teacher)) {
    return getPlanLockError()
  }

  // Verify ownership
  const course = await getCourseById(courseId)
  if (!course || course.teacher_id !== teacher.id) {
    return { success: false, error: 'Course not found' }
  }

  const result = await softDeleteCourse(courseId)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: null }
}
