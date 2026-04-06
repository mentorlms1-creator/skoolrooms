'use client'

/**
 * components/public/WaitlistForm.tsx — Public waitlist join form
 * Shown on the enrollment page when the cohort is full and waitlist is enabled.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
          <div className="space-y-2">
            <Label htmlFor="student_name">Full Name</Label>
            <Input
              id="student_name"
              name="student_name"
              required
              minLength={2}
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="student_email">Email</Label>
            <Input
              id="student_email"
              name="student_email"
              type="email"
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="student_phone">Phone Number</Label>
            <Input
              id="student_phone"
              name="student_phone"
              type="tel"
              required
              placeholder="03XX-XXXXXXX"
            />
          </div>

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
