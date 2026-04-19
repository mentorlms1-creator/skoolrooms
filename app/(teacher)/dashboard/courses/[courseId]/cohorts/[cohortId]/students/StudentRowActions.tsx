'use client'

import { useState } from 'react'
import { MoreHorizontal, Receipt, BadgeMinus, Eye } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { RevokeDialog } from './RevokeDialog'
import { RefundDialog } from './RefundDialog'

export type RowPayment = {
  id: string
  amount_pkr: number
  teacher_payout_amount_pkr: number
  platform_cut_pkr: number
  payment_method: string
  refunded_at: string | null
  status: string
  screenshot_url: string | null
}

type StudentRowActionsProps = {
  enrollmentId: string
  studentName: string
  payment: RowPayment | null
  availableBalance: number
  cohortArchived: boolean
  hasPendingWithdrawal: boolean
}

export function StudentRowActions({
  enrollmentId,
  studentName,
  payment,
  availableBalance,
  cohortArchived,
  hasPendingWithdrawal,
}: StudentRowActionsProps) {
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

  const alreadyRefunded = !!payment?.refunded_at
  const screenshotUrl = payment?.screenshot_url
  const removeDisabled = cohortArchived || hasPendingWithdrawal
  const removeLabel = hasPendingWithdrawal
    ? 'Pending withdrawal — handle above'
    : cohortArchived
      ? 'Cohort archived'
      : 'Remove from cohort'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${studentName}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{studentName}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {screenshotUrl && (
            <DropdownMenuItem asChild>
              <a href={screenshotUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-2 h-4 w-4" />
                View payment proof
              </a>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onSelect={() => setRefundOpen(true)}
            disabled={!payment || alreadyRefunded}
          >
            <Receipt className="mr-2 h-4 w-4" />
            {alreadyRefunded ? 'Already refunded' : 'Record refund'}
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => setRevokeOpen(true)}
            disabled={removeDisabled}
            className="text-destructive focus:text-destructive"
          >
            <BadgeMinus className="mr-2 h-4 w-4" />
            {removeLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RevokeDialog
        enrollmentId={enrollmentId}
        studentName={studentName}
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
      />

      <RefundDialog
        enrollmentId={enrollmentId}
        studentName={studentName}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        payment={payment}
        availableBalance={availableBalance}
      />
    </>
  )
}
