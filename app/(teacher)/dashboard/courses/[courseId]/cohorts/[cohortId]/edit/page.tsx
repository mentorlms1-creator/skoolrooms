/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/edit/page.tsx — Edit cohort
 *
 * Server Component. Loads cohort data, verifies ownership,
 * renders the client-side edit form.
 */

import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCohortById } from '@/lib/db/cohorts'
import { getCourseById } from '@/lib/db/courses'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'
import { EditCohortForm } from './form'

type EditCohortPageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
}

export default async function EditCohortPage({ params }: EditCohortPageProps) {
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

  // Archived cohorts cannot be edited — redirect to detail
  if (cohort.status === 'archived') {
    notFound()
  }

  return (
    <>
      <PageHeader
        title="Edit Cohort"
        backHref={ROUTES.TEACHER.cohortDetail(courseId, cohortId)}
      />

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
        />
      </Card>
    </>
  )
}
