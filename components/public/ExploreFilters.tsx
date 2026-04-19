'use client'

/**
 * components/public/ExploreFilters.tsx — Client-side filter controls for explore page.
 *
 * Filters subject/level/fee/openOnly run in-memory on the current loaded set
 * (cheap, since the server already paginated to ~24 rows). City and cursor
 * are URL-driven so the page can be deep-linked / shared.
 *
 * Infinite scroll: when the sentinel scrolls into view, push the next cursor
 * into `?cursor=` and let the Server Component fetch + render the next batch.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TeacherCard } from '@/components/public/TeacherCard'
import type { ExplorableTeacher } from '@/lib/db/explore'

type ExploreFiltersProps = {
  teachers: ExplorableTeacher[]
  allSubjects: string[]
  allLevels: string[]
  allCities: string[]
  initialCity?: string
  initialCursor?: string | null
  nextCursor?: string | null
  ratings: Record<string, { avg: number; count: number }>
  platformDomain: string
}

export function ExploreFilters({
  teachers,
  allSubjects,
  allLevels,
  allCities,
  initialCity = '',
  initialCursor = null,
  nextCursor = null,
  ratings,
  platformDomain,
}: ExploreFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [maxFee, setMaxFee] = useState('')
  const [openOnly, setOpenOnly] = useState(false)
  const [city, setCity] = useState(initialCity)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const lastTriggeredCursor = useRef<string | null>(initialCursor)

  // Update URL helper. Filter changes always reset the cursor.
  const updateUrl = (next: { city?: string; cursor?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString())
    if ('city' in next) {
      if (next.city) params.set('city', next.city)
      else params.delete('city')
    }
    if ('cursor' in next) {
      if (next.cursor) params.set('cursor', next.cursor)
      else params.delete('cursor')
    }
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/explore?${qs}` : '/explore', { scroll: false })
    })
  }

  const updateCityParam = (nextCity: string) => {
    setCity(nextCity)
    updateUrl({ city: nextCity, cursor: null })
  }

  // Infinite scroll: observe the sentinel; when visible, advance the cursor.
  useEffect(() => {
    if (!nextCursor) return
    const node = sentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            !isPending &&
            lastTriggeredCursor.current !== nextCursor
          ) {
            lastTriggeredCursor.current = nextCursor
            updateUrl({ cursor: nextCursor })
          }
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, isPending])

  const filtered = useMemo(() => {
    return teachers.filter((teacher) => {
      if (city) {
        const wanted = city.trim().toLowerCase()
        if (!teacher.city || teacher.city.trim().toLowerCase() !== wanted) {
          return false
        }
      }
      if (subject) {
        const hasSubject = teacher.subject_tags.some(
          (tag) => tag.toLowerCase() === subject.toLowerCase(),
        )
        if (!hasSubject) return false
      }
      if (level) {
        const hasLevel = teacher.teaching_levels.some(
          (lvl) => lvl.toLowerCase() === level.toLowerCase(),
        )
        if (!hasLevel) return false
      }
      if (maxFee) {
        const maxFeeNum = parseInt(maxFee, 10)
        if (!isNaN(maxFeeNum) && teacher.starting_fee_pkr > maxFeeNum) {
          return false
        }
      }
      if (openOnly && !teacher.has_open_cohorts) return false
      return true
    })
  }, [teachers, subject, level, maxFee, openOnly, city])

  const hasActiveFilters = subject || level || maxFee || openOnly || city

  return (
    <div>
      {/* Filter controls */}
      <div className="mb-8 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-city">City</Label>
          <Select
            value={city || '_all'}
            onValueChange={(v) => updateCityParam(v === '_all' ? '' : v)}
          >
            <SelectTrigger id="filter-city" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Cities</SelectItem>
              {allCities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-subject">Subject</Label>
          <Select
            value={subject || '_all'}
            onValueChange={(v) => setSubject(v === '_all' ? '' : v)}
          >
            <SelectTrigger id="filter-subject" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Subjects</SelectItem>
              {allSubjects.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-level">Level</Label>
          <Select
            value={level || '_all'}
            onValueChange={(v) => setLevel(v === '_all' ? '' : v)}
          >
            <SelectTrigger id="filter-level" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Levels</SelectItem>
              {allLevels.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-max-fee" className="text-sm font-medium text-foreground">
            Max Fee (PKR)
          </label>
          <input
            id="filter-max-fee"
            type="number"
            value={maxFee}
            onChange={(e) => setMaxFee(e.target.value)}
            placeholder="e.g., 5000"
            min="0"
            className="w-full sm:w-32 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2 pb-1">
          <input
            type="checkbox"
            id="filter-open-only"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
          />
          <label htmlFor="filter-open-only" className="text-sm text-foreground">
            Open cohorts only
          </label>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSubject('')
              setLevel('')
              setMaxFee('')
              setOpenOnly(false)
              updateCityParam('')
            }}
            className="pb-1 text-sm text-primary hover:text-primary/90 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="mb-4 text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'teacher' : 'teachers'} loaded
      </p>

      {/* Teacher grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-lg font-medium text-foreground">No teachers found</p>
          <p className="mt-1 text-sm text-muted-foreground">
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
              rating={ratings[teacher.id]}
            />
          ))}
        </div>
      )}

      {/* Infinite-scroll sentinel + status */}
      {nextCursor ? (
        <div
          ref={sentinelRef}
          className="mt-8 flex h-12 items-center justify-center text-sm text-muted-foreground"
        >
          {isPending ? 'Loading more teachers…' : 'Scroll for more'}
        </div>
      ) : teachers.length > 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          You've reached the end.
        </p>
      ) : null}
    </div>
  )
}
