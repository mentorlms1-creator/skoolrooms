/**
 * app/(teacher)/dashboard/courses/[courseId]/lesson-plans/page.tsx
 * Server Component — Lesson plans workspace landing.
 *
 * Auto-redirects into the most recent plan when one exists; otherwise renders
 * the three-pane shell with an empty hint nudging the teacher to generate
 * their first plan.
 */

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCourseById } from '@/lib/db/courses'
import { getLessonPlansForCourse } from '@/lib/db/lessonPlans'
import { countGenerationsThisMonth } from '@/lib/db/lessonPlanUsage'
import { getLimit } from '@/lib/plans/limits'
import { getProviderConfig } from '@/lib/ai/config'
import { ROUTES } from '@/constants/routes'
import { LessonPlanInboxShell } from '@/components/teacher/LessonPlanInboxShell'
import { mapPlansToSidebarItems } from '@/lib/lesson-plan/sidebar-helpers'

export const metadata: Metadata = {
  title: 'Lesson Plans — Skool Rooms',
}

type PageProps = {
  params: Promise<{ courseId: string }>
}

export default async function LessonPlansListPage({ params }: PageProps) {
  const { courseId } = await params
  const teacher = await requireTeacher()

  const course = await getCourseById(courseId)
  if (!course || course.teacher_id !== teacher.id || course.deleted_at) {
    notFound()
  }

  const [plans, used, limit, providerCfg] = await Promise.all([
    getLessonPlansForCourse(teacher.id, courseId),
    countGenerationsThisMonth(teacher.id),
    getLimit(teacher.id, 'lesson_plans_per_month'),
    getProviderConfig(),
  ])

  if (plans.length > 0) {
    redirect(ROUTES.TEACHER.lessonPlanDetail(courseId, plans[0].id))
  }

  const isUnlimited = limit >= 9999
  const quotaText = isUnlimited
    ? 'Unlimited'
    : `${used}/${limit} this month`
  const canCreate = providerCfg.enabled && (isUnlimited || used < limit)
  const disabledReason = !providerCfg.enabled
    ? 'AI lesson planning is currently unavailable.'
    : 'Monthly limit reached. Upgrade for more.'

  return (
    <LessonPlanInboxShell
      courseId={courseId}
      plans={mapPlansToSidebarItems(plans)}
      totalCount={plans.length}
      quotaText={quotaText}
      canCreate={canCreate}
      disabledReason={disabledReason}
    />
  )
}
