// =============================================================================
// app/api/lesson-plans/[id]/revise/route.ts — Streaming revise endpoint.
// Same shape as /api/lesson-plans/generate: SSE stream of text chunks,
// final `done` event with the planId. Persists the rewritten plan via
// updateLessonPlan and appends to chat_history once the stream ends.
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import {
  getLessonPlanById,
  updateLessonPlan,
  type LessonPlanRow,
} from '@/lib/db/lessonPlans'
import { insertUsageEvent } from '@/lib/db/lessonPlanUsage'
import { getLessonPlanProvider } from '@/lib/ai/provider'
import { parseAIOutput } from '@/lib/ai/anthropic'
import { rateLimit } from '@/lib/rate-limit'
import type { ChatTurn } from '@/lib/ai/provider'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ReviseBodySchema = z.object({
  instruction: z.string().min(1).max(2000),
})

function jsonErr(code: string, status: number, message?: string) {
  return Response.json({ code, error: message ?? code }, { status })
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function readChatHistory(plan: LessonPlanRow): ChatTurn[] {
  const raw = plan.chat_history as unknown
  if (!Array.isArray(raw)) return []
  return raw as ChatTurn[]
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: planId } = await ctx.params

  // ─── Auth ─────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonErr('UNAUTHORIZED', 401)
  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) return jsonErr('UNAUTHORIZED', 401)

  // ─── Parse / validate ─────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonErr('VALIDATION_FAILED', 400, 'Invalid JSON')
  }
  const parsed = ReviseBodySchema.safeParse(body)
  if (!parsed.success) return jsonErr('VALIDATION_FAILED', 400)
  const { instruction } = parsed.data

  // ─── Rate limit ───────────────────────────────────────────────────
  const rl = rateLimit(`lprev:${teacher.id}`, 1, 5_000)
  if (!rl.allowed) return jsonErr('RATE_LIMITED', 429)

  // ─── Provider + ownership ─────────────────────────────────────────
  const provider = await getLessonPlanProvider()
  if (!provider) return jsonErr('FEATURE_DISABLED', 503)

  const plan = await getLessonPlanById(teacher.id, planId)
  if (!plan) return jsonErr('NOT_FOUND', 404)

  const history = readChatHistory(plan)

  // ─── Open stream ──────────────────────────────────────────────────
  const abortController = new AbortController()
  const onClientAbort = () => abortController.abort()
  req.signal.addEventListener('abort', onClientAbort, { once: true })

  // Pass theme through so the prompt pre-locks it and the AI cannot
  // accidentally change theme across revisions.
  const themeSlug = (plan.theme_slug ?? undefined) as
    | import('@/lib/lesson-plan/themes/types').ThemeSlug
    | undefined
  const handle = provider.streamRevision(
    {
      currentMarkdown: plan.body_markdown,
      chatHistory: history,
      instruction,
      themeSlug,
      // docType isn't stored on the row yet — default lesson-plan.
      docType: 'lesson-plan',
    },
    abortController.signal,
  )
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let accumulated = ''
      try {
        for await (const chunk of handle.textStream) {
          accumulated += chunk
          controller.enqueue(encoder.encode(sseEvent('text', { chunk })))
        }
      } catch (e) {
        const isAbort = abortController.signal.aborted || (e as Error)?.name === 'AbortError'
        if (isAbort) {
          console.warn('[lesson-plans/revise] client aborted mid-stream, no revision persisted')
        } else {
          console.error('[lesson-plans/revise] stream error:', e)
        }
        controller.enqueue(
          encoder.encode(
            sseEvent('error', {
              code: 'AI_PROVIDER_ERROR',
              message: (e as Error)?.message ?? 'Stream failed',
            }),
          ),
        )
        controller.close()
        return
      }

      const trimmed = accumulated.trim()
      if (!trimmed) {
        controller.enqueue(
          encoder.encode(sseEvent('error', { code: 'AI_PROVIDER_ERROR', message: 'Empty response' })),
        )
        controller.close()
        return
      }
      const { title, body: bodyMarkdown } = parseAIOutput(trimmed)
      if (!bodyMarkdown.trim()) {
        controller.enqueue(
          encoder.encode(sseEvent('error', { code: 'AI_PROVIDER_ERROR', message: 'Empty plan body' })),
        )
        controller.close()
        return
      }

      // Append the user turn + assistant ack to chat history.
      const now = new Date().toISOString()
      const newHistory: ChatTurn[] = [
        ...history,
        { role: 'user', content: instruction, created_at: now },
        { role: 'assistant', content: 'Plan updated.', created_at: now },
      ]

      try {
        await updateLessonPlan(teacher.id, planId, {
          title,
          body_markdown: bodyMarkdown,
          chat_history: newHistory as unknown as LessonPlanRow['chat_history'],
        })
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            sseEvent('error', {
              code: 'AI_PROVIDER_ERROR',
              message: (e as Error)?.message ?? 'Failed to save revision',
            }),
          ),
        )
        controller.close()
        return
      }

      // Best-effort usage log
      try {
        const usage = await handle.usage
        await insertUsageEvent({
          teacher_id: teacher.id,
          lesson_plan_id: planId,
          event: 'revise',
          model: handle.model,
          input_tokens: usage?.inputTokens ?? null,
          output_tokens: usage?.outputTokens ?? null,
        })
      } catch (e) {
        console.error('Failed to log revise usage:', e)
      }

      controller.enqueue(encoder.encode(sseEvent('done', { planId })))
      controller.close()
    },
    cancel() {
      req.signal.removeEventListener('abort', onClientAbort)
      abortController.abort()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
