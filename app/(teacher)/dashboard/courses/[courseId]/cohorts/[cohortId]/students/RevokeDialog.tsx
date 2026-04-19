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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  recordRefundAction,
  revokeEnrollmentAction,
} from '@/lib/actions/enrollment-management'
import type { RowPayment } from './StudentRowActions'

type RevokeDialogProps = {
  enrollmentId: string
  studentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: RowPayment | null
  availableBalance: number
}

export function RevokeDialog({
  enrollmentId,
  studentName,
  open,
  onOpenChange,
  payment,
  availableBalance,
}: RevokeDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [alsoRefund, setAlsoRefund] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reset on every open so state doesn't bleed between students
      setReason('')
      setAlsoRefund(false)
      setError(null)
    }
    onOpenChange(next)
  }

  // Refund eligibility — same rule as RefundDialog
  const refundAmount = payment?.teacher_payout_amount_pkr ?? 0
  const refundEligible =
    !!payment &&
    payment.status === 'confirmed' &&
    !payment.refunded_at &&
    payment.payment_method !== 'manual' &&
    availableBalance >= refundAmount &&
    refundAmount > 0

  function handleConfirm() {
    setError(null)
    const trimmed = reason.trim()
    if (!trimmed) {
      setError('A reason is required.')
      return
    }

    startTransition(async () => {
      // Step 1: revoke
      const revokeForm = new FormData()
      revokeForm.set('reason', trimmed)
      const revokeResult = await revokeEnrollmentAction(enrollmentId, revokeForm)

      if (!revokeResult.success) {
        setError(revokeResult.error)
        return
      }

      // Step 2 (optional): refund
      if (alsoRefund && refundEligible) {
        const refundForm = new FormData()
        refundForm.set('refund_mode', 'in_app')
        refundForm.set('refund_note', 'Refunded as part of removal')
        const refundResult = await recordRefundAction(enrollmentId, refundForm)

        if (!refundResult.success) {
          // Partial success — student already removed; surface the refund failure clearly
          toast.error(
            `${studentName} was removed, but refund failed: ${refundResult.error}. Try again from the Record refund option.`,
          )
          setReason('')
          setAlsoRefund(false)
          onOpenChange(false)
          router.refresh()
          return
        }

        toast.success(
          `${studentName} removed and Rs. ${refundAmount.toLocaleString()} refunded.`,
        )
      } else {
        toast.success(`${studentName} has been removed from this cohort.`)
      }

      setReason('')
      setAlsoRefund(false)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {studentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This student will lose access immediately and cannot re-enroll with you. They&apos;ll receive an email with the reason.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="revoke-reason" className="text-xs font-medium text-foreground">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="revoke-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Repeatedly missing classes without notice"
            rows={3}
            disabled={isPending}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {refundEligible && (
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
            <Checkbox
              id="also-refund"
              checked={alsoRefund}
              onCheckedChange={(v) => setAlsoRefund(v === true)}
              disabled={isPending}
              className="mt-0.5"
            />
            <Label
              htmlFor="also-refund"
              className="flex-1 cursor-pointer text-sm font-normal text-foreground"
            >
              Also refund{' '}
              <span className="font-semibold">Rs. {refundAmount.toLocaleString()}</span>{' '}
              to the student
              <span className="mt-0.5 block text-xs text-muted-foreground">
                In-app refund — deducts from your available balance.
              </span>
            </Label>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="danger"
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isPending}
          >
            {isPending
              ? 'Removing…'
              : alsoRefund && refundEligible
                ? 'Remove & refund'
                : 'Remove student'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
