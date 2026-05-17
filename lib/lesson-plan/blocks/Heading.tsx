// lib/lesson-plan/blocks/Heading.tsx
import type { Theme } from '../themes/types'
import { stripInline } from '../inline'

type Props = { level: 1 | 2 | 3; text: string; theme: Theme }

export function Heading({ level, text, theme }: Props) {
  const t = stripInline(text)
  const style = {
    fontFamily: theme.tokens.font.heading,
    color: theme.tokens.color.primary,
    margin: level === 1 ? '0 0 12px' : level === 2 ? '14px 0 8px' : '12px 0 6px',
    fontSize: level === 1 ? '1.6rem' : level === 2 ? '1.2rem' : '1rem',
    fontWeight: 700,
    breakAfter: 'avoid' as const,
  }
  if (level === 1) return <h1 style={style}>{t}</h1>
  if (level === 2) return <h2 style={style}>{t}</h2>
  return <h3 style={style}>{t}</h3>
}
