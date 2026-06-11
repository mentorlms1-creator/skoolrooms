'use client'

/**
 * components/public/marketing/ExploreBrowse.tsx — Brand-styled browse UI for
 * the explore page (hero + search + filter pills + tutor grid).
 *
 * Logic is carried over from the previous ExploreFilters component:
 * - City and cursor are URL-driven (deep-linkable, server-paginated).
 * - Search/subject/level/fee/open-only filter in-memory on the loaded set.
 * - Infinite scroll via IntersectionObserver sentinel advancing ?cursor=.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import type { ExplorableTeacher } from '@/lib/db/explore'
import { C, FONT_BODY, FONT_HEAD } from './tokens'

type ExploreBrowseProps = {
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

const CARD_BGS = [C.purple, C.dark, '#222', '#7B3F9E', '#1a1a2e', '#2d4a3e', '#3d2b1f', '#1e3a5f']

function pillStyle(active: boolean, activeBg: string, activeColor: string): React.CSSProperties {
  return {
    padding: '8px 18px',
    borderRadius: 50,
    border: `2px solid ${active ? activeBg : '#eee'}`,
    background: active ? activeBg : C.white,
    color: active ? activeColor : '#555',
    fontFamily: FONT_BODY,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }
}

export function ExploreBrowse({
  teachers,
  allSubjects,
  allLevels,
  allCities,
  initialCity = '',
  initialCursor = null,
  nextCursor = null,
  ratings,
  platformDomain,
}: ExploreBrowseProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
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
          if (entry.isIntersecting && !isPending && lastTriggeredCursor.current !== nextCursor) {
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
      if (search) {
        const q = search.trim().toLowerCase()
        const matchesName = teacher.name.toLowerCase().includes(q)
        const matchesSubject = teacher.subject_tags.some((tag) => tag.toLowerCase().includes(q))
        if (!matchesName && !matchesSubject) return false
      }
      if (city) {
        const wanted = city.trim().toLowerCase()
        if (!teacher.city || teacher.city.trim().toLowerCase() !== wanted) return false
      }
      if (subject) {
        const hasSubject = teacher.subject_tags.some((tag) => tag.toLowerCase() === subject.toLowerCase())
        if (!hasSubject) return false
      }
      if (level) {
        const hasLevel = teacher.teaching_levels.some((lvl) => lvl.toLowerCase() === level.toLowerCase())
        if (!hasLevel) return false
      }
      if (maxFee) {
        const maxFeeNum = parseInt(maxFee, 10)
        if (!isNaN(maxFeeNum) && teacher.starting_fee_pkr > maxFeeNum) return false
      }
      if (openOnly && !teacher.has_open_cohorts) return false
      return true
    })
  }, [teachers, search, subject, level, maxFee, openOnly, city])

  const filterLabel: React.CSSProperties = {
    fontFamily: FONT_BODY,
    fontSize: 12,
    fontWeight: 600,
    color: '#aaa',
    alignSelf: 'center',
    marginRight: 4,
  }

  return (
    <div>
      {/* ── BROWSE HERO ── */}
      <section className="mk-px" style={{ background: `linear-gradient(160deg, ${C.dark} 0%, ${C.purple} 100%)`, paddingTop: 64, paddingBottom: 80, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: C.lime, opacity: 0.06, top: -100, right: -80 }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(193,245,57,0.7)', fontFamily: FONT_BODY, fontWeight: 600, marginBottom: 14 }}>Find a Teacher</div>
          <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(2rem,4vw,3.5rem)', color: C.white, textTransform: 'uppercase', lineHeight: 1.05, marginBottom: 32 }}>
            {filtered.length} {filtered.length === 1 ? 'Tutor' : 'Tutors'} Available<br /><span style={{ color: C.lime }}>Right Now.</span>
          </h1>
          {/* Search bar */}
          <div style={{ display: 'flex', gap: 12, maxWidth: 700, flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or subject..."
              aria-label="Search tutors by name or subject"
              style={{ flex: 1, padding: '14px 20px', borderRadius: 50, border: 'none', fontFamily: FONT_BODY, fontSize: 14, outline: 'none', minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
            />
          </div>
        </div>
      </section>

      {/* ── FILTERS + GRID ── */}
      <section className="mk-px" style={{ paddingTop: 48, paddingBottom: 48, maxWidth: 1200, margin: '0 auto' }}>
        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
          {allSubjects.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={filterLabel}>SUBJECT:</span>
              {['', ...allSubjects].map((s) => (
                <button key={s || 'All'} type="button" onClick={() => setSubject(s)} style={pillStyle(subject === s, C.purple, C.white)}>
                  {s || 'All'}
                </button>
              ))}
            </div>
          )}
          {allCities.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={filterLabel}>CITY:</span>
              {['', ...allCities].map((c) => (
                <button key={c || 'All'} type="button" onClick={() => updateCityParam(c)} style={pillStyle(city === c, C.lime, C.black)}>
                  {c || 'All'}
                </button>
              ))}
            </div>
          )}
          {allLevels.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={filterLabel}>LEVEL:</span>
              {['', ...allLevels].map((l) => (
                <button key={l || 'All'} type="button" onClick={() => setLevel(l)} style={pillStyle(level === l, C.dark, C.white)}>
                  {l || 'All'}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={filterLabel}>MAX FEE:</span>
            <input
              type="number"
              value={maxFee}
              onChange={(e) => setMaxFee(e.target.value)}
              placeholder="e.g. 5000"
              min="0"
              aria-label="Maximum fee in PKR"
              style={{ width: 120, padding: '8px 16px', borderRadius: 50, border: '2px solid #eee', fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, outline: 'none', color: '#555' }}
            />
            <button type="button" onClick={() => setOpenOnly(!openOnly)} style={pillStyle(openOnly, C.purple, C.white)}>
              {openOnly ? '✓ ' : ''}Open cohorts only
            </button>
          </div>
        </div>

        {/* Results count */}
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: '#aaa', marginBottom: 28 }}>
          Showing <strong style={{ color: C.black }}>{filtered.length}</strong> {filtered.length === 1 ? 'tutor' : 'tutors'}
        </div>

        {/* Tutor grid */}
        <div className="mk-grid-4" style={{ gap: 18 }}>
          {filtered.map((t, i) => {
            const rating = ratings[t.id]
            return (
              <a
                key={t.id}
                href={`https://${t.subdomain}.${platformDomain}`}
                className="mk-lift"
                style={{ background: CARD_BGS[i % CARD_BGS.length], borderRadius: 20, padding: '28px 24px', position: 'relative', overflow: 'hidden', minHeight: 260, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', textDecoration: 'none' }}
              >
                <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', background: C.white, opacity: 0.05, top: -40, right: -40 }} />
                {rating && rating.count > 0 && (
                  <div style={{ position: 'absolute', top: 18, right: 18, background: C.lime, color: C.black, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 10, padding: '4px 10px', borderRadius: 50, textTransform: 'uppercase' }}>
                    ⭐ {rating.avg.toFixed(1)}
                  </div>
                )}
                {t.profile_photo_url ? (
                  <Image
                    src={t.profile_photo_url}
                    alt={t.name}
                    width={44}
                    height={44}
                    sizes="44px"
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', marginBottom: 12 }}
                  />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 900, color: C.white, fontSize: 14, marginBottom: 12 }}>
                    {t.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 16, color: C.white, textTransform: 'uppercase', lineHeight: 1.2 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT_BODY, margin: '4px 0' }}>
                  {[t.subject_tags.slice(0, 2).join(', '), t.city].filter(Boolean).join(' · ') || 'Tutor'}
                </div>
                <div style={{ fontSize: 12, color: C.lime, fontFamily: FONT_BODY, fontWeight: 600, marginBottom: 14 }}>
                  Rs. {t.starting_fee_pkr.toLocaleString('en-PK')} starting
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: FONT_BODY }}>
                    {t.has_open_cohorts ? 'Open for enrollment' : 'Not accepting students'}
                  </span>
                  {t.has_open_cohorts && (
                    <span style={{ background: C.lime, color: C.black, borderRadius: 50, padding: '7px 16px', fontSize: 11, fontWeight: 700, fontFamily: FONT_HEAD, whiteSpace: 'nowrap' }}>
                      Enroll →
                    </span>
                  )}
                </div>
              </a>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#bbb', fontFamily: FONT_BODY }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16 }}>No tutors found. Try a different filter.</div>
          </div>
        )}

        {/* Infinite-scroll sentinel + status */}
        {nextCursor ? (
          <div ref={sentinelRef} style={{ marginTop: 32, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#aaa', fontFamily: FONT_BODY }}>
            {isPending ? 'Loading more tutors…' : 'Scroll for more'}
          </div>
        ) : teachers.length > 0 ? (
          <p style={{ marginTop: 32, textAlign: 'center', fontSize: 13, color: '#aaa', fontFamily: FONT_BODY }}>
            You&apos;ve reached the end.
          </p>
        ) : null}
      </section>
    </div>
  )
}
