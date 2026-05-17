// =============================================================================
// lib/ai/anthropic.ts — Anthropic-compatible adapter via Vercel AI SDK v6.
// baseURL is overridable so the same adapter works for any provider that
// speaks the Anthropic Messages API (Anthropic, OpenRouter via Anthropic
// protocol, self-hosted proxies, etc.).
// =============================================================================

import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, streamText } from 'ai'
import {
  buildSystemPrompt, buildGeneratePrompt, buildRevisePrompt,
  buildSystemPromptThemed, buildRevisePromptThemed,
} from './prompts'
import type {
  LessonPlanProvider,
  PlanInput,
  PlanResult,
  AdapterConfig,
  StreamHandle,
  ChatTurn,
} from './provider'
import {
  THEME_SLUGS, DOC_TYPES,
  type ThemeSlug, type DocType,
} from '@/lib/lesson-plan/themes/types'

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

export function parseAIOutput(raw: string): {
  title: string
  body: string
  themeSlug?: ThemeSlug
  docType?: DocType
} {
  const idx = raw.indexOf('---')
  const head = idx >= 0 ? raw.slice(0, idx) : ''
  let body = idx >= 0 ? raw.slice(idx + 3).trim() : raw

  let title = ''
  let themeSlug: ThemeSlug | undefined
  let docType: DocType | undefined
  for (const line of head.split('\n')) {
    const t = line.trim()
    if (!t) continue
    const themeMatch = t.match(/^THEME:\s*([\w-]+)/i)
    if (themeMatch) {
      const cand = themeMatch[1].toLowerCase()
      if ((THEME_SLUGS as readonly string[]).includes(cand)) {
        themeSlug = cand as ThemeSlug
      }
      continue
    }
    const docMatch = t.match(/^DOC_TYPE:\s*([\w-]+)/i)
    if (docMatch) {
      const cand = docMatch[1].toLowerCase()
      if ((DOC_TYPES as readonly string[]).includes(cand)) {
        docType = cand as DocType
      }
      continue
    }
    const titleMatch = t.match(/^TITLE:\s*(.+)/i)
    if (titleMatch) title = titleMatch[1].trim()
  }

  if (!title) {
    const h1 = body.match(/^#\s+(.+)/m)
    title = h1 ? h1[1].trim() : 'Untitled plan'
  }
  title = title.slice(0, 200)

  if (body.length > MAX_BODY_BYTES) {
    body = body.slice(0, MAX_BODY_BYTES - 16) + '\n\n…(truncated)'
  }

  return { title, body, themeSlug, docType }
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
    const { title, body, themeSlug, docType } = parseAIOutput(text)
    if (!body.trim()) throw new AIError('Empty plan body after parsing')
    const usage = safeUsage(result.usage)
    return {
      title,
      bodyMarkdown: body,
      themeSlug,
      docType,
      model: config.model,
      ...usage,
    }
  }

  const REVISE_SYSTEM = [
    "You are revising an existing lesson plan. Keep the teacher's intent and the existing structure unless the instruction says otherwise.",
    '',
    'You MUST respond in exactly this format and nothing else:',
    '',
    'TITLE: <a short descriptive title, max 200 characters>',
    '---',
    '<the full updated lesson plan body in markdown>',
    '',
    'Do not include any preamble, commentary, or trailing notes outside this format.',
  ].join('\n')

  function openStream(args: {
    system: string
    prompt: string
    signal?: AbortSignal
  }): StreamHandle {
    const result = streamText({
      model,
      system: args.system,
      prompt: args.prompt,
      maxOutputTokens: 4096,
      abortSignal: args.signal,
    })
    return {
      textStream: result.textStream,
      model: config.model,
      // `result.usage` is PromiseLike — wrap in Promise.resolve so we can
      // attach a tolerant catch (some providers don't return usage).
      usage: Promise.resolve(result.usage)
        .then((u) => safeUsage(u) as { inputTokens?: number; outputTokens?: number })
        .catch(() => null),
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
        system: REVISE_SYSTEM,
        prompt: buildRevisePrompt(args),
      }),

    streamPlan: (input: PlanInput, signal?: AbortSignal) => {
      // When the caller provides themeSlug (null=Auto, slug=fixed), use the
      // themed prompt. Otherwise fall back to the legacy non-themed prompt.
      const useThemed = input.themeSlug !== undefined
      return openStream({
        system: useThemed
          ? buildSystemPromptThemed(input, input.themeSlug ?? null)
          : buildSystemPrompt(input),
        prompt: buildGeneratePrompt(input),
        signal,
      })
    },

    streamRevision: (
      args: {
        currentMarkdown: string
        chatHistory: ChatTurn[]
        instruction: string
        themeSlug?: ThemeSlug
        docType?: DocType
      },
      signal?: AbortSignal,
    ) => {
      if (args.themeSlug) {
        const { system, prompt } = buildRevisePromptThemed({
          themeSlug: args.themeSlug,
          docType: args.docType ?? 'lesson-plan',
          currentMarkdown: args.currentMarkdown,
          chatHistory: args.chatHistory,
          instruction: args.instruction,
        })
        return openStream({ system, prompt, signal })
      }
      return openStream({
        system: REVISE_SYSTEM,
        prompt: buildRevisePrompt(args),
        signal,
      })
    },

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
