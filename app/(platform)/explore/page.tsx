/**
 * app/(platform)/explore/page.tsx — Explore Page (Teacher Directory)
 *
 * Server Component with ISR (revalidates every hour).
 * Fetches explorable teachers and renders a filterable grid.
 */

import { getExplorableTeachers } from '@/lib/db/explore'
import { getTeacherRatingsMap } from '@/lib/db/feedback'
import { ExploreFilters } from '@/components/public/ExploreFilters'
import { PublicNavbar } from '@/components/public/PublicNavbar'
import { platformDomain } from '@/lib/platform/domain'

// ISR: revalidate every hour
export const revalidate = 3600

export const metadata = {
  title: 'Explore Teachers — Skool Rooms',
  description: 'Find the best tutors and teachers in Pakistan. Browse by subject, level, and fee range.',
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>
}) {
  const { city } = await searchParams
  const teachers = await getExplorableTeachers()
  const domain = platformDomain()

  // Fetch ratings for all teachers in one batch
  const ratingsMap = await getTeacherRatingsMap(teachers.map((t) => t.id))

  // Convert Map to plain Record for safe RSC → Client serialization
  const ratings: Record<string, { avg: number; count: number }> = {}
  for (const [id, agg] of ratingsMap) {
    ratings[id] = { avg: agg.avg, count: agg.count }
  }

  // Extract unique subjects, levels, and cities for filter dropdowns
  // (derived from the unfiltered set so the dropdown stays stable)
  const subjectSet = new Set<string>()
  const levelSet = new Set<string>()
  const citySet = new Set<string>()

  for (const teacher of teachers) {
    for (const tag of teacher.subject_tags) {
      subjectSet.add(tag)
    }
    for (const level of teacher.teaching_levels) {
      levelSet.add(level)
    }
    if (teacher.city) {
      const trimmed = teacher.city.trim()
      if (trimmed) citySet.add(trimmed)
    }
  }

  const allSubjects = [...subjectSet].sort()
  const allLevels = [...levelSet].sort()
  const allCities = [...citySet].sort()

  return (
    <div>
      <PublicNavbar />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Find a Teacher</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Browse our directory of teachers and tutors. Filter by subject, level, or fee range.
        </p>
      </div>

      {/* Client-side filterable teacher grid */}
      <ExploreFilters
        teachers={teachers}
        allSubjects={allSubjects}
        allLevels={allLevels}
        allCities={allCities}
        initialCity={city ?? ''}
        ratings={ratings}
        platformDomain={domain}
      />
      </main>
    </div>
  )
}
