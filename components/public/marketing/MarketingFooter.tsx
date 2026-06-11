/**
 * components/public/marketing/MarketingFooter.tsx — Dark footer strip.
 * Server-compatible. Privacy/Terms are placeholders (no pages yet) — they
 * render as plain text until those pages exist.
 */

import { Link } from 'next-view-transitions'
import { ROUTES } from '@/constants/routes'
import { FONT_BODY } from './tokens'
import { C } from './tokens'
import { Logo } from './Logo'

const LINKS: Array<{ label: string; href: string | null }> = [
  { label: 'Privacy', href: null },
  { label: 'Terms', href: null },
  { label: 'Pricing', href: ROUTES.PLATFORM.pricing },
  { label: 'Browse', href: ROUTES.PLATFORM.explore },
]

export function MarketingFooter() {
  return (
    <footer
      className="mk-px"
      style={{
        background: C.black,
        paddingTop: 40,
        paddingBottom: 40,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      <Logo light />
      <div style={{ display: 'flex', gap: 28 }}>
        {LINKS.map(({ label, href }) =>
          href ? (
            <Link key={label} href={href} className="mk-flink" style={{ fontSize: 12, fontFamily: FONT_BODY, textDecoration: 'none' }}>
              {label}
            </Link>
          ) : (
            <span key={label} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: FONT_BODY, cursor: 'default' }}>
              {label}
            </span>
          ),
        )}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: FONT_BODY }}>Made in Pakistan 🇵🇰</div>
    </footer>
  )
}
