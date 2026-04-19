'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MoreHorizontal,
  Receipt,
  BadgeMinus,
  Eye,
  List,
  Activity,
  Award,
  CheckCircle,
  Download,
  XCircle,
} from 'lucide-react'
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
import { EnrollmentPaymentsModal, type ModalPayment } from './EnrollmentPaymentsModal'
import { CertificateRevokeDialog } from './CertificateRevokeDialog'
import {
  StudentProgressDialog,
  type ProgressSubmissionStats,
  type ProgressTimelineEntry,
} from './StudentProgressDialog'
import { markCompleteAction } from '@/lib/actions/enrollment-management'
import { issueCertificateAction } from '@/lib/actions/certificates'
import { ROUTES } from '@/constants/routes'

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

export type RowCertificate = {
  id: string
  certificate_number: string
  revoked_at: string | null
}

type StudentRowActionsProps = {
  enrollmentId: string
  studentName: string
  enrollmentStatus: string
  payment: RowPayment | null
  availableBalance: number
  cohortArchived: boolean
  hasPendingWithdrawal: boolean
  cohortFeeType?: string
  allPayments?: ModalPayment[]
  certificate?: RowCertificate | null
  progress?: {
    cohortName: string
    timeline: ProgressTimelineEntry[]
    stats: ProgressSubmissionStats
  } | null
}

export function StudentRowActions({
  enrollmentId,
  studentName,
  enrollmentStatus,
  payment,
  availableBalance,
  cohortArchived,
  hasPendingWithdrawal,
  cohortFeeType,
  allPayments,
  certificate,
  progress,
}: StudentRowActionsProps) {
  const router = useRouter()
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [paymentsOpen, setPaymentsOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [certRevokeOpen, setCertRevokeOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const alreadyRefunded = !!payment?.refunded_at
  const screenshotUrl = payment?.screenshot_url
  const removeDisabled = cohortArchived || hasPendingWithdrawal
  const removeLabel = hasPendingWithdrawal
    ? 'Pending withdrawal — handle above'
    : cohortArchived
      ? 'Cohort archived'
      : 'Remove from cohort'

  const isMonthly = cohortFeeType === 'monthly'
  const isActive = enrollmentStatus === 'active'
  const isCompleted = enrollmentStatus === 'completed'
  const hasActiveCert = !!certificate && !certificate.revoked_at

  function handleMarkComplete() {
    startTransition(async () => {
      const result = await markCompleteAction(enrollmentId)
      if (result.success) {
        toast.success(`${studentName} marked complete.`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleIssueCertificate() {
    startTransition(async () => {
      const result = await issueCertificateAction(enrollmentId)
      if (result.success) {
        toast.success(`Certificate issued: ${result.data.certificateNumber}`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

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

          {progress && (
            <DropdownMenuItem onSelect={() => setProgressOpen(true)}>
              <Activity className="mr-2 h-4 w-4" />
              Progress
            </DropdownMenuItem>
          )}

          {isMonthly && (
            <DropdownMenuItem onSelect={() => setPaymentsOpen(true)}>
              <List className="mr-2 h-4 w-4" />
              View payments
            </DropdownMenuItem>
          )}

          {screenshotUrl && (
            <DropdownMenuItem asChild>
              <a href={screenshotUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-2 h-4 w-4" />
                View payment proof
              </a>
            </DropdownMenuItem>
          )}

          {isActive && !cohortArchived && (
            <DropdownMenuItem onSelect={handleMarkComplete} disabled={isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark complete
            </DropdownMenuItem>
          )}

          {isCompleted && !hasActiveCert && (
            <DropdownMenuItem onSelect={handleIssueCertificate} disabled={isPending}>
              <Award className="mr-2 h-4 w-4" />
              Issue certificate
            </DropdownMenuItem>
          )}

          {hasActiveCert && (
            <DropdownMenuItem asChild>
              <a
                href={ROUTES.STUDENT.certificateDownload(enrollmentId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" />
                Download certificate
              </a>
            </DropdownMenuItem>
          )}

          {hasActiveCert && (
            <DropdownMenuItem
              onSelect={() => setCertRevokeOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Revoke certificate
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
        payment={payment}
        availableBalance={availableBalance}
      />

      <RefundDialog
        enrollmentId={enrollmentId}
        studentName={studentName}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        payment={payment}
        availableBalance={availableBalance}
      />

      {isMonthly && (
        <EnrollmentPaymentsModal
          enrollmentId={enrollmentId}
          studentName={studentName}
          cohortFeeType={cohortFeeType ?? 'one_time'}
          payments={allPayments ?? []}
          availableBalance={availableBalance}
          open={paymentsOpen}
          onOpenChange={setPaymentsOpen}
        />
      )}

      {progress && (
        <StudentProgressDialog
          open={progressOpen}
          onOpenChange={setProgressOpen}
          studentName={studentName}
          cohortName={progress.cohortName}
          timeline={progress.timeline}
          stats={progress.stats}
        />
      )}

      {certificate && (
        <CertificateRevokeDialog
          certificateId={certificate.id}
          studentName={studentName}
          open={certRevokeOpen}
          onOpenChange={setCertRevokeOpen}
        />
      )}
    </>
  )
}
