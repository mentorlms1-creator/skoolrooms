/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/assignments/page.tsx
 * Server Component — Assignments page for a cohort
 *
 * Fetches assignments with submission counts, verifies ownership.
 * Renders creation form (client) + assignment list with submission details.
 */

import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCohortById } from '@/lib/db/cohorts'
import {
  getAssignmentsByCohort,
  getSubmissionsByAssignment,
  getSubmissionCountsByAssignment,
} from '@/lib/db/assignments'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ROUTES } from '@/constants/routes'
import { AssignmentCreateForm } from './assignment-form'
import { AssignmentList } from './assignment-list'

type PageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
}

export default async function AssignmentsPage({ params }: PageProps) {
  const { courseId, cohortId } = await params
  const teacher = await requireTeacher()

  // Fetch cohort and verify ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id || cohort.course_id !== courseId) {
    notFound()
  }

  const isArchived = cohort.status === 'archived'

  // Check if cohort has started (for start_date guard)
  const today = new Date().toISOString().split('T')[0]
  const cohortHasStarted = cohort.start_date <= today

  // Fetch assignments with submission counts
  const assignments = await getAssignmentsByCohort(cohortId)

  const assignmentsWithDetails = await Promise.all(
    assignments.map(async (a) => {
      const [submissions, counts] = await Promise.all([
        getSubmissionsByAssignment(a.id),
        getSubmissionCountsByAssignment(a.id),
      ])

      return {
        id: a.id,
        title: a.title,
        description: a.description,
        fileUrl: a.file_url,
        dueDate: a.due_date,
        createdAt: a.created_at,
        submissionCount: counts.total,
        submittedCount: counts.submitted,
        reviewedCount: counts.reviewed,
        overdueCount: counts.overdue,
        submissions: submissions.map((s) => ({
          id: s.id,
          studentId: s.students.id,
          studentName: s.students.name,
          studentEmail: s.students.email,
          textAnswer: s.text_answer,
          fileUrl: s.file_url,
          submittedAt: s.submitted_at,
          reviewedAt: s.reviewed_at,
          status: s.status,
        })),
      }
    })
  )

  return (
    <>
      <PageHeader
        title="Assignments"
        description={`Manage assignments for ${cohort.name}`}
        backHref={ROUTES.TEACHER.cohortDetail(courseId, cohortId)}
      />

      {/* Create assignment form — hidden for archived cohorts and pre-start cohorts */}
      {!isArchived && cohortHasStarted && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">New Assignment</h2>
          <AssignmentCreateForm cohortId={cohortId} />
        </Card>
      )}

      {isArchived && (
        <div className="mb-6 rounded-md border border-border bg-muted/5 p-4 text-sm text-muted-foreground">
          This cohort is archived. No new assignments can be created.
        </div>
      )}

      {!isArchived && !cohortHasStarted && (
        <div className="mb-6 rounded-md border border-border bg-muted/5 p-4 text-sm text-muted-foreground">
          Assignments can only be created after the cohort start date ({cohort.start_date}).
        </div>
      )}

      {/* Assignments list */}
      {assignmentsWithDetails.length > 0 ? (
        <AssignmentList
          assignments={assignmentsWithDetails}
          isArchived={isArchived}
        />
      ) : (
        <Card>
          <EmptyState
            title="No assignments yet"
            description={
              cohortHasStarted && !isArchived
                ? 'Create your first assignment above.'
                : 'Assignments will appear here once the cohort has started.'
            }
          />
        </Card>
      )}
    </>
  )
}
