'use server'

// =============================================================================
// lib/actions/lessonPlans.ts — Server actions for AI lesson plans.
// createLessonPlan uses a Postgres RPC (insert_lesson_plan_atomic) that holds
// a transaction-scoped advisory lock per teacher, so the quota check and
// insert can't race even across multiple Lambda instances.
// =============================================================================

export const maxDuration = 60

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import {
  getLessonPlanById,
  updateLessonPlan,
  deleteLessonPlan as dbDeleteLessonPlan,
  type LessonPlanRow,
} from '@/lib/db/lessonPlans'
import { insertUsageEvent } from '@/lib/db/lessonPlanUsage'
import { getLimit } from '@/lib/plans/limits'
import { getLessonPlanProvider } from '@/lib/ai/provider'
import { AIError } from '@/lib/ai/anthropic'
import { rateLimit } from '@/lib/rate-limit'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// Error codes surfaced to the UI
// -----------------------------------------------------------------------------

export type LessonPlanErrorCode =
  | 'FEATURE_DISABLED'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_PROVIDER_ERROR'
  | 'NOT_FOUND'
  | 'COURSE_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'

function err(code: LessonPlanErrorCode, error?: string): ApiResponse<never> {
  return { success: false, code, error: error ?? code }
}

// -----------------------------------------------------------------------------
// Auth helper — returns the teacher row or null
// -----------------------------------------------------------------------------
async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return await getTeacherByAuthId(user.id)
}

// -----------------------------------------------------------------------------
// Input validation
// -----------------------------------------------------------------------------

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

const ReviseSchema = z.object({
  planId: z.string().uuid(),
  instruction: z.string().min(1).max(2000),
})

const DeleteSchema = z.object({
  planId: z.string().uuid(),
  courseId: z.string().uuid(),
})

export type CreateLessonPlanInput = z.infer<typeof PlanInputSchema>

// -----------------------------------------------------------------------------
// createLessonPlan — Atomic generation: AI call → RPC inserts under lock
// -----------------------------------------------------------------------------

export async function createLessonPlan(
  rawInput: unknown,
): Promise<ApiResponse<{ planId: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return err('UNAUTHORIZED')

  const parsed = PlanInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('VALIDATION_FAILED', parsed.error.message)
  const input = parsed.data

  // UX-side rate limit (per-Lambda-instance). The DB lock is the real guarantee.
  const rl = rateLimit(`lpgen:${teacher.id}`, 1, 10_000)
  if (!rl.allowed) return err('RATE_LIMITED')

  const provider = await getLessonPlanProvider()
  if (!provider) return err('FEATURE_DISABLED')

  // Verify course ownership and soft-delete state up front.
  const admin = createAdminClient()
  const { data: course } = await admin
    .from('courses')
    .select('id, deleted_at')
    .eq('id', input.courseId)
    .eq('teacher_id', teacher.id)
    .maybeSingle()
  if (!course || course.deleted_at) return err('COURSE_NOT_FOUND')

  // AI call (60s timeout enforced inside the adapter).
  let result
  try {
    result = await provider.generatePlan({
      scope: input.scope,
      subject: input.subject,
      gradeLevel: input.gradeLevel,
      durationMinutes: input.durationMinutes,
      weekCount: input.weekCount,
      topic: input.topic,
      learningGoals: input.learningGoals,
      language: input.language,
    })
  } catch (e) {
    if (e instanceof AIError) return err(e.code)
    console.error('createLessonPlan AI call failed:', e)
    return err('AI_PROVIDER_ERROR')
  }

  // Plan limit — 9999 sentinel means effectively unlimited; pass null to RPC.
  const limit = await getLimit(teacher.id, 'lesson_plans_per_month')
  const limitParam = limit >= 9999 ? null : limit

  // Atomic insert with quota check, under per-teacher advisory lock.
  const { data: rpcRows, error: rpcErr } = await admin.rpc(
    'insert_lesson_plan_atomic',
    {
      p_teacher_id: teacher.id,
      p_course_id: input.courseId,
      p_scope: input.scope,
      p_title: result.title,
      p_body_markdown: result.bodyMarkdown,
      p_inputs: input as unknown as Record<string, unknown>,
      p_model: result.model,
      p_limit: limitParam,
    },
  )
  if (rpcErr) {
    console.error('insert_lesson_plan_atomic failed:', rpcErr)
    return err('AI_PROVIDER_ERROR', 'Failed to save plan')
  }
  const row = rpcRows?.[0]
  if (!row) return err('AI_PROVIDER_ERROR', 'Failed to save plan')
  if (row.status === 'quota_exceeded') return err('QUOTA_EXCEEDED')

  // Log a generate event for analytics (separate from the atomic insert so a
  // failure here doesn't lose the plan itself).
  try {
    await insertUsageEvent({
      teacher_id: teacher.id,
      lesson_plan_id: row.plan_id,
      event: 'generate',
      model: result.model,
      input_tokens: result.inputTokens ?? null,
      output_tokens: result.outputTokens ?? null,
    })
  } catch (e) {
    console.error('Failed to log usage event:', e)
  }

  revalidatePath(`/dashboard/courses/${input.courseId}/lesson-plans`)
  if (!row.plan_id) return err('AI_PROVIDER_ERROR', 'Failed to save plan')
  return { success: true, data: { planId: row.plan_id } }
}

// -----------------------------------------------------------------------------
// reviseLessonPlan — AI rewrite of an existing plan
// -----------------------------------------------------------------------------

type ChatTurn = { role: 'user' | 'assistant'; content: string; created_at: string }

function readChatHistory(plan: LessonPlanRow): ChatTurn[] {
  const raw = plan.chat_history as unknown
  if (!Array.isArray(raw)) return []
  return raw as ChatTurn[]
}

export async function reviseLessonPlan(
  rawInput: unknown,
): Promise<ApiResponse<{ planId: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return err('UNAUTHORIZED')

  const parsed = ReviseSchema.safeParse(rawInput)
  if (!parsed.success) return err('VALIDATION_FAILED', parsed.error.message)
  const { planId, instruction } = parsed.data

  const rl = rateLimit(`lprev:${teacher.id}`, 1, 5_000)
  if (!rl.allowed) return err('RATE_LIMITED')

  const provider = await getLessonPlanProvider()
  if (!provider) return err('FEATURE_DISABLED')

  const plan = await getLessonPlanById(teacher.id, planId)
  if (!plan) return err('NOT_FOUND')

  const history = readChatHistory(plan)

  let result
  try {
    result = await provider.revisePlan({
      currentMarkdown: plan.body_markdown,
      chatHistory: history,
      instruction,
    })
  } catch (e) {
    if (e instanceof AIError) return err(e.code)
    console.error('reviseLessonPlan AI call failed:', e)
    return err('AI_PROVIDER_ERROR')
  }

  const now = new Date().toISOString()
  const newHistory: ChatTurn[] = [
    ...history,
    { role: 'user', content: instruction, created_at: now },
    { role: 'assistant', content: 'Plan updated.', created_at: now },
  ]

  await updateLessonPlan(teacher.id, planId, {
    title: result.title,
    body_markdown: result.bodyMarkdown,
    chat_history: newHistory as unknown as LessonPlanRow['chat_history'],
  })

  try {
    await insertUsageEvent({
      teacher_id: teacher.id,
      lesson_plan_id: planId,
      event: 'revise',
      model: result.model,
      input_tokens: result.inputTokens ?? null,
      output_tokens: result.outputTokens ?? null,
    })
  } catch (e) {
    console.error('Failed to log usage event:', e)
  }

  revalidatePath(`/dashboard/courses/${plan.course_id}/lesson-plans/${planId}`)
  revalidatePath(`/dashboard/courses/${plan.course_id}/lesson-plans`)
  return { success: true, data: { planId } }
}

// -----------------------------------------------------------------------------
// deleteLessonPlanAction — Hard delete a plan
// -----------------------------------------------------------------------------

export async function deleteLessonPlanAction(
  rawInput: unknown,
): Promise<ApiResponse<{ planId: string }>> {
  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return err('UNAUTHORIZED')

  const parsed = DeleteSchema.safeParse(rawInput)
  if (!parsed.success) return err('VALIDATION_FAILED', parsed.error.message)

  try {
    await dbDeleteLessonPlan(teacher.id, parsed.data.planId)
  } catch (e) {
    console.error('deleteLessonPlan failed:', e)
    return err('NOT_FOUND')
  }

  revalidatePath(`/dashboard/courses/${parsed.data.courseId}/lesson-plans`)
  return { success: true, data: { planId: parsed.data.planId } }
}
