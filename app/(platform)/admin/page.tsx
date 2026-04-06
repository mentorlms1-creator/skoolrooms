/**
 * app/(platform)/admin/page.tsx — Admin dashboard home
 *
 * Server Component. Displays bento grid with KPIs, charts, and recent teachers.
 * Charts are client components loaded via dynamic import (no SSR).
 */

import type { Metadata } from 'next'
import {
  TrendingUp,
  UserPlus,
  CreditCard,
  Users,
} from 'lucide-react'
import {
  getAdminDashboardStats,
  getOperationsStats,
  getRecentTeachers,
  getRevenueByCohort,
} from '@/lib/db/admin'
import { formatPKT } from '@/lib/time/pkt'
import { PageHeader } from '@/components/ui/PageHeader'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { RevenueChart } from './RevenueChart'
import { PlanChart } from './PlanChart'

export const metadata: Metadata = {
  title: 'Admin Dashboard — Lumscribe',
}

export default async function AdminDashboardPage() {
  const [stats, ops, recentTeachers, revenueByCohort] = await Promise.all([
    getAdminDashboardStats(),
    getOperationsStats(),
    getRecentTeachers(),
    getRevenueByCohort(),
  ])

  return (
    <>
      <PageHeader
        title="Hello, Admin!"
        description="Here's your weekly overview"
        filter={<DateRangeFilter />}
        className="mb-6 font-bold"
      />

      <div className="grid grid-cols-12 gap-5 auto-rows-min">
        {/* Row 1: Four stat cards */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatCard
            label="Active Cohorts"
            value={String(ops.totalActiveCohorts)}
            unit="cohorts"
            icon={Users}
            iconColor="text-foreground"
            iconBg="bg-muted"
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatCard
            label="This Week"
            value={String(stats.signupsThisWeek)}
            unit="signups"
            icon={UserPlus}
            iconColor="text-primary"
            iconBg="bg-primary/10"
            trend={stats.signupsLastWeek > 0
              ? `${stats.signupsThisWeek >= stats.signupsLastWeek ? '+' : ''}${Math.round(((stats.signupsThisWeek - stats.signupsLastWeek) / stats.signupsLastWeek) * 100)}%`
              : stats.signupsThisWeek > 0 ? '+100%' : undefined}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatCard
            label="Pending Action"
            value={String(ops.pendingPaymentCount)}
            unit="payments"
            icon={CreditCard}
            iconColor="text-foreground"
            iconBg="bg-muted"
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <StatCard
            label="Monthly Revenue"
            value={stats.mrr >= 1000
              ? (stats.mrr / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
              : String(stats.mrr)}
            unit={stats.mrr >= 1000 ? 'k' : ''}
            prefix="PKR"
            icon={TrendingUp}
            iconColor="text-accent"
            iconBg="bg-accent/10"
            activity={stats.dailyActivity}
            trend={stats.signupsThisMonth > stats.signupsLastMonth
              ? `+${stats.signupsLastMonth > 0 ? Math.round(((stats.signupsThisMonth - stats.signupsLastMonth) / stats.signupsLastMonth) * 100) : 100}%`
              : stats.signupsThisMonth < stats.signupsLastMonth
              ? `${Math.round(((stats.signupsThisMonth - stats.signupsLastMonth) / stats.signupsLastMonth) * 100)}%`
              : undefined}
          />
        </div>

        {/* Row 2: Main Content Bento */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 gap-5">
          {/* Revenue Chart Card */}
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Revenue by Cohort</CardTitle>
                  <CardDescription className="text-sm font-medium mt-1">Confirmed payments performance</CardDescription>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background text-[10px] font-bold">
                  4 hours
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="h-[300px]">
                <RevenueChart data={revenueByCohort} />
              </div>
            </CardContent>
          </Card>

          {/* Recent Teachers table as a wider bento */}
          <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-4">
              <CardTitle className="text-xl font-bold">Recent Signups</CardTitle>
              <CardDescription className="text-sm font-medium mt-1">Latest platform joiners</CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              {recentTeachers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teachers signed up yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recentTeachers.slice(0, 4).map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-container ring-1 ring-foreground/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold text-foreground">
                          {teacher.name}
                        </p>
                        <p className="truncate text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mt-0.5">
                          {teacher.plan} Plan
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-muted-foreground/40">
                        {formatPKT(teacher.created_at, 'date')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column Bento */}
        <div className="col-span-12 lg:col-span-4 grid grid-cols-1 gap-5">
           {/* Plan Distribution (Balance card inspired) */}
           <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="px-8 pt-8 pb-2">
              <CardTitle className="text-center text-xl font-bold">Plan Balance</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8 flex flex-col items-center">
              <div className="h-[220px] w-full">
                <PlanChart data={stats.planDistribution} />
              </div>
              <div className="w-full space-y-4 mt-6">
                <div className="flex items-center justify-between text-[15px] font-bold px-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Pro</span>
                  </div>
                  <span>65%</span>
                </div>
                <div className="flex items-center justify-between text-[15px] font-bold px-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary/50" />
                    <span className="text-muted-foreground">Free</span>
                  </div>
                  <span>35%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights Style card */}
          <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden bg-gradient-to-br from-[#2b2b3d] to-[#12121a] text-white p-8">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md">
                   <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                   AI Insights
                </div>
                <button className="text-white/40 hover:text-white transition-colors">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                </button>
             </div>
             
             <p className="text-[19px] font-bold leading-relaxed mb-10">
                On Wednesday you&apos;re <span className="text-chart-3">overloaded</span>. Should we move <span className="underline decoration-white/20">2 tasks</span> to Thursday?
             </p>

             <div className="space-y-3">
                <button className="w-full h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-[15px] font-bold transition-all backdrop-blur-sm">
                   Ignore
                </button>
                <button className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90 text-[15px] font-bold transition-all shadow-lg">
                   Reschedule
                </button>
             </div>
          </Card>
        </div>
      </div>
    </>
  )
}

interface StatCardProps {
  label: string
  value: string
  unit?: string
  prefix?: string
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
  iconBg?: string
  iconColor?: string
  trend?: string
  /** Array of daily activity counts — each value drives dot intensity */
  activity?: number[]
}

function StatCard({
  label,
  value,
  unit,
  prefix,
  icon: Icon,
  iconBg = 'bg-card',
  iconColor = 'text-foreground',
  trend,
  activity,
}: StatCardProps) {
  const trendValue = trend ? parseFloat(trend) : null
  const isPositive = trendValue !== null && trendValue >= 0
  const maxActivity = activity ? Math.max(...activity, 1) : 1

  return (
    <Card className="border-none shadow-sm ring-1 ring-foreground/5 rounded-[2rem] overflow-hidden bg-card h-full">
      <CardContent className="px-7 pt-7 pb-6 flex flex-col items-start gap-4 h-full">
        {/* Icon */}
        {Icon && (
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-2xl shrink-0',
              iconBg
            )}
          >
            <Icon className={cn('h-5 w-5', iconColor)} strokeWidth={2} />
          </div>
        )}

        {/* Number + unit on same baseline */}
        <div className="flex flex-col gap-1 flex-1 justify-center">
          <div className="flex items-baseline gap-1">
            {prefix && (
              <span className="text-sm font-semibold text-muted-foreground">
                {prefix}
              </span>
            )}
            <span className="text-4xl font-extrabold tracking-tight text-foreground leading-none">
              {value}
            </span>
            {unit && (
              <span className="text-base font-semibold text-muted-foreground leading-none">
                {unit}
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">
            {label}
          </p>
        </div>

        {/* Activity heatmap dots + trend */}
        {(activity || trend) && (
          <div className="flex flex-col gap-1.5 w-full">
            {activity && (
              <div className="flex flex-wrap gap-[3px]">
                {activity.map((count, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-[6px] w-[6px] rounded-full transition-colors',
                      count === 0
                        ? 'bg-muted'
                        : count / maxActivity > 0.6
                        ? 'bg-accent'
                        : count / maxActivity > 0.3
                        ? 'bg-accent/60'
                        : 'bg-accent/30'
                    )}
                    title={`${count} activity${count !== 1 ? '' : ''} (${21 - i}d ago)`}
                  />
                ))}
              </div>
            )}
            {trend && (
              <p className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                isPositive ? 'text-accent' : 'text-destructive'
              )}>
                {trend} vs last period
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
