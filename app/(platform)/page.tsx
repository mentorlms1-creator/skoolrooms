/**
 * app/(platform)/page.tsx — Entry split screen for skoolrooms.com
 *
 * Teacher panel → /teachers, Student panel → /students. The grow/shrink
 * hover animation is pure CSS (.mk-split/.mk-panel in globals.css) so this
 * stays a Server Component.
 */

import type { Metadata } from 'next'
import { Link } from 'next-view-transitions'
import { ROUTES } from '@/constants/routes'
import { Btn } from '@/components/public/marketing/Btn'
import { C, FONT_BODY, FONT_HEAD } from '@/components/public/marketing/tokens'

export const metadata: Metadata = {
  title: 'Skool Rooms — Your Classroom, Your Brand',
  description:
    'Teachers: get a branded online classroom with courses, students, and payments. Students: find verified tutors across Pakistan and enroll in minutes.',
}

const panelBase: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: '60px 40px',
  position: 'relative',
  overflow: 'hidden',
  textDecoration: 'none',
}

export default function EntryPage() {
  return (
    <div className="mk-split" style={{ position: 'relative', fontFamily: FONT_HEAD, overflow: 'hidden', background: C.black }}>
      {/* Centre logo */}
      <div style={{ position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 30, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Skool</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.lime, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rooms</div>
      </div>

      {/* Divider */}
      <div className="mk-split-divider" style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.12)', zIndex: 10 }} />
      <div className="mk-split-divider" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 20, background: C.black, border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
        OR
      </div>

      {/* TEACHER PANEL */}
      <Link
        href={ROUTES.PLATFORM.teachers}
        className="mk-panel"
        style={{ ...panelBase, background: `linear-gradient(145deg, ${C.dark} 0%, ${C.purple} 100%)` }}
      >
        {/* Deco */}
        <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: C.lime, opacity: 0.08, bottom: -100, left: -80 }} />
        <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', background: C.white, opacity: 0.05, top: 60, right: 40 }} />

        <div style={{ background: 'rgba(193,245,57,0.15)', border: '1px solid rgba(193,245,57,0.3)', borderRadius: 50, padding: '6px 18px', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.lime, fontFamily: FONT_BODY, fontWeight: 600, marginBottom: 24 }}>
          For Educators
        </div>

        <h2 style={{ fontSize: 'clamp(2rem,4.5vw,3.6rem)', fontWeight: 900, color: C.white, textTransform: 'uppercase', lineHeight: 1.05, textAlign: 'center', marginBottom: 14 }}>
          Build Your<br /><span style={{ color: C.lime }}>Skool Room</span>
        </h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 260, lineHeight: 1.7, marginBottom: 36 }}>
          Your brand. Your students. Your income. No tech headache.
        </p>
        <Btn variant="lime" size="lg" asSpan>I&apos;m a Teacher →</Btn>

        <div style={{ position: 'absolute', bottom: 24, left: 24, fontFamily: FONT_BODY, fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Tutors · Academies · Coaches
        </div>
      </Link>

      {/* STUDENT PANEL */}
      <Link
        href={ROUTES.PLATFORM.students}
        className="mk-panel"
        style={{ ...panelBase, background: C.white }}
      >
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: C.purple, opacity: 0.05, top: -80, right: -60 }} />
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: C.lime, opacity: 0.12, bottom: 30, left: 40 }} />

        <div style={{ background: 'rgba(124,87,252,0.08)', border: '1px solid rgba(124,87,252,0.2)', borderRadius: 50, padding: '6px 18px', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.purple, fontFamily: FONT_BODY, fontWeight: 600, marginBottom: 24 }}>
          For Learners
        </div>

        <h2 style={{ fontSize: 'clamp(2rem,4.5vw,3.6rem)', fontWeight: 900, color: C.black, textTransform: 'uppercase', lineHeight: 1.05, textAlign: 'center', marginBottom: 14, fontFamily: FONT_HEAD }}>
          Find a<br /><span style={{ color: C.purple }}>Teacher</span>
        </h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 300, color: '#777', textAlign: 'center', maxWidth: 260, lineHeight: 1.7, marginBottom: 36 }}>
          Browse verified tutors. Enroll and pay in 5 minutes.
        </p>
        <Btn variant="purple" size="lg" asSpan>I&apos;m a Student →</Btn>

        <div style={{ position: 'absolute', bottom: 24, right: 24, fontFamily: FONT_BODY, fontSize: 10, color: '#ccc', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Students · Parents · Learners
        </div>
      </Link>
    </div>
  )
}
