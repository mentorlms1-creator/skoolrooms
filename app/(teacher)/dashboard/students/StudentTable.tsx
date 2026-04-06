'use client'

/**
 * app/(teacher)/dashboard/students/StudentTable.tsx — Student list table
 * Client component using DataTable with @tanstack/react-table ColumnDef.
 */

import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'

export type StudentTableRow = {
  enrollmentId: string
  studentId: string
  name: string
  email: string
  phone: string
  courseTitle: string
  cohortName: string
  status: string
  enrolledAt: string
}

const columns: ColumnDef<StudentTableRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link
        href={ROUTES.TEACHER.studentDetail(row.original.studentId)}
        className="text-[15px] font-bold text-foreground hover:text-primary transition-colors"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">{getValue() as string}</span>
    ),
  },
  {
    id: 'courseCohort',
    header: 'Course / Cohort',
    accessorFn: (row) => `${row.courseTitle} ${row.cohortName}`,
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{row.original.courseTitle}</span>
        <span className="text-xs text-muted-foreground">{row.original.cohortName}</span>
      </div>
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
    accessorKey: 'enrolledAt',
    header: 'Enrolled',
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">
        {formatPKT(getValue() as string, 'date')}
      </span>
    ),
  },
]

type StudentTableProps = {
  data: StudentTableRow[]
}

export function StudentTable({ data }: StudentTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchable
      searchPlaceholder="Search by name or email..."
      emptyMessage="No students found."
    />
  )
}
