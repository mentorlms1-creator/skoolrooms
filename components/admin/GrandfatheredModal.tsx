'use client'

// GrandfatheredModal — shown after plan limits are lowered, informing admin of affected teachers.
// The action already ran server-side; this is purely informational.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type GrandfatheredModalProps = {
  open: boolean
  onClose: () => void
  affectedCount: number
}

export function GrandfatheredModal({ open, onClose, affectedCount }: GrandfatheredModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan limits lowered — {affectedCount} teachers grandfathered</DialogTitle>
          <DialogDescription>
            {affectedCount} teacher{affectedCount !== 1 ? 's' : ''} on this plan have usage that
            exceeds the new limits. Their current allowances have been snapshotted and preserved.
            They will keep the higher limits until they change plans.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          View the full list at{' '}
          <a
            href="/admin/plans/grandfathered"
            className="text-primary underline-offset-4 hover:underline"
          >
            Plans → Grandfathered teachers
          </a>
          .
        </p>
        <DialogFooter>
          <Button variant="primary" onClick={onClose}>
            OK, got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
