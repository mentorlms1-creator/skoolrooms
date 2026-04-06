'use client'

/**
 * WithdrawalForm — Client Component
 * Allows a student to request withdrawal from a cohort.
 * Requires a reason (optional but encouraged).
 * Calls requestWithdrawalAction server action.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useUIContext } from '@/providers/UIProvider'
import { requestWithdrawalAction } from '@/lib/actions/enrollment-management'

type WithdrawalFormProps = {
  enrollmentId: string
}

export function WithdrawalForm({ enrollmentId }: WithdrawalFormProps) {
  const router = useRouter()
  const { confirm } = useUIContext()
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

          toast.success('Withdrawal request sent. Your teacher will review it.')
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
        className="rounded-xl"
        onClick={() => setShowForm(true)}
      >
        Request Withdrawal
      </Button>
    )
  }

  return (
    <div className="rounded-2xl bg-container ring-1 ring-foreground/[0.03] p-6">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <h4 className="text-sm font-semibold text-foreground">Request Withdrawal</h4>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="withdrawal-reason"
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50"
        >
          Reason (optional)
        </Label>
        <Textarea
          id="withdrawal-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Let your teacher know why you want to withdraw..."
          rows={3}
        />
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          variant="danger"
          className="rounded-xl"
          onClick={handleSubmit}
          loading={isPending}
        >
          Send Request
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-xl"
          onClick={() => setShowForm(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
