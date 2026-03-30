import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/supabase/server'
import { sendEmail } from '@/lib/email/sender'
import { TIMING } from '@/constants/plans'

/**
 * GET /api/cron/fee-reminders
 *
 * Monthly cohort fee reminders sent 3 days before billing_day.
 * Runs daily via cron.
 *
 * Logic:
 * 1. Calculate target billing_day = today + 3 days
 * 2. Find monthly cohorts where billing_day matches
 * 3. For each cohort, get active enrollments with student emails
 * 4. Multi-teacher batching: if same student is in multiple cohorts,
 *    combine into one email
 */
export async function GET(request: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Calculate target billing day (today + FEE_REMINDER_DAYS_BEFORE)
    const now = new Date()
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + TIMING.FEE_REMINDER_DAYS_BEFORE)
    const targetBillingDay = targetDate.getDate()

    // billing_day is 1-28 only, skip if target exceeds 28
    if (targetBillingDay > TIMING.MAX_BILLING_DAY) {
      return NextResponse.json({ success: true, sent: 0, reason: 'Target billing day exceeds 28' })
    }

    console.log(`[cron:fee-reminders] Looking for cohorts with billing_day=${targetBillingDay}`)

    // Find monthly cohorts with matching billing_day
    const { data: cohorts, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, name, fee_pkr, billing_day, teacher_id')
      .eq('fee_type', 'monthly')
      .eq('billing_day', targetBillingDay)
      .in('status', ['active', 'upcoming'])
      .is('deleted_at', null)

    if (cohortError) {
      console.error('[cron:fee-reminders] Failed to fetch cohorts:', cohortError.message)
      return NextResponse.json({ success: false, error: cohortError.message }, { status: 500 })
    }

    if (!cohorts || cohorts.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: 'No cohorts match' })
    }

    const cohortIds = cohorts.map((c) => c.id as string)

    // Get active enrollments for these cohorts with student info
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('id, cohort_id, student_id, students!inner(id, name, email)')
      .in('cohort_id', cohortIds)
      .eq('status', 'active')

    if (enrollError) {
      console.error('[cron:fee-reminders] Failed to fetch enrollments:', enrollError.message)
      return NextResponse.json({ success: false, error: enrollError.message }, { status: 500 })
    }

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: 'No active enrollments' })
    }

    // Get teacher names for email content — filter out suspended teachers
    const teacherIds = [...new Set(cohorts.map((c) => c.teacher_id as string))]
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, name')
      .in('id', teacherIds)
      .eq('is_suspended', false)

    const teacherNameMap = new Map<string, string>()
    if (teachers) {
      for (const t of teachers) {
        teacherNameMap.set(t.id as string, t.name as string)
      }
    }

    // Filter out cohorts belonging to suspended teachers
    const activeTeacherIds = new Set(teacherNameMap.keys())
    const filteredCohortIds = new Set(
      cohorts
        .filter((c) => activeTeacherIds.has(c.teacher_id as string))
        .map((c) => c.id as string)
    )

    // Build cohort info map
    const cohortMap = new Map<string, { name: string; fee_pkr: number; billing_day: number; teacher_id: string }>()
    for (const c of cohorts) {
      cohortMap.set(c.id as string, {
        name: c.name as string,
        fee_pkr: c.fee_pkr as number,
        billing_day: c.billing_day as number,
        teacher_id: c.teacher_id as string,
      })
    }

    // Calculate the current billing month (YYYY-MM-01 format for the target date)
    const billingMonth = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-01`

    // Multi-teacher batching: group by student email
    type StudentReminder = {
      studentId: string
      studentName: string
      studentEmail: string
      cohortDetails: Array<{
        cohortName: string
        feePkr: number
        teacherName: string
        billingDay: number
      }>
    }

    const studentReminders = new Map<string, StudentReminder>()

    for (const enrollment of enrollments) {
      const student = enrollment.students as unknown as { id: string; name: string; email: string }
      const cohortId = enrollment.cohort_id as string
      const cohortInfo = cohortMap.get(cohortId)
      if (!cohortInfo || !student) continue

      // Skip cohorts belonging to suspended teachers
      if (!filteredCohortIds.has(cohortId)) continue

      // Check if payment already made for this billing month
      const enrollmentId = enrollment.id as string
      const { data: existingPayment } = await supabase
        .from('student_payments')
        .select('id')
        .eq('enrollment_id', enrollmentId)
        .eq('payment_month', billingMonth)
        .in('status', ['confirmed', 'pending_verification'])
        .limit(1)
        .maybeSingle()

      if (existingPayment) {
        // Payment already made or pending for this month — skip
        continue
      }

      const email = student.email
      if (!studentReminders.has(email)) {
        studentReminders.set(email, {
          studentId: student.id,
          studentName: student.name,
          studentEmail: email,
          cohortDetails: [],
        })
      }

      studentReminders.get(email)!.cohortDetails.push({
        cohortName: cohortInfo.name,
        feePkr: cohortInfo.fee_pkr,
        teacherName: teacherNameMap.get(cohortInfo.teacher_id) ?? 'Your Teacher',
        billingDay: cohortInfo.billing_day,
      })
    }

    // Send one combined email per student
    let sentCount = 0
    for (const [, reminder] of studentReminders) {
      const cohortSummary = reminder.cohortDetails
        .map((c) => `${c.cohortName} (Rs. ${c.feePkr.toLocaleString('en-PK')}) — ${c.teacherName}`)
        .join(', ')

      await sendEmail({
        to: reminder.studentEmail,
        type: 'fee_reminder',
        recipientId: reminder.studentId,
        recipientType: 'student',
        data: {
          studentName: reminder.studentName,
          cohortSummary,
          billingDay: reminder.cohortDetails[0].billingDay,
          cohortCount: reminder.cohortDetails.length,
        },
      })
      sentCount++
    }

    console.log(`[cron:fee-reminders] Done. Sent ${sentCount} fee reminder emails`)
    return NextResponse.json({ success: true, sent: sentCount })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[cron:fee-reminders] Unexpected error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
