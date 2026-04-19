// =============================================================================
// app/(teacher)/dashboard/messages/page.tsx — Teacher messages list
// =============================================================================

import { redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getThreadsForTeacherWithNames } from '@/lib/db/messages'
import { ThreadList } from '@/components/messaging/ThreadList'
import { ROUTES } from '@/constants/routes'

export default async function TeacherMessagesPage() {
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string

  const threads = await getThreadsForTeacherWithNames(teacherId)

  // If there are threads and no specific thread is selected, redirect to first thread
  if (threads.length > 0) {
    redirect(ROUTES.TEACHER.messageThread(threads[0].thread_id))
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Direct messages with your students.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <ThreadList
          threads={threads}
          baseHref={ROUTES.TEACHER.messages}
        />
      </div>
    </div>
  )
}
