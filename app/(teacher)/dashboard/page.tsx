/**
 * app/(teacher)/dashboard/page.tsx — Teacher dashboard home page
 *
 * Server Component. Displays welcome message, onboarding checklist,
 * and plan usage overview.
 */

import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherPlanDetails, getTeacherUsage } from '@/lib/db/teachers'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { OnboardingChecklist } from '@/components/teacher/OnboardingChecklist'
import { UsageBars } from '@/components/ui/UsageBars'

export const metadata: Metadata = {
  title: 'Dashboard \u2014 Lumscribe',
}

export default async function DashboardPage() {
  const teacher = await requireTeacher()

  const [planDetails, usage] = await Promise.all([
    getTeacherPlanDetails(teacher.id),
    getTeacherUsage(teacher.id),
  ])

  const usageItems = [
    {
      label: 'Courses',
      current: usage.courses,
      max: planDetails?.limits.max_courses ?? null,
    },
    {
      label: 'Students',
      current: usage.students,
      max: planDetails?.limits.max_students ?? null,
    },
    {
      label: 'Active Cohorts',
      current: usage.cohortsActive,
      max: planDetails?.limits.max_cohorts_active ?? null,
    },
    {
      label: 'Storage',
      current: usage.storageMb,
      max: planDetails?.limits.max_storage_mb ?? null,
      unit: 'MB',
    },
  ]

  return (
    <>
      <PageHeader
        title={`Welcome back, ${teacher.name}`}
        description="Here is an overview of your teaching platform."
      />

      <div className="flex flex-col gap-6">
        <OnboardingChecklist />

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Plan Usage</h2>
          <UsageBars items={usageItems} />
          {planDetails && (
            <p className="mt-4 text-xs text-muted-foreground">
              Current plan: {planDetails.name} ({planDetails.slug})
            </p>
          )}
        </Card>
      </div>
    </>
  )
}
