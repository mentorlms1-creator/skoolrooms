'use client'

// =============================================================================
// components/messaging/Thread.tsx — Displays messages in a thread; realtime.
// =============================================================================

import { useEffect, useState } from 'react'
import { formatPKT } from '@/lib/time/pkt'
import { useRealtime } from '@/hooks/useRealtime'
import { markThreadReadAction } from '@/lib/actions/messages'
import { cn } from '@/lib/utils'
import type { MessageRow } from '@/lib/db/messages'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

type ThreadProps = {
  initialMessages: MessageRow[]
  threadId: string
  currentUserId: string
  currentUserType: 'teacher' | 'student'
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Thread({
  initialMessages,
  threadId,
  currentUserId,
  currentUserType,
}: ThreadProps) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)

  // Mark thread as read on mount
  useEffect(() => {
    void markThreadReadAction(threadId)
  }, [threadId])

  // Realtime subscription — new messages inserted to this thread
  useRealtime<Record<string, unknown>>({
    table: 'direct_messages',
    filter: `thread_id=eq.${threadId}`,
    event: 'INSERT',
    onData: (payload) => {
      const newMsg = payload.new as MessageRow
      if (!newMsg?.id) return
      setMessages((prev) => {
        // Avoid duplicates (optimistic update may already have it)
        if (prev.some((m) => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })
    },
  })

  // Also listen for read_at updates
  useRealtime<Record<string, unknown>>({
    table: 'direct_messages',
    filter: `thread_id=eq.${threadId}`,
    event: 'UPDATE',
    onData: (payload) => {
      const updated = payload.new as MessageRow
      if (!updated?.id) return
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, read_at: updated.read_at } : m)),
      )
    },
  })

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No messages yet. Start the conversation below.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((msg) => {
        const isMine = msg.sender_id === currentUserId && msg.sender_type === currentUserType

        return (
          <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[70%] rounded-2xl px-4 py-2.5',
                isMine
                  ? 'bg-accent text-accent-foreground rounded-br-sm'
                  : 'bg-card border border-border/60 text-foreground rounded-bl-sm',
              )}
            >
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                {msg.body}
              </p>
              <div className={cn('flex items-center gap-1 mt-1', isMine ? 'justify-end' : 'justify-start')}>
                <span className="text-[10px] opacity-60">
                  {formatPKT(msg.created_at, 'time')}
                </span>
                {isMine && msg.read_at && (
                  <span className="text-[10px] opacity-60">· Read</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
