'use client'

/**
 * hooks/useStreamLessonPlan.ts
 * Client hook for consuming a Server-Sent Events stream from one of the
 * lesson-plan streaming routes (/api/lesson-plans/generate or
 * /api/lesson-plans/[id]/revise). Both routes use the same event shape:
 *
 *   event: text   data: {"chunk":"..."}        — repeated
 *   event: done   data: {"planId":"..."}       — once on success
 *   event: error  data: {"code":"...","message":"..."}
 *
 * Pre-stream failures come back as plain JSON 4xx with {code, error},
 * which this hook surfaces via onError exactly like in-stream errors.
 */

import { useCallback, useRef, useState } from 'react'

export type StreamErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION_FAILED'
  | 'FEATURE_DISABLED'
  | 'COURSE_NOT_FOUND'
  | 'NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_PROVIDER_ERROR'

export type StreamCallbacks = {
  onText?: (chunkAndAccumulated: { chunk: string; accumulated: string }) => void
  onDone?: (result: { planId: string; markdown: string }) => void
  onError?: (err: { code: StreamErrorCode; message?: string }) => void
}

export type StartArgs = {
  url: string
  body: unknown
}

export function useStreamLessonPlan(callbacks: StreamCallbacks = {}) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState<{ code: StreamErrorCode; message?: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Refs to callbacks so closures inside start() always see the latest.
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    setMarkdown('')
    setError(null)
  }, [])

  const start = useCallback(async ({ url, body }: StartArgs) => {
    // Cancel any in-flight stream first.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setMarkdown('')
    setError(null)
    setIsStreaming(true)

    let accumulated = ''
    let finalized = false // set true after we fire done OR error, so cleanup paths don't double-fire
    const failWith = (code: StreamErrorCode, message?: string) => {
      if (finalized) return
      finalized = true
      const err = { code, message }
      setError(err)
      setIsStreaming(false)
      cbRef.current.onError?.(err)
    }
    const succeed = (planId: string) => {
      if (finalized) return
      finalized = true
      setIsStreaming(false)
      cbRef.current.onDone?.({ planId, markdown: accumulated })
    }

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (e) {
      if (controller.signal.aborted) {
        setIsStreaming(false)
        return
      }
      failWith('AI_PROVIDER_ERROR', (e as Error)?.message)
      return
    }

    const contentType = res.headers.get('content-type') ?? ''

    // Pre-stream errors return JSON.
    if (!contentType.startsWith('text/event-stream')) {
      try {
        const payload = (await res.json()) as { code?: string; error?: string }
        const code = (payload.code as StreamErrorCode) || 'AI_PROVIDER_ERROR'
        failWith(code, payload.error)
      } catch {
        failWith('AI_PROVIDER_ERROR', `HTTP ${res.status}`)
      }
      return
    }

    if (!res.body) {
      failWith('AI_PROVIDER_ERROR', 'No response body')
      return
    }

    // ─── SSE parser ───────────────────────────────────────────────
    // Spec: events are separated by blank lines (\n\n or \r\n\r\n). Each
    // event has an optional `event:` field and one or more `data:` fields.
    // We only emit named events from the server, so we expect both.
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let done = false

    try {
      while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone
        if (value) buffer += decoder.decode(value, { stream: true })

        // Normalize CRLF → LF so the rest of the parser doesn't have to care.
        if (buffer.includes('\r')) buffer = buffer.replace(/\r\n?/g, '\n')

        let sepIdx = buffer.indexOf('\n\n')
        while (sepIdx !== -1) {
          const rawEvent = buffer.slice(0, sepIdx)
          buffer = buffer.slice(sepIdx + 2)
          sepIdx = buffer.indexOf('\n\n')

          let eventName = 'message'
          let dataLine = ''
          for (const line of rawEvent.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim()
            else if (line.startsWith('data:')) dataLine = line.slice(5).trim()
          }
          if (!dataLine) continue

          let payload: unknown
          try {
            payload = JSON.parse(dataLine)
          } catch {
            continue
          }

          if (eventName === 'text') {
            const chunk = (payload as { chunk?: string }).chunk ?? ''
            accumulated += chunk
            setMarkdown(accumulated)
            cbRef.current.onText?.({ chunk, accumulated })
          } else if (eventName === 'done') {
            const planId = (payload as { planId?: string }).planId ?? ''
            if (planId) succeed(planId)
            else failWith('AI_PROVIDER_ERROR', 'Missing planId in done event')
            reader.cancel().catch(() => {})
            abortRef.current = null
            return
          } else if (eventName === 'error') {
            const p = payload as { code?: string; message?: string }
            failWith(
              (p.code as StreamErrorCode) || 'AI_PROVIDER_ERROR',
              p.message,
            )
            reader.cancel().catch(() => {})
            abortRef.current = null
            return
          }
        }
      }
    } catch (e) {
      // reader.read() rejects with AbortError when the fetch is aborted
      // via stop(). Treat that as a clean cancellation, not a provider
      // failure — the UI is already in the "stopped" state.
      const isAbort =
        controller.signal.aborted ||
        (e as Error)?.name === 'AbortError'
      if (!isAbort && !finalized) {
        failWith('AI_PROVIDER_ERROR', (e as Error)?.message ?? 'Stream read failed')
      } else if (!finalized) {
        // Aborted before `done` fired — clear streaming state without an error.
        finalized = true
        setIsStreaming(false)
      }
      abortRef.current = null
      return
    }

    // Stream closed without emitting `done` — treat as provider error.
    if (!finalized) {
      failWith('AI_PROVIDER_ERROR', 'Stream closed unexpectedly')
    }
    abortRef.current = null
  }, [])

  return { start, stop, reset, isStreaming, markdown, error }
}
