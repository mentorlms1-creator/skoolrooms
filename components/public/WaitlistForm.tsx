'use client'

/**
 * components/public/WaitlistForm.tsx — Public waitlist join form
 * Shown on the enrollment page when the cohort is full and waitlist is enabled.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/card'
import { joinWaitlistAction } from '@/lib/actions/waitlist'

type WaitlistFormProps = {
  cohortId: string
  cohortName: string
  courseName: string
}

export function WaitlistForm({ cohortId, cohortName, courseName }: WaitlistFormProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    formData.set('cohort_id', cohortId)

    const result = await joinWaitlistAction(formData)

    if (result.success) {
      setMessage({
        type: 'success',
        text: 'You have been added to the waitlist! We will notify you when a spot opens up.',
      })
    } else {
      setMessage({ type: 'error', text: result.error })
    }

    setLoading(false)
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground">Join the Waitlist</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        All spots in <span className="font-medium">{cohortName}</span> for{' '}
        <span className="font-medium">{courseName}</span> are currently taken.
        Join the waitlist to be notified when a spot opens up.
      </p>

      {message && (
        <div
          className={`mt-4 rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      {message?.type !== 'success' && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Input
            label="Full Name"
            name="student_name"
            required
            minLength={2}
            placeholder="Enter your name"
          />

          <Input
            label="Email"
            name="student_email"
            type="email"
            required
            placeholder="your@email.com"
          />

          <Input
            label="Phone Number"
            name="student_phone"
            type="tel"
            required
            placeholder="03XX-XXXXXXX"
          />

          <div className="pt-2">
            <Button type="submit" loading={loading} className="w-full">
              Join Waitlist
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
