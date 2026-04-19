'use client'

// =============================================================================
// PayoutActions.tsx — Client component for admin payout complete/fail actions
// Uses useActionState to show confirmation dialogs with admin note input.
// =============================================================================

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { completePayoutAction, failPayoutAction } from '@/lib/actions/admin-payouts'
import type { ApiResponse } from '@/types/api'

// -----------------------------------------------------------------------------
// CompletePayoutButton
// -----------------------------------------------------------------------------
export function CompletePayoutButton({ payoutId }: { payoutId: string }) {
  const [open, setOpen] = useState(false)
  const [adminNote, setAdminNote] = useState('')

  const [state, formAction, isPending] = useActionState(
    async (_prev: ApiResponse<null> | null, formData: FormData): Promise<ApiResponse<null>> => {
      const note = formData.get('adminNote') as string
      const result = await completePayoutAction(payoutId, note)
      if (result.success) setOpen(false)
      return result
    },
    null,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 px-3 text-xs">
          Mark Complete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payout</DialogTitle>
          <DialogDescription>
            Confirm you have transferred the funds to the teacher&apos;s account. This action is
            permanent.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`note-complete-${payoutId}`}>Admin Note (optional)</Label>
            <Textarea
              id={`note-complete-${payoutId}`}
              name="adminNote"
              placeholder="e.g. Transferred via HBL on 19 Apr 2026"
              rows={3}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </div>
          {state && !state.success && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Processing...' : 'Confirm Complete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// -----------------------------------------------------------------------------
// FailPayoutButton
// -----------------------------------------------------------------------------
export function FailPayoutButton({ payoutId }: { payoutId: string }) {
  const [open, setOpen] = useState(false)
  const [adminNote, setAdminNote] = useState('')

  const [state, formAction, isPending] = useActionState(
    async (_prev: ApiResponse<null> | null, formData: FormData): Promise<ApiResponse<null>> => {
      const note = formData.get('adminNote') as string
      const result = await failPayoutAction(payoutId, note)
      if (result.success) setOpen(false)
      return result
    },
    null,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive" className="h-8 px-3 text-xs">
          Mark Failed
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fail Payout</DialogTitle>
          <DialogDescription>
            Mark this payout as failed. The teacher&apos;s available balance will be restored and they
            will be notified.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`note-fail-${payoutId}`}>Reason (optional)</Label>
            <Textarea
              id={`note-fail-${payoutId}`}
              name="adminNote"
              placeholder="e.g. Invalid bank details — IBAN not matching"
              rows={3}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </div>
          {state && !state.success && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? 'Processing...' : 'Confirm Failed'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
