/**
 * app/(teacher)/dashboard/courses/[courseId]/lesson-plans/[planId]/page.tsx
 * Server Component — Lesson plan workspace.
 *
 * Three-pane shell:
 *   • Recent plans list   (LessonPlanInboxShell sidebar)
 *   • Plan detail header + themed body
 *   • AI revise panel     (LessonPlanChat)
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import { notFound } from 'next/navigation'
import { ChevronLeft, Download } from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import { getLessonPlanById, getLessonPlansForCourse } from '@/lib/db/lessonPlans'
import { getCourseById } from '@/lib/db/courses'
import { countGenerationsThisMonth } from '@/lib/db/lessonPlanUsage'
import { getLimit } from '@/lib/plans/limits'
import { getProviderConfig } from '@/lib/ai/config'
import { formatPKT } from '@/lib/time/pkt'
import { ROUTES } from '@/constants/routes'
import { LessonPlanInboxShell } from '@/components/teacher/LessonPlanInboxShell'
import {
  LessonPlanChat,
  type ChatTurn,
} from '@/components/teacher/LessonPlanChat'
import { LessonPlanChatSheet } from '@/components/teacher/LessonPlanChatSheet'
import { LessonPlanThemed } from '@/lib/lesson-plan/LessonPlanThemed'
import { getTheme } from '@/lib/lesson-plan/themes'
import { mapPlansToSidebarItems } from '@/lib/lesson-plan/sidebar-helpers'

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

  const [allPlans, course, used, limit, providerCfg] = await Promise.all([
    getLessonPlansForCourse(teacher.id, courseId),
    getCourseById(courseId),
    countGenerationsThisMonth(teacher.id),
    getLimit(teacher.id, 'lesson_plans_per_month'),
    getProviderConfig(),
  ])

  const history = Array.isArray(plan.chat_history)
    ? (plan.chat_history as unknown as ChatTurn[])
    : []

  const theme = getTheme(plan.theme_slug)
  const courseName = course?.title ?? 'Course'

  const isUnlimited = limit >= 9999
  const quotaText = isUnlimited ? 'Unlimited' : `${used}/${limit} this month`
  const canCreate = providerCfg.enabled && (isUnlimited || used < limit)
  const disabledReason = !providerCfg.enabled
    ? 'AI lesson planning is currently unavailable.'
    : 'Monthly limit reached. Upgrade for more.'

  return (
    <LessonPlanInboxShell
      courseId={courseId}
      plans={mapPlansToSidebarItems(allPlans)}
      totalCount={allPlans.length}
      quotaText={quotaText}
      canCreate={canCreate}
      disabledReason={disabledReason}
    >
      {/* ── Middle pane: detail ──────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0 h-full">
        <article className="flex flex-1 flex-col min-w-0">
          {/* Top bar */}
          <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-foreground/[0.05]">
            <Link
              href={ROUTES.TEACHER.courseDetail(courseId)}
              aria-label="Back to course"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-foreground/[0.04] text-foreground/70 hover:bg-foreground/[0.08] transition-colors"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </Link>
            <div className="flex items-center gap-2">
              <a
                href={`/api/lesson-plans/${plan.id}/pdf`}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Export PDF
              </a>
            </div>
          </header>

          {/* Title block */}
          <div className="px-6 sm:px-10 pt-8">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {courseName}
            </p>
            <h1 className="mt-2 text-[26px] sm:text-[32px] font-bold tracking-tight text-foreground leading-[1.15]">
              {plan.title}
            </h1>
            <p className="mt-2 text-[14px] text-muted-foreground">
              <span className="capitalize">{plan.scope === 'unit' ? 'Full unit' : 'Single session'}</span>
              <span className="mx-2 opacity-50">·</span>
              Last updated {formatPKT(plan.updated_at, 'datetime')}
            </p>
          </div>

          {/* Themed body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-6 sm:px-10 pb-10">
              <div className="mt-6 rounded-2xl overflow-hidden ring-1 ring-foreground/[0.04]">
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
            </div>
          </div>
        </article>

        {/* ── Right pane: AI assistant (desktop only) ─────────────── */}
        <aside className="hidden lg:flex w-[340px] xl:w-[360px] shrink-0 border-l border-foreground/[0.05]">
          <LessonPlanChat planId={plan.id} chatHistory={history} />
        </aside>
      </div>

      {/* Mobile/tablet floating AI button */}
      <LessonPlanChatSheet planId={plan.id} chatHistory={history} />
    </LessonPlanInboxShell>
  )
}
