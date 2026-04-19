'use client'

/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/session-list.tsx
 * Client Component — Wraps SessionCards with cancel + reschedule functionality.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SessionCard } from '@/components/teacher/SessionCard'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useUIContext } from '@/providers/UIProvider'
import { cancelSessionAction } from '@/lib/actions/class-sessions'
import { RescheduleDialog } from './RescheduleDialog'

type SessionData = {
  id: string
  meet_link: string
  scheduled_at: string
  duration_minutes: number
  cancelled_at: string | null
  rescheduled_to_id: string | null
  is_recurring?: boolean
}

type ScheduleSessionListProps = {
  sessions: SessionData[]
  isArchived: boolean
}

export function ScheduleSessionList({ sessions, isArchived }: ScheduleSessionListProps) {
  const router = useRouter()
  const { confirm } = useUIContext()
  const [isPending, startTransition] = useTransition()
  const [rescheduleTarget, setRescheduleTarget] = useState<SessionData | null>(null)

  function handleCancel(sessionId: string) {
    confirm({
      title: 'Cancel Session',
      message: 'Are you sure you want to cancel this class session? Students will be notified.',
      confirmText: 'Cancel Session',
      confirmVariant: 'danger',
      onConfirm: async () => {
        startTransition(async () => {
          const result = await cancelSessionAction(sessionId)

          if (!result.success) {
            toast.error(result.error)
            return
          }

          toast.success('Session cancelled successfully.')
          router.refresh()
        })
      },
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {sessions.map((session) => {
          const isFuture =
            !session.cancelled_at &&
            new Date(session.scheduled_at).getTime() > Date.now()
          const canReschedule = isFuture && !isArchived && !session.rescheduled_to_id

          return (
            <SessionCard
              key={session.id}
              session={session}
              rescheduleButton={
                canReschedule ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRescheduleTarget(session)}
                    disabled={isPending}
                  >
                    Reschedule
                  </Button>
                ) : undefined
              }
              cancelButton={
                isFuture && !isArchived ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancel(session.id)}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    Cancel
                  </Button>
                ) : undefined
              }
            />
          )
        })}
      </div>

      {rescheduleTarget && (
        <RescheduleDialog
          open={true}
          onOpenChange={(open) => !open && setRescheduleTarget(null)}
          sessionId={rescheduleTarget.id}
          defaultMeetLink={rescheduleTarget.meet_link}
          isRecurringInstance={Boolean(rescheduleTarget.is_recurring)}
        />
      )}
    </>
  )
}
