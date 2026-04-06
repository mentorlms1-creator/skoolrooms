/**
 * app/(teacher)/dashboard/layout.tsx — Dashboard layout with sidebar
 *
 * Server Component. Renders Sidebar + main content area.
 * Wraps children with TeacherProvider for client-side plan/usage context.
 * Shows ExpiryBanner for plan expiry/grace/lock/trial warnings.
 * Redirects to onboarding wizard if profile setup not complete.
 * The 5-step checklist (OnboardingChecklist) is informational, not a gate.
 */

import { redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherPlanDetails, getTeacherUsage } from '@/lib/db/teachers'
import { SidebarShell } from '@/components/ui/SidebarShell'
import { TeacherProvider } from '@/providers/TeacherProvider'
import type { TeacherData } from '@/providers/TeacherProvider'
import type { PlanSlug } from '@/types/domain'
import { ExpiryBanner } from '@/components/teacher/ExpiryBanner'
import { ROUTES } from '@/constants/routes'
import { signOut } from '@/lib/auth/actions'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const teacher = await requireTeacher()

  // Redirect to onboarding wizard if profile setup (the 3-step wizard) isn't done.
  // We check profile_complete since that's the final step of the wizard.
  // The 5-step checklist (course_created, cohort_created, etc.) is shown on
  // the dashboard as an informational widget, not as a gate.
  const steps = (teacher.onboarding_steps_json || {}) as Record<string, boolean>
  if (!steps.profile_complete) {
    redirect(ROUTES.PLATFORM.onboarding.step1)
  }

  const teacherId = teacher.id as string

  // Fetch plan details and usage for TeacherProvider
  const [planDetails, usage] = await Promise.all([
    getTeacherPlanDetails(teacherId),
    getTeacherUsage(teacherId),
  ])

  // Build TeacherData shape for the provider
  const teacherData: TeacherData = {
    id: teacherId,
    name: teacher.name as string,
    email: teacher.email as string,
    subdomain: teacher.subdomain as string,
    plan: (teacher.plan as PlanSlug) ?? 'free',
    planExpiresAt: (teacher.plan_expires_at as string | null) ?? null,
    graceUntil: (teacher.grace_until as string | null) ?? null,
    trialEndsAt: (teacher.trial_ends_at as string | null) ?? null,
    onboardingCompleted: teacher.onboarding_completed as boolean,
    onboardingStepsJson: (teacher.onboarding_steps_json || {}) as Record<string, boolean>,
    isSuspended: teacher.is_suspended as boolean,
    profilePhotoUrl: (teacher.profile_photo_url as string | null) ?? null,
    bio: (teacher.bio as string | null) ?? null,
    subjectTags: (teacher.subject_tags || []) as string[],
    teachingLevels: (teacher.teaching_levels || []) as string[],
    city: (teacher.city as string | null) ?? null,
    isPubliclyListed: teacher.is_publicly_listed as boolean,
  }

  const defaultPlan = {
    name: 'Free',
    slug: 'free' as PlanSlug,
    pricePerMonth: 0,
    limits: { max_courses: 1, max_students: 15, max_cohorts_active: 1, max_storage_mb: 500 },
    features: {},
  }

  const defaultUsage = { courses: 0, students: 0, cohortsActive: 0, storageMb: 0 }

  return (
    <TeacherProvider
      teacher={teacherData}
      plan={planDetails ?? defaultPlan}
      usage={usage ?? defaultUsage}
    >
      <SidebarShell
        role="teacher"
        user={{ name: teacherData.name }}
        notificationCount={0}
        notificationHref={ROUTES.TEACHER.messages}
        signOutAction={signOut}
      >
        <ExpiryBanner />
        {children}
      </SidebarShell>
    </TeacherProvider>
  )
}
