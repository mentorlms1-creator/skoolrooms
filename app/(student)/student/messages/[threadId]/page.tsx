// =============================================================================
// app/(student)/student/messages/[threadId]/page.tsx — Student thread view
// =============================================================================

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import {
  getThreadsForStudentWithNames,
  getThreadMessages,
  getThreadParticipants,
} from '@/lib/db/messages'
import { InboxShell } from '@/components/messaging/InboxShell'
import { ConversationView } from '@/components/messaging/ConversationView'
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

  // Resolve teacher display info from the threads summary (always available
  // since the thread must have at least one existing message).
  const summary = threads.find((t) => t.thread_id === threadId)
  let teacherName = summary?.other_party_name
  let teacherPhoto = summary?.other_party_photo_url ?? null
  if (!teacherName) {
    const admin = createAdminClient()
    const { data: teacherRow } = await admin
      .from('teachers')
      .select('name, profile_photo_url')
      .eq('id', teacherId)
      .single()
    teacherName = (teacherRow?.name as string | undefined) ?? 'Teacher'
    teacherPhoto = (teacherRow?.profile_photo_url as string | null | undefined) ?? null
  }

  return (
    <InboxShell
      threads={threads}
      baseHref={ROUTES.STUDENT.messages}
      currentUserId={studentId}
    >
      <ConversationView
        threadId={threadId}
        initialMessages={messages}
        currentUserId={studentId}
        currentUserType="student"
        recipientId={teacherId}
        recipientType="teacher"
        backHref={ROUTES.STUDENT.messages}
        otherParty={{
          id: teacherId,
          name: teacherName,
          photoUrl: teacherPhoto,
        }}
      />
    </InboxShell>
  )
}
