'use client'

/**
 * components/public/ExploreFilters.tsx — Client-side filter controls for explore page
 * Filters teacher list by subject, level, fee range.
 */

import { useState, useMemo } from 'react'
import { TeacherCard } from '@/components/public/TeacherCard'
import type { ExplorableTeacher } from '@/lib/db/explore'

type ExploreFiltersProps = {
  teachers: ExplorableTeacher[]
  allSubjects: string[]
  allLevels: string[]
  platformDomain: string
}

export function ExploreFilters({
  teachers,
  allSubjects,
  allLevels,
  platformDomain,
}: ExploreFiltersProps) {
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [maxFee, setMaxFee] = useState('')
  const [openOnly, setOpenOnly] = useState(false)

  const filtered = useMemo(() => {
    return teachers.filter((teacher) => {
      // Subject filter
      if (subject) {
        const hasSubject = teacher.subject_tags.some(
          (tag) => tag.toLowerCase() === subject.toLowerCase(),
        )
        if (!hasSubject) return false
      }

      // Level filter
      if (level) {
        const hasLevel = teacher.teaching_levels.some(
          (lvl) => lvl.toLowerCase() === level.toLowerCase(),
        )
        if (!hasLevel) return false
      }

      // Fee filter
      if (maxFee) {
        const maxFeeNum = parseInt(maxFee, 10)
        if (!isNaN(maxFeeNum) && teacher.starting_fee_pkr > maxFeeNum) {
          return false
        }
      }

      // Open cohorts filter
      if (openOnly && !teacher.has_open_cohorts) {
        return false
      }

      return true
    })
  }, [teachers, subject, level, maxFee, openOnly])

  return (
    <div>
      {/* Filter controls */}
      <div className="mb-8 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        {/* Subject filter */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-subject" className="text-sm font-medium text-ink">
            Subject
          </label>
          <select
            id="filter-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Subjects</option>
            {allSubjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Level filter */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-level" className="text-sm font-medium text-ink">
            Level
          </label>
          <select
            id="filter-level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Levels</option>
            {allLevels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Max fee filter */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-max-fee" className="text-sm font-medium text-ink">
            Max Fee (PKR)
          </label>
          <input
            id="filter-max-fee"
            type="number"
            value={maxFee}
            onChange={(e) => setMaxFee(e.target.value)}
            placeholder="e.g., 5000"
            min="0"
            className="w-full sm:w-32 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Open cohorts toggle */}
        <div className="flex items-center gap-2 pb-1">
          <input
            type="checkbox"
            id="filter-open-only"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="filter-open-only" className="text-sm text-ink">
            Open cohorts only
          </label>
        </div>

        {/* Clear button */}
        {(subject || level || maxFee || openOnly) && (
          <button
            type="button"
            onClick={() => {
              setSubject('')
              setLevel('')
              setMaxFee('')
              setOpenOnly(false)
            }}
            className="pb-1 text-sm text-brand-600 hover:text-brand-500 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="mb-4 text-sm text-muted">
        {filtered.length} {filtered.length === 1 ? 'teacher' : 'teachers'} found
      </p>

      {/* Teacher grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <p className="text-lg font-medium text-ink">No teachers found</p>
          <p className="mt-1 text-sm text-muted">
            Try adjusting your filters to see more results.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              platformDomain={platformDomain}
            />
          ))}
        </div>
      )}
    </div>
  )
}
