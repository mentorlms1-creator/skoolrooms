// =============================================================================
// app/(student)/student/messages/page.tsx — Student messages list
// =============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { getThreadsForStudentWithNames } from '@/lib/db/messages'
import { ThreadList } from '@/components/messaging/ThreadList'
import { ROUTES } from '@/constants/routes'

export default async function StudentMessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.PLATFORM.studentLogin)

  const student = await getStudentByAuthId(user.id)
  if (!student) redirect(ROUTES.PLATFORM.studentLogin)

  const threads = await getThreadsForStudentWithNames(student.id)

  // Redirect to first thread if one exists
  if (threads.length > 0) {
    redirect(ROUTES.STUDENT.messageThread(threads[0].thread_id))
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Direct messages with your teachers.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <ThreadList
          threads={threads}
          baseHref={ROUTES.STUDENT.messages}
        />
      </div>
    </div>
  )
}
