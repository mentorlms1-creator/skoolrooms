/**
 * app/(student)/student/billing/page.tsx — Student payment history
 *
 * Server Component. Shows payment history across all enrollments.
 * For each payment: course, cohort, amount, payment status badge, reference code.
 */

import type { Metadata } from 'next'
import { requireStudent } from '@/lib/auth/guards'
import { getPaymentsByStudent } from '@/lib/db/student-payments'
import { getEnrollmentsByStudentWithTeacher } from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPKT } from '@/lib/time/pkt'

export const metadata: Metadata = {
  title: 'Payments \u2014 Lumscribe Student',
}

export default async function StudentBillingPage() {
  const student = await requireStudent()

  const [payments, enrollments] = await Promise.all([
    getPaymentsByStudent(student.id),
    getEnrollmentsByStudentWithTeacher(student.id),
  ])

  // Build a summary of outstanding payments
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending')

  return (
    <>
      <PageHeader
        title="Payments"
        description="Your payment history and pending fees"
      />

      {/* Pending payments alert */}
      {pendingEnrollments.length > 0 && (
        <Card className="mb-6 border-warning/30 bg-warning/5 p-4">
          <h3 className="font-medium text-foreground">Pending Payments</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You have {pendingEnrollments.length} enrollment
            {pendingEnrollments.length > 1 ? 's' : ''} awaiting payment
            verification.
          </p>
          <ul className="mt-2 space-y-1">
            {pendingEnrollments.map((e) => (
              <li key={e.id} className="text-sm text-muted-foreground">
                {e.cohorts.courses.title} &mdash; {e.cohorts.name} (
                PKR {e.cohorts.fee_pkr.toLocaleString()})
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Payment history */}
      {payments.length === 0 ? (
        <EmptyState
          title="No payment records"
          description="Your payment history will appear here once you make your first payment."
        />
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <Card key={payment.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">
                      {payment.enrollments.cohorts.courses.title}
                    </h3>
                    <StatusBadge status={payment.status} size="sm" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {payment.enrollments.cohorts.name} &middot;{' '}
                    {payment.enrollments.cohorts.teachers.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      Amount: PKR{' '}
                      {payment.discounted_amount_pkr.toLocaleString()}
                    </span>
                    {payment.discounted_amount_pkr !== payment.amount_pkr && (
                      <span className="line-through">
                        PKR {payment.amount_pkr.toLocaleString()}
                      </span>
                    )}
                    <span>
                      Method:{' '}
                      {payment.payment_method === 'screenshot'
                        ? 'Bank Transfer'
                        : payment.payment_method === 'gateway'
                          ? 'Online Payment'
                          : 'Manual'}
                    </span>
                    <span>Ref: {payment.reference_code}</span>
                  </div>
                </div>
                <div className="text-right">
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
                <div className="mt-3 rounded-md bg-destructive/5 p-2 text-sm text-destructive">
                  Rejected: {payment.rejection_reason}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
