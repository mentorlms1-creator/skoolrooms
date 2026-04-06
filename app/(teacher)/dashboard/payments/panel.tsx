'use client'

/**
 * app/(teacher)/dashboard/payments/panel.tsx — Client panel for payment verification
 * Handles approve/reject interactions with confirm modal, reject reason modal, and toasts.
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUIContext } from '@/providers/UIProvider'
import { PaymentCard } from '@/components/teacher/PaymentCard'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import {
  approveEnrollmentAction,
  rejectEnrollmentAction,
} from '@/lib/actions/enrollments'
import type { PendingEnrollmentWithDetails } from '@/lib/db/enrollments'

type PaymentVerificationPanelProps = {
  enrollments: PendingEnrollmentWithDetails[]
}

export function PaymentVerificationPanel({
  enrollments,
}: PaymentVerificationPanelProps) {
  const router = useRouter()
  const { addToast, confirm } = useUIContext()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectEnrollmentId, setRejectEnrollmentId] = useState<string | null>(
    null
  )
  const [rejectReason, setRejectReason] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)

  const handleApprove = useCallback(
    (enrollmentId: string) => {
      confirm({
        title: 'Approve Payment',
        message:
          'Are you sure you want to approve this payment? The student will be enrolled and notified.',
        confirmText: 'Approve',
        confirmVariant: 'primary',
        onConfirm: async () => {
          setProcessingId(enrollmentId)
          try {
            const result = await approveEnrollmentAction(enrollmentId)
            if (result.success) {
              addToast({
                type: 'success',
                message: 'Payment approved. Student has been enrolled.',
              })
              router.refresh()
            } else {
              addToast({ type: 'error', message: result.error })
            }
          } catch {
            addToast({
              type: 'error',
              message: 'Something went wrong. Please try again.',
            })
          } finally {
            setProcessingId(null)
          }
        },
      })
    },
    [confirm, addToast, router]
  )

  const handleRejectClick = useCallback((enrollmentId: string) => {
    setRejectEnrollmentId(enrollmentId)
    setRejectReason('')
    setRejectModalOpen(true)
  }, [])

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectEnrollmentId) return

    setRejectLoading(true)
    setProcessingId(rejectEnrollmentId)

    try {
      const formData = new FormData()
      formData.set('reason', rejectReason.trim())

      const result = await rejectEnrollmentAction(rejectEnrollmentId, formData)
      if (result.success) {
        addToast({
          type: 'success',
          message: 'Payment rejected. Student has been notified.',
        })
        setRejectModalOpen(false)
        router.refresh()
      } else {
        addToast({ type: 'error', message: result.error })
      }
    } catch {
      addToast({
        type: 'error',
        message: 'Something went wrong. Please try again.',
      })
    } finally {
      setRejectLoading(false)
      setProcessingId(null)
    }
  }, [rejectEnrollmentId, rejectReason, addToast, router])

  return (
    <>
      <div className="space-y-4">
        {enrollments.map((enrollment) => {
          // Get the most recent pending payment
          const payment = enrollment.student_payments[0]
          if (!payment) return null

          return (
            <PaymentCard
              key={enrollment.id}
              enrollmentId={enrollment.id}
              referenceCode={enrollment.reference_code}
              student={enrollment.students}
              cohort={enrollment.cohorts}
              payment={payment}
              onApprove={handleApprove}
              onReject={handleRejectClick}
              disabled={processingId === enrollment.id}
            />
          )
        })}
      </div>

      {/* Reject reason modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => {
          if (!rejectLoading) {
            setRejectModalOpen(false)
          }
        }}
        title="Reject Payment"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Please provide a reason for rejecting this payment. The student will
            be notified with this reason.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g., Screenshot is unclear, amount does not match..."
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={rejectLoading}
          />
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setRejectModalOpen(false)}
              disabled={rejectLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectConfirm}
              loading={rejectLoading}
            >
              Reject Payment
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
