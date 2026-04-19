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
import { getCertificatesByEnrollmentIds } from '@/lib/db/certificates'
import { getWaitlistByCohort } from '@/lib/db/waitlist'
import {
  getLatestPaymentsByEnrollmentIds,
  getAllPaymentsByEnrollmentIds,
} from '@/lib/db/student-payments'
import { getFeedbackByCohort } from '@/lib/db/feedback'
import { getTeacherBalance } from '@/lib/db/balances'
import { getOverdueSubmissions, getSubmissionStatsForStudent } from '@/lib/db/assignments'
import { getAttendanceTimelineForStudent } from '@/lib/db/attendance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { formatPKT, firstOfMonthPKT, monthlyBillingSchedule } from '@/lib/time/pkt'
import { StudentRowActions, type RowPayment, type RowCertificate } from './StudentRowActions'
import { WithdrawalRequestRow } from './WithdrawalRequestRow'
import { BulkIssueCertificatesButton } from './BulkIssueCertificatesButton'
import { BulkMarkCompleteButton } from './BulkMarkCompleteButton'
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

  const [enrollments, waitlistEntries, balance, overdueRecords, feedbackList] = await Promise.all([
    getEnrollmentsByCohort(cohortId),
    getWaitlistByCohort(cohortId),
    getTeacherBalance(teacher.id),
    getOverdueSubmissions(cohortId),
    cohort.status === 'archived' ? getFeedbackByCohort(cohortId) : Promise.resolve([]),
  ])

  // Build per-student overdue count map (O(n) pass over overdue records)
  const overdueByStudent = new Map<string, number>()
  for (const record of overdueRecords) {
    overdueByStudent.set(record.student_id, (overdueByStudent.get(record.student_id) ?? 0) + 1)
  }

  // Separate enrollments by status
  const activeEnrollments = enrollments.filter((e) => e.status === 'active')
  const completedEnrollments = enrollments.filter((e) => e.status === 'completed')
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending')
  const withdrawalRequests = enrollments.filter(
    (e) => e.status === 'active' && e.withdrawal_requested_at,
  )

  const activeEnrollmentIds = activeEnrollments.map((e) => e.id)
  const allEnrollmentIds = [
    ...activeEnrollmentIds,
    ...completedEnrollments.map((e) => e.id),
  ]
  const isMonthly = cohort.fee_type === 'monthly'

  // Certificate lookup for both active and completed rows.
  const certByEnrollment = await getCertificatesByEnrollmentIds(allEnrollmentIds)
  const eligibleForBulkIssue = completedEnrollments.filter((e) => {
    const cert = certByEnrollment.get(e.id)
    return !cert || cert.revoked_at !== null
  }).length

  function rowCertFor(enrollmentId: string): RowCertificate | null {
    const c = certByEnrollment.get(enrollmentId)
    if (!c) return null
    return { id: c.id, certificate_number: c.certificate_number, revoked_at: c.revoked_at }
  }

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

  // Prefetch progress data per active enrollment for the Progress dialog.
  // Capped to active enrollments only — this is the surface where teachers act.
  const progressByEnrollment = new Map<
    string,
    {
      cohortName: string
      timeline: Awaited<ReturnType<typeof getAttendanceTimelineForStudent>>
      stats: Awaited<ReturnType<typeof getSubmissionStatsForStudent>>
    }
  >()
  await Promise.all(
    activeEnrollments.map(async (enrollment) => {
      const [timeline, stats] = await Promise.all([
        getAttendanceTimelineForStudent(enrollment.students.id, cohortId),
        getSubmissionStatsForStudent(enrollment.students.id, cohortId),
      ])
      progressByEnrollment.set(enrollment.id, {
        cohortName: cohort.name,
        timeline,
        stats,
      })
    }),
  )

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

        {/* Cohort completion toolbar */}
        {!cohortArchived && (activeEnrollments.length > 0 || completedEnrollments.length > 0) && (
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {completedEnrollments.length} completed
                {completedEnrollments.length > 0 && (
                  <span> · {completedEnrollments.length - eligibleForBulkIssue} with certificate</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeEnrollments.length > 0 && (
                  <BulkMarkCompleteButton
                    cohortId={cohortId}
                    activeCount={activeEnrollments.length}
                  />
                )}
                <BulkIssueCertificatesButton
                  cohortId={cohortId}
                  eligibleCount={eligibleForBulkIssue}
                />
              </div>
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
                  const overdueCount = overdueByStudent.get(enrollment.students.id) ?? 0
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
                          {overdueCount > 0 && (
                            <span className="mt-1 inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                              {overdueCount} overdue
                            </span>
                          )}
                          <a
                            href={`/api/teacher/progress-report/${enrollment.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block text-xs text-primary hover:underline"
                          >
                            Download Report
                          </a>
                        </div>
                        <StudentRowActions
                          enrollmentId={enrollment.id}
                          studentName={enrollment.students.name}
                          enrollmentStatus={enrollment.status}
                          payment={slimPaymentByEnrollment.get(enrollment.id) ?? null}
                          availableBalance={balance.available_balance_pkr}
                          cohortArchived={cohortArchived}
                          hasPendingWithdrawal={!!enrollment.withdrawal_requested_at}
                          cohortFeeType={cohort.fee_type}
                          allPayments={modalPaymentsByEnrollment.get(enrollment.id) ?? []}
                          certificate={rowCertFor(enrollment.id)}
                          progress={progressByEnrollment.get(enrollment.id) ?? null}
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
                      <th className="pb-2 font-medium text-muted-foreground">Overdue</th>
                      <th className="pb-2 font-medium text-muted-foreground">Status</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEnrollments.map((enrollment) => {
                      const hasPending = hasPendingPaymentByEnrollment.get(enrollment.id) ?? false
                      const monthsPaid = monthsPaidByEnrollment.get(enrollment.id) ?? 0
                      const overdueCount = overdueByStudent.get(enrollment.students.id) ?? 0
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
                            {overdueCount > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                {overdueCount} overdue
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3">
                            <StatusBadge status={enrollment.status} size="sm" />
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <a
                                href={`/api/teacher/progress-report/${enrollment.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary underline-offset-2 hover:underline"
                              >
                                PDF
                              </a>
                              <StudentRowActions
                                enrollmentId={enrollment.id}
                                studentName={enrollment.students.name}
                                enrollmentStatus={enrollment.status}
                                payment={slimPaymentByEnrollment.get(enrollment.id) ?? null}
                                availableBalance={balance.available_balance_pkr}
                                cohortArchived={cohortArchived}
                                hasPendingWithdrawal={!!enrollment.withdrawal_requested_at}
                                cohortFeeType={cohort.fee_type}
                                allPayments={modalPaymentsByEnrollment.get(enrollment.id) ?? []}
                                certificate={rowCertFor(enrollment.id)}
                                progress={progressByEnrollment.get(enrollment.id) ?? null}
                              />
                            </div>
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

        {/* Completed Students */}
        {completedEnrollments.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Completed Students ({completedEnrollments.length})
            </h2>
            <div className="flex flex-col gap-3">
              {completedEnrollments.map((enrollment) => {
                const cert = rowCertFor(enrollment.id)
                const certLabel = cert
                  ? cert.revoked_at
                    ? 'Certificate revoked'
                    : `Certificate: ${cert.certificate_number}`
                  : 'No certificate yet'
                return (
                  <div
                    key={enrollment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{enrollment.students.name}</p>
                      <p className="text-muted-foreground">{enrollment.students.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{certLabel}</p>
                    </div>
                    <StudentRowActions
                      enrollmentId={enrollment.id}
                      studentName={enrollment.students.name}
                      enrollmentStatus={enrollment.status}
                      payment={null}
                      availableBalance={balance.available_balance_pkr}
                      cohortArchived={cohortArchived}
                      hasPendingWithdrawal={false}
                      cohortFeeType={cohort.fee_type}
                      certificate={cert}
                    />
                  </div>
                )
              })}
            </div>
          </Card>
        )}

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

      {/* Feedback section — only shown for archived cohorts */}
      {cohort.status === 'archived' && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Student Feedback</h2>
          {feedbackList.length === 0 ? (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">
                No feedback submitted yet for this cohort.
              </p>
            </Card>
          ) : (
            <Card className="p-6">
              {/* Average rating */}
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl font-bold text-foreground">
                  {(feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length).toFixed(1)}
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Average rating from {feedbackList.length} review{feedbackList.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">out of 5</p>
                </div>
              </div>

              {/* Individual feedback rows */}
              <div className="space-y-3 divide-y divide-border">
                {feedbackList.map((f) => (
                  <div key={f.id} className="pt-3 first:pt-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatPKT(f.created_at, 'date')}
                      </span>
                    </div>
                    {f.comment && (
                      <p className="mt-1 text-sm text-muted-foreground">{f.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
