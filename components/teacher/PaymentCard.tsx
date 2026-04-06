'use client'

/**
 * components/teacher/PaymentCard.tsx — Single pending payment card
 * Displays student info, payment details, screenshot preview, and action buttons.
 */

import { useState } from 'react'
import Image from 'next/image'
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
  onApprove: (enrollmentId: string) => void
  onReject: (enrollmentId: string) => void
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
      <Card className="p-5">
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
                <span className="text-muted-foreground">Email: </span>
                <span className="text-foreground">{student.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Phone: </span>
                <span className="text-foreground">{student.phone}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Cohort: </span>
                <span className="text-foreground">{cohort.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Amount: </span>
                <span className="font-medium text-foreground">Rs. {formattedAmount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Reference: </span>
                <span className="font-mono text-foreground">REF-{referenceCode}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Uploaded: </span>
                <span className="text-foreground">
                  {formatPKT(payment.created_at, 'datetime')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Method: </span>
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
                className="overflow-hidden rounded-md border border-border transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <div className="flex h-24 w-24 items-center justify-center rounded-md border border-border bg-background text-xs text-muted-foreground sm:h-28 sm:w-28">
                No screenshot
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button
            variant="danger"
            size="sm"
            onClick={() => onReject(enrollmentId)}
            disabled={disabled}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onApprove(enrollmentId)}
            disabled={disabled}
          >
            Approve
          </Button>
        </div>
      </Card>

      {/* Screenshot full-size dialog */}
      {payment.screenshot_url && (
        <Dialog open={screenshotOpen} onOpenChange={(open) => { if (!open) setScreenshotOpen(false) }}>
          <DialogContent className="sm:max-w-lg">
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
                  className="mx-auto max-h-[70vh] w-auto rounded-md"
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
