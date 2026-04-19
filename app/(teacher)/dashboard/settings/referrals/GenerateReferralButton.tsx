'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { generateReferralCodeAction } from '@/lib/actions/referrals'

export function GenerateReferralButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [referralUrl, setReferralUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const result = await generateReferralCodeAction()
      if (result.success) {
        setReferralUrl(result.data.referralUrl)
      } else {
        setError(result.error ?? 'Failed to generate code.')
      }
    })
  }

  if (referralUrl) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <code className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-mono text-foreground break-all">
          {referralUrl}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(referralUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleGenerate} disabled={isPending}>
        {isPending ? 'Generating...' : 'Generate My Referral Link'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
