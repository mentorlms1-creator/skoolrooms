'use client'

// =============================================================================
// components/messaging/MessageComposer.tsx — Message input + send
// Optimistic: the textarea clears and the message appears in the thread the
// instant submit fires (onOptimisticSend). The server action runs in the
// background; onSendConfirmed swaps the temp for the real row, onSendFailed
// rolls it back.
// =============================================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { ArrowUp } from 'lucide-react'
import { sendMessageAction } from '@/lib/actions/messages'
import { cn } from '@/lib/utils'
import type { MessageRow } from '@/lib/db/messages'

type MessageComposerProps = {
  threadId: string
  recipientId: string
  recipientType: 'teacher' | 'student'
  currentUserId: string
  currentUserType: 'teacher' | 'student'
  placeholder?: string
  onOptimisticSend?: (tempMessage: MessageRow) => void
  onSendConfirmed?: (tempId: string, realMessage: MessageRow) => void
  onSendFailed?: (tempId: string) => void
}

export function MessageComposer({
  threadId,
  recipientId,
  recipientType,
  currentUserId,
  currentUserType,
  placeholder = 'Message',
  onOptimisticSend,
  onSendConfirmed,
  onSendFailed,
}: MessageComposerProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Auto-grow the textarea up to a max height.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = '0px'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [value])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const body = value.trim()
    if (!body) return

    setError(null)

    const tempId = `temp-${crypto.randomUUID()}`
    const tempMessage: MessageRow = {
      id: tempId,
      thread_id: threadId,
      sender_type: currentUserType,
      sender_id: currentUserId,
      recipient_type: recipientType,
      recipient_id: recipientId,
      body,
      attachment_url: null,
      read_at: null,
      created_at: new Date().toISOString(),
    }
    onOptimisticSend?.(tempMessage)
    setValue('')
    textareaRef.current?.focus()

    const formData = new FormData()
    formData.set('body', body)
    formData.set('recipient_id', recipientId)
    formData.set('recipient_type', recipientType)

    startTransition(async () => {
      const result = await sendMessageAction(formData)
      if (!result.success) {
        setError(result.error ?? 'Failed to send message.')
        onSendFailed?.(tempId)
        return
      }
      onSendConfirmed?.(tempId, result.data.message)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  const canSend = value.trim().length > 0 && !isPending

  return (
    <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-2">
      {error && (
        <p className="text-xs text-destructive mb-2 px-2">{error}</p>
      )}
      <form ref={formRef} onSubmit={handleSubmit}>
        <div
          className={cn(
            'flex items-end gap-2 rounded-3xl bg-foreground/[0.04] pl-4 pr-1.5 py-1.5 transition-shadow',
            'has-[:focus]:bg-foreground/[0.06] has-[:focus]:ring-2 has-[:focus]:ring-primary/20',
          )}
        >
          <textarea
            ref={textareaRef}
            name="body"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={1}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            className="flex-1 resize-none bg-transparent py-2 text-[14.5px] placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 leading-relaxed"
            style={{ maxHeight: 160 }}
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className={cn(
              'shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-all',
              canSend
                ? 'bg-primary text-primary-foreground hover:scale-105 active:scale-95'
                : 'bg-foreground/10 text-muted-foreground/60 cursor-not-allowed',
            )}
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      </form>
    </div>
  )
}
