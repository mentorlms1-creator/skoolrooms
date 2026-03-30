/**
 * app/(platform)/admin/teachers/page.tsx — Teacher list with DataTable
 *
 * Server Component. Displays all teachers with sorting and search.
 */

import Link from 'next/link'
import { getAllTeachers } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { TeacherListTable } from '@/components/admin/TeacherListTable'

export default async function AdminTeachersPage() {
  const teachers = await getAllTeachers()

  // Map to the shape DataTable expects
  const tableData = teachers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    subdomain: t.subdomain,
    plan: t.plan,
    status: t.is_suspended ? 'suspended' : 'active',
    student_count: t.student_count,
    created_at: t.created_at,
  }))

  return (
    <>
      <PageHeader
        title="Teachers"
        description={`${teachers.length} teachers on the platform.`}
      />

      <TeacherListTable data={tableData} />
    </>
  )
}
