import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'
import { sendEmail } from '@/lib/email/sender'

/**
 * GET /api/cron/class-reminders
 *
 * Hourly cron. Sends class reminders:
 * - 24h reminder: sessions scheduled between 23-25 hours from now
 * - 1h reminder: sessions scheduled between 30min-1.5h from now
 *
 * Only non-cancelled sessions. Sends to all actively enrolled students.
 */
export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()

    // 24h window: sessions between 23h and 25h from now
    const window24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString()
    const window24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString()

    // 1h window: sessions between 30min and 1.5h from now
    const window1hStart = new Date(now.getTime() + 30 * 60 * 1000).toISOString()
    const window1hEnd = new Date(now.getTime() + 90 * 60 * 1000).toISOString()

    let totalSent = 0

    // --- 24h reminders ---
    const { data: sessions24h, error: err24h } = await supabase
      .from('class_sessions')
      .select('id, cohort_id, meet_link, scheduled_at, duration_minutes')
      .gte('scheduled_at', window24hStart)
      .lte('scheduled_at', window24hEnd)
      .is('cancelled_at', null)
      .is('deleted_at', null)

    if (err24h) {
      console.error('[cron:class-reminders] Failed to fetch 24h sessions:', err24h.message)
    }

    if (sessions24h && sessions24h.length > 0) {
      const sent = await sendReminders(supabase, sessions24h, 'class_reminder_24h')
      totalSent += sent
    }

    // --- 1h reminders ---
    const { data: sessions1h, error: err1h } = await supabase
      .from('class_sessions')
      .select('id, cohort_id, meet_link, scheduled_at, duration_minutes')
      .gte('scheduled_at', window1hStart)
      .lte('scheduled_at', window1hEnd)
      .is('cancelled_at', null)
      .is('deleted_at', null)

    if (err1h) {
      console.error('[cron:class-reminders] Failed to fetch 1h sessions:', err1h.message)
    }

    if (sessions1h && sessions1h.length > 0) {
      const sent = await sendReminders(supabase, sessions1h, 'class_reminder_1h')
      totalSent += sent
    }

    console.log(`[cron:class-reminders] Done. Sent ${totalSent} reminder emails`)
    return NextResponse.json({ success: true, sent: totalSent })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:class-reminders] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>

type SessionData = {
  id: string
  cohort_id: string
  meet_link: string
  scheduled_at: string
  duration_minutes: number
}

async function sendReminders(
  supabase: SupabaseAdmin,
  sessions: Array<Record<string, unknown>>,
  emailType: 'class_reminder_24h' | 'class_reminder_1h',
): Promise<number> {
  let sentCount = 0
  const cohortIds = [...new Set(sessions.map((s) => s.cohort_id as string))]

  // Get cohort names and teacher info
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, name, teacher_id')
    .in('id', cohortIds)

  const cohortMap = new Map<string, { name: string; teacher_id: string }>()
  if (cohorts) {
    for (const c of cohorts) {
      cohortMap.set(c.id as string, {
        name: c.name as string,
        teacher_id: c.teacher_id as string,
      })
    }
  }

  // Get teacher names
  const teacherIds = [...new Set([...cohortMap.values()].map((c) => c.teacher_id))]
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name')
    .in('id', teacherIds)

  const teacherNameMap = new Map<string, string>()
  if (teachers) {
    for (const t of teachers) {
      teacherNameMap.set(t.id as string, t.name as string)
    }
  }

  // Get active enrollments for these cohorts
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('cohort_id, students!inner(id, name, email)')
    .in('cohort_id', cohortIds)
    .eq('status', 'active')

  if (!enrollments || enrollments.length === 0) return 0

  for (const session of sessions) {
    const typedSession: SessionData = {
      id: session.id as string,
      cohort_id: session.cohort_id as string,
      meet_link: session.meet_link as string,
      scheduled_at: session.scheduled_at as string,
      duration_minutes: session.duration_minutes as number,
    }

    const cohortInfo = cohortMap.get(typedSession.cohort_id)
    if (!cohortInfo) continue

    const teacherName = teacherNameMap.get(cohortInfo.teacher_id) ?? 'Your Teacher'

    // Find enrollments for this session's cohort
    const cohortEnrollments = enrollments.filter(
      (e) => (e.cohort_id as string) === typedSession.cohort_id,
    )

    for (const enrollment of cohortEnrollments) {
      const student = enrollment.students as unknown as { id: string; name: string; email: string }
      if (!student) continue

      await sendEmail({
        to: student.email,
        type: emailType,
        recipientId: student.id,
        recipientType: 'student',
        data: {
          studentName: student.name,
          teacherName,
          cohortName: cohortInfo.name,
          scheduledAt: typedSession.scheduled_at,
          meetLink: typedSession.meet_link,
          durationMinutes: typedSession.duration_minutes,
        },
      })
      sentCount++
    }
  }

  return sentCount
}
