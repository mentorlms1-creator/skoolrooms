/**
 * app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx
 *
 * Server Component. Displays enrolled students, pending enrollments, withdrawal
 * requests, and the waitlist. Provides per-row actions (refund, remove) plus
 * approve/reject for pending withdrawals.
 */

import { notFound } from 'next/navigation'
import { requireTeacher } from '@/lib/auth/guards'
import { getCohortById } from '@/lib/db/cohorts'
import { getCourseById } from '@/lib/db/courses'
import { getEnrollmentsByCohort } from '@/lib/db/enrollments'
import { getWaitlistByCohort } from '@/lib/db/waitlist'
import {
  getLatestPaymentsByEnrollmentIds,
  getAllPaymentsByEnrollmentIds,
} from '@/lib/db/student-payments'
import { getTeacherBalance } from '@/lib/db/balances'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { formatPKT, firstOfMonthPKT, monthlyBillingSchedule } from '@/lib/time/pkt'
import { StudentRowActions, type RowPayment } from './StudentRowActions'
import { WithdrawalRequestRow } from './WithdrawalRequestRow'
import type { ModalPayment } from './EnrollmentPaymentsModal'

type StudentsPageProps = {
  params: Promise<{ courseId: string; cohortId: string }>
}

export default async function CohortStudentsPage({ params }: StudentsPageProps) {
  const { courseId, cohortId } = await params
  const teacher = await requireTeacher()

  const [cohort, course] = await Promise.all([
    getCohortById(cohortId),
    getCourseById(courseId),
  ])

  if (!cohort || cohort.teacher_id !== teacher.id) {
    notFound()
  }

  if (!course || course.teacher_id !== teacher.id) {
    notFound()
  }

  const [enrollments, waitlistEntries, balance] = await Promise.all([
    getEnrollmentsByCohort(cohortId),
    getWaitlistByCohort(cohortId),
    getTeacherBalance(teacher.id),
  ])

  // Separate enrollments by status
  const activeEnrollments = enrollments.filter((e) => e.status === 'active')
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending')
  const withdrawalRequests = enrollments.filter(
    (e) => e.status === 'active' && e.withdrawal_requested_at,
  )

  const activeEnrollmentIds = activeEnrollments.map((e) => e.id)
  const isMonthly = cohort.fee_type === 'monthly'

  // Batch-fetch latest payment per active enrollment for refund eligibility,
  // then project a slim shape (only the fields the client needs) to avoid
  // shipping every payment column over the Server→Client boundary.
  const fullPayments = await getLatestPaymentsByEnrollmentIds(activeEnrollmentIds)
  const slimPaymentByEnrollment = new Map<string, RowPayment>()
  for (const [eid, p] of fullPayments) {
    slimPaymentByEnrollment.set(eid, {
      id: p.id,
      amount_pkr: p.amount_pkr,
      teacher_payout_amount_pkr: p.teacher_payout_amount_pkr,
      platform_cut_pkr: p.platform_cut_pkr,
      payment_method: p.payment_method,
      refunded_at: p.refunded_at,
      status: p.status,
      screenshot_url: p.screenshot_url,
    })
  }

  // For monthly cohorts: fetch ALL payments per enrollment for the modal + months-paid column.
  const allPaymentsByEnrollment = isMonthly
    ? await getAllPaymentsByEnrollmentIds(activeEnrollmentIds)
    : new Map<string, ModalPayment[]>()

  // Project to ModalPayment slim shape per enrollment
  const modalPaymentsByEnrollment = new Map<string, ModalPayment[]>()
  for (const [eid, rows] of allPaymentsByEnrollment) {
    modalPaymentsByEnrollment.set(
      eid,
      rows.map((p) => ({
        id: p.id,
        payment_month: p.payment_month,
        amount_pkr: p.amount_pkr,
        teacher_payout_amount_pkr: p.teacher_payout_amount_pkr,
        platform_cut_pkr: p.platform_cut_pkr,
        payment_method: p.payment_method,
        status: p.status,
        screenshot_url: p.screenshot_url,
        rejection_reason: p.rejection_reason,
        refunded_at: p.refunded_at,
        verified_at: p.verified_at,
      })),
    )
  }

  // Months-paid column: compute Y = elapsed billing months up to today (capped at end_date)
  const todayDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const effectiveEndDate = cohort.end_date < todayDateStr ? cohort.end_date : todayDateStr
  const elapsedMonths = isMonthly
    ? monthlyBillingSchedule(cohort.start_date, effectiveEndDate).length
    : 0

  // Per-row: count confirmed months paid (X) and whether any pending_verification exists
  const monthsPaidByEnrollment = new Map<string, number>()
  const hasPendingPaymentByEnrollment = new Map<string, boolean>()
  for (const [eid, rows] of allPaymentsByEnrollment) {
    const confirmed = rows.filter(
      (p) => p.status === 'confirmed' && p.payment_month,
    ).length
    monthsPaidByEnrollment.set(eid, confirmed)
    hasPendingPaymentByEnrollment.set(
      eid,
      rows.some((p) => p.status === 'pending_verification'),
    )
  }

  const cohortArchived = cohort.status === 'archived'

  return (
    <>
      <PageHeader
        title={`Students — ${cohort.name}`}
        backHref={ROUTES.TEACHER.cohortDetail(courseId, cohortId)}
        description={`${course.title} — ${activeEnrollments.length} active, ${pendingEnrollments.length} pending`}
      />

      <div className="flex flex-col gap-6">
        {/* Withdrawal Requests */}
        {withdrawalRequests.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Withdrawal Requests ({withdrawalRequests.length})
            </h2>
            <div className="flex flex-col gap-3">
              {withdrawalRequests.map((enrollment) => (
                <WithdrawalRequestRow
                  key={enrollment.id}
                  enrollmentId={enrollment.id}
                  studentName={enrollment.students.name}
                  studentEmail={enrollment.students.email}
                  withdrawalReason={enrollment.withdrawal_reason}
                  requestedAt={enrollment.withdrawal_requested_at as string}
                />
              ))}
            </div>
          </Card>
        )}

        {/* Active Students */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Active Students ({activeEnrollments.length})
          </h2>

          {activeEnrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active students yet.</p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {activeEnrollments.map((enrollment) => {
                  const hasPending = hasPendingPaymentByEnrollment.get(enrollment.id) ?? false
                  const monthsPaid = monthsPaidByEnrollment.get(enrollment.id) ?? 0
                  return (
                    <div key={enrollment.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{enrollment.students.name}</p>
                            {hasPending && (
                              <span className="inline-flex h-2 w-2 rounded-full bg-warning" title="Pending review" />
                            )}
                          </div>
                          <p className="text-muted-foreground">{enrollment.students.email}</p>
                          <p className="text-muted-foreground">{enrollment.students.phone}</p>
                          {isMonthly && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Months paid: {monthsPaid}/{elapsedMonths}
                            </p>
                          )}
                        </div>
                        <StudentRowActions
                          enrollmentId={enrollment.id}
                          studentName={enrollment.students.name}
                          payment={slimPaymentByEnrollment.get(enrollment.id) ?? null}
                          availableBalance={balance.available_balance_pkr}
                          cohortArchived={cohortArchived}
                          hasPendingWithdrawal={!!enrollment.withdrawal_requested_at}
                          cohortFeeType={cohort.fee_type}
                          allPayments={modalPaymentsByEnrollment.get(enrollment.id) ?? []}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-muted-foreground">{formatPKT(enrollment.created_at, 'date')}</span>
                        <StatusBadge status={enrollment.status} size="sm" />
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Name</th>
                      <th className="pb-2 font-medium text-muted-foreground">Email</th>
                      <th className="pb-2 font-medium text-muted-foreground">Phone</th>
                      <th className="pb-2 font-medium text-muted-foreground">Enrolled</th>
                      {isMonthly && (
                        <th className="pb-2 font-medium text-muted-foreground">Months paid</th>
                      )}
                      <th className="pb-2 font-medium text-muted-foreground">Status</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEnrollments.map((enrollment) => {
                      const hasPending = hasPendingPaymentByEnrollment.get(enrollment.id) ?? false
                      const monthsPaid = monthsPaidByEnrollment.get(enrollment.id) ?? 0
                      return (
                        <tr key={enrollment.id} className="border-b border-border/50">
                          <td className="py-3 font-medium text-foreground">
                            <span className="inline-flex items-center gap-2">
                              {enrollment.students.name}
                              {hasPending && (
                                <span className="inline-flex h-2 w-2 rounded-full bg-warning" title="Pending review" />
                              )}
                            </span>
                          </td>
                          <td className="py-3 text-muted-foreground">{enrollment.students.email}</td>
                          <td className="py-3 text-muted-foreground">{enrollment.students.phone}</td>
                          <td className="py-3 text-muted-foreground">
                            {formatPKT(enrollment.created_at, 'date')}
                          </td>
                          {isMonthly && (
                            <td className="py-3 text-muted-foreground">
                              {monthsPaid}/{elapsedMonths}
                            </td>
                          )}
                          <td className="py-3">
                            <StatusBadge status={enrollment.status} size="sm" />
                          </td>
                          <td className="py-3 text-right">
                            <StudentRowActions
                              enrollmentId={enrollment.id}
                              studentName={enrollment.students.name}
                              payment={slimPaymentByEnrollment.get(enrollment.id) ?? null}
                              availableBalance={balance.available_balance_pkr}
                              cohortArchived={cohortArchived}
                              hasPendingWithdrawal={!!enrollment.withdrawal_requested_at}
                              cohortFeeType={cohort.fee_type}
                              allPayments={modalPaymentsByEnrollment.get(enrollment.id) ?? []}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Pending Enrollments */}
        {pendingEnrollments.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Pending Enrollments ({pendingEnrollments.length})
            </h2>

            <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {pendingEnrollments.map((enrollment) => (
                  <div key={enrollment.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-medium text-foreground">{enrollment.students.name}</p>
                    <p className="text-muted-foreground">{enrollment.students.email}</p>
                    <p className="text-muted-foreground">{enrollment.students.phone}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-muted-foreground">{formatPKT(enrollment.created_at, 'date')}</span>
                      <StatusBadge status={enrollment.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Name</th>
                      <th className="pb-2 font-medium text-muted-foreground">Email</th>
                      <th className="pb-2 font-medium text-muted-foreground">Phone</th>
                      <th className="pb-2 font-medium text-muted-foreground">Date</th>
                      <th className="pb-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingEnrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="border-b border-border/50">
                        <td className="py-3 font-medium text-foreground">
                          {enrollment.students.name}
                        </td>
                        <td className="py-3 text-muted-foreground">{enrollment.students.email}</td>
                        <td className="py-3 text-muted-foreground">{enrollment.students.phone}</td>
                        <td className="py-3 text-muted-foreground">
                          {formatPKT(enrollment.created_at, 'date')}
                        </td>
                        <td className="py-3">
                          <StatusBadge status={enrollment.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          </Card>
        )}

        {/* Waitlist Management Panel */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Waitlist ({waitlistEntries.length})
            {!cohort.waitlist_enabled && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">(disabled)</span>
            )}
          </h2>

          {waitlistEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {cohort.waitlist_enabled
                ? 'No one is on the waitlist yet.'
                : 'Waitlist is disabled for this cohort. Enable it in cohort settings.'}
            </p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {waitlistEntries.map((entry) => (
                  <div key={entry.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">#{entry.position}</span>
                      <p className="font-medium text-foreground">{entry.student_name}</p>
                    </div>
                    <p className="text-muted-foreground">{entry.student_email}</p>
                    <p className="text-muted-foreground">{entry.student_phone}</p>
                    <p className="mt-1 text-muted-foreground">{formatPKT(entry.joined_at, 'datetime')}</p>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium text-muted-foreground">#</th>
                      <th className="pb-2 font-medium text-muted-foreground">Name</th>
                      <th className="pb-2 font-medium text-muted-foreground">Email</th>
                      <th className="pb-2 font-medium text-muted-foreground">Phone</th>
                      <th className="pb-2 font-medium text-muted-foreground">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlistEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/50">
                        <td className="py-3 text-muted-foreground">{entry.position}</td>
                        <td className="py-3 font-medium text-foreground">
                          {entry.student_name}
                        </td>
                        <td className="py-3 text-muted-foreground">{entry.student_email}</td>
                        <td className="py-3 text-muted-foreground">{entry.student_phone}</td>
                        <td className="py-3 text-muted-foreground">
                          {formatPKT(entry.joined_at, 'datetime')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
