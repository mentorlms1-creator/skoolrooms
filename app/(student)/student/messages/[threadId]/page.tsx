// =============================================================================
// app/(student)/student/messages/[threadId]/page.tsx — Student thread view
// =============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import {
  getThreadsForStudentWithNames,
  getThreadMessages,
  getThreadParticipants,
} from '@/lib/db/messages'
import { ThreadList } from '@/components/messaging/ThreadList'
import { MessagingPanel } from '@/components/messaging/MessagingPanel'
import { ROUTES } from '@/constants/routes'

type Props = {
  params: Promise<{ threadId: string }>
}

export default async function StudentThreadPage({ params }: Props) {
  const { threadId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.PLATFORM.studentLogin)

  const student = await getStudentByAuthId(user.id)
  if (!student) redirect(ROUTES.PLATFORM.studentLogin)

  const studentId = student.id

  // Validate student is a participant in this thread
  const participants = await getThreadParticipants(threadId)
  if (!participants || participants.studentId !== studentId) {
    redirect(ROUTES.STUDENT.messages)
  }

  const [threads, messages] = await Promise.all([
    getThreadsForStudentWithNames(studentId),
    getThreadMessages(threadId),
  ])

  const teacherId = participants.teacherId

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Direct messages with your teachers.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="flex h-[calc(100vh-280px)] min-h-[400px]">
          {/* Thread list sidebar */}
          <div className="w-72 flex-shrink-0 border-r border-border/60 overflow-y-auto">
            <ThreadList
              threads={threads}
              baseHref={ROUTES.STUDENT.messages}
            />
          </div>

          {/* Thread + composer */}
          <div className="flex-1 flex flex-col min-w-0">
            <MessagingPanel
              initialMessages={messages}
              threadId={threadId}
              currentUserId={studentId}
              currentUserType="student"
              recipientId={teacherId}
              recipientType="teacher"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
