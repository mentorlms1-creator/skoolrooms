/**
 * app/(platform)/admin/earnings/page.tsx — Platform earnings overview
 *
 * Server Component. Displays gross collected, platform cuts, payouts processed,
 * net revenue, and teachers with outstanding debit.
 */

import type { Metadata } from 'next'
import { DollarSign, TrendingUp, ArrowUpRight, AlertCircle } from 'lucide-react'
import { getAdminEarningsSummary, getTeachersWithOutstandingDebit } from '@/lib/db/payouts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Earnings — Skool Rooms Admin',
}

export default async function AdminEarningsPage() {
  const [summary, debtors] = await Promise.all([
    getAdminEarningsSummary(),
    getTeachersWithOutstandingDebit(),
  ])

  return (
    <>
      <PageHeader
        title="Earnings"
        description="Platform-wide revenue and payout summary"
      />

      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <EarningsCard
          label="Gross Collected"
          value={`PKR ${summary.grossCollectedPkr.toLocaleString()}`}
          subtitle="Total from all confirmed student payments"
          icon={DollarSign}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <EarningsCard
          label="Platform Cuts"
          value={`PKR ${summary.totalPlatformCutsPkr.toLocaleString()}`}
          subtitle="Sum of all platform_cut_pkr on confirmed payments"
          icon={TrendingUp}
          iconColor="text-accent"
          iconBg="bg-accent/10"
        />
        <EarningsCard
          label="Payouts Processed"
          value={`PKR ${summary.totalPayoutsProcessedPkr.toLocaleString()}`}
          subtitle="Total paid out to teachers (completed payouts)"
          icon={ArrowUpRight}
          iconColor="text-success"
          iconBg="bg-success/10"
        />
        <EarningsCard
          label="Net Revenue"
          value={`PKR ${summary.netRevenuePkr.toLocaleString()}`}
          subtitle="Total platform cuts earned on confirmed payments"
          icon={TrendingUp}
          iconColor="text-foreground"
          iconBg="bg-muted"
        />
      </div>

      {/* Outstanding debits table */}
      <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Outstanding Debits
            {debtors.length > 0 && (
              <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-warning text-warning-foreground text-xs font-bold">
                {debtors.length}
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-sm font-medium mt-1">
            Teachers with outstanding_debit_pkr &gt; 0 (platform absorbed a refund on their behalf)
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {debtors.length === 0 ? (
            <div className="rounded-2xl bg-muted/30 ring-1 ring-foreground/[0.03] p-6 text-center">
              <p className="text-sm text-muted-foreground">No outstanding debits. All teachers are clear.</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-2xl ring-1 ring-foreground/5 overflow-hidden">
              {debtors.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between p-5 bg-card"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{teacher.name}</span>
                    <span className="text-sm text-muted-foreground">{teacher.email}</span>
                  </div>
                  <span className="font-bold text-destructive">
                    PKR {teacher.outstanding_debit_pkr.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

interface EarningsCardProps {
  label: string
  value: string
  subtitle: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  iconBg: string
  iconColor: string
}

function EarningsCard({ label, value, subtitle, icon: Icon, iconBg, iconColor }: EarningsCardProps) {
  return (
    <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
      <CardContent className="px-7 pt-7 pb-6 flex flex-col items-start gap-4 h-full">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl shrink-0', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} strokeWidth={2} />
        </div>
        <div className="flex flex-col gap-1 flex-1 justify-center">
          <span className="text-2xl font-extrabold tracking-tight text-foreground leading-none">
            {value}
          </span>
          <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">
            {label}
          </p>
        </div>
        <p className="text-xs font-medium text-muted-foreground/60">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
