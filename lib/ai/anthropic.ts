// =============================================================================
// lib/ai/anthropic.ts — Anthropic-compatible adapter via Vercel AI SDK v6.
// baseURL is overridable so the same adapter works for any provider that
// speaks the Anthropic Messages API (Anthropic, OpenRouter via Anthropic
// protocol, self-hosted proxies, etc.).
// =============================================================================

import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { buildSystemPrompt, buildGeneratePrompt, buildRevisePrompt } from './prompts'
import type {
  LessonPlanProvider,
  PlanInput,
  PlanResult,
  AdapterConfig,
} from './provider'

const MAX_BODY_BYTES = 65_536
const GENERATE_TIMEOUT_MS = 60_000
const TEST_TIMEOUT_MS = 15_000

export class AIError extends Error {
  code: 'AI_PROVIDER_ERROR' | 'AI_TIMEOUT'
  constructor(
    message: string,
    code: 'AI_PROVIDER_ERROR' | 'AI_TIMEOUT' = 'AI_PROVIDER_ERROR',
  ) {
    super(message)
    this.code = code
  }
}

function parseAIOutput(raw: string): { title: string; body: string } {
  const idx = raw.indexOf('---')
  let title = ''
  let body = raw
  if (idx >= 0) {
    const head = raw.slice(0, idx)
    body = raw.slice(idx + 3).trim()
    const m = head.match(/TITLE:\s*(.+)/i)
    if (m) title = m[1].trim()
  }
  if (!title) {
    const h1 = body.match(/^#\s+(.+)/m)
    title = h1 ? h1[1].trim() : 'Untitled plan'
  }
  title = title.slice(0, 200)
  if (body.length > MAX_BODY_BYTES) {
    body = body.slice(0, MAX_BODY_BYTES - 16) + '\n\n…(truncated)'
  }
  return { title, body }
}

function safeUsage(
  u: unknown,
): { inputTokens?: number; outputTokens?: number } {
  try {
    const o = u as { inputTokens?: number; outputTokens?: number } | undefined
    return {
      inputTokens: typeof o?.inputTokens === 'number' ? o.inputTokens : undefined,
      outputTokens:
        typeof o?.outputTokens === 'number' ? o.outputTokens : undefined,
    }
  } catch {
    return {}
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new AIError('Timed out', 'AI_TIMEOUT')), ms)
  })
  try {
    return await Promise.race([p, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function makeAnthropicProvider(config: AdapterConfig): LessonPlanProvider {
  const anthropic = createAnthropic({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  })
  const model = anthropic(config.model)

  async function callAI(args: {
    system: string
    prompt: string
  }): Promise<PlanResult> {
    let result
    try {
      result = await withTimeout(
        generateText({
          model,
          system: args.system,
          prompt: args.prompt,
          maxOutputTokens: 4096,
        }),
        GENERATE_TIMEOUT_MS,
      )
    } catch (e) {
      if (e instanceof AIError) throw e
      throw new AIError(
        (e as Error)?.message || 'Provider error',
        'AI_PROVIDER_ERROR',
      )
    }
    const text = (result?.text ?? '').trim()
    if (!text) throw new AIError('Empty response from provider')
    const { title, body } = parseAIOutput(text)
    if (!body.trim()) throw new AIError('Empty plan body after parsing')
    const usage = safeUsage(result.usage)
    return {
      title,
      bodyMarkdown: body,
      model: config.model,
      ...usage,
    }
  }

  return {
    generatePlan: (input: PlanInput) =>
      callAI({
        system: buildSystemPrompt(input),
        prompt: buildGeneratePrompt(input),
      }),

    revisePlan: (args) =>
      callAI({
        system: [
          "You are revising an existing lesson plan. Keep the teacher's intent and the existing structure unless the instruction says otherwise.",
          '',
          'You MUST respond in exactly this format and nothing else:',
          '',
          'TITLE: <a short descriptive title, max 200 characters>',
          '---',
          '<the full updated lesson plan body in markdown>',
          '',
          'Do not include any preamble, commentary, or trailing notes outside this format.',
        ].join('\n'),
        prompt: buildRevisePrompt(args),
      }),

    async testConnection() {
      try {
        const r = await withTimeout(
          generateText({
            model,
            prompt: 'Reply with the single word OK.',
            maxOutputTokens: 10,
          }),
          TEST_TIMEOUT_MS,
        )
        return r?.text?.trim()
          ? { ok: true as const }
          : { ok: false as const, error: 'Empty response' }
      } catch (e) {
        return {
          ok: false as const,
          error: (e as Error)?.message || 'Unknown error',
        }
      }
    },
  }
}
