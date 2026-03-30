/**
 * app/(teacher)/dashboard/analytics/page.tsx — Teacher analytics
 *
 * Server Component. Revenue this month, pending, per-cohort breakdown,
 * recently joined students.
 */

import { requireTeacher } from '@/lib/auth/guards'
import { getTeacherAnalytics } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { formatPKT } from '@/lib/time/pkt'

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
          <h3 className="text-sm font-medium text-muted">Revenue This Month</h3>
          <p className="mt-2 text-3xl font-bold text-ink">
            PKR {analytics.revenueThisMonth.toLocaleString()}
          </p>
          {revenueChange !== 0 && (
            <p
              className={`mt-1 text-sm font-medium ${
                revenueChange > 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {revenueChange > 0 ? '+' : ''}
              {revenueChange.toFixed(1)}% vs last month
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted">Revenue Last Month</h3>
          <p className="mt-2 text-3xl font-bold text-ink">
            PKR {analytics.revenueLastMonth.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted">Pending Verification</h3>
          <p className="mt-2 text-3xl font-bold text-ink">
            PKR {analytics.pendingAmount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">Awaiting screenshot verification</p>
        </Card>
      </div>

      {/* Per-Cohort Breakdown */}
      <div className="mt-6">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Revenue by Cohort</h2>
          {analytics.perCohortBreakdown.length === 0 ? (
            <p className="text-sm text-muted">No cohorts found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium text-muted">Cohort</th>
                    <th className="px-3 py-2 font-medium text-muted">Course</th>
                    <th className="px-3 py-2 font-medium text-muted">Students</th>
                    <th className="px-3 py-2 font-medium text-muted text-right">Revenue (This Month)</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.perCohortBreakdown.map((cohort) => (
                    <tr key={cohort.cohortId} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium text-ink">{cohort.cohortName}</td>
                      <td className="px-3 py-2 text-muted">{cohort.courseName}</td>
                      <td className="px-3 py-2 text-ink">{cohort.studentCount}</td>
                      <td className="px-3 py-2 text-ink text-right">
                        PKR {cohort.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Recently Joined Students */}
      <div className="mt-6">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Recently Joined Students</h2>
          {analytics.recentStudents.length === 0 ? (
            <p className="text-sm text-muted">No new students in the last 7 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium text-muted">Name</th>
                    <th className="px-3 py-2 font-medium text-muted">Email</th>
                    <th className="px-3 py-2 font-medium text-muted">Cohort</th>
                    <th className="px-3 py-2 font-medium text-muted">Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentStudents.map((student) => (
                    <tr key={`${student.id}-${student.enrolledAt}`} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium text-ink">{student.name}</td>
                      <td className="px-3 py-2 text-muted">{student.email}</td>
                      <td className="px-3 py-2 text-ink">{student.cohortName}</td>
                      <td className="px-3 py-2 text-muted">
                        {formatPKT(student.enrolledAt, 'relative')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
