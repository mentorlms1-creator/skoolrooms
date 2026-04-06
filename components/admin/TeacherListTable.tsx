'use client'

/**
 * components/admin/TeacherListTable.tsx — Teacher list table with links to detail
 * Client component using DataTable with @tanstack/react-table ColumnDef.
 */

import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
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

const columns: ColumnDef<TeacherTableRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link
        href={ROUTES.ADMIN.teacherDetail(row.original.id)}
        className="font-medium text-primary hover:text-primary/90"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'plan',
    header: 'Plan',
    cell: ({ getValue }) => (
      <span className="capitalize">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => (
      <StatusBadge status={getValue() as string} size="sm" />
    ),
  },
  {
    accessorKey: 'student_count',
    header: 'Students',
  },
  {
    accessorKey: 'created_at',
    header: 'Joined',
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">
        {formatPKT(getValue() as string, 'date')}
      </span>
    ),
  },
]

type TeacherListTableProps = {
  data: TeacherTableRow[]
}

export function TeacherListTable({ data }: TeacherListTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchable
      searchPlaceholder="Search teachers..."
      emptyMessage="No teachers found."
    />
  )
}
