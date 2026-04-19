'use client'

// =============================================================================
// components/messaging/ThreadList.tsx — List of message threads
// =============================================================================

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'
import type { ThreadSummary } from '@/lib/db/messages'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

type ThreadListProps = {
  threads: ThreadSummary[]
  baseHref: string // e.g. '/dashboard/messages' or '/student/messages'
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ThreadList({ threads, baseHref }: ThreadListProps) {
  const pathname = usePathname()

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Messages from your students will appear here.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border/40">
      {threads.map((thread) => {
        const threadHref = `${baseHref}/${thread.thread_id}`
        const isActive = pathname === threadHref
        const initials = thread.other_party_name
          .split(' ')
          .map((w: string) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()

        return (
          <li key={thread.thread_id}>
            <Link
              href={threadHref}
              className={cn(
                'flex items-start gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors',
                isActive && 'bg-accent/5',
              )}
            >
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarFallback className="text-sm font-semibold bg-accent/10 text-accent">
                  {initials || '?'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-[13px] font-medium truncate', isActive ? 'text-foreground' : 'text-foreground/80')}>
                    {thread.other_party_name}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60 flex-shrink-0">
                    {formatPKT(thread.last_message_at, 'relative')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-[12px] text-muted-foreground truncate">
                    {thread.last_message_body}
                  </p>
                  {thread.unread_count > 0 && (
                    <Badge
                      variant="default"
                      className="h-4 min-w-4 flex-shrink-0 px-1.5 text-[10px] bg-accent text-accent-foreground"
                    >
                      {thread.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
