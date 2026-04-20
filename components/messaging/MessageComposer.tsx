'use client'

// =============================================================================
// components/messaging/MessageComposer.tsx — Message input + send
// Optimistic: the textarea clears and the message appears in the thread the
// instant submit fires (onOptimisticSend). The server action runs in the
// background; onSendConfirmed swaps the temp for the real row, onSendFailed
// rolls it back.
// =============================================================================

import { useRef, useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { sendMessageAction } from '@/lib/actions/messages'
import { Button } from '@/components/ui/button'
import type { MessageRow } from '@/lib/db/messages'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

type MessageComposerProps = {
  threadId: string
  recipientId: string
  recipientType: 'teacher' | 'student'
  currentUserId: string
  currentUserType: 'teacher' | 'student'
  onOptimisticSend?: (tempMessage: MessageRow) => void
  onSendConfirmed?: (tempId: string, realMessage: MessageRow) => void
  onSendFailed?: (tempId: string) => void
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MessageComposer({
  threadId,
  recipientId,
  recipientType,
  currentUserId,
  currentUserType,
  onOptimisticSend,
  onSendConfirmed,
  onSendFailed,
}: MessageComposerProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const body = (formData.get('body') as string | null)?.trim() ?? ''
    if (!body) return

    setError(null)

    // Optimistic append — do this BEFORE awaiting the server action.
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
    formRef.current?.reset()
    textareaRef.current?.focus()

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

  return (
    <div className="border-t border-border/60 px-4 py-3">
      {error && (
        <p className="text-xs text-destructive mb-2">{error}</p>
      )}
      <form ref={formRef} onSubmit={handleSubmit}>
        <input type="hidden" name="recipient_id" value={recipientId} />
        <input type="hidden" name="recipient_type" value={recipientType} />
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            name="body"
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={2}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            className="flex-1 resize-none rounded-xl border border-border/60 bg-background px-3 py-2.5 text-[14px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 transition-shadow"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isPending}
            className="h-10 w-10 rounded-xl flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
