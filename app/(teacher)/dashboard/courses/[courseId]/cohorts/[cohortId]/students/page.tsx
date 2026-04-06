/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx
 *
 * Server Component. Displays enrolled students and waitlist management panel.
 * Teacher can view enrolled students, pending enrollments, and waitlist entries.
 */

import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCohortById } from '@/lib/db/cohorts'
import { getCourseById } from '@/lib/db/courses'
import { getEnrollmentsByCohort } from '@/lib/db/enrollments'
import { getWaitlistByCohort } from '@/lib/db/waitlist'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'

type StudentsPageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
}

export default async function CohortStudentsPage({ params }: StudentsPageProps) {
  const { courseId, cohortId } = await params
  const teacher = await requireTeacher()

  const [cohort, course] = await Promise.all([
    getCohortById(cohortId),
    getCourseById(courseId),
  ])

  if (!cohort || cohort.teacher_id !== teacher.id) {
    notFound()
  }

  if (!course || course.teacher_id !== teacher.id) {
    notFound()
  }

  const [enrollments, waitlistEntries] = await Promise.all([
    getEnrollmentsByCohort(cohortId),
    getWaitlistByCohort(cohortId),
  ])

  // Separate enrollments by status
  const activeEnrollments = enrollments.filter((e) => e.status === 'active')
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending')

  return (
    <>
      <PageHeader
        title={`Students — ${cohort.name}`}
        backHref={ROUTES.TEACHER.cohortDetail(courseId, cohortId)}
        description={`${course.title} — ${activeEnrollments.length} active, ${pendingEnrollments.length} pending`}
      />

      <div className="flex flex-col gap-6">
        {/* Active Students */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Active Students ({activeEnrollments.length})
          </h2>

          {activeEnrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active students yet.</p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {activeEnrollments.map((enrollment) => (
                  <div key={enrollment.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-medium text-foreground">{enrollment.students.name}</p>
                    <p className="text-muted-foreground">{enrollment.students.email}</p>
                    <p className="text-muted-foreground">{enrollment.students.phone}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-muted-foreground">{formatPKT(enrollment.created_at, 'date')}</span>
                      <StatusBadge status={enrollment.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Name</th>
                      <th className="pb-2 font-medium text-muted-foreground">Email</th>
                      <th className="pb-2 font-medium text-muted-foreground">Phone</th>
                      <th className="pb-2 font-medium text-muted-foreground">Enrolled</th>
                      <th className="pb-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEnrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="border-b border-border/50">
                        <td className="py-3 font-medium text-foreground">
                          {enrollment.students.name}
                        </td>
                        <td className="py-3 text-muted-foreground">{enrollment.students.email}</td>
                        <td className="py-3 text-muted-foreground">{enrollment.students.phone}</td>
                        <td className="py-3 text-muted-foreground">
                          {formatPKT(enrollment.created_at, 'date')}
                        </td>
                        <td className="py-3">
                          <StatusBadge status={enrollment.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Pending Enrollments */}
        {pendingEnrollments.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Pending Enrollments ({pendingEnrollments.length})
            </h2>

            <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {pendingEnrollments.map((enrollment) => (
                  <div key={enrollment.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-medium text-foreground">{enrollment.students.name}</p>
                    <p className="text-muted-foreground">{enrollment.students.email}</p>
                    <p className="text-muted-foreground">{enrollment.students.phone}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-muted-foreground">{formatPKT(enrollment.created_at, 'date')}</span>
                      <StatusBadge status={enrollment.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Name</th>
                      <th className="pb-2 font-medium text-muted-foreground">Email</th>
                      <th className="pb-2 font-medium text-muted-foreground">Phone</th>
                      <th className="pb-2 font-medium text-muted-foreground">Date</th>
                      <th className="pb-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEnrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="border-b border-border/50">
                        <td className="py-3 font-medium text-foreground">
                          {enrollment.students.name}
                        </td>
                        <td className="py-3 text-muted-foreground">{enrollment.students.email}</td>
                        <td className="py-3 text-muted-foreground">{enrollment.students.phone}</td>
                        <td className="py-3 text-muted-foreground">
                          {formatPKT(enrollment.created_at, 'date')}
                        </td>
                        <td className="py-3">
                          <StatusBadge status={enrollment.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          </Card>
        )}

        {/* Waitlist Management Panel */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Waitlist ({waitlistEntries.length})
            {!cohort.waitlist_enabled && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">(disabled)</span>
            )}
          </h2>

          {waitlistEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {cohort.waitlist_enabled
                ? 'No one is on the waitlist yet.'
                : 'Waitlist is disabled for this cohort. Enable it in cohort settings.'}
            </p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {waitlistEntries.map((entry) => (
                  <div key={entry.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">#{entry.position}</span>
                      <p className="font-medium text-foreground">{entry.student_name}</p>
                    </div>
                    <p className="text-muted-foreground">{entry.student_email}</p>
                    <p className="text-muted-foreground">{entry.student_phone}</p>
                    <p className="mt-1 text-muted-foreground">{formatPKT(entry.joined_at, 'datetime')}</p>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium text-muted-foreground">#</th>
                      <th className="pb-2 font-medium text-muted-foreground">Name</th>
                      <th className="pb-2 font-medium text-muted-foreground">Email</th>
                      <th className="pb-2 font-medium text-muted-foreground">Phone</th>
                      <th className="pb-2 font-medium text-muted-foreground">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlistEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/50">
                        <td className="py-3 text-muted-foreground">{entry.position}</td>
                        <td className="py-3 font-medium text-foreground">
                          {entry.student_name}
                        </td>
                        <td className="py-3 text-muted-foreground">{entry.student_email}</td>
                        <td className="py-3 text-muted-foreground">{entry.student_phone}</td>
                        <td className="py-3 text-muted-foreground">
                          {formatPKT(entry.joined_at, 'datetime')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
