// =============================================================================
// lib/ai/provider.ts — LessonPlanProvider interface + factory.
// Single adapter (Anthropic-compatible) is built from getProviderConfig().
// =============================================================================

export type PlanInput = {
  scope: 'session' | 'unit'
  subject: string
  gradeLevel: string
  durationMinutes?: number
  weekCount?: number
  topic: string
  learningGoals: string
  language: 'english' | 'urdu' | 'roman-urdu'
}

export type PlanResult = {
  title: string
  bodyMarkdown: string
  model: string
  inputTokens?: number
  outputTokens?: number
}

export type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface LessonPlanProvider {
  generatePlan(input: PlanInput): Promise<PlanResult>
  revisePlan(args: {
    currentMarkdown: string
    chatHistory: ChatTurn[]
    instruction: string
  }): Promise<PlanResult>
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
