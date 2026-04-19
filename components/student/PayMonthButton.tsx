'use client'

/**
 * components/student/PayMonthButton.tsx
 * Tiny client component shown next to each outstanding monthly fee row on
 * the student payments page. Calls createNextMonthPaymentAction and
 * redirects the student to the payment page with ?paymentId set.
 */

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createNextMonthPaymentAction } from '@/lib/actions/student-payments'

type PayMonthButtonProps = {
  enrollmentId: string
  paymentMonth: string
  /**
   * Fully-qualified teacher payment-page URL up to (and including) the
   * enrollmentId. This component appends `?paymentId=...` after the action
   * succeeds. Built server-side via teacherSubdomainUrl() so we don't have
   * to ship the platform domain to the client.
   */
  paymentPageUrl: string
}

export function PayMonthButton({
  enrollmentId,
  paymentMonth,
  paymentPageUrl,
}: PayMonthButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await createNextMonthPaymentAction(enrollmentId, paymentMonth)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const url = `${paymentPageUrl}?paymentId=${result.data.paymentId}`
      // Cross-subdomain navigation — use full reload, not router.push
      window.location.href = url
    })
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      loading={isPending}
      size="sm"
    >
      Pay
    </Button>
  )
}
