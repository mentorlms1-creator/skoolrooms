/**
 * app/(teacher)/dashboard/courses/[courseId]/curriculum/page.tsx
 * Server Component — Curriculum builder for a course.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCourseById } from '@/lib/db/courses'
import { getCurriculumByCourse } from '@/lib/db/course-curriculum'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { CurriculumBuilder } from './curriculum-builder'

export const metadata: Metadata = {
  title: 'Curriculum \u2014 Skool Rooms',
}

type PageProps = {
  params: Promise<{ courseId: string }>
}

export default async function CourseCurriculumPage({ params }: PageProps) {
  const { courseId } = await params
  const teacher = await requireTeacher()
  const course = await getCourseById(courseId)
  if (!course || course.teacher_id !== teacher.id) {
    notFound()
  }
  const items = await getCurriculumByCourse(courseId)

  return (
    <>
      <PageHeader
        title="Curriculum"
        description={`Weekly outline for ${course.title}`}
        backHref={ROUTES.TEACHER.courseDetail(courseId)}
      />
      <Card className="p-6">
        <CurriculumBuilder courseId={courseId} initialItems={items} />
      </Card>
    </>
  )
}
