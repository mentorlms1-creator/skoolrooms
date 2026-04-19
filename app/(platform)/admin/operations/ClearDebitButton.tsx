'use client'

// ClearDebitButton — Admin forgives a teacher's outstanding debit

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { clearTeacherDebitAction } from '@/lib/actions/admin-payouts'
import type { ApiResponse } from '@/types/api'

export function ClearDebitButton({
  teacherId,
  debitPkr,
}: {
  teacherId: string
  debitPkr: number
}) {
  const [open, setOpen] = useState(false)

  const [state, formAction, isPending] = useActionState(
    async (_prev: ApiResponse<null> | null): Promise<ApiResponse<null>> => {
      const result = await clearTeacherDebitAction(teacherId)
      if (result.success) setOpen(false)
      return result
    },
    null,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 px-3 text-xs">
          Clear Debit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clear Outstanding Debit</DialogTitle>
          <DialogDescription>
            Forgive PKR {debitPkr.toLocaleString()} outstanding debit for this teacher. This
            action is permanent and logged.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state && !state.success && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Clearing...' : 'Confirm Clear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
