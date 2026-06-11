'use client'

/**
 * components/public/marketing/Btn.tsx — Pill button from the marketing design.
 *
 * Renders a Link when `href` is given, a plain styled <span> when `asSpan`
 * is set (for buttons nested inside a larger clickable Link, e.g. the entry
 * split-screen panels), otherwise a <button>.
 */

import { useState } from 'react'
import { Link } from 'next-view-transitions'
import { C, FONT_BODY } from './tokens'

type BtnVariant = 'purple' | 'lime' | 'dark' | 'ghost' | 'white' | 'ghost-white'

type BtnProps = {
  children: React.ReactNode
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  href?: string
  asSpan?: boolean
  style?: React.CSSProperties
}

const VARIANTS: Record<BtnVariant, React.CSSProperties> = {
  purple: { background: C.purple, color: C.white },
  lime: { background: C.lime, color: C.black },
  dark: { background: C.dark, color: C.white },
  ghost: { background: 'transparent', color: C.dark, border: `2px solid ${C.dark}` },
  white: { background: C.white, color: C.dark },
  'ghost-white': { background: 'transparent', color: C.white, border: '2px solid rgba(255,255,255,0.4)' },
}

export function Btn({ children, variant = 'purple', size = 'md', href, asSpan, style = {} }: BtnProps) {
  const [hov, setHov] = useState(false)
  const pad = size === 'lg' ? '16px 36px' : size === 'sm' ? '9px 20px' : '12px 26px'
  const fs = size === 'lg' ? 16 : size === 'sm' ? 12 : 14

  const css: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: pad,
    borderRadius: 50,
    border: 'none',
    fontFamily: FONT_BODY,
    fontSize: fs,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'transform 0.18s, box-shadow 0.18s',
    transform: hov ? 'translateY(-2px)' : 'translateY(0)',
    boxShadow: hov ? '0 8px 24px rgba(0,0,0,0.18)' : 'none',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    ...VARIANTS[variant],
    ...style,
  }

  const hoverProps = {
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
  }

  if (href) {
    // In-page anchors (#how-it-works) need a plain <a>; routes use Link.
    if (href.startsWith('#')) {
      return (
        <a href={href} style={css} {...hoverProps}>{children}</a>
      )
    }
    return (
      <Link href={href} style={css} {...hoverProps}>{children}</Link>
    )
  }

  if (asSpan) {
    return <span style={css} {...hoverProps}>{children}</span>
  }

  return (
    <button type="button" style={css} {...hoverProps}>{children}</button>
  )
}
