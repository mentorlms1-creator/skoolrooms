/**
 * app/(teacher)/dashboard/students/health/page.tsx — Student Health
 *
 * Server Component. Three sections: at-risk, disengaged, no-submissions.
 * Gated behind the `student_health_signals` feature.
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import { requireTeacher } from '@/lib/auth/guards'
import { canUseFeature } from '@/lib/plans/features'
import {
  listAtRiskStudents,
  listDisengagedStudents,
  listNoSubmissionStudents,
} from '@/lib/db/student-health'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'

export const metadata: Metadata = {
  title: 'Student Health \u2014 Skool Rooms',
}

export default async function StudentHealthPage() {
  const teacher = await requireTeacher()

  const allowed = await canUseFeature(teacher.id, 'student_health_signals')
  if (!allowed) {
    return (
      <>
        <PageHeader
          title="Student Health"
          description="At-risk, disengaged and missing-submission students"
        />
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground">Upgrade to unlock health signals</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Student health signals are available on a paid plan. Upgrade to spot at-risk students before
            they drop off.
          </p>
          <div className="mt-4">
            <Link
              href={ROUTES.PLATFORM.subscribe}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              See plans
            </Link>
          </div>
        </Card>
      </>
    )
  }

  const [atRisk, disengaged, noSubs] = await Promise.all([
    listAtRiskStudents(teacher.id),
    listDisengagedStudents(teacher.id),
    listNoSubmissionStudents(teacher.id),
  ])

  return (
    <>
      <PageHeader
        title="Student Health"
        description="Spot students who need attention this week"
      />

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <SectionHeader title="At-risk" count={atRisk.length} />
          {atRisk.length === 0 ? (
            <EmptyState title="No at-risk students" description="Everyone above 70% attendance." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Student</th>
                    <th className="pb-2 pr-4 font-medium">Cohort</th>
                    <th className="pb-2 pr-4 font-medium">Attendance</th>
                    <th className="pb-2 font-medium">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map((row) => (
                    <tr key={`${row.student_id}-${row.cohort_id}`} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        <Link
                          href={ROUTES.TEACHER.studentDetail(row.student_id)}
                          className="hover:underline"
                        >
                          {row.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        <p className="text-foreground">{row.course_title}</p>
                        <p className="text-xs">{row.cohort_name}</p>
                      </td>
                      <td className="py-2.5 pr-4">
                        <AttendanceBadge percentage={row.percentage} />
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {row.attended} / {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <SectionHeader title="Disengaged" count={disengaged.length} />
          {disengaged.length === 0 ? (
            <EmptyState title="Everyone is logging in" description="No disengaged students." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Student</th>
                    <th className="pb-2 pr-4 font-medium">Last login</th>
                    <th className="pb-2 font-medium">Active enrollments</th>
                  </tr>
                </thead>
                <tbody>
                  {disengaged.map((row) => (
                    <tr key={row.student_id} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        <Link
                          href={ROUTES.TEACHER.studentDetail(row.student_id)}
                          className="hover:underline"
                        >
                          {row.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {row.last_login_at ? formatPKT(row.last_login_at, 'datetime') : 'Never'}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{row.enrollments_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <SectionHeader title="No submissions" count={noSubs.length} />
          {noSubs.length === 0 ? (
            <EmptyState title="All students have submitted" description="Great work!" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Student</th>
                    <th className="pb-2 pr-4 font-medium">Cohort</th>
                    <th className="pb-2 font-medium">Assignments missed</th>
                  </tr>
                </thead>
                <tbody>
                  {noSubs.map((row) => (
                    <tr key={`${row.student_id}-${row.cohort_id}`} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        <Link
                          href={ROUTES.TEACHER.studentDetail(row.student_id)}
                          className="hover:underline"
                        >
                          {row.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        <p className="text-foreground">{row.course_title}</p>
                        <p className="text-xs">{row.cohort_name}</p>
                      </td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          {row.assignment_count}
                        </span>
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

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        {count}
      </span>
    </div>
  )
}

function AttendanceBadge({ percentage }: { percentage: number }) {
  const tone = percentage < 50 ? 'destructive' : 'warn'
  const cls =
    tone === 'destructive'
      ? 'bg-destructive/10 text-destructive'
      : 'bg-warning/10 text-warning'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {percentage}%
    </span>
  )
}
