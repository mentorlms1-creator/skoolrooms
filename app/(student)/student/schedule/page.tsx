/**
 * app/(student)/student/schedule/page.tsx — Student full schedule
 *
 * Server Component. Shows all upcoming classes across all teachers
 * in chronological order with date/time, course, teacher, and Meet link.
 */

import type { Metadata } from 'next'
import { Calendar, Clock, Video, BookOpen } from 'lucide-react'
import { requireStudent } from '@/lib/auth/guards'
import { getUpcomingSessionsByStudent } from '@/lib/db/class-sessions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPKT } from '@/lib/time/pkt'

export const metadata: Metadata = {
  title: 'Schedule \u2014 Skool Rooms Student',
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
        <div className="space-y-8">
          {Array.from(sessionsByDate.entries()).map(
            ([dateLabel, dateSessions]) => (
              <div key={dateLabel}>
                <div className="mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground/50" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
                    {dateLabel}
                  </h2>
                </div>
                <div className="space-y-4">
                  {dateSessions.map((session) => (
                    <Card key={session.id} className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card overflow-hidden">
                      <CardContent className="px-8 py-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-foreground">
                                {formatPKT(session.scheduled_at, 'time')}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                (PKT)
                              </span>
                              <span className="text-sm text-muted-foreground">
                                &middot; {session.duration_minutes} min
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                              <p className="text-sm font-medium text-foreground">
                                {session.cohorts.courses.title}
                              </p>
                            </div>
                            <p className="mt-1 ml-5.5 text-sm text-muted-foreground">
                              {session.cohorts.name} &middot;{' '}
                              {session.cohorts.teachers.name}
                            </p>
                          </div>
                          {session.meet_link && (
                            <a
                              href={session.meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                              <Video className="h-4 w-4" />
                              Join Class
                            </a>
                          )}
                        </div>
                      </CardContent>
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
