'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { recordRefundAction } from '@/lib/actions/enrollment-management'
import type { RowPayment } from './StudentRowActions'

type RefundDialogProps = {
  enrollmentId: string
  studentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: RowPayment | null
  availableBalance: number
}

export function RefundDialog({
  enrollmentId,
  studentName,
  open,
  onOpenChange,
  payment,
  availableBalance,
}: RefundDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<'in_app' | 'offline'>('offline')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Eligibility per ARCHITECTURE §7
  const isManual = payment?.payment_method === 'manual'
  const alreadyRefunded = !!payment?.refunded_at
  const notConfirmed = payment?.status !== 'confirmed'
  const refundAmount = payment?.teacher_payout_amount_pkr ?? 0
  const inAppEligible =
    !!payment && !alreadyRefunded && !notConfirmed && !isManual && availableBalance >= refundAmount

  // Default mode: in-app if eligible, otherwise offline
  function handleOpenChange(next: boolean) {
    if (next) {
      setMode(inAppEligible ? 'in_app' : 'offline')
      setNote('')
      setError(null)
    }
    onOpenChange(next)
  }

  function handleSubmit() {
    setError(null)

    if (mode === 'offline' && !note.trim()) {
      setError('A note is required for offline refunds (e.g. "Rs. 3,500 returned via JazzCash").')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('refund_mode', mode)
      formData.set('refund_note', note.trim())
      if (payment?.id) formData.set('paymentId', payment.id)
      const result = await recordRefundAction(enrollmentId, formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      toast.success(
        mode === 'in_app'
          ? `Refunded Rs. ${refundAmount.toLocaleString()} to ${studentName}.`
          : `Offline refund recorded for ${studentName}.`,
      )
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record refund — {studentName}</DialogTitle>
          <DialogDescription>
            In-app refund deducts from your available balance. Offline refund just records that you returned the money outside the platform.
          </DialogDescription>
        </DialogHeader>

        {!payment ? (
          <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            No payment record found for this enrollment.
          </p>
        ) : alreadyRefunded ? (
          <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            This payment was already refunded.
          </p>
        ) : (
          <>
            {/* Payment summary */}
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium text-foreground">
                  Rs. {payment.amount_pkr.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credited to your balance</span>
                <span className="font-medium text-foreground">
                  Rs. {refundAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your available balance</span>
                <span className="font-medium text-foreground">
                  Rs. {availableBalance.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Mode picker */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-foreground">Refund method</Label>
              <div className="grid gap-2">
                <ModeOption
                  selected={mode === 'in_app'}
                  disabled={!inAppEligible}
                  onClick={() => setMode('in_app')}
                  title={`In-app — deduct Rs. ${refundAmount.toLocaleString()} from balance`}
                  desc={
                    isManual
                      ? 'Not available for manual (cash) enrollments — money never went through the platform.'
                      : !inAppEligible
                        ? 'Insufficient balance — the amount may have already been paid out. Use offline.'
                        : 'Marks the payment refunded and reduces your available balance.'
                  }
                />
                <ModeOption
                  selected={mode === 'offline'}
                  onClick={() => setMode('offline')}
                  title="Offline — I returned the money myself"
                  desc="Records a note. Your balance is not affected."
                />
              </div>
            </div>

            {/* Note */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="refund-note" className="text-xs font-medium text-foreground">
                Note {mode === 'offline' && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="refund-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  mode === 'offline'
                    ? 'e.g. Rs. 3,500 returned via JazzCash on 19-Apr-2026'
                    : 'Optional internal note'
                }
                rows={2}
                disabled={isPending}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          {payment && !alreadyRefunded && (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Recording…' : 'Record refund'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeOption({
  selected,
  disabled,
  onClick,
  title,
  desc,
}: {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-accent/30'
      } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent`}
    >
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </button>
  )
}
