'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { RefundDialog } from './RefundDialog'
import {
  approveMonthlyPaymentAction,
  rejectMonthlyPaymentAction,
} from '@/lib/actions/student-payments'
import { formatPKT } from '@/lib/time/pkt'

export type ModalPayment = {
  id: string
  payment_month: string | null
  amount_pkr: number
  teacher_payout_amount_pkr: number
  platform_cut_pkr: number
  payment_method: string
  status: string
  screenshot_url: string | null
  rejection_reason: string | null
  refunded_at: string | null
  verified_at: string | null
}

type EnrollmentPaymentsModalProps = {
  enrollmentId: string
  studentName: string
  cohortFeeType: string
  payments: ModalPayment[]
  availableBalance: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EnrollmentPaymentsModal({
  enrollmentId,
  studentName,
  payments,
  availableBalance,
  open,
  onOpenChange,
}: EnrollmentPaymentsModalProps) {
  const router = useRouter()
  const [approveTarget, setApproveTarget] = useState<ModalPayment | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ModalPayment | null>(null)
  const [refundTarget, setRefundTarget] = useState<ModalPayment | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payments — {studentName}</DialogTitle>
          </DialogHeader>

          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {payments.map((p) => (
                <PaymentRow
                  key={p.id}
                  payment={p}
                  studentName={studentName}
                  onApprove={() => setApproveTarget(p)}
                  onReject={() => { setRejectTarget(p); setRejectReason('') }}
                  onRefund={() => setRefundTarget(p)}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve confirmation */}
      {approveTarget && (
        <ApproveAlertDialog
          payment={approveTarget}
          studentName={studentName}
          onClose={() => setApproveTarget(null)}
          onSuccess={() => {
            setApproveTarget(null)
            router.refresh()
          }}
        />
      )}

      {/* Reject dialog */}
      {rejectTarget && (
        <RejectAlertDialog
          payment={rejectTarget}
          studentName={studentName}
          reason={rejectReason}
          onReasonChange={setRejectReason}
          onClose={() => setRejectTarget(null)}
          onSuccess={() => {
            setRejectTarget(null)
            router.refresh()
          }}
        />
      )}

      {/* Refund dialog — reuse existing RefundDialog */}
      {refundTarget && (
        <RefundDialog
          enrollmentId={enrollmentId}
          studentName={studentName}
          open={!!refundTarget}
          onOpenChange={(v) => { if (!v) setRefundTarget(null) }}
          payment={{
            id: refundTarget.id,
            amount_pkr: refundTarget.amount_pkr,
            teacher_payout_amount_pkr: refundTarget.teacher_payout_amount_pkr,
            platform_cut_pkr: refundTarget.platform_cut_pkr,
            payment_method: refundTarget.payment_method,
            refunded_at: refundTarget.refunded_at,
            status: refundTarget.status,
            screenshot_url: refundTarget.screenshot_url,
          }}
          availableBalance={availableBalance}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// PaymentRow — single row inside the modal
// ---------------------------------------------------------------------------

function PaymentRow({
  payment,
  studentName,
  onApprove,
  onReject,
  onRefund,
}: {
  payment: ModalPayment
  studentName: string
  onApprove: () => void
  onReject: () => void
  onRefund: () => void
}) {
  const monthLabel = payment.payment_month
    ? formatPKT(`${payment.payment_month}T00:00:00Z`, 'date').replace(/^\d+\s/, '')
    : '—'

  const isRefunded = !!payment.refunded_at
  const isConfirmed = payment.status === 'confirmed'
  const isPending = payment.status === 'pending_verification'

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{monthLabel}</span>
            <StatusBadge status={payment.status} size="sm" />
            {isRefunded && (
              <span className="text-xs text-muted-foreground">
                Refunded {payment.refunded_at ? formatPKT(payment.refunded_at, 'date') : ''}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            Rs. {payment.amount_pkr.toLocaleString()}
            {payment.teacher_payout_amount_pkr > 0 && (
              <> · yours Rs. {payment.teacher_payout_amount_pkr.toLocaleString()}</>
            )}
          </p>
          {payment.verified_at && (
            <p className="text-xs text-muted-foreground">
              Verified {formatPKT(payment.verified_at, 'date')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {payment.screenshot_url && (
            <a
              href={payment.screenshot_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Screenshot
            </a>
          )}

          {isPending && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-success border-success/30 hover:bg-success/10"
                onClick={onApprove}
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={onReject}
              >
                <XCircle className="mr-1 h-3 w-3" />
                Reject
              </Button>
            </>
          )}

          {isConfirmed && !isRefunded && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onRefund}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Refund
            </Button>
          )}
        </div>
      </div>

      {payment.status === 'rejected' && (
        <p className="mt-2 text-xs text-destructive">
          {payment.rejection_reason
            ? `Rejected: ${payment.rejection_reason}`
            : 'Rejected — no reason provided'}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ApproveAlertDialog — inline confirmation for approving a payment
// ---------------------------------------------------------------------------

function ApproveAlertDialog({
  payment,
  studentName,
  onClose,
  onSuccess,
}: {
  payment: ModalPayment
  studentName: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await approveMonthlyPaymentAction(payment.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Payment approved for ${studentName}.`)
      onSuccess()
    })
  }

  return (
    <AlertDialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve payment?</AlertDialogTitle>
          <AlertDialogDescription>
            This will confirm the payment for {studentName} and credit your balance.
            Rs. {payment.amount_pkr.toLocaleString()} · {
              payment.payment_month
                ? formatPKT(`${payment.payment_month}T00:00:00Z`, 'date').replace(/^\d+\s/, '')
                : 'one-time'
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Approving…' : 'Approve'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------------------------------------------------------------------------
// RejectAlertDialog — inline rejection with reason textarea
// ---------------------------------------------------------------------------

function RejectAlertDialog({
  payment,
  studentName,
  reason,
  onReasonChange,
  onClose,
  onSuccess,
}: {
  payment: ModalPayment
  studentName: string
  reason: string
  onReasonChange: (v: string) => void
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await rejectMonthlyPaymentAction(payment.id, reason)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Payment rejected for ${studentName}.`)
      onSuccess()
    })
  }

  return (
    <AlertDialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject payment?</AlertDialogTitle>
          <AlertDialogDescription>
            The student will be notified and can re-upload their screenshot.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="px-1 pb-2">
          <Label htmlFor="reject-reason" className="text-xs font-medium text-foreground">
            Reason (optional)
          </Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="e.g. Screenshot unclear, amount doesn't match"
            rows={2}
            disabled={isPending}
            className="mt-1.5"
          />
        </div>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Rejecting…' : 'Reject'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
