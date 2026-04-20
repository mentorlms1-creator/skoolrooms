'use client'

// =============================================================================
// components/messaging/Thread.tsx
// Presentational message list. State + realtime are owned by MessagingPanel.
// =============================================================================

import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'
import type { MessageRow } from '@/lib/db/messages'

type ThreadProps = {
  messages: MessageRow[]
  currentUserId: string
  currentUserType: 'teacher' | 'student'
}

export function Thread({ messages, currentUserId, currentUserType }: ThreadProps) {
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
