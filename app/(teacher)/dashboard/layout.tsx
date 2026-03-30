/**
 * app/(teacher)/dashboard/layout.tsx — Dashboard layout with sidebar
 *
 * Server Component. Checks onboarding status and renders Sidebar + main area.
 * Redirects to onboarding if not complete.
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

  if (!teacher.onboarding_completed) {
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
