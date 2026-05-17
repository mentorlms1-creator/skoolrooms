// =============================================================================
// lib/ai/provider.ts — LessonPlanProvider interface + factory.
// Single adapter (Anthropic-compatible) is built from getProviderConfig().
// =============================================================================

import type { ThemeSlug, DocType } from '@/lib/lesson-plan/themes/types'

export type PlanInput = {
  scope: 'session' | 'unit'
  subject: string
  gradeLevel: string
  durationMinutes?: number
  weekCount?: number
  topic: string
  learningGoals: string
  language: 'english' | 'urdu' | 'roman-urdu'
  /** null = "Auto" (AI picks); slug = teacher's explicit pick; undefined = legacy non-themed flow. */
  themeSlug?: ThemeSlug | null
}

export type PlanResult = {
  title: string
  bodyMarkdown: string
  model: string
  inputTokens?: number
  outputTokens?: number
  /** Theme the AI picked when teacher selected "Auto". Absent in legacy flow. */
  themeSlug?: ThemeSlug
  /** Document type the AI declared. Absent in legacy flow. */
  docType?: DocType
}

export type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type StreamHandle = {
  /** Yields text chunks as the model produces them. */
  textStream: AsyncIterable<string>
  /** Resolves to the model identifier this stream was run against. */
  model: string
  /** Resolves to usage stats once the stream has fully finished. May be null on providers that don't report. */
  usage: Promise<{ inputTokens?: number; outputTokens?: number } | null>
}

export interface LessonPlanProvider {
  /** Blocking call — returns the full plan in one go. Used by the legacy Server Action path. */
  generatePlan(input: PlanInput): Promise<PlanResult>
  /** Blocking revise — full plan returned in one go. */
  revisePlan(args: {
    currentMarkdown: string
    chatHistory: ChatTurn[]
    instruction: string
  }): Promise<PlanResult>
  /** Streaming generate — caller iterates `textStream` and resolves `usage` after end. */
  streamPlan(input: PlanInput, signal?: AbortSignal): StreamHandle
  /** Streaming revise. Themed callers pass themeSlug + docType so the
   *  prompt pre-locks them and the AI does not change them across revisions. */
  streamRevision(
    args: {
      currentMarkdown: string
      chatHistory: ChatTurn[]
      instruction: string
      themeSlug?: ThemeSlug
      docType?: DocType
    },
    signal?: AbortSignal,
  ): StreamHandle
  testConnection(): Promise<{ ok: true } | { ok: false; error: string }>
}

export type AdapterConfig = {
  baseURL: string
  apiKey: string
  model: string
}

/**
 * Returns a configured LessonPlanProvider, or null when the feature is
 * disabled / unconfigured. Reads config fresh on every call.
 */
export async function getLessonPlanProvider(): Promise<LessonPlanProvider | null> {
  const { getProviderConfig } = await import('./config')
  const config = await getProviderConfig()
  if (!config.enabled) return null
  const { makeAnthropicProvider } = await import('./anthropic')
  return makeAnthropicProvider({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    model: config.model,
  })
}
