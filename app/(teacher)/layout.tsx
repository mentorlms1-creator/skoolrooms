/**
 * app/(teacher)/layout.tsx — Root layout for all teacher routes
 *
 * Server Component. Fetches teacher data, plan details, and usage,
 * then wraps children in UIProvider > TeacherProvider.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { getTeacherByAuthId, getTeacherPlanDetails, getTeacherUsage } from '@/lib/db/teachers'
import { UIProvider } from '@/providers/UIProvider'
import { TeacherProvider } from '@/providers/TeacherProvider'
import type { TeacherData, PlanDetails, UsageData } from '@/providers/TeacherProvider'
import type { PlanSlug } from '@/types/domain'
import { ROUTES } from '@/constants/routes'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Auth check — createClient() is async
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.PLATFORM.teacherLogin)

  // 2. Fetch teacher row — getTeacherByAuthId uses createAdminClient() (not async)
  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) redirect(ROUTES.PLATFORM.teacherLogin)
  if (teacher.is_suspended) redirect('/suspended')

  // 3. Fetch plan details and usage in parallel
  const [planDetails, usage] = await Promise.all([
    getTeacherPlanDetails(teacher.id),
    getTeacherUsage(teacher.id),
  ])

  // Fallback plan details if DB lookup fails (shouldn't happen, but be safe)
  const plan: PlanDetails = planDetails ?? {
    name: 'Free',
    slug: 'free' as PlanSlug,
    pricePerMonth: 0,
    limits: {
      max_courses: 2,
      max_students: 30,
      max_cohorts_active: 2,
      max_storage_mb: 500,
      max_teachers: 1,
    },
    features: {},
  }

  // 4. Map DB row to TeacherData shape
  const teacherData: TeacherData = {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    subdomain: teacher.subdomain,
    plan: teacher.plan as PlanSlug,
    planExpiresAt: teacher.plan_expires_at,
    graceUntil: teacher.grace_until,
    trialEndsAt: teacher.trial_ends_at,
    onboardingCompleted: teacher.onboarding_completed,
    onboardingStepsJson: teacher.onboarding_steps_json,
    isSuspended: teacher.is_suspended,
    profilePhotoUrl: teacher.profile_photo_url,
    bio: teacher.bio,
    subjectTags: teacher.subject_tags,
    teachingLevels: teacher.teaching_levels,
    city: teacher.city,
    isPubliclyListed: teacher.is_publicly_listed,
  }

  return (
    <UIProvider>
      <TeacherProvider teacher={teacherData} plan={plan} usage={usage}>
        {children}
      </TeacherProvider>
    </UIProvider>
  )
}
