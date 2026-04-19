'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatPKT } from '@/lib/time/pkt'
import {
  approveWithdrawalAction,
  rejectWithdrawalAction,
} from '@/lib/actions/enrollment-management'

type WithdrawalRequestRowProps = {
  enrollmentId: string
  studentName: string
  studentEmail: string
  withdrawalReason: string | null
  requestedAt: string
}

export function WithdrawalRequestRow({
  enrollmentId,
  studentName,
  studentEmail,
  withdrawalReason,
  requestedAt,
}: WithdrawalRequestRowProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approveWithdrawalAction(enrollmentId)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(`${studentName}'s withdrawal approved.`)
      setApproveOpen(false)
      router.refresh()
    })
  }

  function handleReject() {
    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('note', rejectNote.trim())
      const result = await rejectWithdrawalAction(enrollmentId, formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(`${studentName}'s withdrawal request rejected.`)
      setRejectNote('')
      setRejectOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-md border border-warning/40 bg-warning/5 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{studentName}</p>
          <p className="text-sm text-muted-foreground">{studentEmail}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Requested {formatPKT(requestedAt, 'datetime')}
          </p>
          {withdrawalReason && (
            <p className="mt-2 text-sm text-foreground/80">
              <span className="font-medium">Reason:</span> {withdrawalReason}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRejectOpen(true)}
            disabled={isPending}
          >
            Reject
          </Button>
          <Button size="sm" onClick={() => setApproveOpen(true)} disabled={isPending}>
            Approve
          </Button>
        </div>
      </div>

      {/* Approve confirmation */}
      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve withdrawal?</AlertDialogTitle>
            <AlertDialogDescription>
              {studentName} will lose access to this cohort. They&apos;ll be notified by email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleApprove()
              }}
              disabled={isPending}
            >
              {isPending ? 'Approving…' : 'Approve withdrawal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject with optional note */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject withdrawal request?</AlertDialogTitle>
            <AlertDialogDescription>
              The student stays enrolled. They&apos;ll receive an email with your note (if provided).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`reject-note-${enrollmentId}`} className="text-xs font-medium text-foreground">
              Note to student (optional)
            </Label>
            <Textarea
              id={`reject-note-${enrollmentId}`}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Please attend the next class before deciding"
              rows={3}
              disabled={isPending}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={(e) => {
                e.preventDefault()
                handleReject()
              }}
              disabled={isPending}
            >
              {isPending ? 'Rejecting…' : 'Reject request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
