/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/new/page.tsx — Create new cohort
 *
 * Server Component. Auth check + course ownership verification,
 * then renders the client-side create cohort form.
 */

import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCourseById } from '@/lib/db/courses'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { CreateCohortForm } from './form'

type NewCohortPageProps = {
  params: Promise<{ courseId: string }>
}

export default async function NewCohortPage({ params }: NewCohortPageProps) {
  const { courseId } = await params
  const teacher = await requireTeacher()
  const course = await getCourseById(courseId)

  if (!course || course.teacher_id !== teacher.id) {
    notFound()
  }

  return (
    <>
      <PageHeader
        title="Create Cohort"
        description={`Add a new cohort to ${course.title}`}
        backHref={ROUTES.TEACHER.courseDetail(courseId)}
      />

      <Card className="p-6">
        <CreateCohortForm courseId={courseId} />
      </Card>
    </>
  )
}
