/**
 * app/(student)/student/schedule/page.tsx — Student full schedule
 *
 * Server Component. Shows all upcoming classes across all teachers
 * in chronological order with date/time, course, teacher, and Meet link.
 */

import type { Metadata } from 'next'
import { requireStudent } from '@/lib/auth/guards'
import { getUpcomingSessionsByStudent } from '@/lib/db/class-sessions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPKT } from '@/lib/time/pkt'

export const metadata: Metadata = {
  title: 'Schedule \u2014 Lumscribe Student',
}

export default async function StudentSchedulePage() {
  const student = await requireStudent()

  // Fetch upcoming sessions (higher limit for full schedule view)
  const sessions = await getUpcomingSessionsByStudent(student.id, 50)

  // Group sessions by date for visual clarity
  const sessionsByDate = new Map<string, typeof sessions>()

  for (const session of sessions) {
    const dateKey = formatPKT(session.scheduled_at, 'date')
    const existing = sessionsByDate.get(dateKey)
    if (existing) {
      existing.push(session)
    } else {
      sessionsByDate.set(dateKey, [session])
    }
  }

  return (
    <>
      <PageHeader
        title="Schedule"
        description="All your upcoming classes across all courses"
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="No upcoming classes"
          description="You don't have any upcoming classes scheduled. Your teachers will add classes to your enrolled courses."
        />
      ) : (
        <div className="space-y-6">
          {Array.from(sessionsByDate.entries()).map(
            ([dateLabel, dateSessions]) => (
              <div key={dateLabel}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {dateLabel}
                </h2>
                <div className="space-y-3">
                  {dateSessions.map((session) => (
                    <Card key={session.id} className="p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {formatPKT(session.scheduled_at, 'time')}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              &middot; {session.duration_minutes} min
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-foreground">
                            {session.cohorts.courses.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {session.cohorts.name} &middot;{' '}
                            {session.cohorts.teachers.name}
                          </p>
                        </div>
                        {session.meet_link && (
                          <a
                            href={session.meet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                          >
                            Join Class
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </>
  )
}
