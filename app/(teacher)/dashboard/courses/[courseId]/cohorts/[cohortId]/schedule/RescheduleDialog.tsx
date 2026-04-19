'use client'

/**
 * RescheduleDialog — small Dialog form to reschedule a single class session.
 * Calls rescheduleSessionAction.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { rescheduleSessionAction } from '@/lib/actions/class-sessions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  defaultMeetLink: string
  isRecurringInstance: boolean
}

function nowLocalISO(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000)
  // Format as YYYY-MM-DDTHH:mm in local time for datetime-local input
  const tz = d.getTimezoneOffset()
  const local = new Date(d.getTime() - tz * 60_000)
  return local.toISOString().slice(0, 16)
}

export function RescheduleDialog({
  open,
  onOpenChange,
  sessionId,
  defaultMeetLink,
  isRecurringInstance,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [scheduledAt, setScheduledAt] = useState('')
  const [meetLink, setMeetLink] = useState(defaultMeetLink)
  const [reason, setReason] = useState('')
  const minLocal = nowLocalISO(60) // at least 1 hour in the future

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scheduledAt) {
      toast.error('Pick a new date and time.')
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      // Convert local datetime input -> ISO UTC string
      fd.set('new_scheduled_at', new Date(scheduledAt).toISOString())
      fd.set('new_meet_link', meetLink.trim())
      if (reason.trim()) fd.set('reason', reason.trim())

      const result = await rescheduleSessionAction(sessionId, fd)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(
        `Session rescheduled. ${result.data.notified} student${result.data.notified === 1 ? '' : 's'} notified.`,
      )
      onOpenChange(false)
      setScheduledAt('')
      setReason('')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule Session</DialogTitle>
          <DialogDescription>
            {isRecurringInstance
              ? 'This will only reschedule this single session, not the recurring series.'
              : 'Pick a new date and time. Enrolled students will be notified.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="reschedule-when">New date & time</Label>
            <Input
              id="reschedule-when"
              type="datetime-local"
              min={minLocal}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reschedule-link">Meet link</Label>
            <Input
              id="reschedule-link"
              type="url"
              placeholder="https://meet.google.com/..."
              value={meetLink}
              onChange={(e) => setMeetLink(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reschedule-reason">Reason (optional)</Label>
            <Textarea
              id="reschedule-reason"
              placeholder="e.g. teacher unavailable, holiday..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Reschedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
