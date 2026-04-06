/**
 * app/(student)/student/courses/page.tsx — Student enrolled courses
 *
 * Server Component. Shows enrolled courses grouped by teacher.
 * For each enrollment: course title, cohort name, status badge, teacher name.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireStudent } from '@/lib/auth/guards'
import { getEnrollmentsByStudentWithTeacher } from '@/lib/db/enrollments'
import type { EnrollmentWithCohortCourseTeacher } from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPKT } from '@/lib/time/pkt'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'My Courses \u2014 Lumscribe Student',
}

export default async function StudentCoursesPage() {
  const student = await requireStudent()
  const enrollments = await getEnrollmentsByStudentWithTeacher(student.id)

  // Group by teacher
  const enrollmentsByTeacher = new Map<
    string,
    {
      teacherName: string
      enrollments: EnrollmentWithCohortCourseTeacher[]
    }
  >()

  for (const enrollment of enrollments) {
    const teacherId = enrollment.cohorts.teachers.id
    const existing = enrollmentsByTeacher.get(teacherId)
    if (existing) {
      existing.enrollments.push(enrollment)
    } else {
      enrollmentsByTeacher.set(teacherId, {
        teacherName: enrollment.cohorts.teachers.name,
        enrollments: [enrollment],
      })
    }
  }

  return (
    <>
      <PageHeader
        title="My Courses"
        description="All courses you are enrolled in"
      />

      {enrollments.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="You haven't enrolled in any courses yet. Ask your teacher for an invite link to get started."
        />
      ) : (
        <div className="space-y-8">
          {Array.from(enrollmentsByTeacher.entries()).map(
            ([teacherId, { teacherName, enrollments: teacherEnrollments }]) => (
              <div key={teacherId}>
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  {teacherName}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {teacherEnrollments.map((enrollment) => (
                    <Link
                      key={enrollment.id}
                      href={ROUTES.STUDENT.enrollmentDetail(enrollment.id)}
                    >
                      <Card className="p-5" hover>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-foreground truncate">
                              {enrollment.cohorts.courses.title}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {enrollment.cohorts.name}
                            </p>
                          </div>
                          <StatusBadge status={enrollment.status} size="sm" />
                        </div>

                        <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                          <p>
                            {formatPKT(enrollment.cohorts.start_date, 'date')} &ndash;{' '}
                            {formatPKT(enrollment.cohorts.end_date, 'date')}
                          </p>
                          <p>
                            Fee: PKR {enrollment.cohorts.fee_pkr.toLocaleString()} (
                            {enrollment.cohorts.fee_type === 'monthly'
                              ? 'Monthly'
                              : 'One-time'}
                            )
                          </p>
                          <p>
                            Cohort status:{' '}
                            <StatusBadge
                              status={enrollment.cohorts.status}
                              size="sm"
                            />
                          </p>
                        </div>

                        {enrollment.cohorts.courses.description && (
                          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                            {enrollment.cohorts.courses.description}
                          </p>
                        )}
                      </Card>
                    </Link>
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
