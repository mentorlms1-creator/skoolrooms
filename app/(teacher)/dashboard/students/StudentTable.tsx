'use client'

/**
 * app/(teacher)/dashboard/students/StudentTable.tsx — Student list table.
 *
 * Server-paginated DataTable. Search/status filters drive the URL; cursor
 * advances via the DataTable footer's "Newer / Older" buttons.
 */

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  nextCursor?: string | null
  currentCursor?: string | null
  totalHint?: number
  currentSearch?: string
  currentStatus?: string
}

export function StudentTable({
  data,
  nextCursor = null,
  currentCursor = null,
  totalHint,
  currentSearch = '',
  currentStatus = '',
}: StudentTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentSearch)

  const updateUrl = (
    next: Partial<{ cursor: string | null; q: string; status: string }>,
  ) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (key === 'cursor') {
        if (value) params.set('cursor', value as string)
        else params.delete('cursor')
      } else if (typeof value === 'string') {
        if (value) params.set(key, value)
        else params.delete(key)
      }
    }
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/dashboard/students?${qs}` : '/dashboard/students', {
        scroll: false,
      })
    })
  }

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateUrl({ q: search, cursor: null })
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-xs">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-2xl border-none ring-1 ring-foreground/5 bg-background h-10 px-4"
            />
          </div>
          <Select
            value={currentStatus || '_all'}
            onValueChange={(v) => updateUrl({ status: v === '_all' ? '' : v, cursor: null })}
          >
            <SelectTrigger className="w-full sm:w-44 h-10 rounded-2xl border-none ring-1 ring-foreground/5">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
      </form>

      <DataTable
        columns={columns}
        data={data}
        emptyMessage="No students found."
        serverPagination={{
          nextCursor,
          prevCursor: currentCursor,
          isLoading: isPending,
          totalCountHint: totalHint,
          onPageChange: (cursor) => updateUrl({ cursor }),
        }}
      />
    </div>
  )
}
