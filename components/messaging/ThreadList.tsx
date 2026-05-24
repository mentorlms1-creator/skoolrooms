'use client'

// =============================================================================
// components/messaging/ThreadList.tsx — Sidebar conversation list
//
// iMessage-style rows: avatar + name + last-message snippet + relative time.
// Unread state is shown as a coloured dot on the avatar and bold text. The
// active conversation gets a soft pill background.
// =============================================================================

import { useMemo, useState } from 'react'
import { Link } from 'next-view-transitions'
import { usePathname } from 'next/navigation'
import { MessageSquare, Search } from 'lucide-react'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'
import type { ThreadSummary } from '@/lib/db/messages'

type ThreadListProps = {
  threads: ThreadSummary[]
  baseHref: string
  /** When true, the sidebar shows the local search input. */
  showSearch?: boolean
  /** Optional empty-state copy when there are no threads at all. */
  emptyTitle?: string
  emptyBody?: string
}

export function ThreadList({
  threads,
  baseHref,
  showSearch = true,
  emptyTitle = 'No conversations yet',
  emptyBody = 'Messages will appear here once a conversation starts.',
}: ThreadListProps) {
  const pathname = usePathname()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return threads
    return threads.filter(
      (t) =>
        t.other_party_name.toLowerCase().includes(q) ||
        t.last_message_body.toLowerCase().includes(q),
    )
  }, [query, threads])

  return (
    <div className="flex h-full flex-col">
      {showSearch && threads.length > 0 && (
        <div className="px-3 pt-3 pb-2 border-b border-foreground/[0.04]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full rounded-xl bg-foreground/[0.04] pl-9 pr-3 py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
            />
          </div>
        </div>
      )}

      <ul className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {threads.length === 0 ? (
          <li className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="h-9 w-9 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">{emptyBody}</p>
          </li>
        ) : filtered.length === 0 ? (
          <li className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No conversations match</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try a different search.</p>
          </li>
        ) : (
          filtered.map((thread) => {
            const threadHref = `${baseHref}/${thread.thread_id}`
            const isActive = pathname === threadHref
            const hasUnread = thread.unread_count > 0

            return (
              <li key={thread.thread_id}>
                <Link
                  href={threadHref}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors',
                    isActive
                      ? 'bg-foreground/[0.06]'
                      : 'hover:bg-foreground/[0.03]',
                  )}
                >
                  <div className="relative shrink-0">
                    <StudentAvatar
                      id={thread.other_party_id}
                      name={thread.other_party_name}
                      photoUrl={thread.other_party_photo_url}
                      size="md"
                      className="!h-11 !w-11 text-sm"
                    />
                    {hasUnread && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-card"
                        aria-label={`${thread.unread_count} unread`}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-[14px] truncate',
                          hasUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground',
                        )}
                      >
                        {thread.other_party_name}
                      </span>
                      <span
                        className={cn(
                          'text-[11px] shrink-0 tabular-nums',
                          hasUnread ? 'font-semibold text-primary' : 'text-muted-foreground/70',
                        )}
                      >
                        {formatPKT(thread.last_message_at, 'relative')}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-[12.5px] truncate mt-0.5 leading-snug',
                        hasUnread ? 'text-foreground/80' : 'text-muted-foreground',
                      )}
                    >
                      {thread.last_message_body}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
