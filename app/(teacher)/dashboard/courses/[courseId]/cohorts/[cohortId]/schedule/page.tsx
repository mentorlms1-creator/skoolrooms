/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/page.tsx
 * Server Component — Schedule page for a cohort
 *
 * Fetches sessions, verifies ownership, renders list with cancel capability.
 */

import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCohortById } from '@/lib/db/cohorts'
import { getSessionsByCohort } from '@/lib/db/class-sessions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ROUTES } from '@/constants/routes'
import { SessionCreateForm } from './form'
import { ScheduleSessionList } from './session-list'

type PageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
}

export default async function SchedulePage({ params }: PageProps) {
  const { courseId, cohortId } = await params
  const teacher = await requireTeacher()

  // Fetch cohort and verify ownership
  const cohort = await getCohortById(cohortId)
  if (!cohort || cohort.teacher_id !== teacher.id || cohort.course_id !== courseId) {
    notFound()
  }

  const isArchived = cohort.status === 'archived'
  const sessions = await getSessionsByCohort(cohortId)

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`Manage class sessions for ${cohort.name}`}
        backHref={ROUTES.TEACHER.cohortDetail(courseId, cohortId)}
      />

      {/* Session creation form — hidden for archived cohorts */}
      {!isArchived && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Add Session</h2>
          <SessionCreateForm cohortId={cohortId} />
        </Card>
      )}

      {isArchived && (
        <div className="mb-6 rounded-md border border-border bg-muted/5 p-4 text-sm text-muted-foreground">
          This cohort is archived. No new sessions can be added.
        </div>
      )}

      {/* Sessions list */}
      {sessions.length > 0 ? (
        <ScheduleSessionList
          sessions={sessions.map((s) => ({
            id: s.id,
            meet_link: s.meet_link,
            scheduled_at: s.scheduled_at,
            duration_minutes: s.duration_minutes,
            cancelled_at: s.cancelled_at,
          }))}
          isArchived={isArchived}
        />
      ) : (
        <Card>
          <EmptyState
            title="No sessions yet"
            description="Add your first class session above to get started."
          />
        </Card>
      )}
    </>
  )
}
