/**
 * app/(teacher)/dashboard/page.tsx — Teacher dashboard home page
 *
 * Server Component. iCloud-style layout: onboarding banner (full-width,
 * hides when complete) → equal-height stat row → revenue + plan usage
 * → upcoming + recent enrollments.
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import {
  BookOpen,
  GraduationCap,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getTeacherPlanDetails,
  getTeacherUsage,
  getTeacherDashboardStats,
  getTeacherMonthlyRevenue,
  getRecentEnrollmentsByTeacher,
} from '@/lib/db/teachers'
import { getUpcomingSessionsByTeacher } from '@/lib/db/class-sessions'
import { formatPKT } from '@/lib/time/pkt'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/badge'
import { OnboardingChecklist } from '@/components/teacher/OnboardingChecklist'
import { UsageBars } from '@/components/ui/UsageBars'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'
import { RevenueChart } from './RevenueChart'

export const metadata: Metadata = {
  title: 'Dashboard — Skool Rooms',
}

export default async function DashboardPage() {
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string
  const teacherName = teacher.name as string
  const firstName = teacherName.split(' ')[0]

  const [planDetails, usage, stats, monthlyRevenue, upcomingSessions, recentEnrollments] =
    await Promise.all([
      getTeacherPlanDetails(teacherId),
      getTeacherUsage(teacherId),
      getTeacherDashboardStats(teacherId),
      getTeacherMonthlyRevenue(teacherId),
      getUpcomingSessionsByTeacher(teacherId, 5),
      getRecentEnrollmentsByTeacher(teacherId, 5),
    ])

  // Derive this-month + last-month revenue from the 6-month series already
  // fetched for the Revenue Trends chart. Series is ordered oldest → newest.
  const thisMonthRevenue =
    monthlyRevenue[monthlyRevenue.length - 1]?.revenue ?? 0
  const lastMonthRevenue =
    monthlyRevenue[monthlyRevenue.length - 2]?.revenue ?? 0
  const revenueDeltaPct =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null

  const usageItems = [
    {
      label: 'Courses',
      current: usage.courses,
      max: planDetails?.limits.max_courses ?? null,
    },
    {
      label: 'Students',
      current: usage.students,
      max: planDetails?.limits.max_students ?? null,
    },
    {
      label: 'Active Cohorts',
      current: usage.cohortsActive,
      max: planDetails?.limits.max_cohorts_active ?? null,
    },
    {
      label: 'Storage',
      current: usage.storageMb,
      max: planDetails?.limits.max_storage_mb ?? null,
      unit: 'MB',
    },
  ]

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}!`}
        description="Your courses, students, and revenue at a glance."
      />

      {/* Onboarding — full width, hides when complete */}
      <OnboardingChecklist />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Row 1: Stat Cards */}
        <StatCard
          label="Active Courses"
          value={stats.activeCourses}
          icon={BookOpen}
          iconBg="bg-primary/10"
          iconColor="text-primary"
        />
        <StatCard
          label="Total Students"
          value={stats.totalStudents}
          icon={GraduationCap}
          iconBg="bg-success/10"
          iconColor="text-success"
        />
        <StatCard
          label="Pending Payments"
          value={stats.pendingPayments}
          icon={CreditCard}
          iconBg="bg-warning/10"
          iconColor="text-warning"
          footer={
            stats.pendingPayments > 0 ? (
              <Link
                href={ROUTES.TEACHER.payments}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
              >
                Review now
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null
          }
        />
        <StatCard
          label="This Month"
          value={
            <>
              <span className="mr-1 text-sm font-semibold text-muted-foreground">
                PKR
              </span>
              {thisMonthRevenue.toLocaleString()}
            </>
          }
          icon={Wallet}
          iconBg="bg-success/10"
          iconColor="text-success"
          footer={
            revenueDeltaPct !== null ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium',
                  revenueDeltaPct > 0
                    ? 'text-success'
                    : revenueDeltaPct < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                )}
              >
                {revenueDeltaPct > 0 && <TrendingUp className="h-3 w-3" />}
                {revenueDeltaPct < 0 && <TrendingDown className="h-3 w-3" />}
                {revenueDeltaPct > 0 ? '+' : ''}
                {revenueDeltaPct}% vs last month
              </span>
            ) : thisMonthRevenue > 0 ? (
              <span className="text-xs font-medium text-success">
                First revenue this month
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/70">
                No revenue yet
              </span>
            )
          }
        />

        {/* Row 2: Revenue Trends (2 cols) + Plan Usage (2 cols) */}
        <Panel className="sm:col-span-2 lg:col-span-2">
          <PanelHeader>
            <h2 className="text-sm font-semibold text-foreground">Revenue Trends</h2>
            <span className="text-xs text-muted-foreground">
              PKR {stats.totalRevenuePkr.toLocaleString()} all-time
            </span>
          </PanelHeader>
          <RevenueChart data={monthlyRevenue} />
        </Panel>

        <Panel className="sm:col-span-2 lg:col-span-2">
          <PanelHeader>
            <h2 className="text-sm font-semibold text-foreground">Plan Usage</h2>
            {planDetails && (
              <Link
                href={ROUTES.TEACHER.settings.plan}
                className="text-xs font-medium text-primary hover:text-primary/80"
              >
                {planDetails.name} plan
              </Link>
            )}
          </PanelHeader>
          <UsageBars items={usageItems} />
        </Panel>

        {/* Row 3: Upcoming Classes (2 cols) + Recent Enrollments (2 cols) */}
        <Panel className="sm:col-span-2 lg:col-span-2">
          <PanelHeader>
            <h2 className="text-sm font-semibold text-foreground">Upcoming Classes</h2>
            <Link
              href={ROUTES.TEACHER.courses}
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              View all
            </Link>
          </PanelHeader>
          {upcomingSessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No upcoming classes scheduled.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {upcomingSessions.slice(0, 4).map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {session.cohorts.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPKT(session.scheduled_at, 'datetime')}
                    </p>
                  </div>
                  {session.duration_minutes && (
                    <span className="shrink-0 text-xs text-muted-foreground/80">
                      {session.duration_minutes}m
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="sm:col-span-2 lg:col-span-2">
          <PanelHeader>
            <h2 className="text-sm font-semibold text-foreground">Recent Enrollments</h2>
            <Link
              href={ROUTES.TEACHER.students}
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              View all
            </Link>
          </PanelHeader>
          {recentEnrollments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No enrollments yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {recentEnrollments.slice(0, 4).map((enrollment) => (
                <li
                  key={enrollment.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {enrollment.studentName}
                      </span>
                      <Badge
                        variant={enrollment.status === 'active' ? 'default' : 'secondary'}
                        className="shrink-0 text-[10px]"
                      >
                        {enrollment.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {enrollment.cohortName} — {enrollment.courseName}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground/80">
                    {formatPKT(enrollment.createdAt, 'relative')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

// -----------------------------------------------------------------------------
// Local presentational helpers
// -----------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  footer,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  iconBg?: string
  iconColor?: string
  footer?: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5">
      {Icon && (
        <div
          className={cn(
            'mb-3 flex h-9 w-9 items-center justify-center rounded-xl',
            iconBg || 'bg-primary/10',
          )}
        >
          <Icon className={cn('h-4 w-4', iconColor || 'text-primary')} />
        </div>
      )}
      <div className="text-[28px] font-semibold tracking-[-0.025em] leading-none text-foreground tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </div>
  )
}

function Panel({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">{children}</div>
  )
}
