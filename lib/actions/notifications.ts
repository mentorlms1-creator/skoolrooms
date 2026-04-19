'use server'

// =============================================================================
// lib/actions/notifications.ts — Server actions for notifications table
// =============================================================================

import { createClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getStudentByAuthId } from '@/lib/db/students'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/db/notifications'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const teacher = await getTeacherByAuthId(user.id)
  if (teacher) return { id: teacher.id as string, type: 'teacher' as const }

  const student = await getStudentByAuthId(user.id)
  if (student) return { id: student.id as string, type: 'student' as const }

  return null
}

// -----------------------------------------------------------------------------
// markNotificationReadAction
// -----------------------------------------------------------------------------

export async function markNotificationReadAction(
  notificationId: string,
): Promise<ApiResponse<void>> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  await markNotificationRead(notificationId)
  return { success: true, data: undefined }
}

// -----------------------------------------------------------------------------
// markAllReadAction
// -----------------------------------------------------------------------------

export async function markAllReadAction(): Promise<ApiResponse<void>> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  await markAllNotificationsRead(user.id, user.type)
  return { success: true, data: undefined }
}
