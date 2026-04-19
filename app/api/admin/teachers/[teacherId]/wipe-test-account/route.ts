// =============================================================================
// app/api/admin/teachers/[teacherId]/wipe-test-account/route.ts
// POST — Wipe all data for a test account (admin only, confirmation required)
// Guard: teacher email must contain '+test' or end with '@test.skoolrooms.com'
// Body: { confirmation_email: string } — must equal teacher email
// =============================================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/supabase/server'
import { logAdminActivity } from '@/lib/db/admin'

function isTestAccount(email: string): boolean {
  return email.includes('+test') || email.endsWith('@test.skoolrooms.com')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  const admin = await requireAdmin()
  const { teacherId } = await params
  const body = (await request.json()) as { confirmation_email?: string }

  const supabase = createAdminClient()

  const { data: teacher, error: fetchError } = await supabase
    .from('teachers')
    .select('id, email, supabase_auth_id')
    .eq('id', teacherId)
    .single()

  if (fetchError || !teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  }

  const email = teacher.email as string

  // Guard 1: Must be a test account
  if (!isTestAccount(email)) {
    return NextResponse.json({ error: 'NOT_TEST_ACCOUNT' }, { status: 403 })
  }

  // Guard 2: Confirmation token
  if (body.confirmation_email !== email) {
    return NextResponse.json({ error: 'CONFIRMATION_MISMATCH' }, { status: 400 })
  }

  // Log BEFORE deleting so audit trail survives partial failure
  await logAdminActivity({
    actionType: 'wipe_test_account',
    performedBy: admin.email ?? admin.id,
    metadata: { teacher_id: teacherId, teacher_email: email },
  })

  // Delete in FK-dependency order
  // 1. assignment_submissions
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id')
    .eq('teacher_id', teacherId)

  const cohortIds = (cohorts ?? []).map((c) => c.id as string)

  if (cohortIds.length > 0) {
    const { data: classSessions } = await supabase
      .from('class_sessions')
      .select('id')
      .in('cohort_id', cohortIds)

    const sessionIds = (classSessions ?? []).map((s) => s.id as string)

    if (sessionIds.length > 0) {
      await supabase.from('attendance').delete().in('class_session_id', sessionIds)
    }

    const { data: assignments } = await supabase
      .from('assignments')
      .select('id')
      .in('cohort_id', cohortIds)

    const assignmentIds = (assignments ?? []).map((a) => a.id as string)
    if (assignmentIds.length > 0) {
      await supabase.from('assignment_submissions').delete().in('assignment_id', assignmentIds)
    }

    const { data: announcements } = await supabase
      .from('announcements')
      .select('id')
      .in('cohort_id', cohortIds)

    const announcementIds = (announcements ?? []).map((a) => a.id as string)
    if (announcementIds.length > 0) {
      await supabase.from('announcement_reads').delete().in('announcement_id', announcementIds)
      await supabase.from('announcement_comments').delete().in('announcement_id', announcementIds)
    }

    await supabase.from('announcements').delete().in('cohort_id', cohortIds)
    await supabase.from('assignments').delete().in('cohort_id', cohortIds)
    await supabase.from('class_sessions').delete().in('cohort_id', cohortIds)

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id')
      .in('cohort_id', cohortIds)

    const enrollmentIds = (enrollments ?? []).map((e) => e.id as string)
    if (enrollmentIds.length > 0) {
      await supabase.from('student_payments').delete().in('enrollment_id', enrollmentIds)
    }

    await supabase.from('enrollments').delete().in('cohort_id', cohortIds)
    await supabase.from('cohorts').delete().eq('teacher_id', teacherId)
  }

  await supabase.from('courses').delete().eq('teacher_id', teacherId)
  await supabase.from('teacher_subscriptions').delete().eq('teacher_id', teacherId)
  await supabase.from('teacher_plan_snapshot').delete().eq('teacher_id', teacherId)
  await supabase.from('teacher_balances').delete().eq('teacher_id', teacherId)
  await supabase.from('teacher_payment_settings').delete().eq('teacher_id', teacherId)
  // admin_activity_log rows intentionally NOT deleted (audit trail)

  // R2 file cleanup is best-effort (we don't have a list-by-prefix helper yet).
  // Files will be orphaned but not affect data integrity.
  // TODO: add listObjectsByPrefix to lib/r2/upload.ts and clean up here.

  await supabase.from('teachers').delete().eq('id', teacherId)

  // Delete Supabase Auth user
  const authId = teacher.supabase_auth_id as string
  if (authId) {
    await supabase.auth.admin.deleteUser(authId)
  }

  return NextResponse.json({ success: true })
}
