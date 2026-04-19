/**
 * app/(teacher)/dashboard/courses/[courseId]/edit/page.tsx — Edit course page
 *
 * Server Component. Loads course data and renders client edit form.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCourseById } from '@/lib/db/courses'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { EditCourseForm } from './form'

export const metadata: Metadata = {
  title: 'Edit Course \u2014 Skool Rooms',
}

type EditCoursePageProps = {
  params: Promise<{ courseId: string }>
}

export default async function EditCoursePage({ params }: EditCoursePageProps) {
  const { courseId } = await params
  const teacher = await requireTeacher()
  const course = await getCourseById(courseId)

  if (!course || course.teacher_id !== teacher.id) {
    notFound()
  }

  return (
    <>
      <PageHeader
        title="Edit Course"
        backHref={ROUTES.TEACHER.courseDetail(course.id)}
      />

      <Card className="p-6">
        <EditCourseForm
          courseId={course.id}
          teacherId={teacher.id}
          defaultTitle={course.title}
          defaultDescription={course.description ?? ''}
          defaultThumbnailUrl={course.thumbnail_url ?? undefined}
          defaultStatus={course.status}
          defaultCategory={course.category}
          defaultTags={course.tags ?? []}
        />
      </Card>
    </>
  )
}
