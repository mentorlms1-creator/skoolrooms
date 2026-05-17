// =============================================================================
// lib/pdf/render-themed.ts — Render a lesson plan to PDF via themed HTML.
// Uses renderToString to produce a standalone HTML document, then puppeteer
// page.setContent → page.pdf.
// =============================================================================

import { renderToString } from 'react-dom/server'
import { getBrowser } from './browser'
import { LessonPlanThemed } from '@/lib/lesson-plan/LessonPlanThemed'
import { getTheme } from '@/lib/lesson-plan/themes'
import type { Database } from '@/types/database'
import { formatPKT } from '@/lib/time/pkt'

type LessonPlanRow = Database['public']['Tables']['lesson_plans']['Row']

export async function renderThemedPdf(args: {
  plan: LessonPlanRow
  courseName: string
  teacherName: string
}): Promise<Buffer> {
  const { plan, courseName, teacherName } = args
  const theme = getTheme(plan.theme_slug)

  // renderToString returns the rendered React tree. The component renders a
  // full <html>/<head>/<body> when context='pdf'. Prepend the doctype.
  const html =
    '<!DOCTYPE html>' +
    renderToString(
      LessonPlanThemed({
        theme,
        context: 'pdf',
        title: plan.title,
        bodyMarkdown: plan.body_markdown,
        courseName,
        teacherName,
        updatedAtPkt: formatPKT(plan.updated_at, 'datetime'),
        docType: 'lesson-plan',
      }),
    )

  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    // setContent only accepts 'load' / 'domcontentloaded' in puppeteer-core v25.
    // Then wait for webfonts to resolve before printing so the PDF uses the
    // actual themed faces instead of the system fallback.
    await page.setContent(html, { waitUntil: 'load', timeout: 25_000 })
    await page.evaluate(() => document.fonts.ready)
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await page.close().catch(() => {})
  }
}
