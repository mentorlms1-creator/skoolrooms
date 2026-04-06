/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/announcements/page.tsx
 * Server Component — Announcements page for a cohort
 *
 * Fetches announcements with comments/reads, verifies ownership.
 * Renders creation form (client) + announcement list with comments.
 * HTML content is sanitized before rendering to prevent XSS.
 */

import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCohortById } from '@/lib/db/cohorts'
import { getAnnouncementsByCohort, getAnnouncementReads } from '@/lib/db/announcements'
import { getEnrollmentsByCohort } from '@/lib/db/enrollments'
import { getCommentsByAnnouncement } from '@/lib/db/announcements'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ROUTES } from '@/constants/routes'
import { AnnouncementCreateForm } from './announcement-form'
import { AnnouncementList } from './announcement-list'

type PageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
}

export default async function AnnouncementsPage({ params }: PageProps) {
  const { courseId, cohortId } = await params
  const teacher = await requireTeacher()

  // Fetch cohort and verify ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id || cohort.course_id !== courseId) {
    notFound()
  }

  const isArchived = cohort.status === 'archived'

  // Fetch announcements, enrollments, and per-announcement reads/comments
  const [announcements, enrollments] = await Promise.all([
    getAnnouncementsByCohort(cohortId),
    getEnrollmentsByCohort(cohortId),
  ])

  const activeEnrollmentCount = enrollments.filter((e) => e.status === 'active').length

  // Build student name map for comment display
  const studentNameMap: Record<string, string> = {}
  for (const e of enrollments) {
    studentNameMap[e.students.id] = e.students.name
  }

  // Fetch reads and comments for each announcement
  const announcementsWithDetails = await Promise.all(
    announcements.map(async (a) => {
      const [reads, comments] = await Promise.all([
        getAnnouncementReads(a.id),
        getCommentsByAnnouncement(a.id),
      ])

      // Build read student names
      const readStudentNames: string[] = []
      for (const sid of reads.studentIds) {
        if (studentNameMap[sid]) {
          readStudentNames.push(studentNameMap[sid])
        }
      }

      return {
        id: a.id,
        body: a.body,
        fileUrl: a.file_url,
        pinned: a.pinned,
        createdAt: a.created_at,
        seenByCount: reads.count,
        totalStudents: activeEnrollmentCount,
        readStudentNames,
        comments: comments.map((c) => ({
          id: c.id,
          authorId: c.author_id,
          authorType: c.author_type as 'teacher' | 'student',
          authorName:
            c.author_type === 'teacher'
              ? teacher.name
              : studentNameMap[c.author_id] ?? 'Unknown Student',
          body: c.body,
          createdAt: c.created_at,
        })),
      }
    })
  )

  return (
    <>
      <PageHeader
        title="Announcements"
        description={`Manage announcements for ${cohort.name}`}
        backHref={ROUTES.TEACHER.cohortDetail(courseId, cohortId)}
      />

      {/* Create announcement form — hidden for archived cohorts */}
      {!isArchived && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">New Announcement</h2>
          <AnnouncementCreateForm cohortId={cohortId} />
        </Card>
      )}

      {isArchived && (
        <div className="mb-6 rounded-md border border-border bg-muted/5 p-4 text-sm text-muted-foreground">
          This cohort is archived. No new announcements can be posted.
        </div>
      )}

      {/* Announcements list */}
      {announcementsWithDetails.length > 0 ? (
        <AnnouncementList
          announcements={announcementsWithDetails}
          teacherName={teacher.name}
          isArchived={isArchived}
        />
      ) : (
        <Card>
          <EmptyState
            title="No announcements yet"
            description="Post your first announcement above to keep students informed."
          />
        </Card>
      )}
    </>
  )
}
