/**
 * app/(teacher)/dashboard/courses/[courseId]/page.tsx — Course detail page
 *
 * Server Component. Displays course info with thumbnail, description,
 * status badge, and edit link.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCourseById } from '@/lib/db/courses'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'

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
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="h-56 w-full object-cover"
          />
        )}

        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Description</h2>
          {course.description ? (
            <div
              className="prose prose-sm max-w-none text-ink"
              dangerouslySetInnerHTML={{ __html: course.description }}
            />
          ) : (
            <p className="text-sm text-muted">
              No description added yet. Click &ldquo;Edit Course&rdquo; to add one.
            </p>
          )}
        </div>
      </Card>
    </>
  )
}
