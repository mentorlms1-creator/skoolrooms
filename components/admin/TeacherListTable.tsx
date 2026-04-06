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
      <div className="flex flex-col gap-0.5">
        <Link
          href={ROUTES.ADMIN.teacherDetail(row.original.id)}
          className="text-[15px] font-bold text-foreground hover:text-primary transition-colors"
        >
          {row.original.name}
        </Link>
        <span className="text-sm text-muted-foreground">{row.original.email}</span>
      </div>
    ),
  },
  {
    accessorKey: 'plan',
    header: 'Plan',
    cell: ({ getValue }) => (
      <span className="inline-block rounded-lg bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold capitalize">
        {getValue() as string}
      </span>
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
    cell: ({ getValue }) => (
      <span className="font-semibold">{getValue() as number}</span>
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Joined',
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">
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
