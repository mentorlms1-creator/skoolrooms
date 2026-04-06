'use client'

/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/new/form.tsx — Create cohort form
 *
 * Client Component. Collects cohort details and calls createCohortAction.
 * billing_day field only shown when fee_type is 'monthly'.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useUIContext } from '@/providers/UIProvider'
import { createCohortAction } from '@/lib/actions/cohorts'
import { ROUTES } from '@/constants/routes'

type CreateCohortFormProps = {
  courseId: string
}

const FEE_TYPE_OPTIONS = [
  { value: 'one_time', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
]

export function CreateCohortForm({ courseId }: CreateCohortFormProps) {
  const router = useRouter()
  const { addToast } = useUIContext()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [feeType, setFeeType] = useState('one_time')
  const [feePkr, setFeePkr] = useState('')
  const [billingDay, setBillingDay] = useState('')
  const [maxStudents, setMaxStudents] = useState('')
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true)
  const [waitlistEnabled, setWaitlistEnabled] = useState(false)
  const [pendingCanSeeSchedule, setPendingCanSeeSchedule] = useState(false)
  const [pendingCanSeeAnnouncements, setPendingCanSeeAnnouncements] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('course_id', courseId)
      formData.set('name', name)
      formData.set('start_date', startDate)
      formData.set('end_date', endDate)
      formData.set('fee_type', feeType)
      formData.set('fee_pkr', feePkr)
      if (feeType === 'monthly') {
        formData.set('billing_day', billingDay)
      }
      if (maxStudents.trim() !== '') {
        formData.set('max_students', maxStudents)
      }
      formData.set('is_registration_open', isRegistrationOpen ? 'true' : 'false')
      formData.set('waitlist_enabled', waitlistEnabled ? 'true' : 'false')
      formData.set('pending_can_see_schedule', pendingCanSeeSchedule ? 'true' : 'false')
      formData.set('pending_can_see_announcements', pendingCanSeeAnnouncements ? 'true' : 'false')

      const result = await createCohortAction(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      addToast({ type: 'success', message: 'Cohort created successfully!' })
      router.push(ROUTES.TEACHER.cohortDetail(courseId, result.data.cohortId))
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      className="flex flex-col gap-6"
    >
      <Input
        label="Cohort Name"
        placeholder="e.g. Batch 2026 — January"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Start Date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <Input
          label="End Date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Fee Type"
          options={FEE_TYPE_OPTIONS}
          value={feeType}
          onChange={(e) => setFeeType(e.target.value)}
        />
        <Input
          label="Fee (PKR)"
          type="number"
          min={0}
          placeholder="e.g. 5000"
          value={feePkr}
          onChange={(e) => setFeePkr(e.target.value)}
          required
        />
      </div>

      {feeType === 'monthly' && (
        <Input
          label="Billing Day"
          type="number"
          min={1}
          max={28}
          placeholder="1–28"
          value={billingDay}
          onChange={(e) => setBillingDay(e.target.value)}
          required
        />
      )}

      <Input
        label="Max Students (leave empty for unlimited)"
        type="number"
        min={1}
        placeholder="e.g. 30"
        value={maxStudents}
        onChange={(e) => setMaxStudents(e.target.value)}
      />

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isRegistrationOpen}
            onChange={(e) => setIsRegistrationOpen(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
          />
          Registration open
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={waitlistEnabled}
            onChange={(e) => setWaitlistEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
          />
          Enable waitlist (when cohort is full)
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={pendingCanSeeSchedule}
            onChange={(e) => setPendingCanSeeSchedule(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
          />
          Pending students can see schedule
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={pendingCanSeeAnnouncements}
            onChange={(e) => setPendingCanSeeAnnouncements(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
          />
          Pending students can see announcements
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Create Cohort
        </Button>
      </div>
    </form>
  )
}
