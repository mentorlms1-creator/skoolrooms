/**
 * app/(platform)/admin/teachers/page.tsx — Teacher list with DataTable
 *
 * Server Component. Displays all teachers with sorting and search.
 */

import type { Metadata } from 'next'
import { getAllTeachers } from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { TeacherListTable } from '@/components/admin/TeacherListTable'

export const metadata: Metadata = {
  title: 'Teachers \u2014 Skool Rooms Admin',
}

export default async function AdminTeachersPage() {
  const teachers = await getAllTeachers()

  const total = teachers.length
  const active = teachers.filter((t) => !t.is_suspended).length
  const now = new Date()
  const thisMonthSignups = teachers.filter((t) => {
    const d = new Date(t.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

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
      <PageHeader title="Teachers" />

      <div className="flex items-center gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold">{total}</span>
          <span className="text-muted-foreground">total</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-primary">{active}</span>
          <span className="text-muted-foreground">active</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold">{thisMonthSignups}</span>
          <span className="text-muted-foreground">this month</span>
        </div>
      </div>

      <TeacherListTable data={tableData} />
    </>
  )
}
