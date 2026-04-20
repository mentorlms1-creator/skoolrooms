/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/attendance/page.tsx
 * Server Component — Attendance page for a cohort
 *
 * Fetches past/non-cancelled sessions, enrollments, and attendance records.
 * Renders per-session attendance marking grid + summary per student.
 */

import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCohortById } from '@/lib/db/cohorts'
import { getSessionsByCohort } from '@/lib/db/class-sessions'
import { getEnrollmentsByCohort } from '@/lib/db/enrollments'
import {
  getAttendanceByCohortSession,
  isAttendanceEditable,
} from '@/lib/db/attendance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'
import { AttendanceGrid } from './attendance-grid'
import { AttendanceSummaryTable } from './attendance-summary'

type PageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
}

export default async function AttendancePage({ params }: PageProps) {
  const { courseId, cohortId } = await params
  const teacher = await requireTeacher()

  // Fetch cohort and verify ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id || cohort.course_id !== courseId) {
    notFound()
  }

  const isArchived = cohort.status === 'archived'

  // Fetch all sessions and enrollments
  const [allSessions, enrollments] = await Promise.all([
    getSessionsByCohort(cohortId),
    getEnrollmentsByCohort(cohortId),
  ])

  const activeEnrollments = enrollments.filter((e) => e.status === 'active')
  const now = new Date()

  // Split sessions into past and future. Only show past sessions for attendance.
  const pastSessions = allSessions.filter(
    (s) => new Date(s.scheduled_at) <= now
  )

  // Fetch attendance records for all past sessions
  const sessionsWithAttendance = await Promise.all(
    pastSessions.map(async (session) => {
      const isCancelled = session.cancelled_at !== null
      const records = isCancelled
        ? []
        : await getAttendanceByCohortSession(session.id)

      // Check if attendance has been marked for this session
      const hasAttendance = records.length > 0

      // Check edit window: if marked, is the earliest marked_at within 24h?
      let withinWindow = true
      if (hasAttendance) {
        const firstMarkedAt = records[0].marked_at
        withinWindow = isAttendanceEditable(firstMarkedAt)
      }

      // Build student-level data
      const attendanceMap = new Map<string, boolean>()
      for (const r of records) {
        attendanceMap.set(r.student_id, r.present)
      }

      return {
        id: session.id,
        scheduledAt: session.scheduled_at,
        durationMinutes: session.duration_minutes,
        isCancelled,
        hasAttendance,
        editable: !isCancelled && withinWindow && !isArchived,
        // Past 24h window but cohort is still active — teacher can edit with a reason.
        pastEditWindow: !isCancelled && hasAttendance && !withinWindow && !isArchived,
        attendanceMap: Object.fromEntries(attendanceMap) as Record<string, boolean>,
      }
    })
  )

  // Build student list
  const students = activeEnrollments.map((e) => ({
    id: e.students.id,
    name: e.students.name,
  }))

  // Compute attendance summary per student
  // Only count non-cancelled sessions in the denominator
  const nonCancelledSessions = sessionsWithAttendance.filter((s) => !s.isCancelled)
  const totalNonCancelledSessions = nonCancelledSessions.length

  const studentSummaries = students.map((student) => {
    let attended = 0
    for (const session of nonCancelledSessions) {
      if (session.attendanceMap[student.id] === true) {
        attended++
      }
    }
    return {
      id: student.id,
      name: student.name,
      attended,
      total: totalNonCancelledSessions,
      percentage:
        totalNonCancelledSessions > 0
          ? Math.round((attended / totalNonCancelledSessions) * 100)
          : 0,
    }
  })

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`Track attendance for ${cohort.name}`}
        backHref={ROUTES.TEACHER.cohortDetail(courseId, cohortId)}
      />

      {isArchived && (
        <div className="mb-6 rounded-md border border-border bg-muted/5 p-4 text-sm text-muted-foreground">
          This cohort is archived. Attendance records are read-only.
        </div>
      )}

      {pastSessions.length === 0 && (
        <Card>
          <EmptyState
            title="No past sessions yet"
            description="Attendance can be marked after a class session has taken place."
          />
        </Card>
      )}

      {pastSessions.length > 0 && students.length === 0 && (
        <Card>
          <EmptyState
            title="No enrolled students"
            description="Students need to be enrolled before attendance can be marked."
          />
        </Card>
      )}

      {/* Per-session attendance grids */}
      {pastSessions.length > 0 && students.length > 0 && (
        <div className="flex flex-col gap-6">
          {sessionsWithAttendance.map((session) => (
            <Card key={session.id} className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {formatPKT(session.scheduledAt, 'datetime')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {session.durationMinutes} min
                  </p>
                </div>
                {session.isCancelled && (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                    Cancelled
                  </span>
                )}
                {!session.isCancelled && session.hasAttendance && !session.editable && !session.pastEditWindow && (
                  <span className="rounded-full bg-muted/10 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Locked
                  </span>
                )}
                {session.pastEditWindow && (
                  <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                    Edit requires reason
                  </span>
                )}
              </div>

              {session.isCancelled ? (
                <p className="text-sm text-muted-foreground">
                  Cancelled sessions are excluded from attendance tracking.
                </p>
              ) : (
                <AttendanceGrid
                  sessionId={session.id}
                  students={students}
                  existingAttendance={session.attendanceMap}
                  editable={session.editable}
                  pastEditWindow={session.pastEditWindow}
                  hasExistingData={session.hasAttendance}
                />
              )}
            </Card>
          ))}

          {/* Summary table */}
          {totalNonCancelledSessions > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Attendance Summary
              </h2>
              <AttendanceSummaryTable summaries={studentSummaries} />
            </Card>
          )}
        </div>
      )}
    </>
  )
}
