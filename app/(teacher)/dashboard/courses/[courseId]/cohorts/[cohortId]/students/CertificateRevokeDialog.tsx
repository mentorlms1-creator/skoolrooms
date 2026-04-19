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
import { revokeCertificateAction } from '@/lib/actions/certificates'

type Props = {
  certificateId: string
  studentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CertificateRevokeDialog({
  certificateId,
  studentName,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')

  function handleSubmit() {
    startTransition(async () => {
      const result = await revokeCertificateAction(certificateId, reason)
      if (result.success) {
        toast.success(`Certificate revoked for ${studentName}.`)
        onOpenChange(false)
        setReason('')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke certificate?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark {studentName}&apos;s certificate as revoked. They will no longer be able to download it. You can re-issue it later from the same menu.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="revoke-cert-reason">Reason (optional)</Label>
          <Textarea
            id="revoke-cert-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Issued in error, student requested removal"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Revoking...' : 'Revoke certificate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
