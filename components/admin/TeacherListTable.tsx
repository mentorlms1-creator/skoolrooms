'use client'

/**
 * components/admin/TeacherListTable.tsx — Teacher list table with links to detail
 * Client component for DataTable with sorting/search.
 */

import Link from 'next/link'
import { DataTable } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'

type TeacherTableRow = {
  id: string
  name: string
  email: string
  subdomain: string
  plan: string
  status: string
  student_count: number
  created_at: string
}

type TeacherListTableProps = {
  data: TeacherTableRow[]
}

export function TeacherListTable({ data }: TeacherListTableProps) {
  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (value: unknown, row: Record<string, unknown>) => (
        <Link
          href={ROUTES.ADMIN.teacherDetail(row.id as string)}
          className="font-medium text-brand-600 hover:text-brand-500"
        >
          {value as string}
        </Link>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
    },
    {
      key: 'plan',
      header: 'Plan',
      sortable: true,
      render: (value: unknown) => (
        <span className="capitalize">{value as string}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value: unknown) => (
        <StatusBadge status={value as string} size="sm" />
      ),
    },
    {
      key: 'student_count',
      header: 'Students',
      sortable: true,
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      render: (value: unknown) => (
        <span className="text-muted">
          {formatPKT(value as string, 'date')}
        </span>
      ),
    },
  ]

  const tableData = data.map((row) => ({
    ...row,
  } as Record<string, unknown>))

  return (
    <DataTable
      columns={columns}
      data={tableData}
      searchable
      searchPlaceholder="Search teachers..."
      emptyMessage="No teachers found."
    />
  )
}
