/**
 * components/public/marketing/MarketingNav.tsx — Sticky nav for marketing pages.
 *
 * Async Server Component. Link sets swap between the teacher-facing and
 * student-facing pages (matching the design). Session-aware: logged-in
 * visitors get a "Go to Dashboard" CTA instead of Start Free / Log In.
 */

import { Link } from 'next-view-transitions'
import { ROUTES } from '@/constants/routes'
import { getSessionDestination } from '@/lib/auth/session'
import { Btn } from './Btn'
import { Logo } from './Logo'
import { FONT_BODY } from './tokens'

type NavLink = { label: string; href: string }

const TEACHER_LINKS: NavLink[] = [
  { label: 'Home', href: ROUTES.PLATFORM.teachers },
  { label: 'Pricing', href: ROUTES.PLATFORM.pricing },
  { label: 'Find a Teacher', href: ROUTES.PLATFORM.students },
]

const STUDENT_LINKS: NavLink[] = [
  { label: 'Home', href: ROUTES.PLATFORM.students },
  { label: 'Browse', href: ROUTES.PLATFORM.explore },
  { label: 'Are you a tutor?', href: ROUTES.PLATFORM.teachers },
]

export async function MarketingNav({ variant }: { variant: 'teacher' | 'student' }) {
  const session = await getSessionDestination()
  const links = variant === 'teacher' ? TEACHER_LINKS : STUDENT_LINKS

  const linkStyle: React.CSSProperties = {
    color: '#555',
    fontSize: 13,
    fontFamily: FONT_BODY,
    fontWeight: 500,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }

  return (
    <nav
      className="mk-px"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #eee',
        paddingTop: 14,
        paddingBottom: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Logo />
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {links.map((l) => (
          <Link key={l.label} href={l.href} style={linkStyle} className="max-sm:hidden">
            {l.label}
          </Link>
        ))}
        {session ? (
          <Btn variant="purple" size="sm" href={session.href}>{session.label}</Btn>
        ) : variant === 'teacher' ? (
          <>
            <Link href={ROUTES.PLATFORM.login} style={linkStyle}>Log In</Link>
            <Btn variant="purple" size="sm" href={ROUTES.PLATFORM.signup}>Start Free</Btn>
          </>
        ) : (
          <>
            <Link href={ROUTES.PLATFORM.studentLogin} style={linkStyle}>Log In</Link>
            <Btn variant="purple" size="sm" href={ROUTES.PLATFORM.explore}>Browse Teachers</Btn>
          </>
        )}
      </div>
    </nav>
  )
}
