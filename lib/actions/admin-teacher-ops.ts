'use server'

// =============================================================================
// lib/actions/admin-teacher-ops.ts — Password reset + view-as start (Server Actions)
// =============================================================================

import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { logAdminActivity } from '@/lib/db/admin'
import {
  makeViewAsSession,
  buildViewAsCookieValue,
  VIEW_AS_COOKIE,
} from '@/lib/admin/view-as-session'
import { cookies } from 'next/headers'
import type { ApiResponse } from '@/types/api'

const COOKIE_MAX_AGE = 30 * 60

// -----------------------------------------------------------------------------
// generatePasswordResetLinkAction — Supabase Auth admin recovery link
// -----------------------------------------------------------------------------
export async function generatePasswordResetLinkAction(
  teacherId: string
): Promise<ApiResponse<{ resetLink: string }>> {
  const admin = await requireAdmin()
  const supabase = createAdminClient()

  const { data: teacher, error: fetchError } = await supabase
    .from('teachers')
    .select('id, email')
    .eq('id', teacherId)
    .single()

  if (fetchError || !teacher) {
    return { success: false, error: 'Teacher not found.' }
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: teacher.email as string,
  })

  if (linkError || !linkData?.properties?.action_link) {
    return { success: false, error: 'Failed to generate recovery link.' }
  }

  await logAdminActivity({
    teacherId,
    actionType: 'password_reset_generated',
    performedBy: admin.email ?? admin.id,
    metadata: {
      teacher_id: teacherId,
      teacher_email: teacher.email as string,
    },
  })

  return { success: true, data: { resetLink: linkData.properties.action_link } }
}

// -----------------------------------------------------------------------------
// startViewAsActionClient — Called from TeacherDetailActions client component
// -----------------------------------------------------------------------------
export async function startViewAsActionClient(
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
