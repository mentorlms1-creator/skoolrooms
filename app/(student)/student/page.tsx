/**
 * app/(student)/student/page.tsx — Student dashboard
 *
 * Server Component. Shows upcoming classes grouped by teacher,
 * with Meet links, date/time in PKT, cohort name, and course title.
 * Uses getUpcomingSessionsByStudent from lib/db/class-sessions.ts.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireStudent } from '@/lib/auth/guards'
import { getUpcomingSessionsByStudent } from '@/lib/db/class-sessions'
import type { StudentSessionWithDetails } from '@/lib/db/class-sessions'
import { getEnrollmentsByStudentWithTeacher } from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPKT } from '@/lib/time/pkt'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Dashboard \u2014 Lumscribe Student',
}

export default async function StudentDashboardPage() {
  const student = await requireStudent()

  // Fetch upcoming sessions (limit 20 for dashboard)
  const [sessions, enrollments] = await Promise.all([
    getUpcomingSessionsByStudent(student.id, 20),
    getEnrollmentsByStudentWithTeacher(student.id),
  ])

  // Count active enrollments for summary
  const activeEnrollments = enrollments.filter((e) => e.status === 'active')

  // Group sessions by teacher
  const sessionsByTeacher = new Map<string, {
    teacherName: string
    sessions: StudentSessionWithDetails[]
  }>()

  for (const session of sessions) {
    const teacherId = session.cohorts.teachers.id
    const existing = sessionsByTeacher.get(teacherId)
    if (existing) {
      existing.sessions.push(session)
    } else {
      sessionsByTeacher.set(teacherId, {
        teacherName: session.cohorts.teachers.name,
        sessions: [session],
      })
    }
  }

  return (
    <>
      <PageHeader
        title={`Welcome back, ${student.name.split(' ')[0]}`}
        description="Here are your upcoming classes"
      />

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Active Courses</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {activeEnrollments.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Upcoming Classes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{sessions.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Quick Links</p>
          <div className="mt-1 flex gap-3">
            <Link
              href={ROUTES.STUDENT.courses}
              className="text-sm font-medium text-primary hover:text-primary/90"
            >
              My Courses
            </Link>
            <Link
              href={ROUTES.STUDENT.schedule}
              className="text-sm font-medium text-primary hover:text-primary/90"
            >
              Full Schedule
            </Link>
          </div>
        </Card>
      </div>

      {/* Upcoming classes grouped by teacher */}
      {sessionsByTeacher.size === 0 ? (
        <EmptyState
          title="No upcoming classes"
          description="You don't have any upcoming classes scheduled. Check your courses to see your enrollment status."
          action={
            <Link
              href={ROUTES.STUDENT.courses}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              View My Courses
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {Array.from(sessionsByTeacher.entries()).map(
            ([teacherId, { teacherName, sessions: teacherSessions }]) => (
              <div key={teacherId}>
                <h2 className="mb-3 text-lg font-semibold text-foreground">
                  {teacherName}
                </h2>
                <div className="space-y-3">
                  {teacherSessions.map((session) => (
                    <Card key={session.id} className="p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {session.cohorts.courses.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {session.cohorts.name}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatPKT(session.scheduled_at, 'datetime')} &middot;{' '}
                            {session.duration_minutes} min
                          </p>
                        </div>
                        {session.meet_link && (
                          <a
                            href={session.meet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                          >
                            Join Class
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </>
  )
}
