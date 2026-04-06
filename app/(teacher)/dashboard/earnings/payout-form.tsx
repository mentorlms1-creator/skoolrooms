'use client'

// =============================================================================
// Payout Request Form — Client Component
// Handles the interactive form for requesting a payout.
// =============================================================================

import { useActionState } from 'react'
import { requestPayoutAction } from '@/lib/actions/payouts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Banknote } from 'lucide-react'
import type { ApiResponse } from '@/types/api'

type PayoutFormProps = {
  availableBalance: number
  minPayoutAmount: number
  hasBankDetails: boolean
  hasActivePayout: boolean
}

const initialState: ApiResponse<{ payoutId: string }> | null = null

export function PayoutForm({
  availableBalance,
  minPayoutAmount,
  hasBankDetails,
  hasActivePayout,
}: PayoutFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      return await requestPayoutAction(formData)
    },
    initialState
  )

  const canRequest =
    hasBankDetails && !hasActivePayout && availableBalance >= minPayoutAmount

  // Determine the reason if the teacher can't request
  let blockerMessage: string | null = null
  if (!hasBankDetails) {
    blockerMessage =
      'Set up your bank details in Settings > Payments before requesting a payout.'
  } else if (hasActivePayout) {
    blockerMessage =
      'You already have a pending payout. Please wait for it to be processed.'
  } else if (availableBalance < minPayoutAmount) {
    blockerMessage = `Minimum payout amount is PKR ${minPayoutAmount.toLocaleString()}. Your available balance is PKR ${availableBalance.toLocaleString()}.`
  }

  return (
    <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Banknote className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Request Payout</h2>
          <p className="text-sm text-muted-foreground">
            Minimum: PKR {minPayoutAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {blockerMessage ? (
        <div className="rounded-xl bg-muted/50 border border-border/50 p-4">
          <p className="text-sm text-muted-foreground">{blockerMessage}</p>
        </div>
      ) : (
        <form action={formAction}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payout-amount">Amount (PKR)</Label>
              <Input
                id="payout-amount"
                name="amount"
                type="number"
                min={minPayoutAmount}
                max={availableBalance}
                defaultValue={availableBalance}
                required
                className="rounded-xl"
                placeholder={`${minPayoutAmount} - ${availableBalance}`}
              />
              <p className="text-xs text-muted-foreground">
                Available: PKR {availableBalance.toLocaleString()}
              </p>
            </div>

            {state && !state.success && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm text-destructive">{state.error}</p>
              </div>
            )}

            {state && state.success && (
              <div className="rounded-xl bg-success/10 border border-success/20 p-3">
                <p className="text-sm text-success">
                  Payout request submitted successfully. You will be notified when it is processed.
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={!canRequest || isPending}
              loading={isPending}
              className="w-full rounded-xl"
            >
              Request Payout
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
