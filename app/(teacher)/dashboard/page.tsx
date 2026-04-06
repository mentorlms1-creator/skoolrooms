/**
 * app/(teacher)/dashboard/page.tsx — Teacher dashboard home page (bento grid)
 *
 * Server Component. Displays stat cards, revenue chart, plan usage,
 * upcoming classes, recent enrollments, and onboarding checklist
 * in a responsive bento grid layout.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
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
import { RevenueChart } from './RevenueChart'

export const metadata: Metadata = {
  title: 'Dashboard — Lumscribe',
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

  // Calculate active days since account creation
  const createdAt = new Date(stats.accountCreatedAt)
  const now = new Date()
  const daysSinceCreation = Math.max(
    1,
    Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
  )
  // Cap at 90-day display ring
  const activeDaysPeriod = 90
  const activeDaysPercent = Math.min(100, (daysSinceCreation / activeDaysPeriod) * 100)

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
        title="Dashboard"
        description={`Welcome back, ${teacherName}`}
        filter={<DateRangeFilter />}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* ═══ Row 1: Stat Cards (4 x 1x1) ═══ */}

        {/* Active Courses */}
        <Card>
          <CardContent className="p-8">
            <p className="text-xs text-muted-foreground/70">Active Courses</p>
            <p className="mt-1 text-4xl font-bold text-foreground">
              {stats.activeCourses}
            </p>
          </CardContent>
        </Card>

        {/* Total Students */}
        <Card>
          <CardContent className="p-8">
            <p className="text-xs text-muted-foreground/70">Total Students</p>
            <p className="mt-1 text-4xl font-bold text-foreground">
              {stats.totalStudents}
            </p>
          </CardContent>
        </Card>

        {/* Pending Payments */}
        <Card>
          <CardContent className="p-8">
            <p className="text-xs text-muted-foreground/70">Pending Payments</p>
            <p className="mt-1 text-4xl font-bold text-foreground">
              {stats.pendingPayments}
            </p>
            {stats.pendingPayments > 0 && (
              <Link
                href={ROUTES.TEACHER.payments}
                className="mt-1 inline-block text-xs text-primary hover:underline"
              >
                Review now
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Active Days Circle */}
        <Card>
          <CardContent className="flex items-center gap-4 p-8">
            <div className="relative h-16 w-16 shrink-0">
              <svg
                viewBox="0 0 64 64"
                className="h-16 w-16 -rotate-90"
                aria-hidden="true"
              >
                {/* Background ring */}
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="5"
                />
                {/* Progress ring */}
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - activeDaysPercent / 100)}`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
                {Math.min(daysSinceCreation, activeDaysPeriod)}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground/70">Active Days</p>
              <p className="text-xs text-muted-foreground">
                of {activeDaysPeriod}-day period
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ═══ Row 2: Revenue Chart (2x1) + Plan Usage (2x1) ═══ */}

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

        {/* ═══ Row 3: Upcoming Classes (1x1) + Recent Enrollments (1x1) + Onboarding (2x1) ═══ */}

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
