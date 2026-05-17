/**
 * app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx
 * Server Component — Renders a lesson plan markdown view with a desktop
 * chat side-panel and a mobile chat drawer.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getLessonPlanById } from '@/lib/db/lessonPlans'
import { getCourseById } from '@/lib/db/courses'
import { formatPKT } from '@/lib/time/pkt'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import {
  LessonPlanChat,
  type ChatTurn,
} from '@/components/teacher/LessonPlanChat'
import { LessonPlanChatSheet } from '@/components/teacher/LessonPlanChatSheet'
import { LessonPlanThemed } from '@/lib/lesson-plan/LessonPlanThemed'
import { getTheme } from '@/lib/lesson-plan/themes'

export const metadata: Metadata = {
  title: 'Lesson Plan — Skool Rooms',
}

type PageProps = {
  params: Promise<{ courseId: string; planId: string }>
}

export default async function LessonPlanDetailPage({ params }: PageProps) {
  const { courseId, planId } = await params
  const teacher = await requireTeacher()

  const plan = await getLessonPlanById(teacher.id, planId)
  if (!plan || plan.course_id !== courseId) notFound()

  const history = Array.isArray(plan.chat_history)
    ? (plan.chat_history as unknown as ChatTurn[])
    : []

  const theme = getTheme(plan.theme_slug)
  const course = await getCourseById(courseId)
  const courseName = course?.title ?? 'Course'

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <Link
            href={ROUTES.TEACHER.courseLessonPlans(courseId)}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to lesson plans
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-foreground">
            {plan.title}
          </h1>
        </div>
        <Button asChild>
          <a href={`/api/lesson-plans/${plan.id}/pdf`}>Download PDF</a>
        </Button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[1fr_360px]">
        <div className="overflow-y-auto rounded-lg border border-border">
          <LessonPlanThemed
            theme={theme}
            context="web"
            title={plan.title}
            bodyMarkdown={plan.body_markdown}
            courseName={courseName}
            teacherName={teacher.name || teacher.email}
            updatedAtPkt={formatPKT(plan.updated_at, 'datetime')}
          />
        </div>
        <aside className="hidden md:block">
          <LessonPlanChat planId={plan.id} chatHistory={history} />
        </aside>
      </div>

      <LessonPlanChatSheet planId={plan.id} chatHistory={history} />
    </div>
  )
}
