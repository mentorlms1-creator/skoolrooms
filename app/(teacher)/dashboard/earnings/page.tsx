/**
 * app/(teacher)/dashboard/earnings/page.tsx — Teacher Earnings page
 *
 * Server Component. Shows balance overview, payout request form,
 * payout history, and recent verified payments that credited the balance.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getTeacherBalance,
  getTeacherPayouts,
  getRecentVerifiedPayments,
  hasActivePayout,
} from '@/lib/db/balances'
import { getTeacherPaymentSettings } from '@/lib/db/admin'
import { getMinPayoutAmount } from '@/lib/platform/settings'
import { formatPKT } from '@/lib/time/pkt'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Card } from '@/components/ui/card'
import { PayoutForm } from './payout-form'
import {
  Wallet,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  CreditCard,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Earnings \u2014 Skool Rooms',
}

export default async function EarningsPage() {
  const teacher = await requireTeacher()

  // Fetch all data in parallel
  const [balance, payouts, recentPayments, activePayout, paymentSettings, minPayout] =
    await Promise.all([
      getTeacherBalance(teacher.id),
      getTeacherPayouts(teacher.id),
      getRecentVerifiedPayments(teacher.id, 20),
      hasActivePayout(teacher.id),
      getTeacherPaymentSettings(teacher.id),
      getMinPayoutAmount(),
    ])

  const hasBankDetails = !!(
    paymentSettings &&
    (paymentSettings.payout_iban ||
      paymentSettings.jazzcash_number ||
      paymentSettings.easypaisa_number)
  )

  const showDebit = balance.outstanding_debit_pkr > 0

  return (
    <>
      <PageHeader
        title="Earnings"
        description="Track your balance, request payouts, and view payment history."
      />

      {/* ================================================================== */}
      {/* Balance Overview — Stat Cards                                      */}
      {/* ================================================================== */}
      <div className={`grid gap-4 sm:grid-cols-2 ${showDebit ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {/* Available Balance */}
        <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
              <Wallet className="h-5 w-5 text-success" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
              Available Balance
            </span>
          </div>
          <p className="text-4xl font-extrabold text-foreground">
            PKR {balance.available_balance_pkr.toLocaleString()}
          </p>
        </div>

        {/* Pending Payout */}
        <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
              Pending Payout
            </span>
          </div>
          <p className="text-4xl font-extrabold text-foreground">
            PKR {balance.pending_balance_pkr.toLocaleString()}
          </p>
        </div>

        {/* Total Paid Out */}
        <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ArrowUpRight className="h-5 w-5 text-primary" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
              Total Paid Out
            </span>
          </div>
          <p className="text-4xl font-extrabold text-foreground">
            PKR {balance.total_paid_out_pkr.toLocaleString()}
          </p>
        </div>

        {/* Outstanding Debit — only show if > 0 */}
        {showDebit && (
          <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-destructive/20 bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
                Outstanding Debit
              </span>
            </div>
            <p className="text-4xl font-extrabold text-destructive">
              PKR {balance.outstanding_debit_pkr.toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Deducted from future earnings due to refunds
            </p>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Payout Request + Payout History — Side by Side on Desktop          */}
      {/* ================================================================== */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Payout Request Form */}
        <PayoutForm
          availableBalance={balance.available_balance_pkr}
          minPayoutAmount={minPayout}
          hasBankDetails={hasBankDetails}
          hasActivePayout={activePayout}
        />

        {/* Payout History */}
        <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-5">Payout History</h2>

          {payouts.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No payouts yet"
              description="Your payout history will appear here once you request your first withdrawal."
              className="py-8"
            />
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="rounded-xl border border-border/50 p-4 text-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground">
                        PKR {payout.amount_pkr.toLocaleString()}
                      </span>
                      <StatusBadge status={payout.status} size="sm" />
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Requested {formatPKT(payout.requested_at, 'date')}</span>
                      {payout.processed_at && (
                        <span>Completed {formatPKT(payout.processed_at, 'date')}</span>
                      )}
                    </div>
                    {payout.admin_note && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        {payout.admin_note}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium text-muted-foreground">Amount</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Requested</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Completed</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => (
                      <tr
                        key={payout.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          PKR {payout.amount_pkr.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={payout.status} size="sm" />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatPKT(payout.requested_at, 'date')}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {payout.processed_at
                            ? formatPKT(payout.processed_at, 'date')
                            : '\u2014'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                          {payout.admin_note || '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Recent Earnings — Verified Payments                                */}
      {/* ================================================================== */}
      <div className="mt-8">
        <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-5">
            Recent Earnings
          </h2>

          {recentPayments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No verified payments yet"
              description="Payments that have been verified will appear here along with a breakdown of platform fees and your net earnings."
              className="py-8"
            />
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-border/50 p-4 text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">
                        {payment.enrollments.students.name}
                      </span>
                      <span className="font-semibold text-success">
                        +PKR {payment.teacher_payout_amount_pkr.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs mb-2">
                      {payment.enrollments.cohorts.courses.title} &middot;{' '}
                      {payment.enrollments.cohorts.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Gross: PKR {payment.discounted_amount_pkr.toLocaleString()}</span>
                      <span>Cut: PKR {payment.platform_cut_pkr.toLocaleString()}</span>
                      <span>
                        {payment.verified_at
                          ? formatPKT(payment.verified_at, 'date')
                          : formatPKT(payment.created_at, 'date')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium text-muted-foreground">Student</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Course / Cohort</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground text-right">Gross</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground text-right">Platform Cut</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground text-right">Net Earned</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {payment.enrollments.students.name}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {payment.enrollments.cohorts.courses.title}
                          <span className="text-foreground/40 mx-1">/</span>
                          {payment.enrollments.cohorts.name}
                        </td>
                        <td className="px-3 py-2 text-foreground text-right">
                          PKR {payment.discounted_amount_pkr.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-right">
                          PKR {payment.platform_cut_pkr.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-medium text-success text-right">
                          PKR {payment.teacher_payout_amount_pkr.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {payment.verified_at
                            ? formatPKT(payment.verified_at, 'date')
                            : formatPKT(payment.created_at, 'date')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bank details hint */}
      {!hasBankDetails && (
        <div className="mt-6 rounded-[2rem] border-none shadow-sm ring-1 ring-warning/20 bg-warning/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Payment details not set
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your bank account or mobile wallet details in{' '}
                <Link
                  href={ROUTES.TEACHER.settings.payment}
                  className="text-primary underline underline-offset-2 hover:no-underline"
                >
                  Settings &rarr; Payments
                </Link>{' '}
                to enable payout requests.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
