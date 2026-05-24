'use client'

/**
 * components/teacher/PaymentCard.tsx — Single pending payment card
 * Displays student info, payment details, screenshot preview, and action buttons.
 */

import { useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatPKT } from '@/lib/time/pkt'

type PaymentCardPayment = {
  id: string
  amount_pkr: number
  discounted_amount_pkr: number
  payment_method: string
  screenshot_url: string | null
  status: string
  created_at: string
  verified_at?: string | null
  refunded_at?: string | null
  rejection_reason?: string | null
  updated_at?: string | null
}

type PaymentCardProps = {
  enrollmentId: string
  referenceCode: string
  student: {
    name: string
    email: string
    phone: string
  }
  cohort: {
    name: string
    fee_pkr: number
  }
  payment: PaymentCardPayment
  /** Provide both to render Approve/Reject actions (pending review mode). Omit for history mode. */
  onApprove?: (enrollmentId: string) => void
  onReject?: (enrollmentId: string) => void
  disabled?: boolean
}

export function PaymentCard({
  enrollmentId,
  referenceCode,
  student,
  cohort,
  payment,
  onApprove,
  onReject,
  disabled = false,
}: PaymentCardProps) {
  const [screenshotOpen, setScreenshotOpen] = useState(false)

  const formattedAmount = new Intl.NumberFormat('en-PK').format(
    payment.discounted_amount_pkr
  )

  return (
    <>
      <Card className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left side: info */}
          <div className="flex-1 space-y-3">
            {/* Student name + status */}
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-foreground">
                {student.name}
              </h3>
              <StatusBadge status={payment.status} size="sm" />
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Email </span>
                <span className="text-foreground">{student.email}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Phone </span>
                <span className="text-foreground">{student.phone}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Cohort </span>
                <span className="text-foreground">{cohort.name}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Amount </span>
                <span className="font-medium text-foreground">Rs. {formattedAmount}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Reference </span>
                <span className="font-mono text-foreground">REF-{referenceCode}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Uploaded </span>
                <span className="text-foreground">
                  {formatPKT(payment.created_at, 'datetime')}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Method </span>
                <span className="text-foreground capitalize">{payment.payment_method}</span>
              </div>
            </div>
          </div>

          {/* Right side: screenshot thumbnail */}
          <div className="flex flex-col items-center gap-3 sm:items-end">
            {payment.screenshot_url ? (
              <button
                type="button"
                onClick={() => setScreenshotOpen(true)}
                className="overflow-hidden rounded-xl ring-1 ring-foreground/5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="View payment screenshot"
              >
                <Image
                  src={payment.screenshot_url}
                  alt="Payment screenshot"
                  width={112}
                  height={112}
                  className="h-24 w-24 object-cover sm:h-28 sm:w-28"
                  sizes="112px"
                />
              </button>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-xl ring-1 ring-foreground/5 bg-background text-xs text-muted-foreground sm:h-28 sm:w-28">
                No screenshot
              </div>
            )}
          </div>
        </div>

        {/* Footer — action buttons in pending mode, decision summary otherwise */}
        {payment.status === 'pending' && onApprove && onReject ? (
          <div className="mt-4 flex items-center justify-end gap-3 border-t border-foreground/[0.03] pt-4">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onReject(enrollmentId)}
              disabled={disabled}
              className="rounded-xl"
            >
              Reject
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onApprove(enrollmentId)}
              disabled={disabled}
              className="rounded-xl"
            >
              Approve
            </Button>
          </div>
        ) : (
          <div className="mt-4 border-t border-foreground/[0.03] pt-4">
            {payment.status === 'verified' && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Approved
                  {payment.verified_at && (
                    <span className="text-muted-foreground">
                      {' '}· {formatPKT(payment.verified_at, 'datetime')}
                    </span>
                  )}
                </span>
              </div>
            )}
            {payment.status === 'rejected' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Rejected
                    {payment.updated_at && (
                      <span className="text-muted-foreground">
                        {' '}· {formatPKT(payment.updated_at, 'datetime')}
                      </span>
                    )}
                  </span>
                </div>
                {payment.rejection_reason && (
                  <p className="rounded-xl bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Reason: </span>
                    {payment.rejection_reason}
                  </p>
                )}
              </div>
            )}
            {payment.status === 'refunded' && (
              <div className="flex items-center gap-2 text-sm text-warning">
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span>
                  Refunded
                  {payment.refunded_at && (
                    <span className="text-muted-foreground">
                      {' '}· {formatPKT(payment.refunded_at, 'datetime')}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Screenshot full-size dialog */}
      {payment.screenshot_url && (
        <Dialog open={screenshotOpen} onOpenChange={(open) => { if (!open) setScreenshotOpen(false) }}>
          <DialogContent className="sm:max-w-lg rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>Payment Screenshot</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <div className="relative w-full" style={{ maxHeight: '70vh' }}>
                <Image
                  src={payment.screenshot_url}
                  alt="Payment screenshot full size"
                  width={800}
                  height={600}
                  className="mx-auto max-h-[70vh] w-auto rounded-2xl"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
