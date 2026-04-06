/**
 * app/(teacher)/dashboard/students/page.tsx — All Students page (Server Component)
 *
 * Shows every unique student enrolled across all of the teacher's cohorts.
 * Inline stats: total unique students, active enrollments, pending enrollments.
 * DataTable with search, sorting, pagination.
 */

import type { Metadata } from 'next'
import { Users, UserCheck, Clock } from 'lucide-react'
import { requireTeacher } from '@/lib/auth/guards'
import { getAllStudentsByTeacher } from '@/lib/db/enrollments'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StudentTable, type StudentTableRow } from './StudentTable'

export const metadata: Metadata = {
  title: 'Students \u2014 Skool Rooms',
}

export default async function TeacherStudentsPage() {
  const teacher = await requireTeacher()
  const enrollments = await getAllStudentsByTeacher(teacher.id)

  // Build table rows (one row per enrollment)
  const tableData: StudentTableRow[] = enrollments.map((e) => ({
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

  // Compute stats
  const uniqueStudentIds = new Set(enrollments.map((e) => e.students.id))
  const totalUniqueStudents = uniqueStudentIds.size
  const activeEnrollments = enrollments.filter((e) => e.status === 'active' || e.status === 'enrolled').length
  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending').length

  return (
    <>
      <PageHeader
        title="Students"
        description="All students enrolled across your courses"
      />

      {/* Inline stats */}
      <div className="flex flex-wrap items-center gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-2xl font-extrabold">{totalUniqueStudents}</span>
          <span className="text-muted-foreground">unique students</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          <span className="text-2xl font-extrabold text-primary">{activeEnrollments}</span>
          <span className="text-muted-foreground">active</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-warning" />
          <span className="text-2xl font-extrabold">{pendingEnrollments}</span>
          <span className="text-muted-foreground">pending</span>
        </div>
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          title="No students yet"
          description="Students will appear here once they enroll in your courses."
        />
      ) : (
        <StudentTable data={tableData} />
      )}
    </>
  )
}
