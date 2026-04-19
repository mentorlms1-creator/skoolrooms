'use client'

/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/new/form.tsx — Create cohort form
 *
 * Client Component. Collects cohort details and calls createCohortAction.
 * billing_day field only shown when fee_type is 'monthly'.
 * "Free course" toggle hides fee_type/fee_pkr/billing_day and forces fee=0.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
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
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isFree, setIsFree] = useState(false)
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
      if (isFree) {
        formData.set('fee_type', 'one_time')
        formData.set('fee_pkr', '0')
      } else {
        formData.set('fee_type', feeType)
        formData.set('fee_pkr', feePkr)
        if (feeType === 'monthly') {
          formData.set('billing_day', billingDay)
        }
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

      toast.success('Cohort created successfully!')
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
      <div className="space-y-2">
        <Label htmlFor="cohort-name">Cohort Name</Label>
        <Input
          id="cohort-name"
          placeholder="e.g. Batch 2026 — January"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start-date">Start Date</Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">End Date</Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Checkbox
            checked={isFree}
            onCheckedChange={(v) => setIsFree(v === true)}
          />
          Free course
        </label>
        <p className="text-xs text-muted-foreground">
          Free cohorts skip payment — students enroll instantly. You won&apos;t earn from this cohort.
        </p>
      </div>

      {!isFree && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fee-type">Fee Type</Label>
              <Select value={feeType} onValueChange={setFeeType}>
                <SelectTrigger id="fee-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee-pkr">Fee (PKR)</Label>
              <Input
                id="fee-pkr"
                type="number"
                min={0}
                placeholder="e.g. 5000"
                value={feePkr}
                onChange={(e) => setFeePkr(e.target.value)}
                required
              />
            </div>
          </div>

          {feeType === 'monthly' && (
            <div className="space-y-2">
              <Label htmlFor="billing-day">Billing Day</Label>
              <Input
                id="billing-day"
                type="number"
                min={1}
                max={28}
                placeholder="1-28"
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
                required
              />
            </div>
          )}
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="max-students">Max Students (leave empty for unlimited)</Label>
        <Input
          id="max-students"
          type="number"
          min={1}
          placeholder="e.g. 30"
          value={maxStudents}
          onChange={(e) => setMaxStudents(e.target.value)}
        />
      </div>

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
