'use client'

/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/form.tsx
 * Client Component — Session creation form
 *
 * Fields: meet_link, date, time, duration_minutes
 * Optional recurring mode: frequency (Weekly) + day-of-week checkboxes
 * Builds RRULE string from selections (e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR)
 * Calls createSessionAction server action.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useUIContext } from '@/providers/UIProvider'
import { createSessionAction } from '@/lib/actions/class-sessions'

type SessionCreateFormProps = {
  cohortId: string
}

const DURATION_OPTIONS = [
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes' },
  { value: '90', label: '90 minutes' },
  { value: '120', label: '120 minutes' },
]

const DAYS_OF_WEEK = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
] as const

export function SessionCreateForm({ cohortId }: SessionCreateFormProps) {
  const router = useRouter()
  const { addToast } = useUIContext()
  const [isPending, startTransition] = useTransition()

  const [meetLink, setMeetLink] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [isRecurring, setIsRecurring] = useState(false)
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  function buildRRule(): string | null {
    if (!isRecurring || selectedDays.length === 0) return null
    return `FREQ=WEEKLY;BYDAY=${selectedDays.join(',')}`
  }

  function handleSubmit() {
    setError(null)

    if (!meetLink.trim()) {
      setError('Meet link is required.')
      return
    }
    if (!date) {
      setError('Date is required.')
      return
    }
    if (!time) {
      setError('Time is required.')
      return
    }
    if (isRecurring && selectedDays.length === 0) {
      setError('Select at least one day for recurring sessions.')
      return
    }

    // Build UTC ISO string from date + time (user inputs PKT, so offset by -5h)
    // The date/time inputs give local values. We combine them and send as ISO.
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
    const rrule = buildRRule()

    startTransition(async () => {
      const formData = new FormData()
      formData.set('cohort_id', cohortId)
      formData.set('meet_link', meetLink.trim())
      formData.set('scheduled_at', scheduledAt)
      formData.set('duration_minutes', duration)
      formData.set('is_recurring', isRecurring ? 'true' : 'false')
      if (rrule) {
        formData.set('recurrence_rule', rrule)
      }

      const result = await createSessionAction(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      const count = result.data.sessionIds.length
      const message =
        count > 1
          ? `Created ${count} sessions successfully!`
          : 'Session created successfully!'

      addToast({ type: 'success', message })

      // Reset form
      setMeetLink('')
      setDate('')
      setTime('')
      setDuration('60')
      setIsRecurring(false)
      setSelectedDays([])

      router.refresh()
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <Input
        label="Google Meet Link"
        placeholder="https://meet.google.com/abc-defg-hij"
        value={meetLink}
        onChange={(e) => setMeetLink(e.target.value)}
        type="url"
        required
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="Time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />
        <Select
          label="Duration"
          options={DURATION_OPTIONS}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
      </div>

      {/* Recurring toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is-recurring"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
        />
        <label htmlFor="is-recurring" className="text-sm font-medium text-ink">
          Recurring weekly
        </label>
      </div>

      {/* Day-of-week checkboxes (visible when recurring) */}
      {isRecurring && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">Repeat on</p>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = selectedDays.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`
                    rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                    ${
                      isSelected
                        ? 'bg-brand-600 text-white'
                        : 'border border-border bg-surface text-ink hover:bg-paper'
                    }
                  `}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          {isRecurring ? 'Create Recurring Sessions' : 'Add Session'}
        </Button>
      </div>
    </form>
  )
}
