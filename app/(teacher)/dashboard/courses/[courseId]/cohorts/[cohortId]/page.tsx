/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx — Cohort detail
 *
 * Server Component. Displays cohort info, invite link, status,
 * enrollment count, and links to edit and schedule pages.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getCohortById,
  getActiveEnrollmentCount,
  computeCohortDisplayStatus,
  getCohortAnalytics,
} from '@/lib/db/cohorts'
import { getCourseById } from '@/lib/db/courses'
import { getActiveEnrollmentsByCohort } from '@/lib/db/enrollments'
import { canUseFeature } from '@/lib/plans/features'
import { CohortAnalyticsCard } from '@/components/teacher/CohortAnalyticsCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import { InviteLinkCopy } from '@/components/teacher/InviteLinkCopy'
import { DuplicateCohortButton } from '@/components/teacher/DuplicateCohortButton'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'

type CohortDetailPageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
}

export default async function CohortDetailPage({ params }: CohortDetailPageProps) {
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

  const enrollmentCount = await getActiveEnrollmentCount(cohortId)
  const displayStatus = computeCohortDisplayStatus(cohort, enrollmentCount)

  // When the cohort is archived but still has active students, surface a
  // soft nudge: those students are eligible to be marked complete + issued certs.
  const archivedActiveCount =
    cohort.status === 'archived'
      ? (await getActiveEnrollmentsByCohort(cohortId)).length
      : 0

  const canSeeRevenueAnalytics = await canUseFeature(teacher.id, 'revenue_analytics')
  const analytics = canSeeRevenueAnalytics
    ? await getCohortAnalytics(cohortId, teacher.id)
    : null

  const isArchived = cohort.status === 'archived'

  const feeLabel =
    cohort.fee_type === 'monthly'
      ? `PKR ${cohort.fee_pkr.toLocaleString()}/month (billing day ${cohort.billing_day})`
      : `PKR ${cohort.fee_pkr.toLocaleString()} (one-time)`

  const spotsLabel =
    cohort.max_students !== null
      ? `${enrollmentCount} / ${cohort.max_students} spots filled`
      : `${enrollmentCount} student${enrollmentCount === 1 ? '' : 's'} enrolled`

  return (
    <>
      <PageHeader
        title={cohort.name}
        backHref={ROUTES.TEACHER.courseDetail(courseId)}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={displayStatus} />
            <DuplicateCohortButton cohortId={cohortId} courseId={courseId} />
            {!isArchived && (
              <Link href={ROUTES.TEACHER.cohortEdit(courseId, cohortId)}>
                <Button variant="secondary">Edit</Button>
              </Link>
            )}
          </div>
        }
      />

      {archivedActiveCount > 0 && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/5 p-4 text-sm text-foreground">
          <p>
            You have {archivedActiveCount} active{' '}
            {archivedActiveCount === 1 ? 'student' : 'students'} in this archived cohort. Mark them complete to issue certificates.
          </p>
          <Link
            href={ROUTES.TEACHER.cohortStudents(courseId, cohortId)}
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            Go to students &rarr;
          </Link>
        </div>
      )}

      {/* Cohort info */}
      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Details</h2>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">Course</dt>
              <dd className="mt-1 text-foreground">{course.title}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Date Range</dt>
              <dd className="mt-1 text-foreground">
                {formatPKT(cohort.start_date, 'date')} &ndash;{' '}
                {formatPKT(cohort.end_date, 'date')}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Fee</dt>
              <dd className="mt-1 text-foreground">{feeLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Enrollment</dt>
              <dd className="mt-1 text-foreground">{spotsLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Registration</dt>
              <dd className="mt-1 text-foreground">
                {cohort.is_registration_open ? 'Open' : 'Closed'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Waitlist</dt>
              <dd className="mt-1 text-foreground">
                {cohort.waitlist_enabled ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Invite link */}
        {!isArchived && (
          <Card className="p-6">
            <InviteLinkCopy inviteToken={cohort.invite_token} />
          </Card>
        )}

        {/* Cohort analytics — Lane E2 */}
        <CohortAnalyticsCard analytics={analytics} locked={!canSeeRevenueAnalytics} />

        {/* Quick links */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Manage</h2>
          <div className="flex flex-wrap gap-3">
            <Link href={ROUTES.TEACHER.cohortSchedule(courseId, cohortId)}>
              <Button variant="secondary">Schedule</Button>
            </Link>
            <Link href={ROUTES.TEACHER.cohortStudents(courseId, cohortId)}>
              <Button variant="secondary">Students</Button>
            </Link>
            <Link href={ROUTES.TEACHER.cohortAnnouncements(courseId, cohortId)}>
              <Button variant="secondary">Announcements</Button>
            </Link>
            <Link href={ROUTES.TEACHER.cohortAttendance(courseId, cohortId)}>
              <Button variant="secondary">Attendance</Button>
            </Link>
            <Link href={ROUTES.TEACHER.courseCurriculum(courseId)}>
              <Button variant="secondary">Curriculum</Button>
            </Link>
          </div>
        </Card>
      </div>
    </>
  )
}
