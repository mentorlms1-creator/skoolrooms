'use client'

// =============================================================================
// components/messaging/MessagingPanel.tsx
// Owns the messages array for a thread. Renders Thread (presentational) and
// MessageComposer, so that a successful send appends locally without waiting
// for the realtime echo. Realtime is still used for the other party's new
// messages and read_at updates; the dedupe-by-id handles the sender's own
// echo when it arrives.
// =============================================================================

import { useEffect, useState } from 'react'
import { useRealtime } from '@/hooks/useRealtime'
import { markThreadReadAction } from '@/lib/actions/messages'
import { Thread } from './Thread'
import { MessageComposer } from './MessageComposer'
import type { MessageRow } from '@/lib/db/messages'

type Props = {
  initialMessages: MessageRow[]
  threadId: string
  currentUserId: string
  currentUserType: 'teacher' | 'student'
  recipientId: string
  recipientType: 'teacher' | 'student'
}

export function MessagingPanel({
  initialMessages,
  threadId,
  currentUserId,
  currentUserType,
  recipientId,
  recipientType,
}: Props) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)

  useEffect(() => {
    void markThreadReadAction(threadId)
  }, [threadId])

  function mergeMessage(next: MessageRow) {
    setMessages((prev) => {
      if (prev.some((m) => m.id === next.id)) return prev
      return [...prev, next]
    })
  }

  useRealtime<Record<string, unknown>>({
    table: 'direct_messages',
    filter: `thread_id=eq.${threadId}`,
    event: 'INSERT',
    onData: (payload) => {
      const newMsg = payload.new as MessageRow
      if (!newMsg?.id) return
      mergeMessage(newMsg)
    },
  })

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

  return (
    <>
      <Thread
        messages={messages}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
      />
      <MessageComposer
        threadId={threadId}
        recipientId={recipientId}
        recipientType={recipientType}
        onSent={mergeMessage}
      />
    </>
  )
}
