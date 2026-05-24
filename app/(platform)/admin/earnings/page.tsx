/**
 * app/(platform)/admin/earnings/page.tsx — Subscription earnings overview
 *
 * Server Component. Phase 1 reality: the platform's revenue is teacher
 * subscriptions, not transaction cuts. This page reflects that.
 * /admin/metrics keeps the MRR/churn/conversion analytics view; this page is
 * the cash-receipts view.
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import { ArrowDownRight, ArrowUpRight, Clock, Users, Wallet, XCircle } from 'lucide-react'
import {
  getEarningsKpi,
  getRevenueByPlan,
  getMonthlyRevenueSeries,
  getRecentApprovals,
} from '@/lib/db/admin-earnings'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import { RevenueChart } from './RevenueChart'

export const metadata: Metadata = {
  title: 'Earnings — Skool Rooms Admin',
}

export default async function AdminEarningsPage() {
  const [kpi, byPlan, monthlySeries, recentApprovals] = await Promise.all([
    getEarningsKpi(),
    getRevenueByPlan(),
    getMonthlyRevenueSeries(12),
    getRecentApprovals(10),
  ])

  return (
    <>
      <PageHeader
        title="Earnings"
        description="Subscription revenue collected from teachers (Phase 1)."
      />

      {/* ── KPI strip ───────────────────────────────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard
          label="All-time revenue"
          value={formatPkr(kpi.allTimeRevenuePkr)}
          subtitle="From every approved subscription"
          icon={Wallet}
          tone="primary"
        />
        <KpiCard
          label="This month"
          value={formatPkr(kpi.thisMonthRevenuePkr)}
          subtitle={
            kpi.monthOverMonthPct === null
              ? 'No data for last month'
              : `${kpi.monthOverMonthPct >= 0 ? '+' : ''}${kpi.monthOverMonthPct}% vs last month`
          }
          deltaPositive={kpi.monthOverMonthPct !== null && kpi.monthOverMonthPct >= 0}
          deltaValue={kpi.monthOverMonthPct}
          icon={kpi.monthOverMonthPct !== null && kpi.monthOverMonthPct >= 0 ? ArrowUpRight : ArrowDownRight}
          tone="success"
        />
        <KpiCard
          label="Active subscribers"
          value={kpi.activeSubscribers.toLocaleString()}
          subtitle="Teachers currently on a paid plan"
          icon={Users}
          tone="accent"
        />
        <PendingQueueCard
          pending={kpi.pendingVerificationCount}
          rejected30d={kpi.rejectedLast30dCount}
        />
      </div>

      {/* ── Monthly revenue chart ─────────────────────────────────── */}
      <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card mb-6">
        <CardHeader className="px-8 pt-8 pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-xl font-bold">Monthly revenue</CardTitle>
              <CardDescription className="text-sm font-medium mt-1">
                Last 12 months · current month highlighted
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <RevenueChart data={monthlySeries} />
        </CardContent>
      </Card>

      {/* ── Revenue by plan ─────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] mb-6">
        <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
          <CardHeader className="px-8 pt-8 pb-3">
            <CardTitle className="text-xl font-bold">Revenue by plan</CardTitle>
            <CardDescription className="text-sm font-medium mt-1">
              Active subscribers and lifetime revenue per plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {byPlan.length === 0 ? (
              <EmptyHint text="No plans configured." />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
                  <tr>
                    <th className="px-6 py-3 text-left">Plan</th>
                    <th className="px-3 py-3 text-right">Monthly price</th>
                    <th className="px-3 py-3 text-right">Active</th>
                    <th className="px-3 py-3 text-right">MRR contribution</th>
                    <th className="px-6 py-3 text-right">All-time revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byPlan.map((row) => (
                    <tr key={row.planSlug} className="border-t border-foreground/[0.05]">
                      <td className="px-6 py-3.5 font-semibold text-foreground capitalize">{row.planName}</td>
                      <td className="px-3 py-3.5 text-right text-muted-foreground">{formatPkr(row.monthlyPricePkr)}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums">{row.activeSubscribers}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-foreground">
                        {formatPkr(row.monthlyContributionPkr)}
                      </td>
                      <td className="px-6 py-3.5 text-right tabular-nums font-bold text-foreground">
                        {formatPkr(row.allTimeRevenuePkr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* ── Recent approvals ──────────────────────────────────────── */}
        <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
          <CardHeader className="px-8 pt-8 pb-3">
            <CardTitle className="text-xl font-bold">Recent approvals</CardTitle>
            <CardDescription className="text-sm font-medium mt-1">
              Last 10 subscriptions you verified.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            {recentApprovals.length === 0 ? (
              <EmptyHint text="No approved subscriptions yet." />
            ) : (
              <ul className="divide-y divide-foreground/[0.04]">
                {recentApprovals.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-foreground truncate">{a.teacherName}</p>
                      <p className="text-[11.5px] text-muted-foreground truncate">
                        <span className="capitalize">{a.planSlug}</span>
                        <span className="mx-1.5 opacity-50">·</span>
                        {formatPKT(a.approvedAt, 'date')}
                      </p>
                    </div>
                    <span className="text-[13px] font-bold tabular-nums text-foreground shrink-0">
                      {formatPkr(a.amountPkr)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Footnote ────────────────────────────────────────────────── */}
      <p className="text-[11.5px] text-muted-foreground/70 max-w-3xl">
        Phase 1: teachers receive student fees directly via bank/JazzCash/EasyPaisa transfer,
        so the platform takes no per-payment cut. Revenue shown here is what teachers pay
        for their subscription. Per-transaction cuts return when the Phase 2 gateway is live.
      </p>
    </>
  )
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

type Tone = 'primary' | 'accent' | 'success' | 'warning'

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: 'bg-primary/10', fg: 'text-primary' },
  accent: { bg: 'bg-accent/10', fg: 'text-accent' },
  success: { bg: 'bg-success/10', fg: 'text-success' },
  warning: { bg: 'bg-warning/15', fg: 'text-warning' },
}

interface KpiCardProps {
  label: string
  value: string
  subtitle: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  tone: Tone
  deltaPositive?: boolean
  deltaValue?: number | null
}

function KpiCard({ label, value, subtitle, icon: Icon, tone, deltaPositive, deltaValue }: KpiCardProps) {
  const t = TONE_STYLES[tone]
  return (
    <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
      <CardContent className="px-7 pt-7 pb-6 flex flex-col gap-4 h-full">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl shrink-0', t.bg)}>
          <Icon className={cn('h-5 w-5', t.fg)} strokeWidth={2} />
        </div>
        <div className="flex flex-col gap-1 flex-1 justify-center">
          <span className="text-2xl font-extrabold tracking-tight text-foreground leading-none">
            {value}
          </span>
          <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">
            {label}
          </p>
        </div>
        <p
          className={cn(
            'text-xs font-medium',
            deltaValue !== undefined && deltaValue !== null
              ? deltaPositive
                ? 'text-success'
                : 'text-destructive'
              : 'text-muted-foreground/60',
          )}
        >
          {subtitle}
        </p>
      </CardContent>
    </Card>
  )
}

function PendingQueueCard({ pending, rejected30d }: { pending: number; rejected30d: number }) {
  const hasPending = pending > 0
  const tone = hasPending ? TONE_STYLES.warning : TONE_STYLES.accent
  return (
    <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
      <CardContent className="px-7 pt-7 pb-6 flex flex-col gap-4 h-full">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl shrink-0', tone.bg)}>
          <Clock className={cn('h-5 w-5', tone.fg)} strokeWidth={2} />
        </div>
        <div className="flex flex-col gap-1 flex-1 justify-center">
          <span className="text-2xl font-extrabold tracking-tight text-foreground leading-none">
            {pending.toLocaleString()}
          </span>
          <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">
            Pending verification
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          {rejected30d > 0 ? (
            <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {rejected30d} rejected · 30d
            </span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground/60">None rejected · 30d</span>
          )}
          {hasPending && (
            <Link
              href={ROUTES.ADMIN.payments}
              className="text-xs font-semibold text-primary hover:text-primary/80"
            >
              Review →
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-muted/30 ring-1 ring-foreground/[0.03] mx-4 my-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function formatPkr(n: number): string {
  return `₨${n.toLocaleString()}`
}
