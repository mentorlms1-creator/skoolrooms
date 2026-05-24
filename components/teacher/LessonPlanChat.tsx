'use client'

/**
 * components/teacher/LessonPlanChat.tsx
 * Client Component — AI revise panel. Streams tokens from
 * /api/lesson-plans/[id]/revise; live markdown preview replaces the chat
 * history while streaming. On done, router.refresh() lets the parent
 * Server Component re-fetch the persisted body and updated history.
 *
 * Quick-action chips submit pre-baked revision prompts for common edits
 * (shorten the warm-up, add an exit ticket, etc.). Freeform chat input
 * stays available below for anything bespoke.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Loader2,
  StopCircle,
  Sparkles,
  ArrowUp,
  Clock,
  CheckCircle2,
  PencilLine,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

type QuickAction = {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  subtitle: string
  prompt: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: Clock,
    title: 'Shorten warm-up to 5 mins',
    subtitle: 'Improve pacing',
    prompt: 'Shorten the warm-up section to 5 minutes while keeping it engaging.',
  },
  {
    icon: CheckCircle2,
    title: 'Add an exit ticket',
    subtitle: 'Check student understanding',
    prompt: 'Add a short exit ticket at the end to check student understanding of the key concepts covered.',
  },
  {
    icon: PencilLine,
    title: 'Create homework',
    subtitle: 'Based on this lesson',
    prompt: 'Add a homework section with 5-8 practice problems based on the concepts taught in this lesson.',
  },
]

type Props = {
  planId: string
  chatHistory: ChatTurn[]
}

export function LessonPlanChat({ planId, chatHistory }: Props) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [pendingInstruction, setPendingInstruction] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const stream = useStreamLessonPlan({
    onDone: () => {
      router.refresh()
      setPendingInstruction(null)
    },
    onError: ({ code, message }) => {
      toast.error("Couldn't revise", {
        description: ERROR_MESSAGES[code] ?? message ?? code,
      })
      setPendingInstruction(null)
    },
  })

  // Auto-grow textarea.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = '0px'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [text])

  function sendPrompt(instruction: string) {
    const trimmed = instruction.trim()
    if (!trimmed || stream.isStreaming) return
    setText('')
    setPendingInstruction(trimmed)
    stream.start({
      url: `/api/lesson-plans/${planId}/revise`,
      body: { instruction: trimmed },
    })
  }

  function submit() {
    sendPrompt(text)
  }

  const isStreaming = stream.isStreaming
  const canSend = text.trim().length > 0 && !isStreaming

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </span>
          <span className="text-[14px] font-bold text-foreground">AI Assistant</span>
        </div>
        {isStreaming && (
          <button
            type="button"
            onClick={() => stream.stop()}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-foreground/[0.05] transition-colors"
          >
            <StopCircle className="h-3.5 w-3.5" />
            Stop
          </button>
        )}
      </div>

      {/* Content scroll area */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 custom-scrollbar">
        {isStreaming ? (
          <div className="space-y-3">
            {pendingInstruction && (
              <div className="rounded-2xl bg-primary/10 px-3.5 py-2.5">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-primary/70 mb-0.5">You</div>
                <div className="text-[12.5px] leading-snug text-foreground">{pendingInstruction}</div>
              </div>
            )}
            <div className="rounded-2xl bg-foreground/[0.04] px-3.5 py-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Drafting
              </div>
              <article
                className="
                  text-[12px] leading-relaxed text-foreground
                  [&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-[13px] [&_h1]:font-semibold
                  [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-[13px] [&_h2]:font-semibold
                  [&_h3]:mb-1 [&_h3]:mt-1 [&_h3]:text-[12px] [&_h3]:font-semibold
                  [&_p]:mb-1
                  [&_ul]:mb-1 [&_ul]:list-disc [&_ul]:pl-4
                  [&_ol]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4
                  [&_li]:mb-0.5
                  [&_strong]:font-semibold
                  [&_code]:rounded [&_code]:bg-foreground/[0.05] [&_code]:px-1 [&_code]:py-0.5
                "
              >
                {stream.markdown ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{stream.markdown}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground">Waiting for the first token…</p>
                )}
              </article>
            </div>
          </div>
        ) : (
          <>
            {/* Quick actions (always shown when not streaming) */}
            <div className="space-y-2 mb-4">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => sendPrompt(action.prompt)}
                    className="w-full flex items-start gap-3 rounded-2xl bg-foreground/[0.04] hover:bg-foreground/[0.06] px-3.5 py-3 text-left transition-colors group"
                  >
                    <span className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-card ring-1 ring-foreground/[0.06]">
                      <Icon className="h-4 w-4 text-foreground/70" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground leading-snug">{action.title}</p>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">{action.subtitle}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Recent suggestions / chat history */}
            {chatHistory.length > 0 && (
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 px-1">
                  Recent revisions
                </p>
                <div className="space-y-1.5">
                  {chatHistory
                    .filter((t) => t.role === 'user')
                    .slice(-6)
                    .reverse()
                    .map((turn, i) => (
                      <button
                        key={`${turn.created_at}-${i}`}
                        type="button"
                        onClick={() => sendPrompt(turn.content)}
                        className="block w-full text-left rounded-xl bg-foreground/[0.03] hover:bg-foreground/[0.06] px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors line-clamp-2"
                      >
                        {turn.content}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {chatHistory.length === 0 && (
              <p className="text-[11.5px] text-muted-foreground/70 px-1 mt-2">
                Or type a custom instruction below to revise this plan.
              </p>
            )}
          </>
        )}
      </div>

      {/* Composer */}
      <div className="px-4 pb-4 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div
            className={cn(
              'flex items-end gap-2 rounded-3xl bg-foreground/[0.04] pl-4 pr-1.5 py-1.5 transition-shadow',
              'has-[:focus]:bg-foreground/[0.06] has-[:focus]:ring-2 has-[:focus]:ring-primary/20',
              isStreaming && 'opacity-60',
            )}
          >
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder={isStreaming ? 'Drafting your revision…' : 'Ask the AI to revise…'}
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none bg-transparent py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 leading-relaxed"
              style={{ maxHeight: 160 }}
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send revision instruction"
              className={cn(
                'shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-all',
                canSend
                  ? 'bg-primary text-primary-foreground hover:scale-105 active:scale-95'
                  : 'bg-foreground/10 text-muted-foreground/60 cursor-not-allowed',
              )}
            >
              <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.5} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
