// =============================================================================
// lib/pdf/render-fallback.ts — Fallback PDF renderer using the existing
// react-pdf path. Invoked when the themed puppeteer path throws.
// =============================================================================

import { renderToBuffer } from '@react-pdf/renderer'
import { LessonPlanPdfDocument } from '@/components/teacher/LessonPlanPdfDocument'
import type { Database } from '@/types/database'
import { formatPKT } from '@/lib/time/pkt'

type LessonPlanRow = Database['public']['Tables']['lesson_plans']['Row']

export async function renderReactPdf(args: {
  plan: LessonPlanRow
  courseName: string
  teacherName: string
}): Promise<Buffer> {
  const { plan, courseName, teacherName } = args
  const pdf = await renderToBuffer(
    LessonPlanPdfDocument({
      courseName,
      teacherName,
      title: plan.title,
      bodyMarkdown: plan.body_markdown,
      updatedAtPkt: formatPKT(plan.updated_at, 'datetime'),
    }) as unknown as Parameters<typeof renderToBuffer>[0],
  )
  return Buffer.from(pdf)
}
