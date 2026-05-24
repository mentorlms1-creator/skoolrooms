// =============================================================================
// components/messaging/InboxShell.tsx — Two-pane Messages layout
//
// Server Component. Renders the header bar, the conversation sidebar (via
// ThreadList), and a right-hand content pane. Both teacher and student
// messages pages render this shell; the right pane is either a real
// ConversationView or an empty-state hint.
// =============================================================================

import { Link } from 'next-view-transitions'
import { PenSquare, MessageSquare } from 'lucide-react'
import { ThreadList } from './ThreadList'
import { MessagesRealtime } from './MessagesRealtime'
import { cn } from '@/lib/utils'
import type { ThreadSummary } from '@/lib/db/messages'

type InboxShellProps = {
  threads: ThreadSummary[]
  baseHref: string
  /** Current user id — used to subscribe to realtime updates for their threads. */
  currentUserId: string
  /** When set, shows a pencil-icon "compose" button in the sidebar header. */
  newHref?: string
  /** Right-pane contents. If omitted, an empty hint is shown. */
  children?: React.ReactNode
  /** Custom empty-state copy when no thread is selected. */
  emptyTitle?: string
  emptyBody?: string
  /** Empty-state copy for the sidebar when there are no threads at all. */
  sidebarEmptyTitle?: string
  sidebarEmptyBody?: string
}

export function InboxShell({
  threads,
  baseHref,
  currentUserId,
  newHref,
  children,
  emptyTitle = 'Select a conversation',
  emptyBody = 'Pick a conversation from the left to read messages.',
  sidebarEmptyTitle,
  sidebarEmptyBody,
}: InboxShellProps) {
  return (
    <div className="h-[calc(100dvh-9rem)] md:h-[calc(100dvh-13rem)] min-h-[480px]">
      <MessagesRealtime currentUserId={currentUserId} />
      <div className="h-full bg-card rounded-3xl ring-1 ring-foreground/5 shadow-sm overflow-hidden">
        <div className="flex h-full">
          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <aside
            className={cn(
              'flex flex-col border-r border-foreground/[0.05]',
              'w-full md:w-[320px] lg:w-[360px] shrink-0',
              // On mobile, hide the sidebar when a thread is open
              children ? 'hidden md:flex' : 'flex',
            )}
          >
            {/* Sidebar header */}
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-foreground/[0.05]">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Messages</h2>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {threads.length} {threads.length === 1 ? 'conversation' : 'conversations'}
                </p>
              </div>
              {newHref && (
                <Link
                  href={newHref}
                  aria-label="New message"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.05] text-foreground hover:bg-foreground/[0.08] transition-colors"
                >
                  <PenSquare className="h-4 w-4" strokeWidth={2} />
                </Link>
              )}
            </div>

            <div className="flex-1 min-h-0">
              <ThreadList
                threads={threads}
                baseHref={baseHref}
                emptyTitle={sidebarEmptyTitle ?? 'No conversations yet'}
                emptyBody={
                  sidebarEmptyBody ??
                  (newHref
                    ? 'Tap the compose icon to start a new conversation.'
                    : 'Your teachers will reach out here.')
                }
              />
            </div>
          </aside>

          {/* ── Right pane ───────────────────────────────────────────────── */}
          <section
            className={cn(
              'flex-1 flex flex-col min-w-0 bg-card',
              children ? 'flex' : 'hidden md:flex',
            )}
          >
            {children ?? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-sm">
                  <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.04]">
                    <MessageSquare className="h-7 w-7 text-muted-foreground/60" strokeWidth={1.5} />
                  </div>
                  <p className="text-base font-semibold text-foreground">{emptyTitle}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">{emptyBody}</p>
                  {newHref && threads.length === 0 && (
                    <Link
                      href={newHref}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <PenSquare className="h-4 w-4" />
                      Start a new conversation
                    </Link>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
