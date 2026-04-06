/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx — Cohort detail
 *
 * Server Component. Displays cohort info, invite link, status,
 * enrollment count, and links to edit and schedule pages.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCohortById, getActiveEnrollmentCount, computeCohortDisplayStatus } from '@/lib/db/cohorts'
import { getCourseById } from '@/lib/db/courses'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { InviteLinkCopy } from '@/components/teacher/InviteLinkCopy'
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
            {!isArchived && (
              <Link href={ROUTES.TEACHER.cohortEdit(courseId, cohortId)}>
                <Button variant="secondary">Edit</Button>
              </Link>
            )}
          </div>
        }
      />

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
          </div>
        </Card>
      </div>
    </>
  )
}
