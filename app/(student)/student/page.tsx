/**
 * app/(student)/student/page.tsx — Student dashboard (bento grid)
 *
 * Server Component. Shows a bento-grid dashboard with:
 * Row 1: Enrolled courses, upcoming classes, pending fees, attendance rate
 * Row 2: Today's schedule (full-width)
 * Row 3: Recent announcements + upcoming assignments
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BookOpen,
  CalendarDays,
  CreditCard,
} from 'lucide-react'
import { requireStudent } from '@/lib/auth/guards'
import { getUpcomingSessionsByStudent } from '@/lib/db/class-sessions'
import { getEnrollmentsByStudentWithTeacher } from '@/lib/db/enrollments'
import { getRecentAnnouncementsByStudent } from '@/lib/db/announcements'
import { getUpcomingAssignmentsByStudent } from '@/lib/db/assignments'
import { getOverallAttendanceSummary } from '@/lib/db/attendance'
import { getPendingPaymentCountByStudent } from '@/lib/db/student-payments'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Dashboard \u2014 Skool Rooms Student',
}

/** Check if a UTC timestamp falls within "today" in PKT (UTC+5) */
function isTodayPKT(utcTimestamp: string): boolean {
  const date = new Date(utcTimestamp)
  // Get today's start and end in PKT by using timezone formatting
  const now = new Date()
  const pktFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const todayPKT = pktFormatter.format(now) // "YYYY-MM-DD"
  const sessionDayPKT = pktFormatter.format(date) // "YYYY-MM-DD"
  return todayPKT === sessionDayPKT
}

export default async function StudentDashboardPage() {
  const student = await requireStudent()
  const firstName = student.name.split(' ')[0]

  // Fetch all dashboard data in parallel
  const [
    sessions,
    enrollments,
    announcements,
    assignments,
    attendanceSummary,
    pendingFees,
  ] = await Promise.all([
    getUpcomingSessionsByStudent(student.id, 20),
    getEnrollmentsByStudentWithTeacher(student.id),
    getRecentAnnouncementsByStudent(student.id, 3),
    getUpcomingAssignmentsByStudent(student.id, 3),
    getOverallAttendanceSummary(student.id),
    getPendingPaymentCountByStudent(student.id),
  ])

  // Derived stats
  const activeEnrollments = enrollments.filter((e) => e.status === 'active')
  const todaySessions = sessions.filter((s) => isTodayPKT(s.scheduled_at)).slice(0, 3)

  // Attendance ring values
  const attendancePercent = attendanceSummary.percentage
  const ringRadius = 40
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference - (attendancePercent / 100) * ringCircumference

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}!`}
        description="Here's what's coming up"
      />

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* -- Row 1: Stat Cards -- */}
        <StatCard
          label="Enrolled Courses"
          value={String(activeEnrollments.length)}
          icon={BookOpen}
          iconBg="bg-primary/10"
        />

        <StatCard
          label="Upcoming Classes"
          value={String(sessions.length)}
          icon={CalendarDays}
          iconBg="bg-success/10"
        />

        <StatCard
          label="Pending Fees"
          value={String(pendingFees)}
          icon={CreditCard}
          iconBg="bg-warning/10"
        />

        {/* Attendance Rate — SVG ring */}
        <Card className="flex items-center justify-center p-7">
          <div className="flex items-center gap-4">
            <svg
              width="96"
              height="96"
              viewBox="0 0 96 96"
              className="shrink-0"
              aria-label={`Attendance rate: ${attendancePercent}%`}
              role="img"
            >
              {/* Background ring */}
              <circle
                cx="48"
                cy="48"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/30"
              />
              {/* Progress ring */}
              <circle
                cx="48"
                cy="48"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="text-primary"
                transform="rotate(-90 48 48)"
              />
              {/* Percentage text */}
              <text
                x="48"
                y="48"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground text-lg font-bold"
                fontSize="18"
              >
                {attendancePercent}%
              </text>
            </svg>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground/70">Attendance</p>
              <p className="text-sm text-muted-foreground">
                {attendanceSummary.attended}/{attendanceSummary.total} classes
              </p>
            </div>
          </div>
        </Card>

        {/* -- Row 2: Today's Schedule (full-width) -- */}
        <Card className="lg:col-span-4 md:col-span-2">
          <CardHeader>
            <CardTitle>Today&apos;s Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {todaySessions.length === 0 ? (
              <EmptyState
                title="No classes scheduled for today"
                description="Enjoy your free time! Check your full schedule for upcoming classes."
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {todaySessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {session.cohorts.courses.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {session.cohorts.teachers.name} &middot;{' '}
                        {session.cohorts.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatPKT(session.scheduled_at, 'time')} &middot;{' '}
                        {session.duration_minutes} min
                      </p>
                    </div>
                    {session.meet_link && (
                      <a
                        href={session.meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                      >
                        Join Class
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* -- Row 3: Announcements + Assignments -- */}

        {/* Recent Announcements (2x1) */}
        <Card className="lg:col-span-2 md:col-span-1">
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No announcements yet.
              </p>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <p className="font-medium text-foreground line-clamp-1">
                      {a.body.replace(/<[^>]*>/g, '').slice(0, 80)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.cohorts.teachers.name} &middot;{' '}
                      {a.cohorts.courses.title} &middot;{' '}
                      {formatPKT(a.created_at, 'relative')}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link
                href={ROUTES.STUDENT.courses}
                className="text-sm font-medium text-primary hover:text-primary/90 transition-colors"
              >
                View all &rarr;
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Assignments (2x1) */}
        <Card className="lg:col-span-2 md:col-span-1">
          <CardHeader>
            <CardTitle>Upcoming Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming assignments.
              </p>
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => (
                  <div key={a.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <p className="font-medium text-foreground line-clamp-1">
                      {a.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.cohorts.courses.title} &middot; Due{' '}
                      {formatPKT(a.due_date, 'date')}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link
                href={ROUTES.STUDENT.courses}
                className="text-sm font-medium text-primary hover:text-primary/90 transition-colors"
              >
                View all &rarr;
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
  iconBg?: string
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
      </CardContent>
    </Card>
  )
}
