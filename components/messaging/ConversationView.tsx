// =============================================================================
// components/messaging/ConversationView.tsx — Right-pane: header + thread + composer
//
// Server Component. Composes the conversation header (avatar + name, optional
// profile link, mobile back link) on top of MessagingPanel.
// =============================================================================

import { Link } from 'next-view-transitions'
import { ChevronLeft } from 'lucide-react'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
import { MessagingPanel } from './MessagingPanel'
import type { MessageRow } from '@/lib/db/messages'

type ConversationViewProps = {
  threadId: string
  initialMessages: MessageRow[]
  currentUserId: string
  currentUserType: 'teacher' | 'student'
  recipientId: string
  recipientType: 'teacher' | 'student'
  otherParty: {
    id: string
    name: string
    photoUrl: string | null
    /** Optional href shown as a "View profile" affordance. */
    profileHref?: string
    /** Optional subtitle under the name (e.g. course name). */
    subtitle?: string
  }
  /** Where the mobile back button returns to (sidebar). */
  backHref: string
}

export function ConversationView({
  threadId,
  initialMessages,
  currentUserId,
  currentUserType,
  recipientId,
  recipientType,
  otherParty,
  backHref,
}: ConversationViewProps) {
  return (
    <>
      {/* Conversation header */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-foreground/[0.05]">
        <Link
          href={backHref}
          aria-label="Back to conversations"
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-foreground/[0.05] -ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        {otherParty.profileHref ? (
          <Link
            href={otherParty.profileHref}
            className="flex items-center gap-3 min-w-0 flex-1 group"
          >
            <StudentAvatar
              id={otherParty.id}
              name={otherParty.name}
              photoUrl={otherParty.photoUrl}
              size="md"
              className="!h-10 !w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {otherParty.name}
              </p>
              {otherParty.subtitle && (
                <p className="text-[12px] text-muted-foreground truncate">{otherParty.subtitle}</p>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <StudentAvatar
              id={otherParty.id}
              name={otherParty.name}
              photoUrl={otherParty.photoUrl}
              size="md"
              className="!h-10 !w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-foreground truncate">{otherParty.name}</p>
              {otherParty.subtitle && (
                <p className="text-[12px] text-muted-foreground truncate">{otherParty.subtitle}</p>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Thread + composer */}
      <MessagingPanel
        initialMessages={initialMessages}
        threadId={threadId}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
        recipientId={recipientId}
        recipientType={recipientType}
      />
    </>
  )
}
