'use client'

/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/edit/form.tsx — Edit cohort form
 *
 * Client Component. Pre-filled form with save and archive actions.
 * Archive uses confirm modal. billing_day only shown for monthly fee type.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/button'
import { useUIContext } from '@/providers/UIProvider'
import { updateCohortAction, archiveCohortAction } from '@/lib/actions/cohorts'
import { ROUTES } from '@/constants/routes'

type EditCohortFormProps = {
  courseId: string
  cohortId: string
  defaultName: string
  defaultStartDate: string
  defaultEndDate: string
  defaultFeeType: string
  defaultFeePkr: number
  defaultBillingDay: number | null
  defaultMaxStudents: number | null
  defaultIsRegistrationOpen: boolean
  defaultWaitlistEnabled: boolean
  defaultPendingCanSeeSchedule: boolean
  defaultPendingCanSeeAnnouncements: boolean
}

const FEE_TYPE_OPTIONS = [
  { value: 'one_time', label: 'One-time' },
  { value: 'monthly', label: 'Monthly' },
]

export function EditCohortForm({
  courseId,
  cohortId,
  defaultName,
  defaultStartDate,
  defaultEndDate,
  defaultFeeType,
  defaultFeePkr,
  defaultBillingDay,
  defaultMaxStudents,
  defaultIsRegistrationOpen,
  defaultWaitlistEnabled,
  defaultPendingCanSeeSchedule,
  defaultPendingCanSeeAnnouncements,
}: EditCohortFormProps) {
  const router = useRouter()
  const { addToast, confirm } = useUIContext()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(defaultName)
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [feeType, setFeeType] = useState(defaultFeeType)
  const [feePkr, setFeePkr] = useState(String(defaultFeePkr))
  const [billingDay, setBillingDay] = useState(
    defaultBillingDay !== null ? String(defaultBillingDay) : '',
  )
  const [maxStudents, setMaxStudents] = useState(
    defaultMaxStudents !== null ? String(defaultMaxStudents) : '',
  )
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(defaultIsRegistrationOpen)
  const [waitlistEnabled, setWaitlistEnabled] = useState(defaultWaitlistEnabled)
  const [pendingCanSeeSchedule, setPendingCanSeeSchedule] = useState(defaultPendingCanSeeSchedule)
  const [pendingCanSeeAnnouncements, setPendingCanSeeAnnouncements] = useState(
    defaultPendingCanSeeAnnouncements,
  )
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    setError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('name', name)
      formData.set('start_date', startDate)
      formData.set('end_date', endDate)
      formData.set('fee_type', feeType)
      formData.set('fee_pkr', feePkr)
      if (feeType === 'monthly') {
        formData.set('billing_day', billingDay)
      }
      formData.set('max_students', maxStudents)
      formData.set('is_registration_open', isRegistrationOpen ? 'true' : 'false')
      formData.set('waitlist_enabled', waitlistEnabled ? 'true' : 'false')
      formData.set('pending_can_see_schedule', pendingCanSeeSchedule ? 'true' : 'false')
      formData.set('pending_can_see_announcements', pendingCanSeeAnnouncements ? 'true' : 'false')

      const result = await updateCohortAction(cohortId, formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      addToast({ type: 'success', message: 'Cohort updated successfully!' })
      router.push(ROUTES.TEACHER.cohortDetail(courseId, cohortId))
    })
  }

  function handleArchive() {
    confirm({
      title: 'Archive Cohort',
      message:
        'Are you sure you want to archive this cohort? This action is permanent and cannot be undone. Pending enrollments will be rejected and waitlist entries will expire.',
      confirmText: 'Archive',
      confirmVariant: 'danger',
      onConfirm: async () => {
        const result = await archiveCohortAction(cohortId)

        if (!result.success) {
          addToast({ type: 'error', message: result.error })
          return
        }

        addToast({ type: 'success', message: 'Cohort archived.' })
        router.push(ROUTES.TEACHER.courseDetail(courseId))
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button
          type="button"
          variant="danger"
          onClick={handleArchive}
          disabled={isPending}
        >
          Archive Cohort
        </Button>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            loading={isPending}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
