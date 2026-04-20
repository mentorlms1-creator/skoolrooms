'use client'

/**
 * components/admin/TeacherListTable.tsx — Teacher list table with cursor pagination.
 *
 * Server fetches one page; this client component handles search/plan/status
 * filter inputs, syncs them to the URL, and asks DataTable to render the
 * "Newer / Older" cursor controls instead of client-side pagination.
 */

import { Link } from 'next-view-transitions'
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
  nextCursor: string | null
  currentCursor: string | null
  totalHint?: number
  currentSearch?: string
  currentPlan?: string
  currentStatus?: string
}

export function TeacherListTable({
  data,
  nextCursor,
  currentCursor,
  totalHint,
  currentSearch = '',
  currentPlan = '',
  currentStatus = '',
}: TeacherListTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(currentSearch)

  const updateUrl = (
    next: Partial<{ cursor: string | null; q: string; plan: string; status: string }>,
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
      router.replace(qs ? `/admin/teachers?${qs}` : '/admin/teachers', { scroll: false })
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateUrl({ q: search, cursor: null })
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
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
            value={currentPlan || '_all'}
            onValueChange={(v) => updateUrl({ plan: v === '_all' ? '' : v, cursor: null })}
          >
            <SelectTrigger className="w-full sm:w-40 h-10 rounded-2xl border-none ring-1 ring-foreground/5">
              <SelectValue placeholder="All plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="solo">Solo</SelectItem>
              <SelectItem value="academy">Academy</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={currentStatus || '_all'}
            onValueChange={(v) => updateUrl({ status: v === '_all' ? '' : v, cursor: null })}
          >
            <SelectTrigger className="w-full sm:w-40 h-10 rounded-2xl border-none ring-1 ring-foreground/5">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
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
        emptyMessage="No teachers found."
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
