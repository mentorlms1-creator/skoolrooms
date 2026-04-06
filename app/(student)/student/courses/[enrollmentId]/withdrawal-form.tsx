'use client'

/**
 * WithdrawalForm — Client Component
 * Allows a student to request withdrawal from a cohort.
 * Requires a reason (optional but encouraged).
 * Calls requestWithdrawalAction server action.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/Textarea'
import { useUIContext } from '@/providers/UIProvider'
import { requestWithdrawalAction } from '@/lib/actions/enrollment-management'

type WithdrawalFormProps = {
  enrollmentId: string
}

export function WithdrawalForm({ enrollmentId }: WithdrawalFormProps) {
  const router = useRouter()
  const { addToast, confirm } = useUIContext()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)

    confirm({
      title: 'Request Withdrawal',
      message:
        'Are you sure you want to request withdrawal from this cohort? Your teacher will review this request.',
      confirmText: 'Request Withdrawal',
      confirmVariant: 'danger',
      onConfirm: () => {
        startTransition(async () => {
          const formData = new FormData()
          formData.set('reason', reason.trim())

          const result = await requestWithdrawalAction(enrollmentId, formData)

          if (!result.success) {
            setError(result.error)
            return
          }

          addToast({
            type: 'success',
            message: 'Withdrawal request sent. Your teacher will review it.',
          })
          setShowForm(false)
          router.refresh()
        })
      },
    })
  }

  if (!showForm) {
    return (
      <Button
        variant="danger"
        size="sm"
        onClick={() => setShowForm(true)}
      >
        Request Withdrawal
      </Button>
    )
  }

  return (
    <div className="rounded-md border border-border bg-background p-4">
      <h4 className="mb-3 text-sm font-medium text-foreground">Request Withdrawal</h4>
      <Textarea
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Let your teacher know why you want to withdraw..."
        rows={3}
      />

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="danger"
          onClick={handleSubmit}
          loading={isPending}
        >
          Send Request
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowForm(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
