// =============================================================================
// app/(student)/student/messages/page.tsx — Student messages inbox
//
// Auto-opens the most recent conversation when one exists. Otherwise renders
// the empty inbox shell — students cannot initiate threads, so there is no
// compose button. Teachers reach out first.
// =============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { getThreadsForStudentWithNames } from '@/lib/db/messages'
import { InboxShell } from '@/components/messaging/InboxShell'
import { ROUTES } from '@/constants/routes'

export default async function StudentMessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.PLATFORM.studentLogin)

  const student = await getStudentByAuthId(user.id)
  if (!student) redirect(ROUTES.PLATFORM.studentLogin)

  const threads = await getThreadsForStudentWithNames(student.id)

  if (threads.length > 0) {
    redirect(ROUTES.STUDENT.messageThread(threads[0].thread_id))
  }

  return (
    <InboxShell
      threads={threads}
      baseHref={ROUTES.STUDENT.messages}
      currentUserId={student.id}
      emptyTitle="No messages yet"
      emptyBody="Your teachers will reach out here when they have updates or questions."
      sidebarEmptyTitle="No messages yet"
      sidebarEmptyBody="Your teachers will reach out here."
    />
  )
}
