/**
 * app/(platform)/admin/page.tsx — Admin dashboard home
 *
 * Server Component. Bento layout split into 4 rows:
 *   1. Hero KPI strip (MRR + 3 secondary stats, all clickable)
 *   2. Today's ticker (signups / approvals / payments / classes happening today)
 *   3. Main bento — Teacher Activity + Recent Signups (left) | Alerts Feed
 *      + Conversion Funnel (right)
 *   4. Top Teachers + Plan Mix
 *
 * Every KPI drills down to its detail page. Search/command launches via the
 * top-bar Cmd+K (admin layout passes the searchAction).
 */

import type { Metadata } from 'next'
import {
  TrendingUp,
  UserPlus,
  CreditCard,
  Users,
  ArrowUpRight,
} from 'lucide-react'
import {
  getAdminDashboardStats,
  getOperationsStats,
  getRecentTeachers,
  getTeacherActivityCard,
} from '@/lib/db/admin'
import {
  getAdminAlerts,
  getConversionFunnel,
  getTodayTicker,
  getTopTeachers,
} from '@/lib/db/admin-dashboard'
import { getEarningsKpi } from '@/lib/db/admin-earnings'
import { Link } from 'next-view-transitions'
import { formatPKT } from '@/lib/time/pkt'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PlanChart } from './PlanChart'
import { TeacherActivityChart } from './TeacherActivityChart'
import { AdminAlertsFeed } from '@/components/admin/AdminAlertsFeed'
import { ConversionFunnelWidget } from '@/components/admin/ConversionFunnel'
import { TodayTickerWidget } from '@/components/admin/TodayTicker'
import { TopTeachersCard } from '@/components/admin/TopTeachersCard'

export const metadata: Metadata = {
  title: 'Admin Dashboard — Skool Rooms',
}

function formatPkrK(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`
  }
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`
  }
  return String(n)
}

export default async function AdminDashboardPage() {
  const [stats, ops, recentTeachers, activity, alerts, funnel, ticker, topTeachers, earnings] =
    await Promise.all([
      getAdminDashboardStats(),
      getOperationsStats(),
      getRecentTeachers(),
      getTeacherActivityCard(),
      getAdminAlerts(),
      getConversionFunnel(),
      getTodayTicker(),
      getTopTeachers(5),
      getEarningsKpi(),
    ])

  const mrrTrend = earnings.monthOverMonthPct
  const recentForGrid = recentTeachers.slice(0, 4)

  return (
    <>
      <PageHeader
        title="Hello, Admin!"
        description="What's happening on the platform right now"
        className="mb-6 font-bold"
      />

      <div className="grid grid-cols-12 gap-5 auto-rows-min">
        {/* ──────────────────────────────────────────────────────────────
            Row 1 — Hero KPI strip
            ────────────────────────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-6">
          <Link
            href="/admin/earnings"
            className="block h-full rounded-[2rem] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-gradient-to-br from-primary/95 to-primary text-primary-foreground h-full">
              <CardContent className="px-8 py-7 flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/15 text-[10px] font-bold uppercase tracking-[0.1em] backdrop-blur-sm">
                    <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Monthly Revenue
                  </div>
                  <ArrowUpRight className="h-5 w-5 opacity-70" strokeWidth={2} />
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold opacity-80">PKR</span>
                    <span className="text-5xl font-extrabold tracking-tight leading-none">
                      {formatPkrK(earnings.thisMonthRevenuePkr)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
                    {mrrTrend !== null ? (
                      <>
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] tabular-nums',
                            mrrTrend >= 0
                              ? 'bg-emerald-400/20 text-emerald-100'
                              : 'bg-rose-400/20 text-rose-100',
                          )}
                        >
                          {mrrTrend >= 0 ? '+' : ''}
                          {mrrTrend}%
                        </span>
                        <span className="opacity-75">
                          vs last month (PKR {formatPkrK(earnings.lastMonthRevenuePkr)})
                        </span>
                      </>
                    ) : (
                      <span className="opacity-75">
                        First month with revenue — no comparison yet.
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-4 flex items-end justify-between text-[12px] font-semibold opacity-80">
                  <span>{earnings.activeSubscribers} active subscribers</span>
                  <span>All-time PKR {formatPkrK(earnings.allTimeRevenuePkr)}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="col-span-12 sm:col-span-4 lg:col-span-2">
          <Link
            href="/admin/teachers"
            className="block h-full rounded-[2rem] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <StatCard
              label="Signups this week"
              value={String(stats.signupsThisWeek)}
              icon={UserPlus}
              iconColor="text-primary"
              iconBg="bg-primary/10"
              trend={signupTrend(stats.signupsThisWeek, stats.signupsLastWeek)}
            />
          </Link>
        </div>

        <div className="col-span-12 sm:col-span-4 lg:col-span-2">
          <Link
            href="/admin/operations"
            className="block h-full rounded-[2rem] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <StatCard
              label="Active cohorts"
              value={String(ops.totalActiveCohorts)}
              icon={Users}
              iconColor="text-foreground"
              iconBg="bg-muted"
            />
          </Link>
        </div>

        <div className="col-span-12 sm:col-span-4 lg:col-span-2">
          <Link
            href="/admin/payments"
            className="block h-full rounded-[2rem] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <StatCard
              label="Pending payments"
              value={String(ops.pendingPaymentCount)}
              icon={CreditCard}
              iconColor={ops.pendingPaymentCount > 0 ? 'text-destructive' : 'text-foreground'}
              iconBg={ops.pendingPaymentCount > 0 ? 'bg-destructive/10' : 'bg-muted'}
            />
          </Link>
        </div>

        {/* ──────────────────────────────────────────────────────────────
            Row 2 — Today's ticker
            ────────────────────────────────────────────────────────────── */}
        <div className="col-span-12">
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-7 pb-3">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold">Today on the platform</CardTitle>
                  <CardDescription className="text-xs font-medium text-muted-foreground/70 mt-0.5">
                    PKT calendar day · resets at midnight Karachi time
                  </CardDescription>
                </div>
                {ticker.revenue_today_pkr > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
                      Revenue today
                    </p>
                    <p className="text-xl font-extrabold tabular-nums text-foreground leading-none mt-0.5">
                      PKR {formatPkrK(ticker.revenue_today_pkr)}
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-7">
              <TodayTickerWidget data={ticker} />
            </CardContent>
          </Card>
        </div>

        {/* ──────────────────────────────────────────────────────────────
            Row 3 — Teacher activity (left) + Alerts feed (right)
            ────────────────────────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-8">
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
            <CardHeader className="px-8 pt-8 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold">Teacher Activity</CardTitle>
                  <CardDescription className="text-sm font-medium mt-1">
                    Weekly active teachers · last 30 days
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-1.5">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground leading-none">
                      {activity.weeklyActive}
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">
                      / {activity.totalTeachers}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                    {activity.dailyActive} active today · {activity.weeklyActiveSharePct}%
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="h-[260px]">
                <TeacherActivityChart data={activity.series} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
            <CardHeader className="px-7 pt-8 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl font-bold">Alerts</CardTitle>
                  <CardDescription className="text-sm font-medium mt-1">
                    Things needing attention
                  </CardDescription>
                </div>
                {alerts.length > 0 && (
                  <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-destructive/10 px-2 text-[11px] font-extrabold tabular-nums text-destructive">
                    {alerts.length}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-7">
              <AdminAlertsFeed alerts={alerts} />
            </CardContent>
          </Card>
        </div>

        {/* ──────────────────────────────────────────────────────────────
            Row 4 — Conversion funnel + Recent signups + Plan mix
            ────────────────────────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
            <CardHeader className="px-7 pt-8 pb-4">
              <CardTitle className="text-xl font-bold">Conversion funnel</CardTitle>
              <CardDescription className="text-sm font-medium mt-1">
                Where teachers drop off · all-time
              </CardDescription>
            </CardHeader>
            <CardContent className="px-7 pb-8">
              <ConversionFunnelWidget data={funnel} />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
            <CardHeader className="px-7 pt-8 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl font-bold">Recent Signups</CardTitle>
                  <CardDescription className="text-sm font-medium mt-1">
                    Latest platform joiners
                  </CardDescription>
                </div>
                <Link
                  href="/admin/teachers"
                  className="shrink-0 text-[12px] font-semibold text-primary hover:underline"
                >
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-7 pb-8">
              {recentForGrid.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teachers signed up yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {recentForGrid.map((teacher) => (
                    <li key={teacher.id}>
                      <Link
                        href={`/admin/teachers/${teacher.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-foreground/[0.03] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-foreground">
                            {teacher.name}
                          </p>
                          <p className="truncate text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider mt-0.5">
                            {teacher.plan} Plan
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-bold text-muted-foreground/50">
                          {formatPKT(teacher.created_at, 'date')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-3">
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
            <CardHeader className="px-7 pt-8 pb-2">
              <CardTitle className="text-xl font-bold">Plan Mix</CardTitle>
              <CardDescription className="text-sm font-medium mt-1">
                Teachers by plan
              </CardDescription>
            </CardHeader>
            <CardContent className="px-7 pb-7 flex flex-col items-center">
              <div className="h-[180px] w-full">
                <PlanChart data={stats.planDistribution} />
              </div>
              <div className="w-full space-y-2.5 mt-4">
                {(() => {
                  const total = stats.planDistribution.reduce((sum, p) => sum + p.count, 0)
                  const sorted = [...stats.planDistribution].sort((a, b) => b.count - a.count)
                  const dotColors = ['bg-primary', 'bg-primary/50', 'bg-primary/25']
                  return sorted.map((entry, i) => (
                    <div
                      key={entry.plan}
                      className="flex items-center justify-between text-[13px] font-bold px-1"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${dotColors[i] ?? 'bg-primary/25'}`} />
                        <span className="text-muted-foreground capitalize">{entry.plan}</span>
                      </div>
                      <span className="tabular-nums">
                        {entry.count}
                        <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground/60">
                          {total > 0 ? Math.round((entry.count / total) * 100) : 0}%
                        </span>
                      </span>
                    </div>
                  ))
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ──────────────────────────────────────────────────────────────
            Row 5 — Top teachers (full width)
            ────────────────────────────────────────────────────────────── */}
        <div className="col-span-12">
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl font-bold">Top Teachers</CardTitle>
                  <CardDescription className="text-sm font-medium mt-1">
                    Ranked by lifetime gross student payments · these are the whales
                  </CardDescription>
                </div>
                <Link
                  href="/admin/teachers"
                  className="shrink-0 text-[12px] font-semibold text-primary hover:underline"
                >
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-7">
              <TopTeachersCard teachers={topTeachers} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function signupTrend(thisWeek: number, lastWeek: number): string | undefined {
  if (lastWeek === 0) {
    return thisWeek > 0 ? '+100%' : undefined
  }
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

interface StatCardProps {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
  iconBg?: string
  iconColor?: string
  trend?: string
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg = 'bg-card',
  iconColor = 'text-foreground',
  trend,
}: StatCardProps) {
  const trendValue = trend ? parseFloat(trend) : null
  const isPositive = trendValue !== null && trendValue >= 0

  return (
    <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
      <CardContent className="px-6 pt-6 pb-5 flex flex-col items-start gap-3 h-full">
        {Icon && (
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-2xl shrink-0',
              iconBg,
            )}
          >
            <Icon className={cn('h-[18px] w-[18px]', iconColor)} strokeWidth={2} />
          </div>
        )}
        <div className="flex flex-col gap-1 flex-1 justify-end">
          <span className="text-3xl font-extrabold tracking-tight text-foreground leading-none tabular-nums">
            {value}
          </span>
          <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">
            {label}
          </p>
        </div>
        {trend && (
          <p
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider',
              isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
            )}
          >
            {trend} vs last
          </p>
        )}
      </CardContent>
    </Card>
  )
}
