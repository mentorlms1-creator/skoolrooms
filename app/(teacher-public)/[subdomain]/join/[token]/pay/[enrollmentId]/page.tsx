/**
 * app/(teacher-public)/[subdomain]/join/[token]/pay/[enrollmentId]/page.tsx
 * Server Component — Student payment page after enrollment.
 *
 * Shows four possible states:
 * 1. Payment pending — bank details + reference code + screenshot upload
 * 2. Payment uploaded (pending_verification) — "waiting for teacher to verify"
 * 3. Payment confirmed — success message
 * 4. Payment rejected — rejection reason + re-upload form
 */

import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/supabase/server'
import { getStudentByAuthId } from '@/lib/db/students'
import { getEnrollmentById } from '@/lib/db/enrollments'
import { getPaymentsByEnrollment } from '@/lib/db/student-payments'
import { getCohortById } from '@/lib/db/cohorts'
import { createAdminClient } from '@/supabase/server'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatPKT } from '@/lib/time/pkt'
import { ScreenshotUploadForm } from '@/components/student/ScreenshotUploadForm'

type PageProps = {
  params: Promise<{ subdomain: string; token: string; enrollmentId: string }>
}

/**
 * Formats a PKR amount with comma separators.
 * Example: 15000 -> "Rs. 15,000"
 */
function formatFeePKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`
}

export default async function PaymentPage({ params }: PageProps) {
  const { enrollmentId } = await params

  // --- Auth check: student must be logged in ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/student-login')
  }

  const student = await getStudentByAuthId(user.id)
  if (!student) {
    redirect('/student-login')
  }

  // --- Fetch enrollment ---
  const enrollment = await getEnrollmentById(enrollmentId)
  if (!enrollment) {
    notFound()
  }

  // Verify the enrollment belongs to this student
  if (enrollment.student_id !== student.id) {
    notFound()
  }

  // --- Fetch payment records ---
  const payments = await getPaymentsByEnrollment(enrollmentId)
  const payment = payments[0] ?? null

  // --- Fetch cohort info ---
  const cohort = await getCohortById(enrollment.cohort_id)
  if (!cohort) {
    notFound()
  }

  // --- Fetch teacher info + payment settings ---
  const adminSupabase = createAdminClient()

  const { data: teacher } = await adminSupabase
    .from('teachers')
    .select('name')
    .eq('id', cohort.teacher_id)
    .single()

  const { data: paymentSettings } = await adminSupabase
    .from('teacher_payment_settings')
    .select(
      'payout_bank_name, payout_account_title, payout_iban, jazzcash_number, easypaisa_number, qr_code_url, instructions',
    )
    .eq('teacher_id', cohort.teacher_id)
    .single()

  // --- Fetch course info ---
  const { data: course } = await adminSupabase
    .from('courses')
    .select('title')
    .eq('id', cohort.course_id)
    .single()

  const teacherName = (teacher?.name as string) ?? 'Teacher'
  const courseName = (course?.title as string) ?? 'Course'
  const feeLabel = cohort.fee_type === 'monthly' ? '/month' : 'one-time'

  // Determine payment state
  const paymentStatus = payment?.status ?? 'pending_verification'
  const hasScreenshot = Boolean(payment?.screenshot_url)

  // --- STATE: Payment confirmed ---
  if (paymentStatus === 'confirmed') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-8 w-8 text-primary"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Payment Confirmed!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are now enrolled in{' '}
            <span className="font-medium text-foreground">{courseName}</span> ({cohort.name}).
            Your teacher {teacherName} has verified your payment.
          </p>
          <div className="mt-4">
            <StatusBadge status="confirmed" />
          </div>
        </Card>
      </div>
    )
  }

  // --- STATE: Payment rejected — show reason + re-upload ---
  if (paymentStatus === 'rejected') {
    const rejectionReason =
      (payment?.rejection_reason as string | null) ?? 'No reason provided'

    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="overflow-hidden">
          <div className="p-6">
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5 text-destructive"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Payment Rejected</h1>
                <p className="text-sm text-muted-foreground">
                  {teacherName} could not verify your payment
                </p>
              </div>
            </div>

            {/* Rejection reason */}
            <div className="mb-6 rounded-md border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">Reason:</p>
              <p className="mt-1 text-sm text-foreground">{rejectionReason}</p>
            </div>

            {/* Fee info */}
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4 text-sm">
              <span className="text-muted-foreground">Amount to pay</span>
              <span className="text-lg font-bold text-foreground">
                {formatFeePKR(payment?.discounted_amount_pkr ?? cohort.fee_pkr)}{' '}
                <span className="text-xs font-normal text-muted-foreground">{feeLabel}</span>
              </span>
            </div>

            {/* Bank details (collapsed for re-upload) */}
            <PaymentMethodDetails
              paymentSettings={paymentSettings}
              teacherName={teacherName}
            />

            {/* Re-upload form */}
            <div className="mt-6">
              <ScreenshotUploadForm
                enrollmentId={enrollmentId}
                referenceCode={enrollment.reference_code}
                existingScreenshotUrl={null}
              />
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // --- STATE: Screenshot uploaded, pending verification ---
  if (hasScreenshot && paymentStatus === 'pending_verification') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-8 w-8 text-primary"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Waiting for Verification</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your payment screenshot has been submitted. {teacherName} will review
            and verify your payment soon.
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <StatusBadge status="pending_verification" />
            <p className="text-xs text-muted-foreground">
              Reference: <span className="font-mono font-medium">REF-{enrollment.reference_code}</span>
            </p>
            {payment && (
              <p className="text-xs text-muted-foreground">
                Submitted {formatPKT(payment.updated_at, 'relative')}
              </p>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // --- STATE: Payment pending — show bank details + upload form ---
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card className="overflow-hidden">
        <div className="p-6">
          {/* Header */}
          <h1 className="text-xl font-bold text-foreground">Complete Your Payment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pay for <span className="font-medium text-foreground">{courseName}</span> ({cohort.name})
          </p>

          {/* Fee amount */}
          <div className="mt-4 flex items-center justify-between rounded-md bg-background p-4">
            <span className="text-sm text-muted-foreground">Amount to pay</span>
            <span className="text-2xl font-bold text-foreground">
              {formatFeePKR(payment?.discounted_amount_pkr ?? cohort.fee_pkr)}{' '}
              <span className="text-xs font-normal text-muted-foreground">{feeLabel}</span>
            </span>
          </div>

          {/* Payment method details */}
          <div className="mt-6">
            <PaymentMethodDetails
              paymentSettings={paymentSettings}
              teacherName={teacherName}
            />
          </div>

          {/* Screenshot upload form */}
          <div className="mt-6 border-t border-border pt-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Upload Payment Screenshot
            </h2>
            <ScreenshotUploadForm
              enrollmentId={enrollmentId}
              referenceCode={enrollment.reference_code}
              existingScreenshotUrl={payment?.screenshot_url ?? null}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

// =============================================================================
// PaymentMethodDetails — Shows bank/JazzCash/EasyPaisa details + QR code
// =============================================================================

type PaymentSettingsData = {
  payout_bank_name: unknown
  payout_account_title: unknown
  payout_iban: unknown
  jazzcash_number: unknown
  easypaisa_number: unknown
  qr_code_url: unknown
  instructions: unknown
} | null

function PaymentMethodDetails({
  paymentSettings,
  teacherName,
}: {
  paymentSettings: PaymentSettingsData
  teacherName: string
}) {
  const bankName = (paymentSettings?.payout_bank_name as string | null) ?? null
  const accountTitle =
    (paymentSettings?.payout_account_title as string | null) ?? null
  const iban = (paymentSettings?.payout_iban as string | null) ?? null
  const jazzcashNumber =
    (paymentSettings?.jazzcash_number as string | null) ?? null
  const easypaisaNumber =
    (paymentSettings?.easypaisa_number as string | null) ?? null
  const qrCodeUrl = (paymentSettings?.qr_code_url as string | null) ?? null
  const instructions =
    (paymentSettings?.instructions as string | null) ?? null

  const hasBankDetails = Boolean(bankName || iban || accountTitle)
  const hasMobileWallets = Boolean(jazzcashNumber || easypaisaNumber)

  if (!hasBankDetails && !hasMobileWallets && !qrCodeUrl) {
    return (
      <div className="rounded-md border border-border bg-background p-4">
        <p className="text-sm text-muted-foreground">
          {teacherName} has not set up payment details yet. Please contact them
          directly for payment instructions.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Payment Details
      </h3>

      {/* Bank transfer details */}
      {hasBankDetails && (
        <div className="rounded-md border border-border p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bank Transfer
          </p>
          <div className="flex flex-col gap-1.5">
            {bankName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bank</span>
                <span className="font-medium text-foreground">{bankName}</span>
              </div>
            )}
            {accountTitle && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Account Title</span>
                <span className="font-medium text-foreground">{accountTitle}</span>
              </div>
            )}
            {iban && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">IBAN</span>
                <span className="font-mono text-sm font-medium text-foreground break-all">
                  {iban}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile wallets */}
      {hasMobileWallets && (
        <div className="rounded-md border border-border p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mobile Wallet
          </p>
          <div className="flex flex-col gap-1.5">
            {jazzcashNumber && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">JazzCash</span>
                <span className="font-mono font-medium text-foreground">
                  {jazzcashNumber}
                </span>
              </div>
            )}
            {easypaisaNumber && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">EasyPaisa</span>
                <span className="font-mono font-medium text-foreground">
                  {easypaisaNumber}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR code */}
      {qrCodeUrl && (
        <div className="rounded-md border border-border p-4 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Scan to Pay
          </p>
          <Image
            src={qrCodeUrl}
            alt="Payment QR Code"
            width={192}
            height={192}
            className="mx-auto rounded-md object-contain"
            sizes="192px"
          />
        </div>
      )}

      {/* Teacher instructions */}
      {instructions && (
        <div className="rounded-md border border-primary/20 bg-primary/10 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Instructions from {teacherName}
          </p>
          <p className="text-sm text-primary">{instructions}</p>
        </div>
      )}
    </div>
  )
}
