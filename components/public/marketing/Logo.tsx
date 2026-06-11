/**
 * components/public/marketing/Logo.tsx — Stacked SKOOL / ROOMS wordmark.
 * Server-compatible.
 */

import { Link } from 'next-view-transitions'
import { ROUTES } from '@/constants/routes'
import { C, FONT_HEAD } from './tokens'

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link
      href={ROUTES.PLATFORM.home}
      style={{ lineHeight: 1, fontFamily: FONT_HEAD, textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' }}
    >
      <div style={{ fontSize: 10, fontWeight: 400, letterSpacing: '0.22em', color: light ? 'rgba(255,255,255,0.6)' : C.purple }}>
        Skool
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.04em', color: light ? C.lime : C.dark, marginTop: -2 }}>
        Rooms
      </div>
    </Link>
  )
}
