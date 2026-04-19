'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { revokeEnrollmentAction } from '@/lib/actions/enrollment-management'

type RevokeDialogProps = {
  enrollmentId: string
  studentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RevokeDialog({ enrollmentId, studentName, open, onOpenChange }: RevokeDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    setError(null)
    const trimmed = reason.trim()
    if (!trimmed) {
      setError('A reason is required.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('reason', trimmed)
      const result = await revokeEnrollmentAction(enrollmentId, formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      toast.success(`${studentName} has been removed from this cohort.`)
      setReason('')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {studentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This student will lose access immediately and cannot re-enroll with you. They&apos;ll receive an email with the reason.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="revoke-reason" className="text-xs font-medium text-foreground">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="revoke-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Repeatedly missing classes without notice"
            rows={3}
            disabled={isPending}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="danger"
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isPending}
          >
            {isPending ? 'Removing…' : 'Remove student'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
