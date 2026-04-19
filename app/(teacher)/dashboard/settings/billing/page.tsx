/**
 * app/(teacher)/dashboard/settings/billing/page.tsx — Billing history
 *
 * Server Component. Subscription history (with invoice download), recent
 * payouts, outstanding balance snapshot.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherSubscriptions } from '@/lib/db/subscriptions'
import { getTeacherBalance, getTeacherPayouts } from '@/lib/db/balances'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'

export const metadata: Metadata = {
  title: 'Billing \u2014 Skool Rooms',
}

export default async function TeacherBillingPage() {
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string

  const [subscriptions, balance, payouts] = await Promise.all([
    getTeacherSubscriptions(teacherId),
    getTeacherBalance(teacherId),
    getTeacherPayouts(teacherId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Subscription history, payouts and outstanding balance"
      />

      {/* Outstanding balance snapshot */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Balance</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BalanceTile label="Available" value={balance.available_balance_pkr} />
          <BalanceTile label="Pending" value={balance.pending_balance_pkr} />
          <BalanceTile label="Total earned" value={balance.total_earned_pkr} />
          <BalanceTile label="Outstanding debit" value={balance.outstanding_debit_pkr} />
        </div>
      </Card>

      {/* Subscription history */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Subscription history</h2>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re on the Free plan — no billing history yet. Trial periods don&apos;t appear here.
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden flex flex-col gap-3">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="rounded-md border border-border p-3 sm:p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground capitalize">{sub.plan}</span>
                    <StatusBadge status={sub.status} size="sm" />
                  </div>
                  <p className="mt-1 text-foreground">Rs. {sub.amount_pkr.toLocaleString()}</p>
                  <p className="mt-1 text-muted-foreground">
                    {formatPKT(sub.period_start, 'date')} &mdash; {formatPKT(sub.period_end, 'date')}
                  </p>
                  <p className="mt-1 text-muted-foreground">{formatPKT(sub.created_at, 'date')}</p>
                  <p className="mt-1 text-xs text-muted-foreground capitalize">
                    {sub.payment_method.replace('_', ' ')}
                  </p>
                  {sub.status === 'approved' && (
                    <a
                      href={`/api/teacher/invoice/${sub.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-primary hover:underline"
                    >
                      Download invoice
                    </a>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Plan</th>
                    <th className="pb-2 pr-4 font-medium">Amount</th>
                    <th className="pb-2 pr-4 font-medium">Period</th>
                    <th className="pb-2 pr-4 font-medium">Method</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 font-medium text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-medium text-foreground capitalize">{sub.plan}</td>
                      <td className="py-2.5 pr-4 text-foreground">
                        Rs. {sub.amount_pkr.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {formatPKT(sub.period_start, 'date')} &mdash;{' '}
                        {formatPKT(sub.period_end, 'date')}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground capitalize">
                        {sub.payment_method.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={sub.status} size="sm" />
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {formatPKT(sub.created_at, 'date')}
                      </td>
                      <td className="py-2.5 text-right">
                        {sub.status === 'approved' ? (
                          <a
                            href={`/api/teacher/invoice/${sub.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Recent payouts */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Recent payouts</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payouts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Requested</th>
                  <th className="pb-2 font-medium">Processed</th>
                </tr>
              </thead>
              <tbody>
                {payouts.slice(0, 25).map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 text-foreground">
                      Rs. {p.amount_pkr.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={p.status} size="sm" />
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {formatPKT(p.requested_at, 'date')}
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {p.processed_at ? formatPKT(p.processed_at, 'date') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4">
          <Link href={ROUTES.TEACHER.earnings} className="text-sm text-primary hover:underline">
            Manage payouts &rarr;
          </Link>
        </div>
      </Card>
    </div>
  )
}

function BalanceTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-foreground">Rs. {value.toLocaleString()}</p>
    </div>
  )
}
