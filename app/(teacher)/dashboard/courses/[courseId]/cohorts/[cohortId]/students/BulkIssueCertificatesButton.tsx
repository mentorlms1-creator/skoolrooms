'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Award } from 'lucide-react'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { bulkIssueCertificatesAction } from '@/lib/actions/certificates'

type Props = {
  cohortId: string
  eligibleCount: number
}

export function BulkIssueCertificatesButton({ cohortId, eligibleCount }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await bulkIssueCertificatesAction(cohortId)
      if (result.success) {
        const { issued, skipped, failed } = result.data
        toast.success(
          `Issued ${issued}, skipped ${skipped}${failed > 0 ? `, ${failed} failed` : ''}.`,
        )
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={eligibleCount === 0 || isPending}>
          <Award className="mr-2 h-4 w-4" />
          Issue certificates ({eligibleCount})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Issue certificates?</AlertDialogTitle>
          <AlertDialogDescription>
            This will issue certificates for {eligibleCount} completed{' '}
            {eligibleCount === 1 ? 'student' : 'students'} who do not yet have one.
            Each student will receive an email notification.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isPending}
          >
            {isPending ? 'Issuing...' : 'Issue certificates'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
