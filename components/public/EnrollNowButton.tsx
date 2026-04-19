'use client'

/**
 * components/public/EnrollNowButton.tsx
 * Client Component — calls /api/student/enroll. Redirects on result.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Props = {
  cohortId: string
  inviteToken: string
  isFree: boolean
  loginHref: string
}

function newIdempotencyKey(cohortId: string): string {
  // crypto.randomUUID is supported in modern browsers + edge runtimes.
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${cohortId}:${rand}`
}

export function EnrollNowButton({ cohortId, inviteToken, isFree, loginHref }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/student/enroll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cohortId, idempotencyKey: newIdempotencyKey(cohortId) }),
      })

      let json: { success?: boolean; error?: string; code?: string; data?: { enrollmentId: string; status: string } } = {}
      try {
        json = await res.json()
      } catch {
        // ignore parse errors
      }

      if (!res.ok || !json.success) {
        if (res.status === 401 || json.code === 'UNAUTHORIZED') {
          router.push(loginHref)
          return
        }
        const msg = json.error ?? 'Enrollment failed. Please try again.'
        setError(msg)
        toast.error(msg)
        return
      }

      const data = json.data!
      if (data.status === 'active') {
        toast.success('Enrolled! Welcome aboard.')
        router.push('/student')
        return
      }
      if (data.status === 'waitlisted') {
        toast.success('Added to waitlist.')
        router.refresh()
        return
      }
      // pending_verification — go to payment page
      router.push(`/join/${inviteToken}/pay/${data.enrollmentId}`)
    })
  }

  return (
    <div>
      <Button className="w-full" size="lg" onClick={handleClick} loading={isPending}>
        {isFree ? 'Join for free' : 'Enroll Now'}
      </Button>
      {error && <p className="mt-2 text-center text-xs text-destructive">{error}</p>}
    </div>
  )
}
