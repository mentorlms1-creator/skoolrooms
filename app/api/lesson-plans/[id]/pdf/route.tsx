// =============================================================================
// app/api/lesson-plans/[id]/pdf/route.tsx — Stream a generated PDF.
//
// Documented exception to the "API routes for webhooks/crons/external only"
// rule (CLAUDE.md): this route serves a generated file, not CRUD. All
// mutations remain in Server Actions.
//
// Renders via puppeteer + themed HTML when possible. Falls back to react-pdf
// (the original implementation) if puppeteer fails so the teacher never gets
// a 500 — just a plain-but-functional PDF in worst case.
// =============================================================================

import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getLessonPlanById } from '@/lib/db/lessonPlans'
import { renderThemedPdf } from '@/lib/pdf/render-themed'
import { renderReactPdf } from '@/lib/pdf/render-fallback'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params

  // Auth — must be the owning teacher.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) return new Response('Unauthorized', { status: 401 })

  const plan = await getLessonPlanById(teacher.id, id)
  if (!plan) return new Response('Not found', { status: 404 })

  // Fetch course title for the cover header.
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('title')
    .eq('id', plan.course_id)
    .maybeSingle()

  const courseName = course?.title ?? 'Course'
  const teacherName = teacher.name || teacher.email

  // Try the themed (puppeteer) path. On any failure, fall back to react-pdf
  // so the teacher gets *something*. Log the failure so wasted renders are
  // visible to operators.
  let pdf: Buffer
  try {
    pdf = await renderThemedPdf({ plan, courseName, teacherName })
  } catch (err) {
    console.error('[pdf] themed render failed, falling back to react-pdf:', err)
    try {
      pdf = await renderReactPdf({ plan, courseName, teacherName })
    } catch (fallbackErr) {
      console.error('[pdf] fallback render ALSO failed:', fallbackErr)
      return new Response('PDF generation failed', { status: 500 })
    }
  }

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
