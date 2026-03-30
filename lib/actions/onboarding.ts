'use server'

// =============================================================================
// lib/actions/onboarding.ts — Server actions for teacher onboarding wizard
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId, updateTeacher } from '@/lib/db/teachers'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** All 5 onboarding steps that must be true for onboarding_completed.
 * Must match the keys in teachers.onboarding_steps_json default:
 * {"profile_complete": false, "payment_details_set": false, "course_created": false, "cohort_created": false, "link_shared": false}
 */
const ONBOARDING_STEPS = [
  'profile_complete',
  'payment_details_set',
  'course_created',
  'cohort_created',
  'link_shared',
] as const

type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

function allStepsComplete(steps: Record<string, boolean>): boolean {
  return ONBOARDING_STEPS.every((step) => steps[step] === true)
}

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, teacher: null }
  }

  const teacher = await getTeacherByAuthId(user.id)
  return { user, teacher }
}

// -----------------------------------------------------------------------------
// saveOnboardingStep1 — Subjects & teaching levels
// -----------------------------------------------------------------------------

export async function saveOnboardingStep1(
  formData: FormData,
): Promise<ApiResponse<null>> {
  const { teacher } = await getAuthenticatedTeacher()

  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  const subjectTags = formData.getAll('subject_tags') as string[]
  const teachingLevels = formData.getAll('teaching_levels') as string[]

  if (subjectTags.length === 0) {
    return { success: false, error: 'Please select at least one subject.' }
  }

  if (teachingLevels.length === 0) {
    return { success: false, error: 'Please select at least one teaching level.' }
  }

  // Saving subjects/levels is wizard data, not a checklist step.
  // The 5 checklist steps are: profile_complete, payment_details_set,
  // course_created, cohort_created, link_shared.
  const updated = await updateTeacher(teacher.id, {
    subject_tags: subjectTags,
    teaching_levels: teachingLevels,
  })

  if (!updated) {
    return { success: false, error: 'Failed to save. Please try again.' }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// saveOnboardingStep3 — Profile bio & photo
// -----------------------------------------------------------------------------

export async function saveOnboardingStep3(
  formData: FormData,
): Promise<ApiResponse<null>> {
  const { teacher } = await getAuthenticatedTeacher()

  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  const bio = formData.get('bio') as string | null
  const profilePhotoUrl = formData.get('profile_photo_url') as string | null

  if (!bio || bio.trim().length < 10) {
    return {
      success: false,
      error: 'Please write a bio of at least 10 characters.',
    }
  }

  const stepsJson: Record<string, boolean> = {
    ...teacher.onboarding_steps_json,
    profile_complete: true,
  }

  const updates: Record<string, unknown> = {
    bio: bio.trim(),
    onboarding_steps_json: stepsJson,
    onboarding_completed: allStepsComplete(stepsJson),
  }

  if (profilePhotoUrl) {
    updates.profile_photo_url = profilePhotoUrl
  }

  const updated = await updateTeacher(teacher.id, updates)

  if (!updated) {
    return { success: false, error: 'Failed to save. Please try again.' }
  }

  return { success: true, data: null }
}

// -----------------------------------------------------------------------------
// completeOnboardingStep — Mark an individual onboarding step as done
// -----------------------------------------------------------------------------

export async function completeOnboardingStep(
  step: OnboardingStep,
): Promise<ApiResponse<null>> {
  const { teacher } = await getAuthenticatedTeacher()

  if (!teacher) {
    return { success: false, error: 'Not authenticated' }
  }

  if (!ONBOARDING_STEPS.includes(step)) {
    return { success: false, error: 'Invalid onboarding step.' }
  }

  const stepsJson: Record<string, boolean> = {
    ...teacher.onboarding_steps_json,
    [step]: true,
  }

  const updated = await updateTeacher(teacher.id, {
    onboarding_steps_json: stepsJson,
    onboarding_completed: allStepsComplete(stepsJson),
  })

  if (!updated) {
    return { success: false, error: 'Failed to update. Please try again.' }
  }

  return { success: true, data: null }
}
