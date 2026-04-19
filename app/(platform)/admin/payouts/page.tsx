/**
 * app/(platform)/admin/payouts/page.tsx — Admin payout queue
 *
 * Server Component. Shows pending payouts for action + history of completed/failed.
 * Actions (complete/fail) are handled by client components via Server Actions.
 */

import type { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'
import { getAllPayouts } from '@/lib/db/payouts'
import { formatPKT } from '@/lib/time/pkt'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CompletePayoutButton, FailPayoutButton } from './PayoutActions'

export const metadata: Metadata = {
  title: 'Payouts — Skool Rooms Admin',
}

export default async function AdminPayoutsPage() {
  const allPayouts = await getAllPayouts()

  const pending = allPayouts.filter((p) => p.payout.status === 'pending' || p.payout.status === 'processing')
  const history = allPayouts.filter((p) => p.payout.status === 'completed' || p.payout.status === 'failed')

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Review and process teacher payout requests"
      />

      {/* Pending queue */}
      <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card mb-6">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-xl font-bold">
            Pending Queue
            {pending.length > 0 && (
              <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-warning text-warning-foreground text-xs font-bold">
                {pending.length}
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-sm font-medium mt-1">
            Payouts awaiting processing
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {pending.length === 0 ? (
            <div className="rounded-2xl bg-muted/30 ring-1 ring-foreground/[0.03] p-6 text-center">
              <p className="text-sm text-muted-foreground">No pending payouts. All clear.</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-2xl ring-1 ring-foreground/5 overflow-hidden">
              {pending.map(({ payout, teacher, livePaymentSettings, bankDetailsChanged }) => (
                <div key={payout.id} className="p-5 bg-card">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{teacher.name}</span>
                        <StatusBadge status={payout.status} size="sm" />
                        {bankDetailsChanged && (
                          <span className="inline-flex items-center gap-1 text-xs text-warning font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            Bank details updated since request
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{teacher.email}</span>
                      <span className="text-2xl font-bold text-foreground mt-1">
                        PKR {payout.amount_pkr.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Requested {formatPKT(payout.requested_at, 'datetime')}
                      </span>
                    </div>

                    {/* Live bank details */}
                    <div className="shrink-0 min-w-[220px]">
                      {livePaymentSettings ? (
                        <div className="rounded-xl bg-muted/30 ring-1 ring-foreground/[0.05] p-4 space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Live Bank Details
                          </p>
                          {livePaymentSettings.payout_bank_name && (
                            <p className="text-sm text-foreground">
                              <span className="text-muted-foreground">Bank: </span>
                              {livePaymentSettings.payout_bank_name}
                            </p>
                          )}
                          {livePaymentSettings.payout_account_title && (
                            <p className="text-sm text-foreground">
                              <span className="text-muted-foreground">Title: </span>
                              {livePaymentSettings.payout_account_title}
                            </p>
                          )}
                          {livePaymentSettings.payout_iban && (
                            <p className="text-sm text-foreground font-mono">
                              <span className="text-muted-foreground font-sans">IBAN: </span>
                              {livePaymentSettings.payout_iban}
                            </p>
                          )}
                          {livePaymentSettings.jazzcash_number && (
                            <p className="text-sm text-foreground">
                              <span className="text-muted-foreground">JazzCash: </span>
                              {livePaymentSettings.jazzcash_number}
                            </p>
                          )}
                          {livePaymentSettings.easypaisa_number && (
                            <p className="text-sm text-foreground">
                              <span className="text-muted-foreground">EasyPaisa: </span>
                              {livePaymentSettings.easypaisa_number}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-destructive/5 ring-1 ring-destructive/10 p-4">
                          <p className="text-sm text-destructive">No payment settings on file</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <CompletePayoutButton payoutId={payout.id} />
                    <FailPayoutButton payoutId={payout.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-xl font-bold">History</CardTitle>
          <CardDescription className="text-sm font-medium mt-1">
            Completed and failed payout records
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {history.length === 0 ? (
            <div className="rounded-2xl bg-muted/30 ring-1 ring-foreground/[0.03] p-6 text-center">
              <p className="text-sm text-muted-foreground">No payout history yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-2xl ring-1 ring-foreground/5 overflow-hidden">
              {history.map(({ payout, teacher }) => (
                <div key={payout.id} className="flex flex-col gap-1 p-5 bg-card sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{teacher.name}</span>
                      <StatusBadge status={payout.status} size="sm" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      PKR {payout.amount_pkr.toLocaleString()}
                    </span>
                    {payout.admin_note && (
                      <span className="text-xs text-muted-foreground italic">{payout.admin_note}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0">
                    {payout.processed_at
                      ? formatPKT(payout.processed_at, 'datetime')
                      : formatPKT(payout.requested_at, 'datetime')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
