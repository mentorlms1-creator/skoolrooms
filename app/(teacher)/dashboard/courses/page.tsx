/**
 * app/(teacher)/dashboard/courses/page.tsx — Course list page
 *
 * Server Component. Displays all courses for the authenticated teacher
 * with links to create, view, and edit courses.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherCourses } from '@/lib/db/courses'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Courses \u2014 Lumscribe',
}

/** Strip HTML tags from a string for plain-text preview */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

export default async function CoursesPage() {
  const teacher = await requireTeacher()
  const courses = await getTeacherCourses(teacher.id)

  return (
    <>
      <PageHeader
        title="Courses"
        description="Manage your courses and publish them for students to enroll."
        action={
          <Link href={ROUTES.TEACHER.courseNew}>
            <Button>Create Course</Button>
          </Link>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Create your first course to get started. You can add cohorts, schedule classes, and invite students once your course is ready."
          action={
            <Link href={ROUTES.TEACHER.courseNew}>
              <Button>Create Your First Course</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={ROUTES.TEACHER.courseDetail(course.id)}
              className="block"
            >
              <Card hover className="flex flex-col overflow-hidden">
                {course.thumbnail_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-paper">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-10 w-10 text-muted"
                      aria-hidden="true"
                    >
                      <path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.949 49.949 0 00-9.902 3.912l-.003.002-.34.18a.75.75 0 01-.707 0A50.009 50.009 0 007.5 12.174v-.224c0-.131.067-.248.172-.311a54.614 54.614 0 014.653-2.52.75.75 0 00-.65-1.352 56.129 56.129 0 00-4.78 2.589 1.858 1.858 0 00-.859 1.228 49.803 49.803 0 00-4.634-1.527.75.75 0 01-.231-1.337A60.653 60.653 0 0111.7 2.805z" />
                      <path d="M13.06 15.473a48.45 48.45 0 017.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 01-.46.71 47.878 47.878 0 00-8.105 4.342.75.75 0 01-.832 0 47.205 47.205 0 00-1.346-.808c-.3-.186-.592-.376-.883-.57l-.563-.37a.75.75 0 01-.146-1.07 1.857 1.857 0 00.284-1.218 1.856 1.856 0 00-.825-1.3 49.394 49.394 0 00-3.888-2.136.75.75 0 01-.159-1.248l.218-.156c.158-.113.333-.207.516-.283a50.158 50.158 0 017.25 3.79.75.75 0 01.019.042z" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="truncate text-base font-semibold text-ink">
                      {course.title}
                    </h3>
                    <StatusBadge status={course.status} size="sm" />
                  </div>
                  {course.description && (
                    <p className="line-clamp-2 text-sm text-muted">
                      {stripHtmlTags(course.description)}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
