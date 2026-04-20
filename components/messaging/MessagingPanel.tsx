'use client'

// =============================================================================
// components/messaging/MessagingPanel.tsx
// Owns the messages array for a thread. Sender's message appears optimistically
// the instant they submit (no await). The realtime echo + the server action's
// returned row both get deduped against the temp id. Realtime also delivers
// the other party's messages and read_at updates.
// =============================================================================

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  useEffect(() => {
    // Mark thread read, then refresh server components so the sidebar message
    // badge and thread list unread counts update without a hard reload.
    void markThreadReadAction(threadId).then(() => {
      router.refresh()
    })
  }, [threadId, router])

  function mergeMessage(next: MessageRow) {
    setMessages((prev) => {
      if (prev.some((m) => m.id === next.id)) return prev
      return [...prev, next]
    })
  }

  function replaceTempMessage(tempId: string, real: MessageRow) {
    setMessages((prev) => {
      // If the realtime echo already delivered the real row, just drop the temp.
      if (prev.some((m) => m.id === real.id)) {
        return prev.filter((m) => m.id !== tempId)
      }
      return prev.map((m) => (m.id === tempId ? real : m))
    })
  }

  function removeTempMessage(tempId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== tempId))
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
        currentUserId={currentUserId}
        currentUserType={currentUserType}
        onOptimisticSend={mergeMessage}
        onSendConfirmed={replaceTempMessage}
        onSendFailed={removeTempMessage}
      />
    </>
  )
}
