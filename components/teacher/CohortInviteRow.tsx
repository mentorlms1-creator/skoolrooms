'use client'

/**
 * components/teacher/CohortInviteRow.tsx
 *
 * Compact invite row used on the cohort detail page. Shows a "share" icon,
 * a brief title + helper line, and two trailing actions: Copy link, Preview.
 * On copy, fires the 'link_shared' onboarding step and flashes a confirmation.
 */

import { useState, useCallback, useRef } from 'react'
import { Link2, Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTeacherContext } from '@/providers/TeacherProvider'
import { teacherSubdomainUrl } from '@/lib/platform/domain'
import { completeOnboardingStep } from '@/lib/actions/onboarding'

type Props = {
  inviteToken: string
}

export function CohortInviteRow({ inviteToken }: Props) {
  const { teacher } = useTeacherContext()
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inviteUrl = teacherSubdomainUrl(teacher.subdomain, `/join/${inviteToken}`)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 2000)
      void completeOnboardingStep('link_shared')
    } catch {
      // Clipboard unavailable (non-HTTPS); silently ignore.
    }
  }, [inviteUrl])

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border/40 bg-card px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:flex-row sm:items-center sm:gap-5 sm:px-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Link2 className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Invite students to join</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          Share the invite link with your students — {inviteUrl}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <a
          href={inviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Preview
        </a>
      </div>
    </div>
  )
}
