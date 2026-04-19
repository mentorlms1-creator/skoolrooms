'use client'

/**
 * components/ui/DataTable.tsx — Generic data table powered by @tanstack/react-table + shadcn Table
 *
 * Two modes:
 * - Default (client-side): sorting, text filtering, pagination handled in-browser.
 * - serverPagination: the server slices rows; this component renders a simple
 *   "Load more / Older / Newer" footer driven by the parent's cursor handler.
 *
 * Both modes preserve the mobile card view contract: consumers can render a
 * separate md:hidden card layout alongside.
 */

import { useState } from 'react'
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

// Re-export ColumnDef for consumer convenience
export type { ColumnDef } from '@tanstack/react-table'

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const

export type ServerPagination = {
  /** Cursor token of the next page, or null if no more rows. */
  nextCursor: string | null
  /** Cursor token of the previous page, or null if on the first page. */
  prevCursor?: string | null
  /** Called when the user clicks "Load more" / "Newer". null = first page. */
  onPageChange: (cursor: string | null) => void
  /** Optional total-count hint for "Showing N of ~M" UI. */
  totalCountHint?: number
  /** Default page-size shown in the footer copy. Defaults to 50. */
  pageSize?: number
  /** Disable buttons while a fetch is in flight. */
  isLoading?: boolean
}

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  emptyMessage?: string
  searchable?: boolean
  searchPlaceholder?: string
  /** Column id to use for global text filtering. If not set, uses the first column. */
  searchColumnId?: string
  /** When set, switches DataTable into server-driven pagination mode. */
  serverPagination?: ServerPagination
}

export function DataTable<TData>({
  columns,
  data,
  emptyMessage = 'No data found.',
  searchable = false,
  searchPlaceholder = 'Search...',
  searchColumnId,
  serverPagination,
}: DataTableProps<TData>) {
  void searchColumnId
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const isServer = !!serverPagination

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // In server-paginated mode, do not run client-side filter/paginate models.
    ...(isServer
      ? {}
      : {
          getFilteredRowModel: getFilteredRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
        }),
    initialState: {
      pagination: {
        pageSize: PAGE_SIZE_OPTIONS[0],
      },
    },
  })

  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const totalRows = isServer
    ? data.length
    : table.getFilteredRowModel().rows.length
  const pageCount = isServer ? 1 : table.getPageCount()

  const showClientControls =
    !isServer && (searchable || data.length > PAGE_SIZE_OPTIONS[0])

  return (
    <div className="flex flex-col gap-4">
      {/* Search + page size controls (client mode only) */}
      {showClientControls && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {searchable && (
            <div className="w-full sm:max-w-xs">
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => {
                  setGlobalFilter(e.target.value)
                  table.setPageIndex(0)
                }}
                className="rounded-2xl border-none ring-1 ring-foreground/5 bg-background h-10 px-4"
              />
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
                table.setPageIndex(0)
              }}
            >
              <SelectTrigger className="h-9 w-[70px] rounded-xl border-none ring-1 ring-foreground/5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>entries</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-[2rem] border-none shadow-sm ring-1 ring-foreground/5 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-container border-b border-foreground/5 hover:bg-container">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50',
                        canSort && 'cursor-pointer select-none hover:text-muted-foreground',
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <ArrowUpDown
                              className={cn(
                                'h-3.5 w-3.5',
                                header.column.getIsSorted()
                                  ? 'text-primary'
                                  : 'text-muted-foreground/30',
                              )}
                            />
                          )}
                        </span>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <EmptyState title={emptyMessage} description="" />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-b border-foreground/5 hover:bg-foreground/[0.02]">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-6 py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — client mode */}
      {!isServer && pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between text-sm gap-2 px-2">
          <p className="text-muted-foreground">
            Showing {pageIndex * pageSize + 1} to{' '}
            {Math.min((pageIndex + 1) * pageSize, totalRows)} of {totalRows} entries
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-none ring-1 ring-foreground/5 hover:bg-foreground/[0.03]"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-none ring-1 ring-foreground/5 hover:bg-foreground/[0.03]"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Pagination — server-driven mode */}
      {isServer && (
        <ServerPaginationFooter pagination={serverPagination!} rowsShown={data.length} />
      )}
    </div>
  )
}

function ServerPaginationFooter({
  pagination,
  rowsShown,
}: {
  pagination: ServerPagination
  rowsShown: number
}) {
  const { nextCursor, prevCursor, onPageChange, totalCountHint, isLoading } = pagination
  const showFooter =
    !!nextCursor || !!prevCursor || (totalCountHint !== undefined && totalCountHint > 0)

  if (!showFooter) return null

  return (
    <div className="flex flex-wrap items-center justify-between text-sm gap-2 px-2">
      <p className="text-muted-foreground">
        {totalCountHint !== undefined
          ? `Showing ${rowsShown} of ~${totalCountHint.toLocaleString()}`
          : `Showing ${rowsShown}`}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-none ring-1 ring-foreground/5 hover:bg-foreground/[0.03]"
          onClick={() => onPageChange(null)}
          disabled={!prevCursor || isLoading}
        >
          <ChevronLeft className="h-4 w-4" />
          Newer
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-none ring-1 ring-foreground/5 hover:bg-foreground/[0.03]"
          onClick={() => nextCursor && onPageChange(nextCursor)}
          disabled={!nextCursor || isLoading}
        >
          Older
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
