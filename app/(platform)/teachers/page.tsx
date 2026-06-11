/**
 * app/(platform)/teachers/page.tsx — Teacher-facing marketing landing page.
 *
 * Server Component. Card hovers are CSS (mk-* classes); only the FAQ
 * accordion is a Client Component.
 */

import type { Metadata } from 'next'
import { ROUTES } from '@/constants/routes'
import { platformDomain } from '@/lib/platform/domain'
import { Btn } from '@/components/public/marketing/Btn'
import { FaqAccordion, type FaqItem } from '@/components/public/marketing/FaqAccordion'
import { MarketingFooter } from '@/components/public/marketing/MarketingFooter'
import { MarketingNav } from '@/components/public/marketing/MarketingNav'
import { WhatsAppButton } from '@/components/public/marketing/WhatsAppButton'
import { C, FONT_BODY, FONT_HEAD } from '@/components/public/marketing/tokens'

export const metadata: Metadata = {
  title: 'Skool Rooms for Teachers — Your Branded Online Classroom',
  description:
    'Stop sharing PDFs on WhatsApp. Get a branded classroom with course management, student enrollment, and direct JazzCash/EasyPaisa payments. Free to start.',
}

const MARQUEE_ITEMS = ['340+ Tutors', '1,200+ Students', 'JazzCash ✓', 'EasyPaisa ✓', 'Free to Start', 'Your Own Brand', 'Direct Payments', 'No Commission']

const STEPS = [
  { n: '01', t: 'Sign Up Free', d: 'Create your account in 2 minutes. No card, no commitment.' },
  { n: '02', t: 'Build Your Room', d: 'Set up your branded page, add courses, set your schedule and fees.' },
  { n: '03', t: 'Students Enroll', d: 'They find you, pay via JazzCash or EasyPaisa, and you teach.' },
]

const FAQS: FaqItem[] = [
  { q: 'Is it really free to start?', a: 'Yes. Free plan includes 1 course, 15 students, your branded subdomain. No card needed, no time limit.' },
  { q: 'How do I collect payments?', a: 'Students send payment via JazzCash, EasyPaisa, or bank transfer. You verify the screenshot manually and approve enrollment. Full control, zero commission.' },
  { q: 'What if a student sends a fake receipt?', a: 'You approve every enrollment manually before granting access. No payment verification = no access. Simple.' },
  { q: 'Can I add multiple teachers to my academy?', a: 'Yes — the Academy plan supports multi-teacher accounts with a shared admin dashboard.' },
  { q: 'Do students need an account?', a: 'Yes, a quick free signup so they can manage their enrollments and access course materials.' },
]

export default function TeachersPage() {
  const domain = platformDomain()

  const features = [
    { icon: '🏷️', title: 'Branded Subdomain', desc: `yourname.${domain} — live in minutes. Looks pro, feels yours.`, bg: C.lime, color: C.black },
    { icon: '📚', title: 'Course Management', desc: 'Cohorts, schedules, attendance, materials — all in one dashboard.', bg: C.purple, color: C.white },
    { icon: '💸', title: 'Direct Payments', desc: 'JazzCash, EasyPaisa, bank transfer. You get paid. No middleman.', bg: C.dark, color: C.white },
    { icon: '📊', title: 'Student Analytics', desc: "See who's active, who needs follow-up, and how your courses perform.", bg: C.black, color: C.lime },
  ]

  const eyebrow: React.CSSProperties = { fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.purple, fontFamily: FONT_BODY, fontWeight: 600, marginBottom: 10 }
  const h2: React.CSSProperties = { fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(1.8rem,3vw,2.8rem)', textTransform: 'uppercase', color: C.black, lineHeight: 1.1, marginBottom: 56 }

  return (
    <div style={{ background: C.white }}>
      <MarketingNav variant="teacher" />

      {/* ── HERO ── */}
      <section className="mk-px" style={{ background: `linear-gradient(160deg, ${C.dark} 0%, ${C.purple} 60%, #9B6FFF 100%)`, paddingTop: 80, position: 'relative', overflow: 'hidden', minHeight: '88vh', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: C.lime, opacity: 0.07, top: -150, right: -100 }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: C.white, opacity: 0.04, bottom: 0, left: 100 }} />

        <div className="mk-cols-2" style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(193,245,57,0.15)', border: '1px solid rgba(193,245,57,0.35)', borderRadius: 50, padding: '7px 18px', marginBottom: 28 }}>
              <span style={{ color: C.lime, fontSize: 11, fontFamily: FONT_BODY, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>🔥 Pakistan&apos;s First Tutor Platform</span>
            </div>

            <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(2.4rem,5vw,4.2rem)', color: C.white, lineHeight: 1.04, textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 20 }}>
              Stop Sharing<br />
              PDFs on<br />
              <span style={{ color: C.lime }}>WhatsApp.</span>
            </h1>
            <p style={{ fontFamily: FONT_BODY, fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, marginBottom: 36, maxWidth: 440 }}>
              Get your own branded classroom online. Manage courses, students, and payments like a real business — in minutes.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 40 }}>
              <Btn variant="lime" size="lg" href={ROUTES.PLATFORM.signup}>Build My Skool Room →</Btn>
              <Btn variant="ghost-white" size="lg" href="#how-it-works">See How It Works</Btn>
            </div>
            {/* Social proof */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex' }}>
                {[C.lime, C.purple, '#FF6B9D', '#FFB347', '#4FC3F7'].map((c, i) => (
                  <div key={c} style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: '2.5px solid rgba(255,255,255,0.3)', marginLeft: i === 0 ? 0 : -10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.white, fontFamily: FONT_HEAD }}>
                    {['SA', 'BR', 'HN', 'MK', 'ZA'][i]}
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                <strong style={{ color: C.white }}>340+ tutors</strong> already teaching here
              </div>
            </div>
          </div>

          {/* Right — Dashboard mockup */}
          <div className="mk-hero-visual" style={{ position: 'relative', height: 480 }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-40%,-50%)', background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: 28, width: 300, boxShadow: '0 32px 80px rgba(0,0,0,0.35)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>Your Classroom</div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 15, color: C.lime, marginBottom: 20 }}>sara.{domain}</div>
              {[['Active Students', '34 👥'], ['Courses Live', '3 📚'], ['Pending Payments', '2 ⏳'], ['This Month', 'Rs 28,000 💸']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 0' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: FONT_BODY }}>{k}</span>
                  <span style={{ color: C.white, fontWeight: 600, fontSize: 13, fontFamily: FONT_BODY }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', top: 40, right: 0, background: C.lime, borderRadius: 12, padding: '10px 16px', fontSize: 12, fontWeight: 600, fontFamily: FONT_BODY, color: C.black, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>🎉 New enrollment!</div>
            <div style={{ position: 'absolute', bottom: 100, left: 0, background: C.dark, borderRadius: 12, padding: '10px 16px', fontSize: 12, fontWeight: 600, fontFamily: FONT_BODY, color: C.white, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>💸 Payment received · Rs 3,500</div>
            <div style={{ position: 'absolute', top: '50%', right: -20, background: C.white, borderRadius: 12, padding: '10px 16px', fontSize: 12, fontWeight: 600, fontFamily: FONT_BODY, color: C.dark, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', whiteSpace: 'nowrap' }}>⭐ 4.9 · 34 reviews</div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div style={{ background: C.lime, padding: '14px 0', overflow: 'hidden', position: 'relative' }}>
        <div className="mk-marquee">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.black }}>
              {item} <span style={{ opacity: 0.3, margin: '0 8px' }}>●</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section className="mk-px" style={{ paddingTop: 100, paddingBottom: 100, maxWidth: 1200, margin: '0 auto' }}>
        <div style={eyebrow}>What You Get</div>
        <h2 style={h2}>
          Everything to run<br /><span style={{ color: C.purple }}>your teaching business</span>
        </h2>
        <div className="mk-grid-4" style={{ gap: 16 }}>
          {features.map((f) => (
            <div key={f.title} className="mk-lift" style={{ background: f.bg, borderRadius: 20, padding: '32px 24px', minHeight: 220, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 15, color: f.color, textTransform: 'uppercase', marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, fontFamily: FONT_BODY, fontWeight: 300, color: f.color, opacity: 0.8, lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="mk-px" style={{ background: C.offwhite, paddingTop: 100, paddingBottom: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={eyebrow}>Simple Process</div>
          <h2 style={h2}>
            Up and running<br /><span style={{ color: C.purple }}>in 3 steps</span>
          </h2>
          <div className="mk-grid-3" style={{ gap: 24 }}>
            {STEPS.map((s) => (
              <div key={s.n} className="mk-border-hover mk-border-hover-lime" style={{ background: C.white, borderRadius: 20, padding: '36px 28px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 16, right: 20, fontFamily: FONT_HEAD, fontWeight: 900, fontSize: '5rem', color: C.purple, opacity: 0.07, lineHeight: 1 }}>{s.n}</div>
                <div style={{ background: C.lime, width: 44, height: 4, borderRadius: 2, marginBottom: 24 }} />
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 17, textTransform: 'uppercase', color: C.black, marginBottom: 10 }}>{s.t}</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 300, color: '#666', lineHeight: 1.75 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section className="mk-px" style={{ paddingTop: 100, paddingBottom: 100, maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ background: C.lime, borderRadius: 24, padding: 'clamp(32px, 5vw, 56px) clamp(24px, 6vw, 64px)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: 40, top: 20, fontFamily: FONT_HEAD, fontWeight: 900, fontSize: '11rem', color: 'rgba(70,54,153,0.08)', lineHeight: 1, pointerEvents: 'none' }}>&quot;</div>
          <h3 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(1.4rem,2.5vw,2rem)', color: C.black, textTransform: 'uppercase', lineHeight: 1.35, marginBottom: 32, maxWidth: 640 }}>
            &quot;I went from sharing PDFs on WhatsApp to having a proper classroom online. Enrolled 18 students in my first month.&quot;
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_HEAD, fontWeight: 900, color: C.white, fontSize: 16 }}>SA</div>
            <div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 15, textTransform: 'uppercase' }}>Sara Ahmed</div>
              <div style={{ fontSize: 13, color: '#555', fontFamily: FONT_BODY }}>Maths Tutor · Lahore</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING CTA ── */}
      <section className="mk-px" style={{ background: `linear-gradient(135deg, ${C.dark} 0%, ${C.purple} 100%)`, paddingTop: 80, paddingBottom: 80, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: C.lime, opacity: 0.05, top: -150, right: -100 }} />
        <div style={{ fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(193,245,57,0.7)', fontFamily: FONT_BODY, fontWeight: 600, marginBottom: 14 }}>Pricing</div>
        <h2 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(2rem,4vw,3.2rem)', color: C.white, textTransform: 'uppercase', marginBottom: 16 }}>
          Start Free.<br /><span style={{ color: C.lime }}>Upgrade When You Grow.</span>
        </h2>
        <p style={{ fontFamily: FONT_BODY, color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 36 }}>Plans starting from Rs. 0</p>
        <Btn variant="lime" size="lg" href={ROUTES.PLATFORM.pricing}>See All Plans →</Btn>
      </section>

      {/* ── FAQ ── */}
      <section className="mk-px" style={{ paddingTop: 100, paddingBottom: 100 }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={eyebrow}>FAQ</div>
          <h2 style={{ ...h2, marginBottom: 40 }}>Common Questions</h2>
          <FaqAccordion faqs={FAQS} />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="mk-px" style={{ background: C.black, paddingTop: 100, paddingBottom: 100, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: C.purple, opacity: 0.08, top: -150, left: -100 }} />
        <h2 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(2rem,4vw,3.5rem)', color: C.white, textTransform: 'uppercase', marginBottom: 16, lineHeight: 1.1 }}>
          Your classroom is<br /><span style={{ color: C.lime }}>one click away.</span>
        </h2>
        <p style={{ fontFamily: FONT_BODY, color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 40 }}>Free forever. Upgrade when you grow. No card needed.</p>
        <Btn variant="lime" size="lg" href={ROUTES.PLATFORM.signup}>Build My Skool Room →</Btn>
      </section>

      <MarketingFooter />
      <WhatsAppButton />
    </div>
  )
}
