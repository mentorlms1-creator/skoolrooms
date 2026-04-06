/**
 * app/(student)/student/courses/page.tsx — Student enrolled courses
 *
 * Server Component. Shows enrolled courses grouped by teacher.
 * For each enrollment: course title, cohort name, status badge, teacher name.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Calendar, Banknote, ArrowRight } from 'lucide-react'
import { requireStudent } from '@/lib/auth/guards'
import { getEnrollmentsByStudentWithTeacher } from '@/lib/db/enrollments'
import type { EnrollmentWithCohortCourseTeacher } from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPKT } from '@/lib/time/pkt'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'My Courses \u2014 Skool Rooms Student',
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
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {teacherEnrollments.map((enrollment) => (
                    <Link
                      key={enrollment.id}
                      href={ROUTES.STUDENT.enrollmentDetail(enrollment.id)}
                    >
                      <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="px-8 pt-8 pb-8">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <BookOpen className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-foreground truncate">
                                  {enrollment.cohorts.courses.title}
                                </h3>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                  {enrollment.cohorts.name}
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={enrollment.status} size="sm" />
                          </div>

                          <div className="mt-5 space-y-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>
                                {formatPKT(enrollment.cohorts.start_date, 'date')} &ndash;{' '}
                                {formatPKT(enrollment.cohorts.end_date, 'date')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Banknote className="h-3.5 w-3.5" />
                              <span>
                                PKR {enrollment.cohorts.fee_pkr.toLocaleString()} (
                                {enrollment.cohorts.fee_type === 'monthly'
                                  ? 'Monthly'
                                  : 'One-time'}
                                )
                              </span>
                            </div>
                          </div>

                          {enrollment.cohorts.courses.description && (
                            <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
                              {enrollment.cohorts.courses.description}
                            </p>
                          )}

                          <div className="mt-5 flex items-center justify-between">
                            <StatusBadge
                              status={enrollment.cohorts.status}
                              size="sm"
                            />
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                              View Details
                              <ArrowRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </CardContent>
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
