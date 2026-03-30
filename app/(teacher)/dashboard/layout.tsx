/**
 * app/(teacher)/dashboard/layout.tsx — Dashboard layout with sidebar
 *
 * Server Component. Renders Sidebar + main content area.
 * Redirects to onboarding wizard if profile setup not complete.
 * The 5-step checklist (OnboardingChecklist) is informational, not a gate.
 */

import { redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { Sidebar } from '@/components/teacher/Sidebar'
import { ROUTES } from '@/constants/routes'

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

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <main className="ml-64 flex-1">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  )
}
