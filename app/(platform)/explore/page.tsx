/**
 * app/(platform)/explore/page.tsx — Explore Page (Teacher Directory)
 *
 * Server Component with ISR (revalidates every hour), now in the marketing
 * design. Cursor-paginated: 24 cards per page, infinite scroll on the client
 * (see components/public/marketing/ExploreBrowse.tsx).
 */

import {
  getExplorableTeacherIds,
  getExplorableTeacherDetails,
  getExploreFacets,
} from '@/lib/db/explore'
import { getTeacherRatingsMap } from '@/lib/db/feedback'
import { ROUTES } from '@/constants/routes'
import { Btn } from '@/components/public/marketing/Btn'
import { ExploreBrowse } from '@/components/public/marketing/ExploreBrowse'
import { MarketingFooter } from '@/components/public/marketing/MarketingFooter'
import { MarketingNav } from '@/components/public/marketing/MarketingNav'
import { WhatsAppButton } from '@/components/public/marketing/WhatsAppButton'
import { C, FONT_BODY, FONT_HEAD } from '@/components/public/marketing/tokens'
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
    <div style={{ background: C.white, minHeight: '100vh' }}>
      <MarketingNav variant="student" />

      <ExploreBrowse
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

      {/* ── Are you a tutor? ── */}
      <section className="mk-px" style={{ background: C.offwhite, paddingTop: 60, paddingBottom: 60, textAlign: 'center' }}>
        <h3 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: C.black, marginBottom: 12 }}>
          Are You a Tutor?
        </h3>
        <p style={{ fontFamily: FONT_BODY, color: '#888', fontSize: 14, marginBottom: 24 }}>
          List your courses for free and reach hundreds of students.
        </p>
        <Btn variant="purple" href={ROUTES.PLATFORM.teachers}>Build Your Skool Room →</Btn>
      </section>

      <MarketingFooter />
      <WhatsAppButton />
    </div>
  )
}
