/**
 * app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx
 * Server Component — Renders a lesson plan markdown view with a desktop
 * chat side-panel and a mobile chat drawer.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { requireTeacher } from '@/lib/auth/guards'
import { getLessonPlanById } from '@/lib/db/lessonPlans'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import {
  LessonPlanChat,
  type ChatTurn,
} from '@/components/teacher/LessonPlanChat'
import { LessonPlanChatSheet } from '@/components/teacher/LessonPlanChatSheet'

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
        <article
          className="
            overflow-y-auto rounded-lg border border-border bg-card p-6
            text-sm leading-relaxed text-foreground
            [&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold
            [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold
            [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold
            [&_p]:mb-2
            [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-6
            [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6
            [&_li]:mb-1
            [&_strong]:font-semibold
            [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5
            [&_code]:text-xs
          "
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {plan.body_markdown}
          </ReactMarkdown>
        </article>
        <aside className="hidden md:block">
          <LessonPlanChat planId={plan.id} chatHistory={history} />
        </aside>
      </div>

      <LessonPlanChatSheet planId={plan.id} chatHistory={history} />
    </div>
  )
}
