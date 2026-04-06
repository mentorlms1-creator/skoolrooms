'use client'

// =============================================================================
// app/(teacher)/onboarding/step-2/form.tsx — Subdomain picker with availability check
// =============================================================================

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RESERVED_SUBDOMAINS } from '@/constants/plans'
import { ROUTES } from '@/constants/routes'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/
const reservedSet = new Set(RESERVED_SUBDOMAINS)

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

type Step2FormProps = {
  defaultSubdomain: string
  domain: string
}

export function Step2Form({ defaultSubdomain, domain }: Step2FormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [subdomain, setSubdomain] = useState(defaultSubdomain)
  const [status, setStatus] = useState<AvailabilityStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const validate = useCallback((value: string): string | null => {
    if (value.length < 3) {
      return 'Subdomain must be at least 3 characters.'
    }
    if (value.length > 30) {
      return 'Subdomain must be 30 characters or less.'
    }
    if (!SUBDOMAIN_REGEX.test(value)) {
      return 'Only lowercase letters, numbers, and hyphens. Must start and end with a letter or number.'
    }
    if (reservedSet.has(value)) {
      return `"${value}" is reserved and cannot be used.`
    }
    return null
  }, [])

  function handleChange(value: string) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSubdomain(normalized)
    setStatus('idle')
    setError(null)
  }

  async function checkAvailability() {
    const validationError = validate(subdomain)
    if (validationError) {
      setError(validationError)
      setStatus('invalid')
      return
    }

    setStatus('checking')
    setError(null)

    try {
      const response = await fetch(
        `${ROUTES.API.cloudflare.subdomain}?check=${encodeURIComponent(subdomain)}`,
      )
      const data = (await response.json()) as
        | { success: true; data: { available: boolean } }
        | { success: false; error: string }

      if (!data.success) {
        setError('Failed to check availability. Please try again.')
        setStatus('idle')
        return
      }

      if (data.data.available) {
        setStatus('available')
      } else {
        setStatus('taken')
        setError(`"${subdomain}" is already taken. Try another name.`)
      }
    } catch {
      setError('Failed to check availability. Please try again.')
      setStatus('idle')
    }
  }

  function handleConfirm() {
    if (status !== 'available') return

    setConfirming(true)
    startTransition(async () => {
      try {
        // Create subdomain via API
        const response = await fetch(ROUTES.API.cloudflare.subdomain, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomain }),
        })

        const data = (await response.json()) as
          | { success: true; data: { subdomain: string } }
          | { success: false; error: string }

        if (!data.success) {
          setError(data.error)
          setConfirming(false)
          return
        }

        // Subdomain is set — proceed to profile step.
        // This doesn't complete a checklist step (the 5 checklist steps are
        // profile_complete, payment_details_set, course_created, cohort_created, link_shared).
        router.push(ROUTES.PLATFORM.onboarding.step3)
      } catch {
        setError('Something went wrong. Please try again.')
        setConfirming(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Subdomain input */}
      <div>
        <div className="space-y-2">
          <Label htmlFor="subdomain">Your subdomain</Label>
          <Input
            id="subdomain"
            value={subdomain}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="your-name"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {/* Live preview */}
        <p className="mt-2 text-sm text-muted-foreground">
          Your page:{' '}
          <span className="font-medium text-foreground">
            {subdomain || 'your-name'}.{domain}
          </span>
        </p>
      </div>

      {/* Availability status indicator */}
      {status === 'available' && (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5 text-success"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium text-success">
            &quot;{subdomain}&quot; is available
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {status !== 'available' ? (
          <Button
            onClick={checkAvailability}
            loading={status === 'checking'}
            disabled={status === 'checking' || subdomain.length < 3}
            variant="secondary"
            className="flex-1"
            size="lg"
          >
            Check Availability
          </Button>
        ) : (
          <Button
            onClick={handleConfirm}
            loading={confirming || isPending}
            disabled={confirming || isPending}
            className="flex-1"
            size="lg"
          >
            Confirm & Continue
          </Button>
        )}
      </div>
    </div>
  )
}
