/**
 * app/(platform)/students/page.tsx — Student-facing marketing landing page.
 *
 * Server Component with ISR. The "Top Tutors This Month" section is wired to
 * real explorable teachers (most students first); it hides itself if no
 * teachers are live yet.
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import { ROUTES } from '@/constants/routes'
import { getExplorableTeacherIds, getExplorableTeacherDetails } from '@/lib/db/explore'
import { EXPLORE_PAGE_SIZE } from '@/lib/pagination/limits'
import { getTeacherRatingsMap } from '@/lib/db/feedback'
import { platformDomain } from '@/lib/platform/domain'
import { Btn } from '@/components/public/marketing/Btn'
import { MarketingFooter } from '@/components/public/marketing/MarketingFooter'
import { MarketingNav } from '@/components/public/marketing/MarketingNav'
import { WhatsAppButton } from '@/components/public/marketing/WhatsAppButton'
import { C, FONT_BODY, FONT_HEAD } from '@/components/public/marketing/tokens'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Find a Teacher — Skool Rooms',
  description:
    'Browse verified tutors across Pakistan. See real schedules, fees, and course outlines. Enroll and pay via JazzCash or EasyPaisa in 5 minutes.',
}

const SUBJECTS = [
  { label: 'Maths', icon: '➕', bg: '#B8F0FF', color: C.black },
  { label: 'Sciences', icon: '🔬', bg: C.lime, color: C.black },
  { label: 'English', icon: '📖', bg: '#FFD6F5', color: C.black },
  { label: 'Quran', icon: '☪️', bg: '#FFE8B0', color: C.black },
  { label: 'Coding', icon: '💻', bg: C.purple, color: C.white },
  { label: 'Art', icon: '🎨', bg: '#FFB8B8', color: C.black },
]

const STEPS = [
  { n: '01', t: 'Find Your Tutor', d: 'Browse by subject, city, or fee. See full course outlines and schedules.' },
  { n: '02', t: 'Pick Your Batch', d: 'Choose a timing that works for you. See how many slots are left.' },
  { n: '03', t: 'Pay & Start', d: "Send payment via JazzCash or EasyPaisa. Tutor confirms and you're in." },
]

const CARD_BGS = [C.purple, C.dark, '#222']

export default async function StudentsPage() {
  const domain = platformDomain()

  // Featured tutors — top 3 by student count from the first explore page.
  // Details hydration drops teachers without published courses, so fetch a
  // full page of candidates rather than just 3 IDs.
  const { rows } = await getExplorableTeacherIds({}, null, EXPLORE_PAGE_SIZE)
  const candidates = await getExplorableTeacherDetails(rows.map((r) => r.id))
  const featured = [...candidates].sort((a, b) => b.student_count - a.student_count).slice(0, 3)
  const ratingsMap = await getTeacherRatingsMap(featured.map((t) => t.id))

  const eyebrow: React.CSSProperties = { fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.purple, fontFamily: FONT_BODY, fontWeight: 600, marginBottom: 10 }
  const h2: React.CSSProperties = { fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(1.8rem,3vw,2.8rem)', textTransform: 'uppercase', color: C.black, lineHeight: 1.1 }

  return (
    <div style={{ background: C.white }}>
      <MarketingNav variant="student" />

      {/* ── HERO ── */}
      <section className="mk-px mk-cols-2" style={{ paddingTop: 80, background: C.white, maxWidth: 1200, margin: '0 auto', minHeight: '85vh' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,87,252,0.08)', border: '1px solid rgba(124,87,252,0.2)', borderRadius: 50, padding: '7px 18px', marginBottom: 28 }}>
            <span style={{ color: C.purple, fontSize: 11, fontFamily: FONT_BODY, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>🇵🇰 Pakistan&apos;s Top Tutors, One Platform</span>
          </div>
          <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(2.4rem,5vw,4.2rem)', color: C.black, lineHeight: 1.04, textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 20 }}>
            Find the Right<br />Teacher.<br />
            <span style={{ color: C.purple }}>Actually Learn.</span>
          </h1>
          <p style={{ fontFamily: FONT_BODY, fontSize: 16, fontWeight: 300, color: '#666', lineHeight: 1.8, marginBottom: 36, maxWidth: 440 }}>
            Browse verified tutors across Pakistan. See real schedules, fees, and course outlines. Enroll and pay via JazzCash or EasyPaisa — done in 5 minutes.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 40 }}>
            <Btn variant="purple" size="lg" href={ROUTES.PLATFORM.explore}>Browse Teachers →</Btn>
            <Btn variant="ghost" size="lg" href="#how-it-works">How It Works</Btn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex' }}>
              {[C.purple, C.dark, '#FF6B9D', '#FFB347', '#4FC3F7'].map((c, i) => (
                <div key={c} style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: '2.5px solid #fff', marginLeft: i === 0 ? 0 : -10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.white, fontFamily: FONT_HEAD }}>
                  {['HR', 'AM', 'ZK', 'SF', 'NB'][i]}
                </div>
              ))}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: '#888' }}>
              <strong style={{ color: C.black }}>1,200+ students</strong> already enrolled
            </div>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="mk-hero-visual" style={{ position: 'relative', height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.white, border: '2px solid #eee', borderRadius: 20, padding: 28, width: 300, boxShadow: '0 24px 60px rgba(0,0,0,0.08)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-45%, -50%)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 900, color: C.white, fontSize: 18, marginBottom: 14 }}>SA</div>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 18, color: C.black, textTransform: 'uppercase' }}>Sara Ahmed</div>
            <div style={{ fontSize: 13, color: C.purple, fontFamily: FONT_BODY, marginBottom: 16 }}>Maths Tutor · Lahore</div>
            {[['Next Batch', 'July 10'], ['Fee', 'Rs. 3,500/mo'], ['Slots Left', '4']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', padding: '9px 0' }}>
                <span style={{ color: '#aaa', fontSize: 12, fontFamily: FONT_BODY }}>{k}</span>
                <span style={{ color: C.black, fontWeight: 600, fontSize: 12, fontFamily: FONT_BODY }}>{v}</span>
              </div>
            ))}
            <Btn variant="purple" size="sm" asSpan style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}>Enroll Now</Btn>
          </div>
          <div style={{ position: 'absolute', top: 40, right: 10, background: C.lime, borderRadius: 12, padding: '10px 16px', fontSize: 12, fontWeight: 600, fontFamily: FONT_BODY, color: C.black, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}>✓ Verified Tutor</div>
          <div style={{ position: 'absolute', bottom: 110, left: 0, background: C.dark, borderRadius: 12, padding: '10px 16px', fontSize: 12, fontWeight: 600, fontFamily: FONT_BODY, color: C.white, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', whiteSpace: 'nowrap' }}>⭐ 4.9 · 34 reviews</div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="mk-px" style={{ background: C.purple, paddingTop: 48, paddingBottom: 48, display: 'flex', justifyContent: 'center', gap: 80, flexWrap: 'wrap', marginTop: 60 }}>
        {[['340+', 'Verified Tutors'], ['20+', 'Subjects'], ['1,200+', 'Students Enrolled'], ['5 min', 'To Enroll']].map(([n, l]) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: '2.8rem', color: C.lime, lineHeight: 1 }}>{n}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6, letterSpacing: '0.08em', fontFamily: FONT_BODY }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── BROWSE BY SUBJECT ── */}
      <section className="mk-px" style={{ paddingTop: 100, paddingBottom: 100, maxWidth: 1200, margin: '0 auto' }}>
        <div style={eyebrow}>Explore</div>
        <h2 style={{ ...h2, marginBottom: 48 }}>
          Browse by <span style={{ color: C.purple }}>Subject</span>
        </h2>
        <div className="mk-grid-6" style={{ gap: 16 }}>
          {SUBJECTS.map((s) => (
            <Link
              key={s.label}
              href={ROUTES.PLATFORM.explore}
              className="mk-lift-lg"
              style={{ background: s.bg, borderRadius: 20, padding: '36px 16px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative', minHeight: 140, justifyContent: 'flex-end', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', textDecoration: 'none' }}
            >
              <div style={{ position: 'absolute', top: -10, fontSize: '2.2rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))' }}>{s.icon}</div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', color: s.color, letterSpacing: '0.03em', textAlign: 'center' }}>{s.label}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── FEATURED TUTORS (real data) ── */}
      {featured.length > 0 && (
        <section className="mk-px" style={{ background: C.offwhite, paddingTop: 100, paddingBottom: 100 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48, flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={eyebrow}>Featured</div>
                <h2 style={h2}>
                  Top Tutors <span style={{ color: C.purple }}>This Month</span>
                </h2>
              </div>
              <Btn variant="purple" href={ROUTES.PLATFORM.explore}>See All Tutors →</Btn>
            </div>
            <div className="mk-grid-3" style={{ gap: 20 }}>
              {featured.map((t, i) => {
                const rating = ratingsMap.get(t.id)
                return (
                  <a
                    key={t.id}
                    href={`https://${t.subdomain}.${domain}`}
                    className="mk-lift"
                    style={{ background: CARD_BGS[i % CARD_BGS.length], borderRadius: 20, padding: '32px 28px', position: 'relative', overflow: 'hidden', minHeight: 220, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', textDecoration: 'none' }}
                  >
                    <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: C.white, opacity: 0.06, top: -60, right: -60 }} />
                    <div style={{ position: 'absolute', top: 24, right: 24, background: C.lime, color: C.black, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 12, padding: '5px 14px', borderRadius: 50 }}>
                      {t.student_count} {t.student_count === 1 ? 'student' : 'students'}
                    </div>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 900, color: C.white, fontSize: 16, marginBottom: 14 }}>
                      {t.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 20, color: C.white, textTransform: 'uppercase' }}>{t.name}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: FONT_BODY, marginTop: 4, marginBottom: 4 }}>
                      {[t.subject_tags[0], t.city].filter(Boolean).join(' · ') || 'Tutor'}
                    </div>
                    <div style={{ fontSize: 13, color: C.lime, fontFamily: FONT_BODY, fontWeight: 600 }}>
                      Rs. {t.starting_fee_pkr.toLocaleString('en-PK')}
                      {rating && rating.count > 0 ? ` · ⭐ ${rating.avg.toFixed(1)}` : ''}
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="mk-px" style={{ paddingTop: 100, paddingBottom: 100, maxWidth: 1200, margin: '0 auto' }}>
        <div style={eyebrow}>Simple Process</div>
        <h2 style={{ ...h2, marginBottom: 56 }}>
          Enrolled in <span style={{ color: C.purple }}>3 Steps</span>
        </h2>
        <div className="mk-grid-3" style={{ gap: 24 }}>
          {STEPS.map((s) => (
            <div key={s.n} className="mk-border-hover mk-border-hover-purple" style={{ background: C.offwhite, borderRadius: 20, padding: '36px 28px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 16, right: 20, fontFamily: FONT_HEAD, fontWeight: 900, fontSize: '5rem', color: C.purple, opacity: 0.07, lineHeight: 1 }}>{s.n}</div>
              <div style={{ background: C.purple, width: 44, height: 4, borderRadius: 2, marginBottom: 24 }} />
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 17, textTransform: 'uppercase', color: C.black, marginBottom: 10 }}>{s.t}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 300, color: '#666', lineHeight: 1.75 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section className="mk-px" style={{ paddingBottom: 100, maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ background: C.lime, borderRadius: 24, padding: 'clamp(32px, 5vw, 56px) clamp(24px, 6vw, 64px)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: 40, top: 20, fontFamily: FONT_HEAD, fontWeight: 900, fontSize: '11rem', color: 'rgba(70,54,153,0.08)', lineHeight: 1, pointerEvents: 'none' }}>&quot;</div>
          <h3 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(1.4rem,2.5vw,2rem)', color: C.black, textTransform: 'uppercase', lineHeight: 1.35, marginBottom: 32, maxWidth: 640 }}>
            &quot;Found a chemistry tutor, saw her full course outline, enrolled and paid via EasyPaisa. Took me 5 minutes total.&quot;
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 900, color: C.white, fontSize: 16 }}>HR</div>
            <div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 15, textTransform: 'uppercase' }}>Hamza Raza</div>
              <div style={{ fontSize: 13, color: '#555', fontFamily: FONT_BODY }}>O-Level Student · Karachi</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mk-px" style={{ background: C.black, paddingTop: 100, paddingBottom: 100, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: C.purple, opacity: 0.07, top: -150, right: -100 }} />
        <h2 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(2rem,4vw,3.5rem)', color: C.white, textTransform: 'uppercase', marginBottom: 16, lineHeight: 1.1 }}>
          Your teacher is<br /><span style={{ color: C.lime }}>already here.</span>
        </h2>
        <p style={{ fontFamily: FONT_BODY, color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 40 }}>Browse for free. Enroll in 5 minutes.</p>
        <Btn variant="lime" size="lg" href={ROUTES.PLATFORM.explore}>Find My Teacher →</Btn>
      </section>

      <MarketingFooter />
      <WhatsAppButton />
    </div>
  )
}
