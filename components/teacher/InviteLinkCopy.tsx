'use client'

/**
 * components/teacher/InviteLinkCopy.tsx — Copy invite link to clipboard
 *
 * Client Component. Displays the invite URL for a cohort and provides
 * a copy button. Marks onboarding step 'link_shared' on first copy.
 */

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { useTeacherContext } from '@/providers/TeacherProvider'
import { teacherSubdomainUrl } from '@/lib/platform/domain'
import { completeOnboardingStep } from '@/lib/actions/onboarding'

type InviteLinkCopyProps = {
  inviteToken: string
}

export function InviteLinkCopy({ inviteToken }: InviteLinkCopyProps) {
  const { teacher } = useTeacherContext()
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inviteUrl = teacherSubdomainUrl(teacher.subdomain, `/join/${inviteToken}`)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)

      // Clear previous timeout if user clicks again quickly
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)

      // Fire and forget onboarding step
      void completeOnboardingStep('link_shared')
    } catch {
      // Clipboard API not available (e.g. non-HTTPS)
    }
  }, [inviteUrl])

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">Invite Link</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={inviteUrl}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
