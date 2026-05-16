// =============================================================================
// app/api/lesson-plans/[id]/pdf/route.ts — Stream a generated PDF.
// Documented exception to the "API routes for webhooks/crons/external only"
// rule (CLAUDE.md): this route serves a generated file, not CRUD. All
// mutations remain in Server Actions.
// =============================================================================

import { NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getLessonPlanById } from '@/lib/db/lessonPlans'
import { formatPKT } from '@/lib/time/pkt'
import { LessonPlanPdfDocument } from '@/components/teacher/LessonPlanPdfDocument'

export const maxDuration = 30
export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  console.log('[pdf] GET request, planId=', id)

  // Auth — must be the owning teacher
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.log('[pdf] no auth user → 401')
    return new Response('Unauthorized', { status: 401 })
  }
  console.log('[pdf] auth user id=', user.id, 'email=', user.email)

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) {
    console.log('[pdf] no teacher row for auth user → 401')
    return new Response('Unauthorized', { status: 401 })
  }
  console.log('[pdf] teacher id=', teacher.id, 'name=', teacher.name)

  const plan = await getLessonPlanById(teacher.id, id)
  if (!plan) {
    console.log('[pdf] plan lookup returned null for teacher=', teacher.id, 'plan=', id, '→ 404')
    return new Response('Not found', { status: 404 })
  }
  console.log('[pdf] plan found, rendering PDF')

  // Fetch course title for the header
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('title')
    .eq('id', plan.course_id)
    .maybeSingle()

  const pdf = await renderToBuffer(
    <LessonPlanPdfDocument
      courseName={course?.title ?? 'Course'}
      teacherName={teacher.name || teacher.email}
      title={plan.title}
      bodyMarkdown={plan.body_markdown}
      // Show when the AI last produced/revised this plan, NOT when this PDF
      // was rendered. updated_at == created_at on never-revised plans, so
      // this works for both first-version and revised exports.
      updatedAtPkt={formatPKT(plan.updated_at, 'datetime')}
    />,
  )

  const safeTitle =
    plan.title.replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60).trim() ||
    'lesson-plan'

  return new Response(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
