/**
 * app/(teacher)/dashboard/analytics/page.tsx — Teacher analytics
 *
 * Server Component. Revenue this month, pending, per-cohort breakdown,
 * recently joined students.
 */

import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherAnalytics } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { formatPKT } from '@/lib/time/pkt'

export const metadata: Metadata = {
  title: 'Analytics \u2014 Lumscribe',
}

export default async function TeacherAnalyticsPage() {
  const teacher = await requireTeacher()
  const analytics = await getTeacherAnalytics(teacher.id)

  const revenueChange =
    analytics.revenueLastMonth > 0
      ? ((analytics.revenueThisMonth - analytics.revenueLastMonth) / analytics.revenueLastMonth) * 100
      : analytics.revenueThisMonth > 0
        ? 100
        : 0

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Revenue overview and student activity."
      />

      {/* Revenue KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Revenue This Month</h3>
          <p className="mt-2 text-3xl font-bold text-foreground">
            PKR {analytics.revenueThisMonth.toLocaleString()}
          </p>
          {revenueChange !== 0 && (
            <p
              className={`mt-1 text-sm font-medium ${
                revenueChange > 0 ? 'text-success' : 'text-destructive'
              }`}
            >
              {revenueChange > 0 ? '+' : ''}
              {revenueChange.toFixed(1)}% vs last month
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Revenue Last Month</h3>
          <p className="mt-2 text-3xl font-bold text-foreground">
            PKR {analytics.revenueLastMonth.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Pending Verification</h3>
          <p className="mt-2 text-3xl font-bold text-foreground">
            PKR {analytics.pendingAmount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Awaiting screenshot verification</p>
        </Card>
      </div>

      {/* Per-Cohort Breakdown */}
      <div className="mt-6">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Revenue by Cohort</h2>
          {analytics.perCohortBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cohorts found.</p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {analytics.perCohortBreakdown.map((cohort) => (
                  <div key={cohort.cohortId} className="rounded-md border border-border p-3 sm:p-4 text-sm">
                    <p className="font-medium text-foreground">{cohort.cohortName}</p>
                    <p className="text-muted-foreground">{cohort.courseName}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-muted-foreground">{cohort.studentCount} students</span>
                      <span className="font-medium text-foreground">PKR {cohort.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium text-muted-foreground">Cohort</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Course</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Students</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground text-right">Revenue (This Month)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.perCohortBreakdown.map((cohort) => (
                      <tr key={cohort.cohortId} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{cohort.cohortName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{cohort.courseName}</td>
                        <td className="px-3 py-2 text-foreground">{cohort.studentCount}</td>
                        <td className="px-3 py-2 text-foreground text-right">
                          PKR {cohort.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Recently Joined Students */}
      <div className="mt-6">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Recently Joined Students</h2>
          {analytics.recentStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No new students in the last 7 days.</p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden flex flex-col gap-3">
                {analytics.recentStudents.map((student) => (
                  <div key={`${student.id}-${student.enrolledAt}`} className="rounded-md border border-border p-3 sm:p-4 text-sm">
                    <p className="font-medium text-foreground">{student.name}</p>
                    <p className="text-muted-foreground">{student.email}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-foreground">{student.cohortName}</span>
                      <span className="text-muted-foreground">{formatPKT(student.enrolledAt, 'relative')}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium text-muted-foreground">Name</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Email</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Cohort</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recentStudents.map((student) => (
                      <tr key={`${student.id}-${student.enrolledAt}`} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{student.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{student.email}</td>
                        <td className="px-3 py-2 text-foreground">{student.cohortName}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatPKT(student.enrolledAt, 'relative')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
