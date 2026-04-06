'use client'

/**
 * components/teacher/NotificationSettingsForm.tsx — Notification preference toggles
 * Business-critical emails (plan_hard_locked, grace_period) are always sent
 * and cannot be disabled.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { updateNotificationPreferencesAction } from '@/lib/actions/teacher-settings'

type NotificationSettingsFormProps = {
  preferences: Record<string, boolean>
}

type NotificationOption = {
  key: string
  label: string
  description: string
  locked?: boolean
}

const NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    key: 'new_enrollment',
    label: 'New Enrollment',
    description: 'When a student enrolls in your cohort.',
  },
  {
    key: 'enrollment_confirmed',
    label: 'Enrollment Confirmed',
    description: 'When a payment is verified and enrollment is confirmed.',
  },
  {
    key: 'payment_approved',
    label: 'Payment Approved',
    description: 'When a screenshot payment is approved.',
  },
  {
    key: 'payment_rejected',
    label: 'Payment Rejected',
    description: 'When a screenshot payment is rejected.',
  },
  {
    key: 'student_comment',
    label: 'Student Comment',
    description: 'When a student comments on an announcement.',
  },
  {
    key: 'class_reminder',
    label: 'Class Reminder',
    description: 'Reminders before your scheduled classes.',
  },
  {
    key: 'fee_reminder',
    label: 'Fee Reminder',
    description: 'Reminders about upcoming student fees.',
  },
  {
    key: 'payout_processed',
    label: 'Payout Processed',
    description: 'When your payout request is processed.',
  },
]

// These are always sent, teacher cannot opt out
const LOCKED_NOTIFICATIONS = [
  { label: 'Plan Hard Locked', description: 'When your plan access is locked after grace period.' },
  { label: 'Grace Period Reminders', description: 'Daily reminders during grace period.' },
  { label: 'Trial Ending Soon', description: 'Warning before trial period ends.' },
]

export function NotificationSettingsForm({
  preferences,
}: NotificationSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const result = await updateNotificationPreferencesAction(formData)

    if (result.success) {
      setMessage({ type: 'success', text: 'Notification preferences saved.' })
      router.refresh()
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(false)
  }

  return (
    <>
      {message && (
        <div
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="divide-y divide-border">
          {NOTIFICATION_OPTIONS.map((opt) => {
            const isChecked = preferences[opt.key] !== false // Default to enabled
            return (
              <label
                key={opt.key}
                htmlFor={opt.key}
                className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 hover:bg-background"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                </div>
                <input
                  type="checkbox"
                  name={opt.key}
                  id={opt.key}
                  defaultChecked={isChecked}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                />
              </label>
            )
          })}
        </Card>

        {/* Locked notifications */}
        <Card className="mt-4 divide-y divide-border">
          <div className="px-6 py-3 bg-background">
            <p className="text-xs font-medium text-muted-foreground">
              Business-critical (always sent, cannot be disabled)
            </p>
          </div>
          {LOCKED_NOTIFICATIONS.map((opt) => (
            <div
              key={opt.label}
              className="flex items-center justify-between gap-4 px-6 py-4 opacity-60"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
              </div>
              <input
                type="checkbox"
                checked
                disabled
                className="h-4 w-4 rounded border-border text-primary"
              />
            </div>
          ))}
        </Card>

        <div className="mt-4 flex justify-end">
          <Button type="submit" loading={loading}>
            Save Preferences
          </Button>
        </div>
      </form>
    </>
  )
}
