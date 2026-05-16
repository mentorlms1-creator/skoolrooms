// =============================================================================
// app/api/lesson-plans/generate/route.ts — Token-streaming generate endpoint.
//
// Documented exception #2 to CLAUDE.md rule 12 (API routes are for webhooks /
// crons / external integrations only). This route exists because Server
// Actions return one value — they cannot stream tokens back to the browser
// as the model produces them. The persistence step still goes through the
// same `insert_lesson_plan_atomic` RPC the Server Action uses, so quota /
// race guarantees are unchanged.
//
// Response shape: text/event-stream with three event types:
//   event: text   data: {"chunk":"..."}      — repeated as tokens arrive
//   event: done   data: {"planId":"..."}     — exactly once on success
//   event: error  data: {"code":"...","message":"..."}
//
// Pre-stream failures (auth, validation, feature flag, course not found,
// optimistic quota exhausted) return regular JSON 4xx with no stream.
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { countGenerationsThisMonth, insertUsageEvent } from '@/lib/db/lessonPlanUsage'
import { getLimit } from '@/lib/plans/limits'
import { getLessonPlanProvider } from '@/lib/ai/provider'
import { parseAIOutput } from '@/lib/ai/anthropic'
import { rateLimit } from '@/lib/rate-limit'

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PlanInputSchema = z.object({
  courseId: z.string().uuid(),
  scope: z.enum(['session', 'unit']),
  subject: z.string().min(1).max(100),
  gradeLevel: z.string().min(1).max(50),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  weekCount: z.number().int().min(1).max(24).optional(),
  topic: z.string().min(1).max(200),
  learningGoals: z.string().min(1).max(2000),
  language: z.enum(['english', 'urdu', 'roman-urdu']),
})

function jsonErr(code: string, status: number, message?: string) {
  return Response.json({ code, error: message ?? code }, { status })
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
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
  const parsed = PlanInputSchema.safeParse(body)
  if (!parsed.success) return jsonErr('VALIDATION_FAILED', 400, parsed.error.message)
  const input = parsed.data

  // ─── Rate limit ───────────────────────────────────────────────────
  const rl = rateLimit(`lpgen:${teacher.id}`, 1, 10_000)
  if (!rl.allowed) return jsonErr('RATE_LIMITED', 429)

  // ─── Feature flag + provider config ───────────────────────────────
  const provider = await getLessonPlanProvider()
  if (!provider) return jsonErr('FEATURE_DISABLED', 503)

  // ─── Course ownership ─────────────────────────────────────────────
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('id, deleted_at')
    .eq('id', input.courseId)
    .eq('teacher_id', teacher.id)
    .maybeSingle()
  if (!course || course.deleted_at) return jsonErr('COURSE_NOT_FOUND', 404)

  // ─── Optimistic quota check (atomic check still runs after stream) ──
  const limit = await getLimit(teacher.id, 'lesson_plans_per_month')
  const limitParam = limit >= 9999 ? null : limit
  if (limitParam !== null) {
    const used = await countGenerationsThisMonth(teacher.id)
    if (used >= limitParam) return jsonErr('QUOTA_EXCEEDED', 402)
  }

  // ─── Open AI stream + build SSE response ──────────────────────────
  const abortController = new AbortController()
  req.signal.addEventListener('abort', () => abortController.abort())

  const handle = provider.streamPlan(input, abortController.signal)
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

      // Stream ended cleanly. Parse + persist.
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

      // Atomic insert under per-teacher advisory lock.
      const { data: rpcRows, error: rpcErr } = await admin.rpc(
        'insert_lesson_plan_atomic',
        {
          p_teacher_id: teacher.id,
          p_course_id: input.courseId,
          p_scope: input.scope,
          p_title: title,
          p_body_markdown: bodyMarkdown,
          p_inputs: input as unknown as Record<string, unknown>,
          p_model: handle.model,
          p_limit: limitParam,
        },
      )
      if (rpcErr) {
        controller.enqueue(
          encoder.encode(sseEvent('error', { code: 'AI_PROVIDER_ERROR', message: rpcErr.message })),
        )
        controller.close()
        return
      }
      const row = rpcRows?.[0]
      if (!row) {
        controller.enqueue(
          encoder.encode(sseEvent('error', { code: 'AI_PROVIDER_ERROR', message: 'Persist failed' })),
        )
        controller.close()
        return
      }
      if (row.status === 'quota_exceeded' || !row.plan_id) {
        controller.enqueue(encoder.encode(sseEvent('error', { code: 'QUOTA_EXCEEDED' })))
        controller.close()
        return
      }

      // Log usage (best-effort).
      try {
        const usage = await handle.usage
        await insertUsageEvent({
          teacher_id: teacher.id,
          lesson_plan_id: row.plan_id,
          event: 'generate',
          model: handle.model,
          input_tokens: usage?.inputTokens ?? null,
          output_tokens: usage?.outputTokens ?? null,
        })
      } catch (e) {
        console.error('Failed to log generate usage:', e)
      }

      controller.enqueue(encoder.encode(sseEvent('done', { planId: row.plan_id })))
      controller.close()
    },
    cancel() {
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
