'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck } from 'lucide-react'
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
import { bulkMarkCompleteAction } from '@/lib/actions/enrollment-management'

type Props = {
  cohortId: string
  activeCount: number
}

export function BulkMarkCompleteButton({ cohortId, activeCount }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await bulkMarkCompleteAction(cohortId)
      if (result.success) {
        toast.success(`Marked ${result.data.updated} student(s) complete.`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={activeCount === 0 || isPending}>
          <CheckCheck className="mr-2 h-4 w-4" />
          Mark all complete ({activeCount})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark all active students complete?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark {activeCount} active{' '}
            {activeCount === 1 ? 'student' : 'students'} as completed. They will then be eligible for certificates.
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
            {isPending ? 'Updating...' : 'Mark all complete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
