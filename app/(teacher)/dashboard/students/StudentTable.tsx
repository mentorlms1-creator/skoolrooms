'use client'

/**
 * app/(teacher)/dashboard/students/StudentTable.tsx — Music-style student list
 *
 * Roomy table on sm+, stacked cards on <sm. URL-driven search/filter/cursor;
 * the search input auto-submits after 500ms debounce (Enter forces instant).
 * Full row → student detail via next-view-transitions.
 */

import { Link } from 'next-view-transitions'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/constants/routes'
import { formatPKT } from '@/lib/time/pkt'
import { cn } from '@/lib/utils'

export type StudentTableRow = {
  enrollmentId: string
  studentId: string
  name: string
  email: string
  phone: string
  photoUrl: string | null
  courseTitle: string
  cohortName: string
  status: string
  enrolledAt: string
}

const STATUSES = [
  { label: 'All', value: '_all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Withdrawn', value: 'withdrawn' },
  { label: 'Revoked', value: 'revoked' },
] as const

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
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

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
      router.replace(qs ? `${ROUTES.TEACHER.students}?${qs}` : ROUTES.TEACHER.students, {
        scroll: false,
      })
    })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    updateUrl({ q: search, cursor: null })
  }

  const onSearchChange = (value: string) => {
    setSearch(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      updateUrl({ q: value, cursor: null })
    }, 500)
  }

  const hasActiveFilter = Boolean(currentSearch || currentStatus)
  const isFilteredEmpty = data.length === 0 && hasActiveFilter

  return (
    <div
      className={cn(
        'flex flex-col gap-5 transition-opacity duration-200',
        isPending && 'opacity-50 pointer-events-none',
      )}
    >
      {/* Toolbar */}
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-[260px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
            <Input
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 pr-7 rounded-lg border-none ring-1 ring-border bg-muted/20 hover:bg-muted/30 focus:bg-background h-9 text-xs focus-visible:ring-primary/45 transition-all placeholder:text-muted-foreground/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  if (debounceTimer.current) clearTimeout(debounceTimer.current)
                  updateUrl({ q: '', cursor: null })
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground p-0.5 rounded-full"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="w-full sm:w-auto overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-lg bg-muted/25 p-0.5 ring-1 ring-border/30">
            <div className="flex min-w-max gap-0.5">
              {STATUSES.map((item) => {
                const isActive = (currentStatus || '_all') === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() =>
                      updateUrl({
                        status: item.value === '_all' ? '' : item.value,
                        cursor: null,
                      })
                    }
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 select-none whitespace-nowrap',
                      isActive
                        ? 'bg-card text-foreground shadow-xs font-semibold ring-1 ring-border/30'
                        : 'text-muted-foreground/80 hover:text-foreground hover:bg-foreground/[0.02]',
                    )}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Hidden submit so Enter still fires instantly */}
        <button type="submit" className="hidden" aria-hidden="true" />
      </form>

      {/* Filtered-empty state */}
      {isFilteredEmpty ? (
        <div className="rounded-2xl bg-card ring-1 ring-border/40 px-6 py-16 text-center">
          <p className="text-sm text-foreground font-medium">
            No students match this filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              if (debounceTimer.current) clearTimeout(debounceTimer.current)
              startTransition(() => {
                router.replace(ROUTES.TEACHER.students, { scroll: false })
              })
            }}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div>
          {/* DESKTOP TABLE — sm+ */}
          <div className="hidden sm:block rounded-2xl bg-card ring-1 ring-border/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="grid grid-cols-[2.4fr_1.6fr_1fr_0.9fr] px-5 py-3 border-b border-border/40 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <span>Student</span>
              <span>Course / Cohort</span>
              <span>Enrolled</span>
              <span>Status</span>
            </div>

            {data.map((row, idx) => (
              <Link
                key={row.enrollmentId}
                href={ROUTES.TEACHER.studentDetail(row.studentId)}
                className={cn(
                  'grid grid-cols-[2.4fr_1.6fr_1fr_0.9fr] items-center px-5 py-3 gap-2 transition-colors duration-150 hover:bg-muted/40',
                  idx < data.length - 1 && 'border-b border-border/40',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar
                    id={row.studentId}
                    name={row.name}
                    photoUrl={row.photoUrl}
                    size="md"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-foreground leading-tight truncate">
                      {row.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {row.email}
                      {row.phone ? ` · ${row.phone}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-medium text-foreground truncate">
                    {row.courseTitle}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {row.cohortName}
                  </span>
                </div>

                <span className="text-[12px] text-muted-foreground whitespace-nowrap">
                  {formatPKT(row.enrolledAt, 'date')}
                </span>

                <div>
                  <StatusBadge status={row.status} size="sm" />
                </div>
              </Link>
            ))}
          </div>

          {/* MOBILE CARDS — <sm */}
          <div className="sm:hidden flex flex-col gap-2">
            {data.map((row) => (
              <Link
                key={row.enrollmentId}
                href={ROUTES.TEACHER.studentDetail(row.studentId)}
                className="flex items-center gap-3 rounded-xl bg-card ring-1 ring-border/40 px-4 py-3 transition-colors duration-150 active:bg-muted/50"
              >
                <StudentAvatar
                  id={row.studentId}
                  name={row.name}
                  photoUrl={row.photoUrl}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-foreground leading-tight truncate">
                    {row.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {row.email}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{row.courseTitle}</span>
                    <span>·</span>
                    <StatusBadge status={row.status} size="sm" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            count={data.length}
            totalHint={totalHint}
            nextCursor={nextCursor}
            currentCursor={currentCursor}
            onPageChange={(cursor) => updateUrl({ cursor })}
          />
        </div>
      )}
    </div>
  )
}

function Pagination({
  count,
  totalHint,
  nextCursor,
  currentCursor,
  onPageChange,
}: {
  count: number
  totalHint?: number
  nextCursor: string | null
  currentCursor: string | null
  onPageChange: (cursor: string | null) => void
}) {
  const hasNewer = currentCursor !== null
  const hasOlder = nextCursor !== null

  return (
    <div className="flex justify-between items-center pt-4 px-1 text-[11px] text-muted-foreground">
      <span>
        {count > 0 ? (
          <>
            Showing {count}
            {totalHint !== undefined && ` of ${totalHint}`}
          </>
        ) : (
          'No results on this page'
        )}
      </span>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!hasNewer}
          onClick={() => onPageChange(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg ring-1 ring-border/40 bg-card text-xs transition-colors',
            hasNewer
              ? 'text-foreground hover:bg-muted/30'
              : 'text-muted-foreground/40 cursor-not-allowed',
          )}
        >
          ← Newer
        </button>
        <button
          type="button"
          disabled={!hasOlder}
          onClick={() => hasOlder && onPageChange(nextCursor)}
          className={cn(
            'px-3 py-1.5 rounded-lg ring-1 ring-border/40 bg-card text-xs transition-colors',
            hasOlder
              ? 'text-foreground hover:bg-muted/30'
              : 'text-muted-foreground/40 cursor-not-allowed',
          )}
        >
          Older →
        </button>
      </div>
    </div>
  )
}
