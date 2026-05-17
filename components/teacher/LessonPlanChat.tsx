'use client'

/**
 * components/teacher/LessonPlanChat.tsx
 * Client Component — Chat panel for revising a lesson plan with AI.
 * Streams tokens from /api/lesson-plans/[id]/revise; live markdown
 * preview replaces the chat history while streaming. On done, calls
 * router.refresh() so the parent's main markdown view re-fetches the
 * persisted new body.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2, StopCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  useStreamLessonPlan,
  type StreamErrorCode,
} from '@/hooks/useStreamLessonPlan'

const ERROR_MESSAGES: Record<StreamErrorCode, string> = {
  QUOTA_EXCEEDED: "You've used all your plans for this month.",
  FEATURE_DISABLED: 'AI lesson planning is currently unavailable.',
  AI_TIMEOUT: 'The AI took too long to respond. Please try again.',
  AI_PROVIDER_ERROR: "Couldn't revise the plan right now. Please try again.",
  RATE_LIMITED: 'Slow down a bit — try again in a few seconds.',
  NOT_FOUND: 'This plan no longer exists.',
  COURSE_NOT_FOUND: 'Course not found.',
  VALIDATION_FAILED: 'Instruction is required.',
  UNAUTHORIZED: 'Please sign in again.',
}

export type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

type Props = {
  planId: string
  chatHistory: ChatTurn[]
}

export function LessonPlanChat({ planId, chatHistory }: Props) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [pendingInstruction, setPendingInstruction] = useState<string | null>(null)

  const stream = useStreamLessonPlan({
    onDone: () => {
      // Server has persisted the new body + appended chat_history.
      // router.refresh() re-fetches the Server Component so both the
      // main markdown view and chat history reflect the new state.
      router.refresh()
      setPendingInstruction(null)
      // Leave the live markdown visible briefly until the page refreshes.
    },
    onError: ({ code, message }) => {
      toast.error("Couldn't revise", {
        description: ERROR_MESSAGES[code] ?? message ?? code,
      })
      setPendingInstruction(null)
    },
  })

  function submit() {
    const instruction = text.trim()
    if (!instruction) return
    setText('')
    setPendingInstruction(instruction)
    stream.start({
      url: `/api/lesson-plans/${planId}/revise`,
      body: { instruction },
    })
  }

  const isStreaming = stream.isStreaming

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium text-foreground">
          {isStreaming ? 'Drafting your revision…' : 'Revise with AI'}
        </span>
        {isStreaming && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => stream.stop()}
            className="h-7 px-2 text-muted-foreground"
          >
            <StopCircle className="mr-1 h-3.5 w-3.5" />
            Stop
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isStreaming ? (
          <>
            {pendingInstruction && (
              <div className="rounded-md bg-primary/10 p-2 text-sm">
                <div className="text-xs uppercase tracking-wide opacity-60">You</div>
                <div>{pendingInstruction}</div>
              </div>
            )}
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI · drafting
              </div>
              <article
                className="
                  text-xs leading-relaxed text-foreground
                  [&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-sm [&_h1]:font-semibold
                  [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold
                  [&_h3]:mb-1 [&_h3]:mt-1 [&_h3]:text-xs [&_h3]:font-semibold
                  [&_p]:mb-1
                  [&_ul]:mb-1 [&_ul]:list-disc [&_ul]:pl-4
                  [&_ol]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4
                  [&_li]:mb-0.5
                  [&_strong]:font-semibold
                  [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5
                "
              >
                {stream.markdown ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {stream.markdown}
                  </ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground">Waiting for the first token…</p>
                )}
              </article>
            </div>
          </>
        ) : (
          <>
            {chatHistory.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Tell the AI how to revise this plan — e.g. &ldquo;make the
                warm-up shorter and add a quiz at the end&rdquo;.
              </p>
            )}
            {chatHistory.map((t, i) => (
              <div
                key={i}
                className={
                  t.role === 'user'
                    ? 'rounded-md bg-primary/10 p-2 text-sm'
                    : 'rounded-md bg-muted p-2 text-sm text-muted-foreground'
                }
              >
                <div className="text-xs uppercase tracking-wide opacity-60">
                  {t.role === 'user' ? 'You' : 'AI'}
                </div>
                <div>{t.content}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="border-t border-border p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            isStreaming
              ? 'Wait for the current revision to finish…'
              : 'Type your revision instruction…'
          }
          rows={3}
          disabled={isStreaming}
          maxLength={2000}
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={submit} disabled={isStreaming || !text.trim()}>
            {isStreaming ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}
