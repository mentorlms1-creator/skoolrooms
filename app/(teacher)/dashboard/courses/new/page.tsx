/**
 * app/(teacher)/dashboard/courses/new/page.tsx — Create new course page
 *
 * Server Component wrapper. Auth check, then renders client form.
 */

import { requireTeacher } from '@/lib/auth/guards'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'
import { CreateCourseForm } from './form'

export default async function NewCoursePage() {
  await requireTeacher()

  return (
    <>
      <PageHeader
        title="Create Course"
        description="Set up a new course. You can add cohorts and schedule classes after creating it."
        backHref={ROUTES.TEACHER.courses}
      />

      <Card className="p-6">
        <CreateCourseForm />
      </Card>
    </>
  )
}
