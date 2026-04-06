/**
 * app/(student)/student/courses/[enrollmentId]/page.tsx — Enrollment detail
 *
 * Server Component. Shows cohort info, announcements, assignments, and
 * attendance summary for a specific enrollment. Respects pending visibility
 * flags (pending_can_see_announcements). Student can comment on announcements,
 * submit assignments, and request withdrawal from this page.
 */

import { notFound } from 'next/navigation'
import { requireStudent } from '@/lib/auth/guards'
import { getEnrollmentByIdWithDetails } from '@/lib/db/enrollments'
import {
  getAnnouncementsByCohort,
  getCommentsByAnnouncement,
  getAnnouncementReadsByStudent,
} from '@/lib/db/announcements'
import {
  getAssignmentsByCohort,
  getSubmissionsByStudentForCohort,
} from '@/lib/db/assignments'
import { getAttendanceSummary } from '@/lib/db/attendance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPKT } from '@/lib/time/pkt'
import { ROUTES } from '@/constants/routes'
import { StudentAnnouncementList } from './announcements'
import { StudentAssignmentList } from './assignments'
import { WithdrawalForm } from './withdrawal-form'

type PageParams = {
  params: Promise<{ enrollmentId: string }>
}

export default async function EnrollmentDetailPage({ params }: PageParams) {
  const { enrollmentId } = await params
  const student = await requireStudent()

  // Fetch enrollment with full details
  const enrollment = await getEnrollmentByIdWithDetails(enrollmentId)

  // Guard: enrollment must exist and belong to this student
  if (!enrollment || enrollment.student_id !== student.id) {
    notFound()
  }

  const cohort = enrollment.cohorts
  const course = cohort.courses
  const teacher = cohort.teachers

  // Determine visibility based on enrollment status and cohort flags
  const isPending = enrollment.status === 'pending'
  const canSeeAnnouncements = !isPending || cohort.pending_can_see_announcements
  const isActiveOrPending =
    enrollment.status === 'active' || enrollment.status === 'pending'
  const isActive = enrollment.status === 'active'
  const isArchived = cohort.status === 'archived'

  // Fetch data in parallel based on visibility
  const [announcements, assignments, attendanceSummary] = await Promise.all([
    canSeeAnnouncements ? getAnnouncementsByCohort(cohort.id) : Promise.resolve([]),
    isActiveOrPending ? getAssignmentsByCohort(cohort.id) : Promise.resolve([]),
    isActive ? getAttendanceSummary(student.id, cohort.id) : Promise.resolve(null),
  ])

  // Fetch announcement reads + comments if announcements are visible
  let readAnnouncementIds = new Set<string>()
  let commentsByAnnouncement = new Map<
    string,
    Array<{
      id: string
      authorId: string
      authorType: string
      body: string
      createdAt: string
    }>
  >()

  if (announcements.length > 0) {
    const announcementIds = announcements.map((a) => a.id)
    const [reads, ...commentResults] = await Promise.all([
      getAnnouncementReadsByStudent(student.id, announcementIds),
      ...announcements.map((a) => getCommentsByAnnouncement(a.id)),
    ])

    readAnnouncementIds = reads
    commentsByAnnouncement = new Map()
    announcements.forEach((a, idx) => {
      commentsByAnnouncement.set(
        a.id,
        commentResults[idx].map((c) => ({
          id: c.id,
          authorId: c.author_id,
          authorType: c.author_type,
          body: c.body,
          createdAt: c.created_at,
        }))
      )
    })
  }

  // Fetch student submissions for assignments
  let submissionMap = new Map<
    string,
    {
      id: string
      status: string
      textAnswer: string | null
      fileUrl: string | null
      submittedAt: string
      reviewedAt: string | null
    }
  >()

  if (assignments.length > 0) {
    const assignmentIds = assignments.map((a) => a.id)
    const rawMap = await getSubmissionsByStudentForCohort(student.id, assignmentIds)
    submissionMap = new Map()
    for (const [key, sub] of rawMap) {
      submissionMap.set(key, {
        id: sub.id,
        status: sub.status,
        textAnswer: sub.text_answer,
        fileUrl: sub.file_url,
        submittedAt: sub.submitted_at,
        reviewedAt: sub.reviewed_at,
      })
    }
  }

  // Serializable announcement data for the client component
  const announcementData = announcements.map((a) => ({
    id: a.id,
    body: a.body,
    fileUrl: a.file_url,
    pinned: a.pinned,
    createdAt: a.created_at,
    isRead: readAnnouncementIds.has(a.id),
    comments: commentsByAnnouncement.get(a.id) ?? [],
  }))

  // Serializable assignment data for the client component
  const assignmentData = assignments.map((a) => {
    const submission = submissionMap.get(a.id)
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      fileUrl: a.file_url,
      dueDate: a.due_date,
      createdAt: a.created_at,
      submission: submission ?? null,
    }
  })

  // Can withdraw: enrollment is active and no withdrawal already requested
  const canWithdraw = isActive && !enrollment.withdrawal_requested_at
  const withdrawalPending = isActive && !!enrollment.withdrawal_requested_at

  return (
    <>
      <PageHeader
        title={course.title}
        description={`${cohort.name} with ${teacher.name}`}
        backHref={ROUTES.STUDENT.courses}
      />

      {/* Enrollment status + cohort info */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Enrollment Status</p>
          <div className="mt-1">
            <StatusBadge status={enrollment.status} />
          </div>
          {withdrawalPending && (
            <p className="mt-2 text-xs text-warning">Withdrawal requested</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Cohort Period</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {formatPKT(cohort.start_date, 'date')} &ndash;{' '}
            {formatPKT(cohort.end_date, 'date')}
          </p>
        </Card>
        {attendanceSummary && (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Attendance</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {attendanceSummary.percentage}%
            </p>
            <p className="text-xs text-muted-foreground">
              {attendanceSummary.attended} of {attendanceSummary.total} classes
            </p>
          </Card>
        )}
        {!attendanceSummary && (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Fee</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              PKR {cohort.fee_pkr.toLocaleString()} (
              {cohort.fee_type === 'monthly' ? 'Monthly' : 'One-time'})
            </p>
          </Card>
        )}
      </div>

      {/* Announcements section */}
      {canSeeAnnouncements && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Announcements</h2>
          {announcementData.length === 0 ? (
            <EmptyState
              title="No announcements yet"
              description="Your teacher has not posted any announcements for this cohort."
            />
          ) : (
            <StudentAnnouncementList
              announcements={announcementData}
              teacherName={teacher.name}
              isArchived={isArchived}
              canComment={isActive}
              studentId={student.id}
            />
          )}
        </section>
      )}

      {!canSeeAnnouncements && isPending && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Announcements</h2>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Announcements will be visible once your enrollment is confirmed.
            </p>
          </Card>
        </section>
      )}

      {/* Assignments section */}
      {isActiveOrPending && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Assignments</h2>
          {assignmentData.length === 0 ? (
            <EmptyState
              title="No assignments yet"
              description="Your teacher has not posted any assignments for this cohort."
            />
          ) : (
            <StudentAssignmentList
              assignments={assignmentData}
              canSubmit={isActive && !isArchived}
              studentId={student.id}
            />
          )}
        </section>
      )}

      {/* Withdrawal section */}
      {canWithdraw && !isArchived && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Enrollment</h2>
          <Card className="p-6">
            <p className="mb-4 text-sm text-muted-foreground">
              If you need to leave this cohort, you can request a withdrawal. Your
              teacher will review the request.
            </p>
            <WithdrawalForm enrollmentId={enrollment.id} />
          </Card>
        </section>
      )}

      {withdrawalPending && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Enrollment</h2>
          <Card className="p-6">
            <p className="text-sm text-warning">
              Your withdrawal request is being reviewed by your teacher.
            </p>
            {enrollment.withdrawal_reason && (
              <p className="mt-2 text-sm text-muted-foreground">
                Reason: {enrollment.withdrawal_reason}
              </p>
            )}
          </Card>
        </section>
      )}
    </>
  )
}
