/**
 * app/(platform)/explore/page.tsx — Explore Page (Teacher Directory)
 *
 * Server Component with ISR (revalidates every hour).
 * Cursor-paginated: 24 cards per page, infinite scroll on the client.
 */

import {
  getExplorableTeacherIds,
  getExplorableTeacherDetails,
  getExploreFacets,
} from '@/lib/db/explore'
import { getTeacherRatingsMap } from '@/lib/db/feedback'
import { ExploreFilters } from '@/components/public/ExploreFilters'
import { PublicNavbar } from '@/components/public/PublicNavbar'
import { platformDomain } from '@/lib/platform/domain'
import { EXPLORE_PAGE_SIZE } from '@/lib/pagination/limits'

// ISR: revalidate every hour. `unstable_cache` tags handle finer-grained
// invalidation when teachers/courses/feedback change.
export const revalidate = 3600

export const metadata = {
  title: 'Explore Teachers — Skool Rooms',
  description:
    'Find the best tutors and teachers in Pakistan. Browse by subject, level, and fee range.',
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; cursor?: string }>
}) {
  const { city, cursor } = await searchParams
  const filters = city ? { city } : {}

  const [{ rows: idRows, nextCursor }, facets] = await Promise.all([
    getExplorableTeacherIds(filters, cursor ?? null, EXPLORE_PAGE_SIZE),
    getExploreFacets(),
  ])

  const teachers = await getExplorableTeacherDetails(idRows.map((r) => r.id))
  const ratingsMap = await getTeacherRatingsMap(teachers.map((t) => t.id))

  const ratings: Record<string, { avg: number; count: number }> = {}
  for (const [id, agg] of ratingsMap) {
    ratings[id] = { avg: agg.avg, count: agg.count }
  }

  const domain = platformDomain()

  return (
    <div>
      <PublicNavbar />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Find a Teacher</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Browse our directory of teachers and tutors. Filter by subject, level, or fee range.
          </p>
        </div>

        <ExploreFilters
          teachers={teachers}
          allSubjects={facets.subjects}
          allLevels={facets.levels}
          allCities={facets.cities}
          initialCity={city ?? ''}
          initialCursor={cursor ?? null}
          nextCursor={nextCursor}
          ratings={ratings}
          platformDomain={domain}
        />
      </main>
    </div>
  )
}
