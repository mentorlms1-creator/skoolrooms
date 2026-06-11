/**
 * app/(platform)/pricing/page.tsx — Pricing page (marketing design).
 * Server Component. Free / Solo / Academy plan cards; all CTAs → signup.
 */

import type { Metadata } from 'next'
import { ROUTES } from '@/constants/routes'
import { platformDomain } from '@/lib/platform/domain'
import { Btn } from '@/components/public/marketing/Btn'
import { MarketingFooter } from '@/components/public/marketing/MarketingFooter'
import { MarketingNav } from '@/components/public/marketing/MarketingNav'
import { WhatsAppButton } from '@/components/public/marketing/WhatsAppButton'
import { C, FONT_BODY, FONT_HEAD } from '@/components/public/marketing/tokens'

export const metadata: Metadata = {
  title: 'Pricing — Skool Rooms',
  description: 'Simple, transparent pricing for Skool Rooms. Start free, upgrade when you grow. No hidden fees, no commissions.',
}

const INCLUDED = ['Your Branded Link', 'Screenshot Payments', 'Student Enrollment Flow', 'Course Materials Upload', 'Mobile-Friendly', 'No Setup Fees', 'Cancel Anytime']

export default function PricingPage() {
  const domain = platformDomain()

  const plans = [
    {
      name: 'Free', price: 'Rs. 0', period: 'Forever',
      features: ['1 course', '15 students', '1 active cohort', '500 MB storage', `yourname.${domain}`, 'Screenshot payment verification', 'Basic support'],
      cta: 'Get Started', popular: false,
    },
    {
      name: 'Solo', price: 'Rs. 1,999', period: '/month',
      features: ['5 courses', '50 students', 'Unlimited cohorts', '2 GB storage', 'Branded subdomain', 'Analytics dashboard', 'WhatsApp notifications', 'Priority support'],
      cta: 'Start 14-Day Trial', popular: true,
    },
    {
      name: 'Academy', price: 'Rs. 3,999', period: '/month',
      features: ['Unlimited courses', '200 students', 'Unlimited cohorts', '10 GB storage', 'Multi-teacher support', 'Advanced analytics', 'Custom domain (coming)', 'Dedicated support'],
      cta: 'Start 14-Day Trial', popular: false,
    },
  ]

  return (
    <div style={{ background: C.white }}>
      <MarketingNav variant="teacher" />

      {/* ── Hero ── */}
      <section className="mk-px" style={{ background: `linear-gradient(160deg, ${C.dark} 0%, ${C.purple} 100%)`, paddingTop: 80, paddingBottom: 96, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: C.lime, opacity: 0.06, top: -120, right: -80 }} />
        <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(193,245,57,0.7)', fontFamily: FONT_BODY, fontWeight: 600, marginBottom: 16 }}>Pricing</div>
        <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(2.2rem,5vw,4rem)', color: C.white, textTransform: 'uppercase', lineHeight: 1.05, marginBottom: 16 }}>
          Start Free.<br /><span style={{ color: C.lime }}>Scale Your Way.</span>
        </h1>
        <p style={{ fontFamily: FONT_BODY, color: 'rgba(255,255,255,0.65)', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
          No hidden fees. No commissions. Just your platform, your students, your income.
        </p>
      </section>

      {/* ── Plans ── */}
      <section className="mk-px" style={{ paddingTop: 80, paddingBottom: 80, maxWidth: 1100, margin: '0 auto' }}>
        <div className="mk-grid-3" style={{ gap: 20 }}>
          {plans.map((p) => (
            <div key={p.name} className="mk-lift-lg" style={{ borderRadius: 20, padding: '40px 32px', border: `2px solid ${p.popular ? C.lime : '#eee'}`, background: p.popular ? C.black : C.white, position: 'relative' }}>
              {p.popular && (
                <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', background: C.lime, color: C.black, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 11, padding: '5px 18px', borderRadius: 50, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                  ⚡ Most Popular
                </div>
              )}
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.15em', color: p.popular ? C.lime : C.purple, marginBottom: 10 }}>{p.name}</div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: '2.8rem', color: p.popular ? C.white : C.black, lineHeight: 1, marginBottom: 4 }}>{p.price}</div>
              <div style={{ fontSize: 13, color: p.popular ? 'rgba(255,255,255,0.45)' : '#aaa', marginBottom: 32, fontFamily: FONT_BODY }}>{p.period}</div>
              <ul style={{ listStyle: 'none', marginBottom: 36, padding: 0 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: `1px solid ${p.popular ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}` }}>
                    <span style={{ color: p.popular ? C.lime : C.purple, fontWeight: 700, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: p.popular ? 'rgba(255,255,255,0.75)' : '#555', fontFamily: FONT_BODY }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Btn variant={p.popular ? 'lime' : 'purple'} href={ROUTES.PLATFORM.signup} style={{ width: '100%', justifyContent: 'center' }}>{p.cta}</Btn>
              {!p.popular && <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 10, fontFamily: FONT_BODY }}>No card required</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Compare strip ── */}
      <section className="mk-px" style={{ background: C.offwhite, paddingTop: 60, paddingBottom: 60 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h3 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: C.black, marginBottom: 32 }}>All Plans Include</h3>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 16 }}>
            {INCLUDED.map((f) => (
              <div key={f} style={{ background: C.white, border: '1px solid #eee', borderRadius: 50, padding: '10px 22px', fontSize: 13, fontFamily: FONT_BODY, fontWeight: 500, color: C.dark, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: C.purple }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="mk-px" style={{ paddingTop: 80, paddingBottom: 80, textAlign: 'center' }}>
        <h2 style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,3rem)', color: C.black, textTransform: 'uppercase', marginBottom: 16 }}>
          Still not sure? <span style={{ color: C.purple }}>Start Free.</span>
        </h2>
        <p style={{ fontFamily: FONT_BODY, color: '#888', fontSize: 15, marginBottom: 36 }}>No card, no commitment. Upgrade only when you&apos;re ready.</p>
        <Btn variant="purple" size="lg" href={ROUTES.PLATFORM.signup}>Get Started Free →</Btn>
      </section>

      <MarketingFooter />
      <WhatsAppButton />
    </div>
  )
}
