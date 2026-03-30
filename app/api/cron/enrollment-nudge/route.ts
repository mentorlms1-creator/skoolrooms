import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'
import { sendEmail } from '@/lib/email/sender'

/**
 * GET /api/cron/enrollment-nudge
 *
 * Daily cron. Finds student_payments with status='pending_verification'
 * created more than 24h ago. Sends a nudge email to the teacher
 * reminding them to verify the screenshot.
 */
export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Payments pending verification for more than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: payments, error: paymentError } = await supabase
      .from('student_payments')
      .select(`
        id, amount_pkr, created_at,
        enrollments!inner(
          id, student_id, cohort_id,
          students!inner(id, name, email),
          cohorts!inner(id, name, teacher_id)
        )
      `)
      .eq('status', 'pending_verification')
      .lt('created_at', cutoff)

    if (paymentError) {
      console.error('[cron:enrollment-nudge] Failed to fetch payments:', paymentError.message)
      return NextResponse.json({ success: false, error: paymentError.message }, { status: 500 })
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: 'No pending payments older than 24h' })
    }

    // Group by teacher to send consolidated nudges
    type NudgeInfo = {
      teacherId: string
      teacherEmail: string
      teacherName: string
      pendingPayments: Array<{
        studentName: string
        cohortName: string
        amountPkr: number
        createdAt: string
      }>
    }

    const teacherNudges = new Map<string, NudgeInfo>()

    // Collect teacher IDs for batch lookup
    const teacherIds = new Set<string>()
    for (const payment of payments) {
      const enrollment = payment.enrollments as unknown as {
        cohorts: { teacher_id: string }
      }
      teacherIds.add(enrollment.cohorts.teacher_id)
    }

    // Fetch teacher info
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, name, email')
      .in('id', [...teacherIds])

    const teacherMap = new Map<string, { name: string; email: string }>()
    if (teachers) {
      for (const t of teachers) {
        teacherMap.set(t.id as string, {
          name: t.name as string,
          email: t.email as string,
        })
      }
    }

    for (const payment of payments) {
      const enrollment = payment.enrollments as unknown as {
        students: { id: string; name: string; email: string }
        cohorts: { id: string; name: string; teacher_id: string }
      }

      const teacherId = enrollment.cohorts.teacher_id
      const teacherInfo = teacherMap.get(teacherId)
      if (!teacherInfo) continue

      if (!teacherNudges.has(teacherId)) {
        teacherNudges.set(teacherId, {
          teacherId,
          teacherEmail: teacherInfo.email,
          teacherName: teacherInfo.name,
          pendingPayments: [],
        })
      }

      teacherNudges.get(teacherId)!.pendingPayments.push({
        studentName: enrollment.students.name,
        cohortName: enrollment.cohorts.name,
        amountPkr: payment.amount_pkr as number,
        createdAt: payment.created_at as string,
      })
    }

    // Send one email per teacher
    let sentCount = 0
    for (const [, nudge] of teacherNudges) {
      const paymentSummary = nudge.pendingPayments
        .map(
          (p) =>
            `${p.studentName} — ${p.cohortName} — Rs. ${p.amountPkr.toLocaleString('en-PK')}`,
        )
        .join('; ')

      await sendEmail({
        to: nudge.teacherEmail,
        type: 'enrollment_unverified_24h',
        recipientId: nudge.teacherId,
        recipientType: 'teacher',
        data: {
          teacherName: nudge.teacherName,
          pendingCount: nudge.pendingPayments.length,
          paymentSummary,
        },
      })
      sentCount++
    }

    console.log(`[cron:enrollment-nudge] Done. Sent ${sentCount} nudge emails to teachers`)
    return NextResponse.json({ success: true, sent: sentCount })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:enrollment-nudge] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
