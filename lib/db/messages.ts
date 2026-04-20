// =============================================================================
// lib/db/messages.ts — All queries for direct_messages table
// All writes use createAdminClient() (service role bypasses RLS).
// RLS on direct_messages allows reads by sender/recipient; writes are server-only.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

// -----------------------------------------------------------------------------
// Row types (manual — until supabase gen types is run)
// -----------------------------------------------------------------------------

export type MessageRow = {
  id: string
  thread_id: string
  sender_type: 'teacher' | 'student'
  sender_id: string
  recipient_type: 'teacher' | 'student'
  recipient_id: string
  body: string
  attachment_url: string | null
  read_at: string | null
  created_at: string
}

export type ThreadSummary = {
  thread_id: string
  /** The other party's id (not the current user) */
  other_party_id: string
  other_party_type: 'teacher' | 'student'
  other_party_name: string
  last_message_body: string
  last_message_at: string
  unread_count: number
}

export type SendMessageInput = {
  threadId: string
  senderType: 'teacher' | 'student'
  senderId: string
  recipientType: 'teacher' | 'student'
  recipientId: string
  body: string
}

// -----------------------------------------------------------------------------
// getOrCreateThreadId
// Looks up an existing thread between a teacher+student pair.
// If none found, returns a fresh UUID for the caller to use.
// -----------------------------------------------------------------------------

export async function getOrCreateThreadId(
  teacherId: string,
  studentId: string,
): Promise<{ threadId: string; isNew: boolean }> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('direct_messages')
    .select('thread_id')
    .or(
      `and(sender_id.eq.${teacherId},recipient_id.eq.${studentId}),and(sender_id.eq.${studentId},recipient_id.eq.${teacherId})`,
    )
    .limit(1)
    .maybeSingle()

  if (data?.thread_id) {
    return { threadId: data.thread_id, isNew: false }
  }

  const { data: uuidRow } = await supabase.rpc('gen_random_uuid' as string)
  return { threadId: (uuidRow as string | null) ?? crypto.randomUUID(), isNew: true }
}

// -----------------------------------------------------------------------------
// sendMessage — Insert a message row
// -----------------------------------------------------------------------------

export async function sendMessage(input: SendMessageInput): Promise<MessageRow | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      thread_id: input.threadId,
      sender_type: input.senderType,
      sender_id: input.senderId,
      recipient_type: input.recipientType,
      recipient_id: input.recipientId,
      body: input.body,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[sendMessage]', error.message)
    return null
  }

  return data as MessageRow
}

// -----------------------------------------------------------------------------
// getThreadMessages — Fetch all messages in a thread (oldest first)
// -----------------------------------------------------------------------------

export async function getThreadMessages(
  threadId: string,
  limit = 100,
): Promise<MessageRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[getThreadMessages]', error.message)
    return []
  }

  return (data ?? []) as MessageRow[]
}

// -----------------------------------------------------------------------------
// getThreadsForTeacher — Latest message per thread for a teacher
// Returns one entry per unique thread_id, sorted by last message time desc.
// -----------------------------------------------------------------------------

export async function getThreadsForTeacher(
  teacherId: string,
): Promise<ThreadSummary[]> {
  const supabase = createAdminClient()

  // Fetch all messages where teacher is sender or recipient
  const { data, error } = await supabase
    .from('direct_messages')
    .select('thread_id, sender_id, sender_type, recipient_id, recipient_type, body, read_at, created_at')
    .or(`and(sender_id.eq.${teacherId},sender_type.eq.teacher),and(recipient_id.eq.${teacherId},recipient_type.eq.teacher)`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getThreadsForTeacher]', error.message)
    return []
  }

  return buildThreadSummaries(data ?? [], teacherId, 'teacher')
}

// -----------------------------------------------------------------------------
// getThreadsForStudent — Latest message per thread for a student
// -----------------------------------------------------------------------------

export async function getThreadsForStudent(
  studentId: string,
): Promise<ThreadSummary[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('direct_messages')
    .select('thread_id, sender_id, sender_type, recipient_id, recipient_type, body, read_at, created_at')
    .or(`and(sender_id.eq.${studentId},sender_type.eq.student),and(recipient_id.eq.${studentId},recipient_type.eq.student)`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getThreadsForStudent]', error.message)
    return []
  }

  return buildThreadSummaries(data ?? [], studentId, 'student')
}

// -----------------------------------------------------------------------------
// Helper: collapse raw messages into one ThreadSummary per thread_id
// Names are not resolved here (caller may join teacher/student tables).
// -----------------------------------------------------------------------------

type RawMsg = {
  thread_id: string
  sender_id: string
  sender_type: string
  recipient_id: string
  recipient_type: string
  body: string
  read_at: string | null
  created_at: string
}

function buildThreadSummaries(
  rows: RawMsg[],
  currentUserId: string,
  currentUserType: 'teacher' | 'student',
): ThreadSummary[] {
  const seen = new Map<string, ThreadSummary>()

  for (const row of rows) {
    if (seen.has(row.thread_id)) {
      // Already captured the latest message — just count unreads
      const existing = seen.get(row.thread_id)!
      const isUnreadForMe =
        row.recipient_id === currentUserId &&
        row.recipient_type === currentUserType &&
        !row.read_at
      if (isUnreadForMe) existing.unread_count++
      continue
    }

    const otherIsRecipient = row.sender_id === currentUserId && row.sender_type === currentUserType
    const otherId = otherIsRecipient ? row.recipient_id : row.sender_id
    const otherType = (otherIsRecipient ? row.recipient_type : row.sender_type) as 'teacher' | 'student'

    const isUnreadForMe =
      row.recipient_id === currentUserId &&
      row.recipient_type === currentUserType &&
      !row.read_at

    seen.set(row.thread_id, {
      thread_id: row.thread_id,
      other_party_id: otherId,
      other_party_type: otherType,
      other_party_name: '', // filled by caller after name lookup
      last_message_body: row.body,
      last_message_at: row.created_at,
      unread_count: isUnreadForMe ? 1 : 0,
    })
  }

  return Array.from(seen.values())
}

// -----------------------------------------------------------------------------
// getThreadsForTeacherWithNames — threads + other party names resolved
// -----------------------------------------------------------------------------

export async function getThreadsForTeacherWithNames(
  teacherId: string,
): Promise<ThreadSummary[]> {
  const summaries = await getThreadsForTeacher(teacherId)
  if (summaries.length === 0) return []

  const supabase = createAdminClient()

  // All other parties are students
  const studentIds = summaries.map((s) => s.other_party_id)
  const { data: students } = await supabase
    .from('students')
    .select('id, name')
    .in('id', studentIds)

  const nameMap = new Map((students ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))

  return summaries.map((s) => ({
    ...s,
    other_party_name: nameMap.get(s.other_party_id) ?? 'Unknown',
  }))
}

// -----------------------------------------------------------------------------
// getThreadsForStudentWithNames — threads + teacher names resolved
// -----------------------------------------------------------------------------

export async function getThreadsForStudentWithNames(
  studentId: string,
): Promise<ThreadSummary[]> {
  const summaries = await getThreadsForStudent(studentId)
  if (summaries.length === 0) return []

  const supabase = createAdminClient()

  const teacherIds = summaries.map((s) => s.other_party_id)
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name')
    .in('id', teacherIds)

  const nameMap = new Map((teachers ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))

  return summaries.map((s) => ({
    ...s,
    other_party_name: nameMap.get(s.other_party_id) ?? 'Unknown',
  }))
}

// -----------------------------------------------------------------------------
// markThreadRead — mark all unread messages in a thread as read for a recipient
// -----------------------------------------------------------------------------

export async function markThreadRead(
  threadId: string,
  recipientId: string,
  recipientType: 'teacher' | 'student',
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('recipient_id', recipientId)
    .eq('recipient_type', recipientType)
    .is('read_at', null)

  if (error) {
    console.error('[markThreadRead]', error.message)
  }
}

// -----------------------------------------------------------------------------
// getUnreadCountForTeacher
// -----------------------------------------------------------------------------

export async function getUnreadCountForTeacher(teacherId: string): Promise<number> {
  const supabase = createAdminClient()

  const { count, error } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', teacherId)
    .eq('recipient_type', 'teacher')
    .is('read_at', null)

  if (error) {
    console.error('[getUnreadCountForTeacher]', error.message)
    return 0
  }

  return count ?? 0
}

// -----------------------------------------------------------------------------
// getUnreadCountForStudent
// -----------------------------------------------------------------------------

export async function getUnreadCountForStudent(studentId: string): Promise<number> {
  const supabase = createAdminClient()

  const { count, error } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', studentId)
    .eq('recipient_type', 'student')
    .is('read_at', null)

  if (error) {
    console.error('[getUnreadCountForStudent]', error.message)
    return 0
  }

  return count ?? 0
}

// -----------------------------------------------------------------------------
// getParticipants — returns { teacherId, studentId } for a given threadId
// Used for access validation in page.tsx
// -----------------------------------------------------------------------------

export async function getThreadParticipants(
  threadId: string,
): Promise<{ teacherId: string; studentId: string } | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('direct_messages')
    .select('sender_id, sender_type, recipient_id, recipient_type')
    .eq('thread_id', threadId)
    .limit(1)
    .single()

  if (!data) return null

  const teacherId =
    data.sender_type === 'teacher' ? data.sender_id : data.recipient_id
  const studentId =
    data.sender_type === 'student' ? data.sender_id : data.recipient_id

  return { teacherId, studentId }
}
