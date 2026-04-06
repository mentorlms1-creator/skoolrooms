'use client'

/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/session-list.tsx
 * Client Component — Wraps SessionCards with cancel functionality
 *
 * Uses useUIContext for confirm dialog and toast notifications.
 * Calls cancelSessionAction server action on confirm.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SessionCard } from '@/components/teacher/SessionCard'
import { Button } from '@/components/ui/Button'
import { useUIContext } from '@/providers/UIProvider'
import { cancelSessionAction } from '@/lib/actions/class-sessions'

type SessionData = {
  id: string
  meet_link: string
  scheduled_at: string
  duration_minutes: number
  cancelled_at: string | null
}

type ScheduleSessionListProps = {
  sessions: SessionData[]
  isArchived: boolean
}

export function ScheduleSessionList({ sessions, isArchived }: ScheduleSessionListProps) {
  const router = useRouter()
  const { addToast, confirm } = useUIContext()
  const [isPending, startTransition] = useTransition()

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
            addToast({ type: 'error', message: result.error })
            return
          }

          addToast({ type: 'success', message: 'Session cancelled successfully.' })
          router.refresh()
        })
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.map((session) => {
        const isFuture =
          !session.cancelled_at &&
          new Date(session.scheduled_at).getTime() > Date.now()

        return (
          <SessionCard
            key={session.id}
            session={session}
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
  )
}
