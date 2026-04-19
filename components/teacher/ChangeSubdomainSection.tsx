'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { changeSubdomainAction } from '@/lib/actions/teacher-account'
import { platformDomain } from '@/lib/platform/domain'

type Props = {
  currentSubdomain: string
  subdomainChangedAt: string | null
}

export function ChangeSubdomainSection({ currentSubdomain, subdomainChangedAt }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const domain = platformDomain()

  // Compute cooldown state
  const cooldownEnd = subdomainChangedAt
    ? new Date(new Date(subdomainChangedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null
  const isOnCooldown = cooldownEnd ? new Date() < cooldownEnd : false

  function handleOpen() {
    setInputValue('')
    setError(null)
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    setError(null)
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await changeSubdomainAction(inputValue.trim().toLowerCase())
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-1 text-base font-semibold text-foreground">Subdomain</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Your public teaching page URL. Students use this to find and enroll in your courses.
      </p>

      <div className="mb-4 rounded-md bg-muted/50 px-4 py-3 font-mono text-sm text-foreground">
        {currentSubdomain}.{domain}
      </div>

      {isOnCooldown ? (
        <p className="text-sm text-muted-foreground">
          Next change available:{' '}
          <span className="font-medium text-foreground">
            {cooldownEnd!.toLocaleDateString('en-PK', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </p>
      ) : (
        <Button variant="outline" onClick={handleOpen}>
          Change subdomain
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change your subdomain</DialogTitle>
            <DialogDescription>
              After changing, your old link ({currentSubdomain}.{domain}) will stop working
              immediately. You cannot change again for 30 days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="new-subdomain">New subdomain</Label>
            <Input
              id="new-subdomain"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                setError(null)
              }}
              placeholder="your-new-name"
              autoComplete="off"
            />
            {inputValue && (
              <p className="text-sm text-muted-foreground">
                Your new URL:{' '}
                <span className="font-medium text-foreground">
                  {inputValue}.{domain}
                </span>
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              loading={isPending}
              disabled={isPending || !inputValue.trim()}
              variant="destructive"
            >
              Confirm change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
