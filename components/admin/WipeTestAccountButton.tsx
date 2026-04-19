'use client'

// =============================================================================
// components/admin/WipeTestAccountButton.tsx — Destructive wipe for test accounts
// Only rendered when teacher email matches test pattern (+test or @test.skoolrooms.com)
// =============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type WipeTestAccountButtonProps = {
  teacherId: string
  teacherEmail: string
}

export function WipeTestAccountButton({ teacherId, teacherEmail }: WipeTestAccountButtonProps) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleWipe() {
    setLoading(true)
    setError(null)

    const response = await fetch(`/api/admin/teachers/${teacherId}/wipe-test-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation_email: confirmEmail }),
    })

    if (response.ok) {
      setShowDialog(false)
      router.push('/admin/teachers')
    } else {
      const data = (await response.json()) as { error?: string }
      setError(data.error ?? 'Wipe failed. Check server logs.')
      setLoading(false)
    }
  }

  return (
    <>
      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-destructive/70">
          Test Account
        </h3>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowDialog(true)}
          className="w-full rounded-xl"
        >
          Wipe Test Account
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Wipe test account?</DialogTitle>
            <DialogDescription>
              This will permanently delete all data for{' '}
              <strong>{teacherEmail}</strong>, including courses, cohorts, students, payments, and
              the Supabase auth user. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm font-medium text-foreground">
              Type the teacher email to confirm:
            </p>
            <Input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={teacherEmail}
              className="font-mono text-sm"
            />
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleWipe}
              disabled={confirmEmail !== teacherEmail || loading}
              loading={loading}
            >
              Wipe Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
