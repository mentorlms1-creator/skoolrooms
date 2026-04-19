'use client'

/**
 * DiscountCodeInput — Discount code entry on the student pay page
 * Shows the fee amount and allows applying a discount code.
 * Stores the applied codeId in hidden state for the ScreenshotUploadForm.
 */

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { validateDiscountAction } from '@/lib/actions/validate-discount'
import { applyDiscountToPaymentAction } from '@/lib/actions/student-payments'

type Props = {
  cohortId: string
  feePkr: number
  feeLabel: string
  enrollmentId: string
  paymentId?: string
}

function formatFeePKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`
}

export function DiscountCodeInput({ cohortId, feePkr, feeLabel, enrollmentId, paymentId }: Props) {
  const [code, setCode] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState<{
    discountedAmountPkr: number
    savings: number
    codeId: string
    codeText: string
  } | null>(null)

  const displayAmount = applied?.discountedAmountPkr ?? feePkr

  function handleApply() {
    if (!code.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await validateDiscountAction(cohortId, code)
      if (!result.valid) {
        setError(result.error)
        return
      }

      setApplied({
        discountedAmountPkr: result.discountedAmountPkr,
        savings: feePkr - result.discountedAmountPkr,
        codeId: result.codeId,
        codeText: code.toUpperCase(),
      })

      // Persist discount on the payment row (best-effort; approval also sets it)
      if (paymentId) {
        await applyDiscountToPaymentAction(paymentId, result.codeId, result.discountedAmountPkr)
      }
    })
  }

  function handleRemove() {
    setApplied(null)
    setCode('')
    setError(null)
  }

  return (
    <div className="rounded-md bg-background p-4 space-y-3">
      {/* Amount display */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Amount to pay</span>
        <div className="text-right">
          <span className="text-2xl font-bold text-foreground">
            {formatFeePKR(displayAmount)}{' '}
            <span className="text-xs font-normal text-muted-foreground">{feeLabel}</span>
          </span>
          {applied && (
            <p className="text-xs text-success">
              Saving {formatFeePKR(applied.savings)}
            </p>
          )}
        </div>
      </div>

      {/* Discount code input */}
      {!applied ? (
        <div className="flex gap-2">
          <Input
            placeholder="Discount code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono uppercase"
            maxLength={8}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleApply}
            disabled={isPending || !code.trim()}
          >
            {isPending ? 'Checking...' : 'Apply'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border border-success/30 bg-success/10 px-3 py-2">
          <p className="text-sm text-success font-medium">
            Code applied: <span className="font-mono">{applied.codeText}</span>
          </p>
          <button
            onClick={handleRemove}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Remove
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
