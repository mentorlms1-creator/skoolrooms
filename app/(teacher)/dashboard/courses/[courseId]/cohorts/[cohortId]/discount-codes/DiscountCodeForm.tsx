'use client'

/**
 * DiscountCodeForm — Create or delete a discount code
 * mode='create' (default): renders the add form
 * mode='delete': renders a delete button for an existing code
 */

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createDiscountCodeAction,
  deleteDiscountCodeAction,
} from '@/lib/actions/discount-codes'
import type { DiscountCodeRow } from '@/lib/db/discount-codes'

type Props = {
  cohortId: string
  feePkr: number
  existing?: DiscountCodeRow
  mode?: 'create' | 'delete'
}

export function DiscountCodeForm({ cohortId, feePkr, existing, mode = 'create' }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // --- Delete mode ---
  if (mode === 'delete' && existing) {
    return (
      <form
        action={async () => {
          startTransition(async () => {
            const result = await deleteDiscountCodeAction(existing.id)
            if (!result.success) setError(result.error ?? 'Failed')
          })
        }}
      >
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={isPending}
        >
          {isPending ? 'Deleting...' : 'Delete'}
        </Button>
      </form>
    )
  }

  // --- Create mode ---
  if (success) {
    return (
      <div className="rounded-md bg-success/10 p-4 text-sm text-success">
        Discount code created.{' '}
        <button
          className="underline"
          onClick={() => setSuccess(false)}
        >
          Add another
        </button>
      </div>
    )
  }

  async function handleSubmit(formData: FormData) {
    setError(null)
    formData.set('cohort_id', cohortId)
    startTransition(async () => {
      const result = await createDiscountCodeAction(formData)
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error ?? 'Failed to create code.')
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="code">Code (6–8 chars, A–Z 0–9)</Label>
        <Input
          id="code"
          name="code"
          placeholder="SUMMER25"
          maxLength={8}
          required
          className="uppercase"
          onChange={(e) => {
            e.target.value = e.target.value.toUpperCase()
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="discount_type">Type</Label>
          <select
            id="discount_type"
            name="discount_type"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          >
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed (Rs.)</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="discount_value">Value</Label>
          <Input
            id="discount_value"
            name="discount_value"
            type="number"
            min={1}
            max={feePkr - 1}
            placeholder="10"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="max_uses">Max uses (optional)</Label>
          <Input
            id="max_uses"
            name="max_uses"
            type="number"
            min={1}
            placeholder="Unlimited"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="expires_at">Expires (optional)</Label>
          <Input
            id="expires_at"
            name="expires_at"
            type="date"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Creating...' : 'Create Code'}
      </Button>
    </form>
  )
}
