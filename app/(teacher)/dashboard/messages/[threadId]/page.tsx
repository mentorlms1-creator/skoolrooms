// =============================================================================
// app/(teacher)/dashboard/messages/[threadId]/page.tsx — Teacher thread view
// =============================================================================

import { redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getThreadsForTeacherWithNames,
  getThreadMessages,
  getThreadParticipants,
} from '@/lib/db/messages'
import { ThreadList } from '@/components/messaging/ThreadList'
import { Thread } from '@/components/messaging/Thread'
import { MessageComposer } from '@/components/messaging/MessageComposer'
import { ROUTES } from '@/constants/routes'

type Props = {
  params: Promise<{ threadId: string }>
}

export default async function TeacherThreadPage({ params }: Props) {
  const { threadId } = await params
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string

  // Validate teacher is a participant in this thread
  const participants = await getThreadParticipants(threadId)
  if (!participants || participants.teacherId !== teacherId) {
    redirect(ROUTES.TEACHER.messages)
  }

  const [threads, messages] = await Promise.all([
    getThreadsForTeacherWithNames(teacherId),
    getThreadMessages(threadId),
  ])

  // Find the student in this thread
  const studentId = participants.studentId

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Direct messages with your students.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="flex h-[calc(100vh-280px)] min-h-[400px]">
          {/* Thread list sidebar */}
          <div className="w-72 flex-shrink-0 border-r border-border/60 overflow-y-auto">
            <ThreadList
              threads={threads}
              baseHref={ROUTES.TEACHER.messages}
            />
          </div>

          {/* Thread + composer */}
          <div className="flex-1 flex flex-col min-w-0">
            <Thread
              initialMessages={messages}
              threadId={threadId}
              currentUserId={teacherId}
              currentUserType="teacher"
            />
            <MessageComposer
              threadId={threadId}
              recipientId={studentId}
              recipientType="student"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
