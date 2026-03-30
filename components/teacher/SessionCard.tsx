/**
 * components/teacher/SessionCard.tsx — Individual class session display card
 * Server-compatible (no 'use client' needed).
 *
 * Shows formatted date/time in PKT, duration, Meet link, and status.
 * Supports an optional onCancel callback for future non-cancelled sessions.
 */

import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatPKT } from '@/lib/time/pkt'

type SessionCardProps = {
  session: {
    id: string
    meet_link: string
    scheduled_at: string
    duration_minutes: number
    cancelled_at: string | null
  }
  cancelButton?: React.ReactNode
}

function getSessionStatus(
  scheduledAt: string,
  durationMinutes: number,
  cancelledAt: string | null,
): 'cancelled' | 'completed' | 'upcoming' {
  if (cancelledAt) return 'cancelled'

  const endTime = new Date(scheduledAt)
  endTime.setMinutes(endTime.getMinutes() + durationMinutes)

  if (endTime.getTime() < Date.now()) return 'completed'
  return 'upcoming'
}

export function SessionCard({ session, cancelButton }: SessionCardProps) {
  const status = getSessionStatus(
    session.scheduled_at,
    session.duration_minutes,
    session.cancelled_at,
  )

  const isCancelled = status === 'cancelled'
  const isFuture = status === 'upcoming'

  return (
    <Card
      className={`p-4 ${isCancelled ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {/* Date and time */}
          <p className="text-sm font-medium text-ink">
            {formatPKT(session.scheduled_at, 'datetime')}
          </p>

          {/* Duration */}
          <p className="text-sm text-muted">
            {session.duration_minutes} minutes
          </p>

          {/* Meet link - only for future non-cancelled sessions */}
          {isFuture && session.meet_link && (
            <a
              href={session.meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                  clipRule="evenodd"
                />
                <path
                  fillRule="evenodd"
                  d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                  clipRule="evenodd"
                />
              </svg>
              Join Meeting
            </a>
          )}
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={status} size="sm" />

          {/* Cancel button - only for future non-cancelled sessions */}
          {isFuture && cancelButton}
        </div>
      </div>
    </Card>
  )
}
