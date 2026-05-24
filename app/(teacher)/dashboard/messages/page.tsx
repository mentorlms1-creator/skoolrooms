// =============================================================================
// app/(teacher)/dashboard/messages/page.tsx — Teacher messages inbox
//
// Auto-opens the most recent conversation when one exists. Otherwise renders
// the empty inbox shell with a compose CTA.
// =============================================================================

import { redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getThreadsForTeacherWithNames } from '@/lib/db/messages'
import { InboxShell } from '@/components/messaging/InboxShell'
import { ROUTES } from '@/constants/routes'

export default async function TeacherMessagesPage() {
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string

  const threads = await getThreadsForTeacherWithNames(teacherId)

  if (threads.length > 0) {
    redirect(ROUTES.TEACHER.messageThread(threads[0].thread_id))
  }

  return (
    <InboxShell
      threads={threads}
      baseHref={ROUTES.TEACHER.messages}
      currentUserId={teacherId}
      newHref={ROUTES.TEACHER.messagesNew}
      emptyTitle="No messages yet"
      emptyBody="Start a conversation with any student enrolled in your cohorts."
    />
  )
}
