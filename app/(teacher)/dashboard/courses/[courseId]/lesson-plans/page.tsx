/**
 * app/(teacher)/dashboard/courses/[courseId]/lesson-plans/page.tsx
 * Server Component — Lists AI lesson plans for a course.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCourseById } from '@/lib/db/courses'
import { getLessonPlansForCourse } from '@/lib/db/lessonPlans'
import { countGenerationsThisMonth } from '@/lib/db/lessonPlanUsage'
import { getLimit } from '@/lib/plans/limits'
import { getProviderConfig } from '@/lib/ai/config'
import { PageHeader } from '@/components/ui/PageHeader'
import { ROUTES } from '@/constants/routes'
import { LessonPlanList } from '@/components/teacher/LessonPlanList'
import { NewLessonPlanDialog } from '@/components/teacher/NewLessonPlanDialog'

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

  const isUnlimited = limit >= 9999
  const quotaText = isUnlimited
    ? 'Unlimited'
    : `${used} of ${limit} used this month`
  const canCreate = providerCfg.enabled && (isUnlimited || used < limit)
  const disabledReason = !providerCfg.enabled
    ? 'AI lesson planning is currently unavailable.'
    : 'Monthly limit reached. Upgrade for more.'

  return (
    <>
      <PageHeader
        title="Lesson Plans"
        description={`${course.title} · ${quotaText}`}
        backHref={ROUTES.TEACHER.courseDetail(courseId)}
        action={
          <NewLessonPlanDialog
            courseId={courseId}
            disabled={!canCreate}
            disabledReason={disabledReason}
          />
        }
      />
      <LessonPlanList
        courseId={courseId}
        plans={plans.map((p) => ({
          id: p.id,
          title: p.title,
          scope: p.scope as 'session' | 'unit',
          updated_at: p.updated_at,
        }))}
      />
    </>
  )
}
