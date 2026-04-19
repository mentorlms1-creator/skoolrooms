/**
 * app/(student)/student/payments/page.tsx — Student payment history
 *
 * Server Component. Shows:
 *   1. Outstanding monthly fees (compute schedule minus paid/pending months)
 *   2. Pending enrollments alert
 *   3. Full payment history
 */

import type { Metadata } from 'next'
import {
  CreditCard,
  AlertCircle,
  CheckCircle,
  Receipt,
  Clock,
  Banknote,
  Calendar,
  Award,
  Download,
} from 'lucide-react'
import { requireStudent } from '@/lib/auth/guards'
import {
  getPaymentsByStudent,
  getPaymentsByEnrollment,
} from '@/lib/db/student-payments'
import {
  getEnrollmentsByStudentWithTeacher,
  getActiveMonthlyEnrollmentsForOutstanding,
} from '@/lib/db/enrollments'
import { getCertificatesByEnrollmentIds } from '@/lib/db/certificates'
import { ROUTES } from '@/constants/routes'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  formatPKT,
  monthlyBillingSchedule,
  dueDateForMonth,
} from '@/lib/time/pkt'
import { teacherSubdomainUrl } from '@/lib/platform/domain'
import { PayMonthButton } from '@/components/student/PayMonthButton'

export const metadata: Metadata = {
  title: 'Payments \u2014 Skool Rooms Student',
}

type OutstandingRow = {
  enrollmentId: string
  paymentMonth: string
  dueDate: string
  feePkr: number
  cohortName: string
  courseTitle: string
  teacherName: string
  status: 'overdue' | 'pending_verification' | 'upcoming'
  paymentPageUrl: string
}

export default async function StudentBillingPage() {
  const student = await requireStudent()

  const [payments, enrollments, monthlyEnrollments] = await Promise.all([
    getPaymentsByStudent(student.id),
    getEnrollmentsByStudentWithTeacher(student.id),
    getActiveMonthlyEnrollmentsForOutstanding(student.id),
  ])

  // Build outstanding-fees rows for each active monthly enrollment
  const outstanding: OutstandingRow[] = []
  // Use PKT calendar-day string for comparison so "today == due" never flickers
  // depending on what hour of UTC day it is when this page renders.
  const todayPKT = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()) // 'YYYY-MM-DD'

  for (const enr of monthlyEnrollments) {
    const cohort = enr.cohorts
    if (!cohort.billing_day) continue

    const schedule = monthlyBillingSchedule(cohort.start_date, cohort.end_date)

    // Pull every payment for this enrollment to know which months are
    // already paid or in flight.
    const enrollmentPayments = await getPaymentsByEnrollment(enr.id)
    const settledMonths = new Set<string>()
    for (const p of enrollmentPayments) {
      if (
        p.payment_month &&
        (p.status === 'confirmed' || p.status === 'pending_verification')
      ) {
        settledMonths.add(p.payment_month)
      }
    }

    const subdomain = enr.cohorts.teachers.subdomain ?? ''
    const paymentPageBase = subdomain
      ? teacherSubdomainUrl(
          subdomain,
          `/join/${cohort.invite_token}/pay/${enr.id}`,
        )
      : ''

    for (const month of schedule) {
      if (settledMonths.has(month)) continue

      const dueDate = dueDateForMonth(month, cohort.billing_day)

      // Compare PKT calendar-day strings so "today === due" always reads as
      // Due (not Overdue), regardless of what UTC hour the server renders this.
      let status: OutstandingRow['status']
      if (dueDate < todayPKT) {
        status = 'overdue'
      } else if (dueDate > todayPKT) {
        // More than 7 days out → upcoming; within 7 days → due
        const dueDateObj = new Date(`${dueDate}T00:00:00Z`)
        const todayMidnightUTC = new Date(`${todayPKT}T00:00:00Z`)
        const diffDays = (dueDateObj.getTime() - todayMidnightUTC.getTime()) / (1000 * 60 * 60 * 24)
        status = diffDays > 7 ? 'upcoming' : 'pending_verification'
      } else {
        // dueDate === todayPKT — it's due today
        status = 'pending_verification'
      }

      outstanding.push({
        enrollmentId: enr.id,
        paymentMonth: month,
        dueDate,
        feePkr: cohort.fee_pkr,
        cohortName: cohort.name,
        courseTitle: cohort.courses.title,
        teacherName: cohort.teachers.name,
        status,
        paymentPageUrl: paymentPageBase,
      })
    }
  }

  // Sort outstanding rows: overdue first, then by due date asc
  outstanding.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1
    if (b.status === 'overdue' && a.status !== 'overdue') return 1
    return a.dueDate.localeCompare(b.dueDate)
  })

  // Build a summary of pending enrollments (initial enrollment awaiting verify)
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending')

  // Completed enrollments + certificate lookup so we can render download CTAs.
  const completedEnrollments = enrollments.filter((e) => e.status === 'completed')
  const completedCerts = await getCertificatesByEnrollmentIds(
    completedEnrollments.map((e) => e.id),
  )

  return (
    <>
      <PageHeader
        title="Payments"
        description="Your payment history and pending fees"
      />

      {/* Outstanding monthly fees */}
      {outstanding.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Outstanding fees
          </h2>
          <div className="space-y-3">
            {outstanding.map((row) => {
              const monthLabel = formatPKT(`${row.paymentMonth}T00:00:00Z`, 'date')
                .replace(/^\d+\s/, '') // strip the leading day portion
              const dueLabel = formatPKT(`${row.dueDate}T00:00:00Z`, 'date')
              const statusLabel =
                row.status === 'overdue'
                  ? 'Overdue'
                  : row.status === 'upcoming'
                    ? 'Upcoming'
                    : 'Due'

              return (
                <Card
                  key={`${row.enrollmentId}-${row.paymentMonth}`}
                  className="rounded-2xl border-none shadow-sm ring-1 ring-foreground/5 bg-card overflow-hidden"
                >
                  <CardContent className="px-6 py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate">
                            {row.courseTitle}
                          </h3>
                          <StatusBadge status={row.status} size="sm" />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.cohortName} &middot; {row.teacherName}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {monthLabel}
                          </span>
                          <span className="text-xs text-muted-foreground/80">
                            {statusLabel} {dueLabel}
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                            <Banknote className="h-3.5 w-3.5" />
                            Rs. {row.feePkr.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {row.paymentPageUrl ? (
                          <PayMonthButton
                            enrollmentId={row.enrollmentId}
                            paymentMonth={row.paymentMonth}
                            paymentPageUrl={row.paymentPageUrl}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Contact teacher
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Certificates */}
      {completedEnrollments.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Certificates</h2>
          <div className="space-y-3">
            {completedEnrollments.map((enr) => {
              const cert = completedCerts.get(enr.id)
              const hasActiveCert = !!cert && !cert.revoked_at
              return (
                <Card
                  key={enr.id}
                  className="rounded-2xl border-none shadow-sm ring-1 ring-foreground/5 bg-card overflow-hidden"
                >
                  <CardContent className="px-6 py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-foreground truncate">
                            {enr.cohorts.courses.title}
                          </h3>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {enr.cohorts.name} &middot; {enr.cohorts.teachers.name}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {hasActiveCert ? (
                          <a
                            href={ROUTES.STUDENT.certificateDownload(enr.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            Download certificate
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Certificate not yet issued by your teacher.
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending payments alert */}
      {pendingEnrollments.length > 0 && (
        <Card className="mb-8 rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-accent/5 overflow-hidden">
          <CardContent className="px-8 pt-8 pb-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Pending Payments</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You have {pendingEnrollments.length} enrollment
                  {pendingEnrollments.length > 1 ? 's' : ''} awaiting payment
                  verification.
                </p>
                <ul className="mt-3 space-y-2">
                  {pendingEnrollments.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-warning" />
                      {e.cohorts.courses.title} &mdash; {e.cohorts.name} (
                      PKR {e.cohorts.fee_pkr.toLocaleString()})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      {payments.length === 0 ? (
        <EmptyState
          title="No payment records"
          description="Your payment history will appear here once you make your first payment."
        />
      ) : (
        <div className="space-y-5">
          {payments.map((payment) => {
            const statusIcon =
              payment.status === 'confirmed' ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : payment.status === 'refunded' ? (
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
              ) : payment.status === 'rejected' ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CreditCard className="h-5 w-5 text-primary" />
              )

            return (
              <Card key={payment.id} className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card overflow-hidden">
                <CardContent className="px-8 pt-8 pb-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        {statusIcon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {payment.enrollments.cohorts.courses.title}
                          </h3>
                          <StatusBadge status={payment.status} size="sm" />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {payment.enrollments.cohorts.name} &middot;{' '}
                          {payment.enrollments.cohorts.teachers.name}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Banknote className="h-3.5 w-3.5" />
                            PKR{' '}
                            {payment.discounted_amount_pkr.toLocaleString()}
                          </span>
                          {payment.discounted_amount_pkr !== payment.amount_pkr && (
                            <span className="line-through">
                              PKR {payment.amount_pkr.toLocaleString()}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5">
                            <Receipt className="h-3.5 w-3.5" />
                            {payment.payment_method === 'screenshot'
                              ? 'Bank Transfer'
                              : payment.payment_method === 'gateway'
                                ? 'Online Payment'
                                : 'Manual'}
                          </span>
                          <span className="text-xs text-muted-foreground/70">
                            Ref: {payment.reference_code}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right sm:shrink-0">
                      <p className="text-sm text-muted-foreground">
                        {formatPKT(payment.created_at, 'datetime')}
                      </p>
                      {payment.payment_month && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          For: {payment.payment_month}
                        </p>
                      )}
                    </div>
                  </div>
                  {payment.rejection_reason && (
                    <div className="mt-4 rounded-2xl bg-destructive/5 p-4 text-sm text-destructive">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>Rejected: {payment.rejection_reason}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
