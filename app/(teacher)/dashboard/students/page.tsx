/**
 * app/(teacher)/dashboard/students/page.tsx — All Students page (Server Component)
 *
 * Cursor-paginated. Header stat cards come from cheap count queries (no row
 * pull); table data comes from a server-paginated DataTable.
 */

import type { Metadata } from 'next'
import { Users, UserCheck, Clock } from 'lucide-react'
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
  title: 'Students \u2014 Skool Rooms',
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

      <div className="flex flex-wrap items-center gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-2xl font-extrabold">{stats.uniqueStudents}</span>
          <span className="text-muted-foreground">unique students</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          <span className="text-2xl font-extrabold text-primary">{stats.active}</span>
          <span className="text-muted-foreground">active</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-warning" />
          <span className="text-2xl font-extrabold">{stats.pending}</span>
          <span className="text-muted-foreground">pending</span>
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
