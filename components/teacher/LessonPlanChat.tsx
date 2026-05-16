'use client'

/**
 * components/teacher/LessonPlanChat.tsx
 * Client Component — Chat panel for revising a lesson plan with AI.
 * Calls reviseLessonPlan Server Action. The actual plan markdown is rendered
 * elsewhere; this panel only shows the conversation history + input.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  reviseLessonPlan,
  type LessonPlanErrorCode,
} from '@/lib/actions/lessonPlans'

const ERROR_MESSAGES: Record<LessonPlanErrorCode, string> = {
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
  const [pending, start] = useTransition()
  const [text, setText] = useState('')

  function submit() {
    const instruction = text.trim()
    if (!instruction) return
    start(async () => {
      const res = await reviseLessonPlan({ planId, instruction })
      if (res.success) {
        setText('')
        // Force the Server Component to re-fetch — revalidatePath alone
        // doesn't update an already-rendered page.
        router.refresh()
      } else {
        const code = (res.code as LessonPlanErrorCode) ?? 'AI_PROVIDER_ERROR'
        toast.error("Couldn't revise", {
          description: ERROR_MESSAGES[code] ?? res.error,
        })
      }
    })
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-sm font-medium text-foreground">
        Revise with AI
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {chatHistory.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Tell the AI how to revise this plan — e.g. &ldquo;make the warm-up
            shorter and add a quiz at the end&rdquo;.
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
        {pending && (
          <div className="text-sm text-muted-foreground">Revising plan…</div>
        )}
      </div>
      <div className="border-t border-border p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your revision instruction…"
          rows={3}
          disabled={pending}
          maxLength={2000}
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={submit} disabled={pending || !text.trim()}>
            {pending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}
