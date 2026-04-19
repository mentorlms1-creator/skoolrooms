'use server'

// =============================================================================
// lib/actions/admin-view-as.ts — View-as teacher Server Actions
// =============================================================================

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { logAdminActivity } from '@/lib/db/admin'
import {
  getViewAsSession,
  makeViewAsSession,
  buildViewAsCookieValue,
  VIEW_AS_COOKIE,
} from '@/lib/admin/view-as-session'
import { cookies } from 'next/headers'
import type { ApiResponse } from '@/types/api'

const COOKIE_MAX_AGE = 30 * 60 // 30 minutes in seconds

export async function startViewAsAction(
  teacherId: string
): Promise<ApiResponse<null>> {
  const admin = await requireAdmin()
  const supabase = createAdminClient()

  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('id, email')
    .eq('id', teacherId)
    .single()

  if (error || !teacher) {
    return { success: false, error: 'Teacher not found.' }
  }

  const session = makeViewAsSession(teacherId, teacher.email as string)
  const cookieValue = buildViewAsCookieValue(session)

  const cookieStore = await cookies()
  cookieStore.set(VIEW_AS_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  await logAdminActivity({
    teacherId,
    actionType: 'view_as_start',
    performedBy: admin.email ?? admin.id,
    metadata: {
      target_teacher_id: teacherId,
      target_teacher_email: teacher.email as string,
    },
  })

  return { success: true, data: null }
}

export async function endViewAsAction(): Promise<ApiResponse<{ durationSeconds: number }>> {
  const admin = await requireAdmin()

  const session = await getViewAsSession()
  const cookieStore = await cookies()
  cookieStore.delete(VIEW_AS_COOKIE)

  const durationSeconds = session
    ? Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000)
    : 0

  await logAdminActivity({
    teacherId: session?.teacherId,
    actionType: 'view_as_end',
    performedBy: admin.email ?? admin.id,
    metadata: {
      target_teacher_id: session?.teacherId ?? null,
      target_teacher_email: session?.teacherEmail ?? null,
      duration_seconds: durationSeconds,
    },
  })

  return { success: true, data: { durationSeconds } }
}
