// =============================================================================
// app/(teacher)/dashboard/messages/[threadId]/page.tsx — Teacher thread view
// =============================================================================

import { redirect } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import {
  getThreadsForTeacherWithNames,
  getThreadMessages,
  getThreadParticipants,
} from '@/lib/db/messages'
import { teacherHasEnrollmentWithStudent } from '@/lib/db/enrollments'
import { InboxShell } from '@/components/messaging/InboxShell'
import { ConversationView } from '@/components/messaging/ConversationView'
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

  // Resolve the other-party (student) display info. Prefer the threads
  // summary; fall back to a direct query for brand-new empty threads.
  const summary = threads.find((t) => t.thread_id === threadId)
  let studentName = summary?.other_party_name
  let studentPhoto = summary?.other_party_photo_url ?? null
  if (!studentName) {
    const supabase = createAdminClient()
    const { data: studentRow } = await supabase
      .from('students')
      .select('name, profile_photo_url')
      .eq('id', studentId)
      .single()
    studentName = (studentRow?.name as string | undefined) ?? 'Student'
    studentPhoto = (studentRow?.profile_photo_url as string | null | undefined) ?? null
  }

  return (
    <InboxShell
      threads={threads}
      baseHref={ROUTES.TEACHER.messages}
      currentUserId={teacherId}
      newHref={ROUTES.TEACHER.messagesNew}
    >
      <ConversationView
        threadId={threadId}
        initialMessages={messages}
        currentUserId={teacherId}
        currentUserType="teacher"
        recipientId={studentId}
        recipientType="student"
        backHref={ROUTES.TEACHER.messages}
        otherParty={{
          id: studentId,
          name: studentName,
          photoUrl: studentPhoto,
          profileHref: ROUTES.TEACHER.studentDetail(studentId),
        }}
      />
    </InboxShell>
  )
}
