import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require('@react-pdf/renderer') as { renderToBuffer: (element: unknown) => Promise<Buffer> }
import { createElement } from 'react'
import { createClient } from '@/supabase/server'
import { createAdminClient } from '@/supabase/server'
import { getTeacherByAuthId } from '@/lib/db/teachers'
import { getAttendanceTimelineForStudent } from '@/lib/db/attendance'
import {
  getAssignmentsByCohort,
  getSubmissionsByStudentForCohort,
} from '@/lib/db/assignments'
import { formatPKT, monthlyBillingSchedule } from '@/lib/time/pkt'
import { ProgressReportDocument } from '@/components/teacher/ProgressReportDocument'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> },
) {
  const { enrollmentId } = await params

  // Auth: require teacher session via cookie
  const supabaseClient = await createClient()
  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teacher = await getTeacherByAuthId(user.id)
  if (!teacher) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  type EnrollmentForReport = {
    id: string
    student_id: string
    cohort_id: string
    status: string
    students: { id: string; name: string; email: string }
    cohorts: {
      id: string
      name: string
      start_date: string
      end_date: string
      fee_type: string
      fee_pkr: number
      billing_day: number | null
      teacher_id: string
      courses: { id: string; title: string }
    }
  }

  // Fetch enrollment with cohort + course + student info
  const { data: rawEnrollment, error: enrollError } = await supabase
    .from('enrollments')
    .select(`
      id, student_id, cohort_id, status,
      students!inner(id, name, email),
      cohorts!inner(
        id, name, start_date, end_date, fee_type, fee_pkr, billing_day, teacher_id,
        courses!inner(id, title)
      )
    `)
    .eq('id', enrollmentId)
    .single()

  if (enrollError || !rawEnrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const typedEnrollment = rawEnrollment as unknown as EnrollmentForReport

  // Ownership check: enrollment's cohort must belong to this teacher
  if (typedEnrollment.cohorts.teacher_id !== teacher.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cohort = typedEnrollment.cohorts
  const student = typedEnrollment.students

  // Canonical attendance source (shared with student progress dialog — Lane E2)
  const attendanceTimeline = await getAttendanceTimelineForStudent(student.id, cohort.id)
  const nonCancelledTimeline = attendanceTimeline.filter((e) => !e.cancelled)
  const attendanceSummary = {
    total: nonCancelledTimeline.length,
    attended: nonCancelledTimeline.filter((e) => e.present).length,
  }

  // Fetch assignments and per-student submissions
  const assignments = await getAssignmentsByCohort(cohort.id)
  const assignmentIds = assignments.map((a) => a.id)
  const submissionsMap = await getSubmissionsByStudentForCohort(student.id, assignmentIds)

  const today = new Date().toISOString()

  const assignmentSummary = assignments.map((a) => {
    const submission = submissionsMap.get(a.id)
    const isPastDue = a.due_date < today
    let status: 'submitted' | 'reviewed' | 'overdue' | 'not_submitted'
    if (submission) {
      status = submission.status as 'submitted' | 'reviewed' | 'overdue'
    } else if (isPastDue) {
      status = 'not_submitted'
    } else {
      status = 'not_submitted'
    }
    return {
      title: a.title,
      dueDate: formatPKT(a.due_date, 'date'),
      status,
    }
  })

  // Fetch payments for this enrollment
  const { data: payments } = await supabase
    .from('student_payments')
    .select('id, payment_month, status')
    .eq('enrollment_id', enrollmentId)
    .order('payment_month', { ascending: true })

  const isMonthly = cohort.fee_type === 'monthly'

  // Build payment summary
  let paymentSummary: { month: string; status: 'paid' | 'pending' | 'overdue' }[] = []

  if (isMonthly && cohort.billing_day) {
    const effectiveEnd = cohort.end_date < today.split('T')[0] ? cohort.end_date : today.split('T')[0]
    const billingMonths = monthlyBillingSchedule(cohort.start_date, effectiveEnd)

    const confirmedMonths = new Set<string>()
    const pendingMonths = new Set<string>()
    if (payments) {
      for (const p of payments as Array<{ payment_month: string | null; status: string }>) {
        if (p.payment_month) {
          if (p.status === 'confirmed') confirmedMonths.add(p.payment_month)
          else if (p.status === 'pending_verification') pendingMonths.add(p.payment_month)
        }
      }
    }

    const todayDateStr = today.split('T')[0]
    paymentSummary = billingMonths.map((month) => {
      const billingDayStr = String(cohort.billing_day).padStart(2, '0')
      const monthStr = month.slice(0, 7)
      const dueDateStr = `${monthStr}-${billingDayStr}`
      let status: 'paid' | 'pending' | 'overdue'
      if (confirmedMonths.has(month)) {
        status = 'paid'
      } else if (pendingMonths.has(month)) {
        status = 'pending'
      } else if (dueDateStr < todayDateStr) {
        status = 'overdue'
      } else {
        status = 'pending'
      }
      return { month: monthStr, status }
    })
  } else if (!isMonthly) {
    const confirmed = (payments as Array<{ status: string }> | null)?.some(
      (p) => p.status === 'confirmed',
    )
    const pending = (payments as Array<{ status: string }> | null)?.some(
      (p) => p.status === 'pending_verification',
    )
    paymentSummary = [
      {
        month: 'One-time',
        status: confirmed ? 'paid' : pending ? 'pending' : 'overdue',
      },
    ]
  }

  const generatedAt = formatPKT(new Date(), 'datetime')
  const startDate = formatPKT(cohort.start_date, 'date')
  const endDate = formatPKT(cohort.end_date, 'date')

  const pdfElement = createElement(ProgressReportDocument, {
    studentName: student.name,
    cohortName: cohort.name,
    courseName: cohort.courses.title,
    teacherName: teacher.name,
    startDate,
    endDate,
    totalSessions: attendanceSummary.total,
    attendedSessions: attendanceSummary.attended,
    assignments: assignmentSummary,
    payments: paymentSummary,
    isMonthly,
    generatedAt,
  })

  const pdfBuffer = await renderToBuffer(pdfElement)

  const safeStudentName = student.name.replace(/[^a-zA-Z0-9]/g, '-')
  const safeCohortName = cohort.name.replace(/[^a-zA-Z0-9]/g, '-')

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="progress-${safeStudentName}-${safeCohortName}.pdf"`,
    },
  })
}
