'use client'

import type { GrandfatheredTeacherRow } from '@/lib/db/admin-plans'
import { formatPKT } from '@/lib/time/pkt'
import { ROUTES } from '@/constants/routes'
import { Link } from 'next-view-transitions'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

type GrandfatheredTableProps = {
  rows: GrandfatheredTeacherRow[]
}

export function GrandfatheredTable({ rows }: GrandfatheredTableProps) {
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filtered = rows.filter((r) => {
    if (planFilter !== 'all' && r.plan !== planFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.teacherName.toLowerCase().includes(q) || r.teacherEmail.toLowerCase().includes(q)
    }
    return true
  })

  const plans = [...new Set(rows.map((r) => r.plan))]

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-muted p-8 text-center text-sm text-muted-foreground">
        No grandfathered teachers. All teachers are within current plan limits.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All plans</option>
          {plans.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="ml-auto self-center text-sm text-muted-foreground">
          {filtered.length} teacher{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((r) => (
          <GrandfatheredCard key={r.teacherId} row={r} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-foreground/[0.05]">
              <Th>Teacher</Th>
              <Th>Plan</Th>
              <Th>Snapshot date</Th>
              <Th>Limit differences</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.teacherId} className="border-b border-foreground/[0.03] last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{r.teacherName}</p>
                  <p className="text-xs text-muted-foreground">{r.teacherEmail}</p>
                </td>
                <td className="px-4 py-3 capitalize font-medium text-foreground">{r.plan}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatPKT(r.capturedAt, 'date')}
                </td>
                <td className="px-4 py-3">
                  <LimitDiffs row={r} />
                </td>
                <td className="px-4 py-3">
                  <Link href={ROUTES.ADMIN.teacherDetail(r.teacherId)}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GrandfatheredCard({ row }: { row: GrandfatheredTeacherRow }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/5 p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-foreground">{row.teacherName}</p>
          <p className="text-xs text-muted-foreground">{row.teacherEmail}</p>
        </div>
        <Link href={ROUTES.ADMIN.teacherDetail(row.teacherId)}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      </div>
      <div className="text-xs text-muted-foreground capitalize">
        Plan: {row.plan} · Snapshotted {formatPKT(row.capturedAt, 'date')}
      </div>
      <LimitDiffs row={row} />
    </div>
  )
}

function LimitDiffs({ row }: { row: GrandfatheredTeacherRow }) {
  const snap = row.snapshotJson
  const cur = row.currentPlan
  const diffs: string[] = []

  if (Number(snap.max_courses) > cur.maxCourses)
    diffs.push(`Courses: ${snap.max_courses} (snap) vs ${cur.maxCourses} (live)`)
  if (Number(snap.max_students) > cur.maxStudents)
    diffs.push(`Students: ${snap.max_students} (snap) vs ${cur.maxStudents} (live)`)
  if (Number(snap.max_cohorts_active) > cur.maxCohortsActive)
    diffs.push(`Cohorts: ${snap.max_cohorts_active} (snap) vs ${cur.maxCohortsActive} (live)`)
  if (Number(snap.max_storage_mb) > cur.maxStorageMb)
    diffs.push(`Storage: ${snap.max_storage_mb}MB (snap) vs ${cur.maxStorageMb}MB (live)`)

  return (
    <div className="space-y-0.5">
      {diffs.map((d) => (
        <p key={d} className="text-xs text-amber-600 dark:text-amber-400">
          {d}
        </p>
      ))}
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
      {children}
    </th>
  )
}
