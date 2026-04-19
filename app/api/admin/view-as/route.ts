// =============================================================================
// app/api/admin/view-as/route.ts
// POST — Start view-as session (set cookie + log)
// DELETE — End view-as session (clear cookie + log)
// =============================================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { logAdminActivity } from '@/lib/db/admin'
import {
  makeViewAsSession,
  buildViewAsCookieValue,
  getViewAsSession,
  VIEW_AS_COOKIE,
} from '@/lib/admin/view-as-session'
import { cookies } from 'next/headers'

const COOKIE_MAX_AGE = 30 * 60 // seconds

export async function POST(request: Request) {
  const admin = await requireAdmin()
  const { teacherId } = (await request.json()) as { teacherId: string }

  if (!teacherId) {
    return NextResponse.json({ error: 'teacherId required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('id, email')
    .eq('id', teacherId)
    .single()

  if (error || !teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
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

  return NextResponse.json({ success: true, teacherEmail: teacher.email as string })
}

export async function DELETE() {
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

  return NextResponse.json({ success: true, durationSeconds })
}
