'use client'

// =============================================================================
// components/messaging/Thread.tsx
//
// Presentational message list. State + realtime are owned by MessagingPanel.
// Bubbles are grouped by sender — consecutive messages from the same person
// collapse into one rounded stack, with the timestamp only on the last bubble
// of each group. A date divider ("Today" / "Yesterday" / "May 19") is inserted
// whenever the calendar day changes.
// =============================================================================

import { useEffect, useRef } from 'react'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'
import type { MessageRow } from '@/lib/db/messages'

type ThreadProps = {
  messages: MessageRow[]
  currentUserId: string
  currentUserType: 'teacher' | 'student'
}

type RenderItem =
  | { kind: 'divider'; key: string; label: string }
  | {
      kind: 'message'
      key: string
      msg: MessageRow
      isMine: boolean
      isFirstInGroup: boolean
      isLastInGroup: boolean
    }

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - that.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return formatPKT(iso, 'date')
}

function buildItems(
  messages: MessageRow[],
  currentUserId: string,
  currentUserType: 'teacher' | 'student',
): RenderItem[] {
  const items: RenderItem[] = []
  let prevDayKey: string | null = null
  let prevSenderKey: string | null = null
  const GROUP_WINDOW_MS = 5 * 60 * 1000

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const isMine = msg.sender_id === currentUserId && msg.sender_type === currentUserType
    const myDay = dayKey(msg.created_at)
    const senderKey = `${msg.sender_type}:${msg.sender_id}`

    if (myDay !== prevDayKey) {
      items.push({ kind: 'divider', key: `d-${myDay}-${i}`, label: dayLabel(msg.created_at) })
      prevDayKey = myDay
      prevSenderKey = null
    }

    const prev = messages[i - 1]
    const next = messages[i + 1]
    const prevSameSender =
      prev && senderKey === prevSenderKey && new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS
    const nextSameSender =
      next &&
      `${next.sender_type}:${next.sender_id}` === senderKey &&
      dayKey(next.created_at) === myDay &&
      new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() < GROUP_WINDOW_MS

    items.push({
      kind: 'message',
      key: msg.id,
      msg,
      isMine,
      isFirstInGroup: !prevSameSender,
      isLastInGroup: !nextSameSender,
    })

    prevSenderKey = senderKey
  }

  return items
}

export function Thread({ messages, currentUserId, currentUserType }: ThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastMessageId = messages[messages.length - 1]?.id

  // Auto-scroll to bottom whenever a new message arrives.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lastMessageId])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <p className="text-sm font-semibold text-foreground">No messages yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Say hi — your first message will start the conversation.
          </p>
        </div>
      </div>
    )
  }

  const items = buildItems(messages, currentUserId, currentUserType)

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-1 custom-scrollbar"
    >
      {items.map((item) => {
        if (item.kind === 'divider') {
          return (
            <div key={item.key} className="flex items-center justify-center py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {item.label}
              </span>
            </div>
          )
        }

        const { msg, isMine, isFirstInGroup, isLastInGroup } = item

        return (
          <div
            key={item.key}
            className={cn(
              'flex',
              isMine ? 'justify-end' : 'justify-start',
              isFirstInGroup ? 'mt-2' : 'mt-0.5',
            )}
          >
            <div className={cn('flex flex-col max-w-[78%] sm:max-w-[68%]', isMine ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'px-3.5 py-2 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words',
                  isMine
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-foreground/[0.06] text-foreground',
                  // iMessage-style asymmetric tail corners by group position
                  isMine
                    ? cn(
                        'rounded-l-2xl',
                        isFirstInGroup ? 'rounded-tr-2xl' : 'rounded-tr-md',
                        isLastInGroup ? 'rounded-br-md' : 'rounded-br-2xl',
                      )
                    : cn(
                        'rounded-r-2xl',
                        isFirstInGroup ? 'rounded-tl-2xl' : 'rounded-tl-md',
                        isLastInGroup ? 'rounded-bl-md' : 'rounded-bl-2xl',
                      ),
                )}
              >
                {msg.body}
              </div>
              {isLastInGroup && (
                <div
                  className={cn(
                    'flex items-center gap-1.5 text-[10.5px] text-muted-foreground/70 mt-1 px-1',
                    isMine ? 'justify-end' : 'justify-start',
                  )}
                >
                  <span className="tabular-nums">{formatPKT(msg.created_at, 'time')}</span>
                  {isMine && msg.read_at && <span>· Read</span>}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
