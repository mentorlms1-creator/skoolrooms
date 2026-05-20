/**
 * app/(teacher)/dashboard/students/page.tsx — All Students page (Server Component)
 *
 * iCloud-Web redesign: PageHeader + KPI hero card + StudentTable.
 * Stats come from a cheap aggregate query; table data is server-paginated.
 */

import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import {
  getStudentsByTeacherPage,
  getStudentStatsByTeacher,
} from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StudentTable, type StudentTableRow } from './StudentTable'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination/limits'

export const metadata: Metadata = {
  title: 'Students — Skool Rooms',
}

type SearchParams = {
  cursor?: string
  q?: string
  status?: string
}

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const teacher = await requireTeacher()
  const { cursor, q, status } = await searchParams

  const [page, stats] = await Promise.all([
    getStudentsByTeacherPage({
      teacherId: teacher.id,
      cursor: cursor ?? null,
      limit: DEFAULT_PAGE_SIZE,
      q: q ?? null,
      status: status ?? null,
    }),
    getStudentStatsByTeacher(teacher.id),
  ])

  const tableData: StudentTableRow[] = page.rows.map((e) => ({
    enrollmentId: e.id,
    studentId: e.students.id,
    name: e.students.name,
    email: e.students.email,
    phone: e.students.phone,
    photoUrl: (e.students as { profile_photo_url?: string | null }).profile_photo_url ?? null,
    courseTitle: e.cohorts.courses.title,
    cohortName: e.cohorts.name,
    status: e.status,
    enrolledAt: e.created_at,
  }))

  return (
    <>
      <PageHeader
        title="Students"
        description="All students enrolled across your courses"
      />

      {/* KPI hero — 3 stats divided by hairlines */}
      <div className="mb-6 rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-0">
          <KpiStat
            value={stats.uniqueStudents}
            label="Total"
            delta={stats.newThisMonth > 0 ? `+${stats.newThisMonth} this month` : null}
            tone="neutral"
          />
          <KpiStat
            value={stats.active}
            label="Active"
            delta={
              stats.uniqueStudents > 0 && stats.activePct > 0
                ? `${stats.activePct}% of total`
                : null
            }
            tone="success"
            divided
          />
          <KpiStat
            value={stats.pending}
            label="Pending"
            delta={
              stats.oldestPendingDays !== null && stats.pending > 0
                ? `Oldest ${stats.oldestPendingDays} day${stats.oldestPendingDays === 1 ? '' : 's'}`
                : null
            }
            tone="warning"
            divided
          />
        </div>
      </div>

      {page.rows.length === 0 && !cursor && !q && !status ? (
        <EmptyState
          title="No students yet"
          description="Students will appear here once they enroll in your courses."
        />
      ) : (
        <StudentTable
          data={tableData}
          nextCursor={page.nextCursor}
          currentCursor={cursor ?? null}
          totalHint={stats.uniqueStudents}
          currentSearch={q ?? ''}
          currentStatus={status ?? ''}
        />
      )}
    </>
  )
}

type KpiTone = 'neutral' | 'success' | 'warning'

function KpiStat({
  value,
  label,
  delta,
  tone,
  divided = false,
}: {
  value: number
  label: string
  delta: string | null
  tone: KpiTone
  divided?: boolean
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-foreground'

  return (
    <div className={divided ? 'pl-4 sm:pl-6 border-l border-border/40' : 'pr-4 sm:pr-6'}>
      <div
        className={`text-[26px] sm:text-[34px] font-semibold tracking-[-0.025em] leading-none ${toneClass}`}
      >
        {value}
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      {delta && (
        <div className="mt-1 hidden sm:block text-[11px] text-muted-foreground/80">
          {delta}
        </div>
      )}
    </div>
  )
}
