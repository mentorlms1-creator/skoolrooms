/**
 * app/(student)/student/payments/page.tsx — Student payment history
 *
 * Server Component. Shows payment history across all enrollments.
 * For each payment: course, cohort, amount, payment status badge, reference code.
 */

import type { Metadata } from 'next'
import {
  CreditCard,
  AlertCircle,
  CheckCircle,
  Receipt,
  Clock,
  Banknote,
} from 'lucide-react'
import { requireStudent } from '@/lib/auth/guards'
import { getPaymentsByStudent } from '@/lib/db/student-payments'
import { getEnrollmentsByStudentWithTeacher } from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPKT } from '@/lib/time/pkt'

export const metadata: Metadata = {
  title: 'Payments \u2014 Skool Rooms Student',
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
              payment.status === 'approved' ? (
                <CheckCircle className="h-5 w-5 text-success" />
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
