/**
 * app/(teacher)/dashboard/page.tsx — Teacher dashboard home page (bento grid)
 *
 * Server Component. Displays stat cards, revenue chart, plan usage,
 * upcoming classes, recent enrollments, and onboarding checklist
 * in a responsive bento grid layout.
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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { OnboardingChecklist } from '@/components/teacher/OnboardingChecklist'
import { UsageBars } from '@/components/ui/UsageBars'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'
import { RevenueChart } from './RevenueChart'

export const metadata: Metadata = {
  title: 'Dashboard — Skool Rooms',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const _params = await searchParams
  const teacher = await requireTeacher()
  const teacherId = teacher.id as string
  const teacherName = teacher.name as string
  const firstName = teacherName.split(' ')[0]

  // Fetch all dashboard data in parallel
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
  // fetched for the Revenue Trends chart. The series is ordered oldest → newest,
  // so the final entry is the current month.
  const thisMonthRevenue =
    monthlyRevenue[monthlyRevenue.length - 1]?.revenue ?? 0
  const lastMonthRevenue =
    monthlyRevenue[monthlyRevenue.length - 2]?.revenue ?? 0
  const revenueDeltaPct =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null

  // Build plan usage items
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
        description="Here's your weekly overview"
        filter={<DateRangeFilter />}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* Row 1: Stat Cards (4 x 1x1) */}

        {/* Active Courses */}
        <StatCard
          label="Active Courses"
          value={String(stats.activeCourses)}
          icon={BookOpen}
          iconBg="bg-primary/10"
        />

        {/* Total Students */}
        <StatCard
          label="Total Students"
          value={String(stats.totalStudents)}
          icon={GraduationCap}
          iconBg="bg-success/10"
        />

        {/* Pending Payments */}
        <StatCard
          label="Pending Payments"
          value={String(stats.pendingPayments)}
          icon={CreditCard}
          iconBg="bg-warning/10"
          href={stats.pendingPayments > 0 ? ROUTES.TEACHER.payments : undefined}
          linkText="Review now"
        />

        {/* This Month's Revenue */}
        <Card>
          <CardContent className="p-7">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <Wallet className="h-5 w-5 text-success" />
            </div>
            <p className="text-3xl font-extrabold text-foreground tabular-nums">
              <span className="mr-1 text-sm font-semibold text-muted-foreground">
                PKR
              </span>
              {thisMonthRevenue.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">This Month</p>
            {revenueDeltaPct !== null ? (
              <p
                className={cn(
                  'mt-1 inline-flex items-center gap-1 text-xs font-medium',
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
              </p>
            ) : thisMonthRevenue > 0 ? (
              <p className="mt-1 text-xs font-medium text-success">
                First revenue this month
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground/70">
                No revenue yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Row 2: Revenue Chart (2x1) + Plan Usage (2x1) */}

        {/* Revenue Trends */}
        <Card className="md:col-span-2">
          <CardContent className="p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Revenue Trends</h2>
              <span className="text-xs text-muted-foreground">
                PKR {stats.totalRevenuePkr.toLocaleString()} total
              </span>
            </div>
            <RevenueChart data={monthlyRevenue} />
          </CardContent>
        </Card>

        {/* Plan Usage */}
        <Card className="md:col-span-2">
          <CardContent className="p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Plan Usage</h2>
              {planDetails && (
                <Link
                  href={ROUTES.TEACHER.settings.plan}
                  className="text-xs text-primary hover:underline"
                >
                  {planDetails.name} plan
                </Link>
              )}
            </div>
            <UsageBars items={usageItems} />
          </CardContent>
        </Card>

        {/* Row 3: Upcoming Classes (1x1) + Recent Enrollments (1x1) + Onboarding (2x1) */}

        {/* Upcoming Classes */}
        <Card>
          <CardContent className="p-8">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Upcoming Classes
            </h2>
            {upcomingSessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No upcoming classes scheduled.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {upcomingSessions.slice(0, 4).map((session) => (
                  <li key={session.id} className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground truncate">
                      {session.cohorts.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatPKT(session.scheduled_at, 'datetime')}
                    </span>
                    {session.duration_minutes && (
                      <span className="text-xs text-muted-foreground">
                        {session.duration_minutes} min
                      </span>
                    )}
                    <Separator className="mt-1" />
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={ROUTES.TEACHER.courses}
              className="mt-3 inline-block text-xs text-primary hover:underline"
            >
              View all courses
            </Link>
          </CardContent>
        </Card>

        {/* Recent Enrollments */}
        <Card>
          <CardContent className="p-8">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Recent Enrollments
            </h2>
            {recentEnrollments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No enrollments yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentEnrollments.slice(0, 4).map((enrollment) => (
                  <li key={enrollment.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
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
                    <span className="text-xs text-muted-foreground truncate">
                      {enrollment.cohortName} — {enrollment.courseName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatPKT(enrollment.createdAt, 'relative')}
                    </span>
                    <Separator className="mt-1" />
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={ROUTES.TEACHER.students}
              className="mt-3 inline-block text-xs text-primary hover:underline"
            >
              View all students
            </Link>
          </CardContent>
        </Card>

        {/* Onboarding Checklist */}
        <div className="md:col-span-2">
          <OnboardingChecklist />
        </div>
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  href,
  linkText,
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
  iconBg?: string
  href?: string
  linkText?: string
}) {
  return (
    <Card>
      <CardContent className="p-7">
        {Icon && (
          <div
            className={cn(
              'mb-3 flex h-10 w-10 items-center justify-center rounded-xl',
              iconBg || 'bg-primary/10'
            )}
          >
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <p className="text-4xl font-extrabold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">{label}</p>
        {href && linkText && (
          <Link
            href={href}
            className="mt-1 inline-block text-xs text-primary hover:underline"
          >
            {linkText}
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
