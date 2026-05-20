/**
 * app/(teacher)/dashboard/earnings/page.tsx — Teacher Earnings page
 *
 * Server Component. In screenshot-payment mode the platform never holds
 * student money — students pay the teacher's bank/JazzCash/EasyPaisa
 * directly. This page is therefore a ledger of what the teacher has
 * already received via the platform, NOT a payout-request UI.
 *
 * The platform commission is recorded in student_payments.platform_cut_pkr
 * for internal accounting but is intentionally not surfaced to teachers
 * in Phase 1. Payout DB tables and server actions are preserved for the
 * Phase 2 gateway flow but no UI in this page wires them up.
 */

import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getTeacherBalance,
  getRecentVerifiedPayments,
} from '@/lib/db/balances'
import { formatPKT } from '@/lib/time/pkt'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Wallet, AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Earnings — Skool Rooms',
}

export default async function EarningsPage() {
  const teacher = await requireTeacher()

  const [balance, recentPayments] = await Promise.all([
    getTeacherBalance(teacher.id),
    getRecentVerifiedPayments(teacher.id, 20),
  ])

  const showDebit = balance.outstanding_debit_pkr > 0

  return (
    <>
      <PageHeader
        title="Earnings"
        description="Track payments you've received directly from students."
      />

      {/* ================================================================== */}
      {/* Verified Earnings + (conditional) Outstanding Debit                 */}
      {/* ================================================================== */}
      <div className={`grid gap-4 ${showDebit ? 'sm:grid-cols-2' : ''}`}>
        {/* Verified Earnings — lifetime */}
        <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
              <Wallet className="h-5 w-5 text-success" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
              Verified Earnings
            </span>
          </div>
          <p className="text-4xl font-extrabold text-foreground">
            PKR {balance.total_earned_pkr.toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Lifetime total from payments you&apos;ve verified
          </p>
        </div>

        {/* Outstanding Debit — only when > 0 */}
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
              Owed back to the platform from refunds; deducted from future earnings.
            </p>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Recent Earnings — Verified Payments                                */}
      {/* ================================================================== */}
      <div className="mt-8">
        <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Recent Earnings
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Money already in your account from screenshot-verified student payments.
          </p>

          {recentPayments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No verified payments yet"
              description="Payments you verify in the Payments queue will appear here."
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
                    <div className="text-xs text-muted-foreground">
                      {payment.verified_at
                        ? formatPKT(payment.verified_at, 'date')
                        : formatPKT(payment.created_at, 'date')}
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
                      <th className="px-3 py-2 font-medium text-muted-foreground text-right">Earned</th>
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
    </>
  )
}
