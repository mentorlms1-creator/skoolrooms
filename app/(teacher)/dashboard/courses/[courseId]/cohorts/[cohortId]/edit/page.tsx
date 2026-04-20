/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/edit/page.tsx — Edit cohort
 *
 * Server Component. Loads cohort data, verifies ownership,
 * renders the client-side edit form.
 */

import { Link } from 'next-view-transitions'
import { notFound } from 'next/navigation'
import { Tag } from 'lucide-react'

import { requireTeacher } from '@/lib/auth/guards'
import { getCohortById } from '@/lib/db/cohorts'
import { getCourseById } from '@/lib/db/courses'
import { countActiveConfirmedEnrollments } from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { EditCohortForm } from './form'

type EditCohortPageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function EditCohortPage({ params, searchParams }: EditCohortPageProps) {
  const { courseId, cohortId } = await params
  const { from } = await searchParams
  const fromDuplicate = from === 'duplicate'
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

  // Archived cohorts cannot be edited — redirect to detail
  if (cohort.status === 'archived') {
    notFound()
  }

  // Lock fee_type / billing_day if any active enrollment has confirmed payments
  const confirmedEnrollmentCount = await countActiveConfirmedEnrollments(cohortId)

  return (
    <>
      <PageHeader
        title="Edit Cohort"
        backHref={ROUTES.TEACHER.cohortDetail(courseId, cohortId)}
      />

      {fromDuplicate && (
        <div className="mb-4 rounded-md border border-warning bg-warning/10 p-4 text-sm text-warning-foreground">
          <strong>Review dates before publishing.</strong> This cohort was duplicated with default dates (30-day duration starting in 30 days). Update start and end dates to match your actual schedule, then set status to Upcoming or Active when ready.
        </div>
      )}

      {/* Discount codes quick link */}
      <div className="mb-4">
        <Link
          href={`/dashboard/courses/${courseId}/cohorts/${cohortId}/discount-codes`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Tag className="h-4 w-4" />
          Manage Discount Codes
        </Link>
      </div>

      <Card className="p-6">
        <EditCohortForm
          courseId={courseId}
          cohortId={cohortId}
          defaultName={cohort.name}
          defaultStartDate={cohort.start_date}
          defaultEndDate={cohort.end_date}
          defaultFeeType={cohort.fee_type}
          defaultFeePkr={cohort.fee_pkr}
          defaultBillingDay={cohort.billing_day}
          defaultMaxStudents={cohort.max_students}
          defaultIsRegistrationOpen={cohort.is_registration_open}
          defaultWaitlistEnabled={cohort.waitlist_enabled}
          defaultPendingCanSeeSchedule={cohort.pending_can_see_schedule}
          defaultPendingCanSeeAnnouncements={cohort.pending_can_see_announcements}
          confirmedEnrollmentCount={confirmedEnrollmentCount}
        />
      </Card>
    </>
  )
}
