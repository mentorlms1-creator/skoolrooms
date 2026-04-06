/**
 * app/(platform)/explore/page.tsx — Explore Page (Teacher Directory)
 *
 * Server Component with ISR (revalidates every hour).
 * Fetches explorable teachers and renders a filterable grid.
 */

import { getExplorableTeachers } from '@/lib/db/explore'
import { ExploreFilters } from '@/components/public/ExploreFilters'
import { PublicNavbar } from '@/components/public/PublicNavbar'
import { platformDomain } from '@/lib/platform/domain'

// ISR: revalidate every hour
export const revalidate = 3600

export const metadata = {
  title: 'Explore Teachers — Skool Rooms',
  description: 'Find the best tutors and teachers in Pakistan. Browse by subject, level, and fee range.',
}

export default async function ExplorePage() {
  const teachers = await getExplorableTeachers()
  const domain = platformDomain()

  // Extract unique subjects and levels for filter dropdowns
  const subjectSet = new Set<string>()
  const levelSet = new Set<string>()

  for (const teacher of teachers) {
    for (const tag of teacher.subject_tags) {
      subjectSet.add(tag)
    }
    for (const level of teacher.teaching_levels) {
      levelSet.add(level)
    }
  }

  const allSubjects = [...subjectSet].sort()
  const allLevels = [...levelSet].sort()

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
        platformDomain={domain}
      />
      </main>
    </div>
  )
}
