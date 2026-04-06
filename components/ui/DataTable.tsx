'use client'

/**
 * components/ui/DataTable.tsx — Client-side data table with sorting, search, and pagination
 * Uses Input for search box. Mobile-friendly with horizontal scroll.
 */

import { useState, useMemo, type ReactNode } from 'react'
import { Input } from '@/components/ui/Input'

type Column = {
  key: string
  header: string
  sortable?: boolean
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode
}

type DataTableProps = {
  columns: Column[]
  data: Record<string, unknown>[]
  emptyMessage?: string
  searchable?: boolean
  searchPlaceholder?: string
}

type SortDirection = 'asc' | 'desc'
type SortState = { key: string; direction: SortDirection } | null

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const

export function DataTable({
  columns,
  data,
  emptyMessage = 'No data found.',
  searchable = false,
  searchPlaceholder = 'Search...',
}: DataTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0])

  // Filter data by search term (matches any string column)
  const filteredData = useMemo(() => {
    if (!search.trim()) return data

    const term = search.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        const value = row[col.key]
        if (typeof value === 'string') {
          return value.toLowerCase().includes(term)
        }
        if (typeof value === 'number') {
          return String(value).includes(term)
        }
        return false
      }),
    )
  }, [data, search, columns])

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!sort) return filteredData

    return [...filteredData].sort((a, b) => {
      const aVal = a[sort.key]
      const bVal = b[sort.key]

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      let comparison = 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal)
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [filteredData, sort])

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const paginatedData = sortedData.slice(page * pageSize, (page + 1) * pageSize)

  // Reset to first page on search or page size change
  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(0)
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize)
    setPage(0)
  }

  function handleSort(key: string) {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.direction === 'asc'
          ? { key, direction: 'desc' }
          : null
      }
      return { key, direction: 'asc' }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search + page size controls */}
      {(searchable || data.length > PAGE_SIZE_OPTIONS[0]) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {searchable && (
            <div className="w-full sm:max-w-xs">
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="rounded border border-border bg-card px-2 py-2 text-sm text-foreground min-h-[2.75rem]"
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-4 py-3 font-medium text-muted-foreground whitespace-nowrap
                    ${col.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''}
                  `}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <SortIcon
                        active={sort?.key === col.key}
                        direction={sort?.key === col.key ? sort.direction : undefined}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-border last:border-b-0 hover:bg-background/50"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-foreground whitespace-nowrap">
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between text-sm gap-2">
          <p className="text-muted-foreground">
            Showing {page * pageSize + 1} to{' '}
            {Math.min((page + 1) * pageSize, sortedData.length)} of{' '}
            {sortedData.length} entries
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border border-border px-3 py-2 text-muted-foreground hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => {
                // Show first, last, and pages around current
                if (i === 0 || i === totalPages - 1) return true
                if (Math.abs(i - page) <= 1) return true
                return false
              })
              .reduce<(number | 'ellipsis')[]>((acc, i, idx, arr) => {
                if (idx > 0) {
                  const prev = arr[idx - 1]
                  if (typeof prev === 'number' && i - prev > 1) {
                    acc.push('ellipsis')
                  }
                }
                acc.push(i)
                return acc
              }, [])
              .map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`
                      rounded border px-3 py-2
                      ${
                        page === item
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border text-muted-foreground hover:bg-background'
                      }
                    `}
                  >
                    {item + 1}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="rounded border border-border px-3 py-2 text-muted-foreground hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sort Icon ───────────────────────────────────────────────────────────────

function SortIcon({
  active,
  direction,
}: {
  active: boolean
  direction?: SortDirection
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground/50'}`}
      aria-hidden="true"
    >
      <path
        d="M8 3.5l3 4H5l3-4z"
        opacity={active && direction === 'desc' ? 0.3 : 1}
      />
      <path
        d="M8 12.5l-3-4h6l-3 4z"
        opacity={active && direction === 'asc' ? 0.3 : 1}
      />
    </svg>
  )
}
