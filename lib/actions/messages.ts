'use server'

// =============================================================================
// lib/actions/messages.ts — Server actions for direct_messages
// =============================================================================

import { createClient, createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getStudentByAuthId } from '@/lib/db/students'
import {
  getOrCreateThreadId,
  sendMessage,
  markThreadRead,
} from '@/lib/db/messages'
import { teacherHasEnrollmentWithStudent } from '@/lib/db/enrollments'
import { createNotification } from '@/lib/db/notifications'
import { sendEmail } from '@/lib/email/sender'
import { ROUTES } from '@/constants/routes'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function getAuthenticatedTeacher() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return getTeacherByAuthId(user.id)
}

async function getAuthenticatedStudent() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return getStudentByAuthId(user.id)
}

// -----------------------------------------------------------------------------
// sendMessageAction — Teacher or student sends a message
// Validates that an enrollment relationship exists between the parties.
// -----------------------------------------------------------------------------

export async function sendMessageAction(
  formData: FormData,
): Promise<ApiResponse<{ messageId: string }>> {
  const body = (formData.get('body') as string | null)?.trim() ?? ''
  const recipientId = (formData.get('recipient_id') as string | null)?.trim() ?? ''
  const recipientType = formData.get('recipient_type') as 'teacher' | 'student' | null

  if (!body) return { success: false, error: 'Message body is required.' }
  if (!recipientId) return { success: false, error: 'Recipient is required.' }
  if (!recipientType || !['teacher', 'student'].includes(recipientType)) {
    return { success: false, error: 'Invalid recipient type.' }
  }

  // Determine sender
  let senderId: string
  let senderType: 'teacher' | 'student'
  let senderName: string
  let senderEmail: string
  let teacherId: string
  let studentId: string

  if (recipientType === 'student') {
    // Sender is a teacher
    const teacher = await getAuthenticatedTeacher()
    if (!teacher) return { success: false, error: 'Not authenticated.' }
    senderId = teacher.id as string
    senderType = 'teacher'
    senderName = teacher.name as string
    senderEmail = teacher.email as string
    teacherId = senderId
    studentId = recipientId

    // Validate enrollment relationship
    const connected = await teacherHasEnrollmentWithStudent(teacherId, studentId)
    if (!connected) {
      return { success: false, error: 'NOT_CONNECTED', code: 'NOT_CONNECTED' }
    }
  } else {
    // Sender is a student
    const student = await getAuthenticatedStudent()
    if (!student) return { success: false, error: 'Not authenticated.' }
    senderId = student.id as string
    senderType = 'student'
    senderName = student.name as string
    senderEmail = student.email as string
    teacherId = recipientId
    studentId = senderId

    // Validate enrollment relationship
    const connected = await teacherHasEnrollmentWithStudent(teacherId, studentId)
    if (!connected) {
      return { success: false, error: 'NOT_CONNECTED', code: 'NOT_CONNECTED' }
    }
  }

  const { threadId } = await getOrCreateThreadId(teacherId, studentId)

  // Insert message
  const message = await sendMessage({
    threadId,
    senderType,
    senderId,
    recipientType,
    recipientId,
    body,
  })

  if (!message) {
    return { success: false, error: 'Failed to send message. Please try again.' }
  }

  // Resolve thread URL for notifications
  const threadUrl =
    recipientType === 'teacher'
      ? ROUTES.TEACHER.messageThread(threadId)
      : ROUTES.STUDENT.messageThread(threadId)

  // Create in-app notification for recipient
  void createNotification({
    userType: recipientType,
    userId: recipientId,
    kind: 'new_message',
    title: `New message from ${senderName}`,
    body: body.substring(0, 120),
    linkUrl: threadUrl,
  })

  // Fetch recipient email for email notification
  const supabase = createAdminClient()
  let recipientEmail: string | null = null
  let recipientName: string | null = null

  if (recipientType === 'teacher') {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('email, name')
      .eq('id', recipientId)
      .single()
    recipientEmail = (teacher as { email: string; name: string } | null)?.email ?? null
    recipientName = (teacher as { email: string; name: string } | null)?.name ?? null
  } else {
    const { data: student } = await supabase
      .from('students')
      .select('email, name')
      .eq('id', recipientId)
      .single()
    recipientEmail = (student as { email: string; name: string } | null)?.email ?? null
    recipientName = (student as { email: string; name: string } | null)?.name ?? null
  }

  if (recipientEmail && recipientName) {
    void sendEmail({
      to: recipientEmail,
      type: 'new_message',
      recipientId,
      recipientType,
      data: {
        ...(recipientType === 'teacher' ? { teacherName: recipientName } : { studentName: recipientName }),
        senderName,
        messagePreview: body.substring(0, 120),
        threadUrl,
      },
    })
  }

  return { success: true, data: { messageId: message.id } }
}

// -----------------------------------------------------------------------------
// startThreadWithStudentAction — Teacher-initiated thread open.
// Verifies enrollment relationship, ensures a thread id exists, and returns
// it for the client to redirect into /dashboard/messages/[threadId].
// -----------------------------------------------------------------------------

export async function startThreadWithStudentAction(
  studentId: string,
): Promise<ApiResponse<{ threadId: string; studentId: string; isNew: boolean }>> {
  if (!studentId) {
    return { success: false, error: 'Student is required.' }
  }

  const teacher = await getAuthenticatedTeacher()
  if (!teacher) return { success: false, error: 'Not authenticated.' }

  const connected = await teacherHasEnrollmentWithStudent(teacher.id as string, studentId)
  if (!connected) {
    return { success: false, error: 'You can only message students enrolled in your cohorts.', code: 'NOT_CONNECTED' }
  }

  const { threadId, isNew } = await getOrCreateThreadId(teacher.id as string, studentId)
  return { success: true, data: { threadId, studentId, isNew } }
}

// -----------------------------------------------------------------------------
// markThreadReadAction — Mark all unread messages in a thread as read
// -----------------------------------------------------------------------------

export async function markThreadReadAction(
  threadId: string,
): Promise<ApiResponse<void>> {
  // Try teacher auth first
  const teacher = await getAuthenticatedTeacher()
  if (teacher) {
    await markThreadRead(threadId, teacher.id as string, 'teacher')
    return { success: true, data: undefined }
  }

  const student = await getAuthenticatedStudent()
  if (student) {
    await markThreadRead(threadId, student.id as string, 'student')
    return { success: true, data: undefined }
  }

  return { success: false, error: 'Not authenticated.' }
}
