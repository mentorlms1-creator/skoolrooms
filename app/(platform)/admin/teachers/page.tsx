/**
 * app/(platform)/admin/teachers/page.tsx — Teacher list with cursor pagination.
 *
 * Server Component. Reads cursor + filters from the URL, fetches one page at
 * a time, and passes a server-pagination callback through TeacherListTable.
 */

import type { Metadata } from 'next'
import {
  getAdminTeachersPage,
  getAdminTeachersHeaderStats,
} from '@/lib/db/admin'
import { PageHeader } from '@/components/ui/PageHeader'
import { TeacherListTable } from '@/components/admin/TeacherListTable'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination/limits'

export const metadata: Metadata = {
  title: 'Teachers \u2014 Skool Rooms Admin',
}

type SearchParams = {
  cursor?: string
  q?: string
  plan?: string
  status?: 'active' | 'suspended'
}

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { cursor, q, plan, status } = await searchParams

  const [page, headerStats] = await Promise.all([
    getAdminTeachersPage({
      cursor: cursor ?? null,
      limit: DEFAULT_PAGE_SIZE,
      search: q ?? null,
      plan: plan ?? null,
      status: status ?? null,
    }),
    getAdminTeachersHeaderStats(),
  ])

  const tableData = page.rows.map((t) => ({
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
          <span className="text-2xl font-extrabold">{headerStats.total}</span>
          <span className="text-muted-foreground">total</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-primary">{headerStats.active}</span>
          <span className="text-muted-foreground">active</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold">{headerStats.thisMonthSignups}</span>
          <span className="text-muted-foreground">this month</span>
        </div>
      </div>

      <TeacherListTable
        data={tableData}
        nextCursor={page.nextCursor}
        currentCursor={cursor ?? null}
        totalHint={headerStats.total}
        currentSearch={q ?? ''}
        currentPlan={plan ?? ''}
        currentStatus={status ?? ''}
      />
    </>
  )
}
