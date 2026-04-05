/**
 * app/(teacher)/dashboard/courses/[courseId]/page.tsx — Course detail page
 *
 * Server Component. Displays course info with thumbnail, description,
 * status badge, edit link, and cohort list.
 * HTML content is sanitized before rendering to prevent XSS.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCourseById } from '@/lib/db/courses'
import {
  getCohortsByCourse,
  getActiveEnrollmentCount,
  computeCohortDisplayStatus,
} from '@/lib/db/cohorts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { CohortCard } from '@/components/teacher/CohortCard'
import { ROUTES } from '@/constants/routes'
import sanitizeHtml from 'sanitize-html'

export const metadata: Metadata = {
  title: 'Course Details \u2014 Lumscribe',
}

type CourseDetailPageProps = {
  params: Promise<{ courseId: string }>
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { courseId } = await params
  const teacher = await requireTeacher()
  const course = await getCourseById(courseId)

  if (!course || course.teacher_id !== teacher.id) {
    notFound()
  }

  const cohorts = await getCohortsByCourse(courseId)

  // Compute display status and enrollment count for each cohort
  const cohortDisplayData = await Promise.all(
    cohorts.map(async (cohort) => {
      const enrollmentCount = await getActiveEnrollmentCount(cohort.id)
      const displayStatus = computeCohortDisplayStatus(cohort, enrollmentCount)
      return { cohort, enrollmentCount, displayStatus }
    }),
  )

  return (
    <>
      <PageHeader
        title={course.title}
        backHref={ROUTES.TEACHER.courses}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={course.status} />
            <Link href={ROUTES.TEACHER.courseEdit(course.id)}>
              <Button variant="secondary">Edit Course</Button>
            </Link>
          </div>
        }
      />

      <Card className="overflow-hidden">
        {course.thumbnail_url && (
          <div className="relative h-56 w-full">
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 896px"
            />
          </div>
        )}

        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Description</h2>
          {course.description ? (
            <div
              className="prose prose-sm max-w-none text-ink"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(course.description) }}
            />
          ) : (
            <p className="text-sm text-muted">
              No description added yet. Click &ldquo;Edit Course&rdquo; to add one.
            </p>
          )}
        </div>
      </Card>

      {/* Cohorts section */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Cohorts</h2>
          <Link href={ROUTES.TEACHER.cohortNew(courseId)}>
            <Button size="sm">Create Cohort</Button>
          </Link>
        </div>

        {cohortDisplayData.length > 0 ? (
          <div className="flex flex-col gap-3">
            {cohortDisplayData.map(({ cohort, enrollmentCount, displayStatus }) => (
              <CohortCard
                key={cohort.id}
                cohort={cohort}
                courseId={courseId}
                displayStatus={displayStatus}
                enrollmentCount={enrollmentCount}
              />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              title="No cohorts yet"
              description="Create your first cohort to start enrolling students in this course."
              action={
                <Link href={ROUTES.TEACHER.cohortNew(courseId)}>
                  <Button>Create Cohort</Button>
                </Link>
              }
            />
          </Card>
        )}
      </div>
    </>
  )
}
