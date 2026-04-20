// =============================================================================
// app/(teacher)/dashboard/messages/[threadId]/page.tsx — Teacher thread view
// =============================================================================

import { Link } from 'next-view-transitions'
import { redirect } from 'next/navigation'
import { PenSquare } from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getThreadsForTeacherWithNames,
  getThreadMessages,
  getThreadParticipants,
} from '@/lib/db/messages'
import { teacherHasEnrollmentWithStudent } from '@/lib/db/enrollments'
import { ThreadList } from '@/components/messaging/ThreadList'
import { MessagingPanel } from '@/components/messaging/MessagingPanel'
import { ROUTES } from '@/constants/routes'

type Props = {
  params: Promise<{ threadId: string }>
  searchParams: Promise<{ with?: string }>
}

export default async function TeacherThreadPage({ params, searchParams }: Props) {
  const { threadId } = await params
  const { with: fallbackStudentId } = await searchParams
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string

  // Try to resolve the thread via existing messages first.
  const participants = await getThreadParticipants(threadId)

  let studentId: string
  if (participants && participants.teacherId === teacherId) {
    studentId = participants.studentId
  } else if (!participants && fallbackStudentId) {
    // Brand-new thread with no messages yet — authorise via enrollment.
    const allowed = await teacherHasEnrollmentWithStudent(teacherId, fallbackStudentId)
    if (!allowed) redirect(ROUTES.TEACHER.messages)
    studentId = fallbackStudentId
  } else {
    redirect(ROUTES.TEACHER.messages)
  }

  const [threads, messages] = await Promise.all([
    getThreadsForTeacherWithNames(teacherId),
    getThreadMessages(threadId),
  ])

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
            <Link
              href={ROUTES.TEACHER.messagesNew}
              className="flex items-center gap-2 px-4 py-3 border-b border-border/40 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              <PenSquare className="h-4 w-4" />
              New message
            </Link>
            <ThreadList
              threads={threads}
              baseHref={ROUTES.TEACHER.messages}
            />
          </div>

          {/* Thread + composer */}
          <div className="flex-1 flex flex-col min-w-0">
            <MessagingPanel
              initialMessages={messages}
              threadId={threadId}
              currentUserId={teacherId}
              currentUserType="teacher"
              recipientId={studentId}
              recipientType="student"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
