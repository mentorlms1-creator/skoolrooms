// lib/lesson-plan/blocks/Callout.tsx
import type { Theme } from '../themes/types'

type Props = {
  theme: Theme
  children: React.ReactNode
  variant?: Theme['components']['callout']
}

export function Callout({ theme, children, variant }: Props) {
  const v = variant ?? theme.components.callout
  const base = {
    margin: `4px 0 ${theme.tokens.space.callout}`,
    padding: '8px 12px',
    color: theme.tokens.color.text,
    fontFamily: theme.tokens.font.body,
    fontSize: '.95em',
  }

  if (v === 'cream-card') {
    return <div style={{
      ...base,
      background: theme.tokens.color.surface === '#ffffff' ? '#fef9c3' : '#fef3c7',
      border: `1px solid ${theme.tokens.color.divider}`,
      borderRadius: '4px',
    }}>{children}</div>
  }

  if (v === 'dashed-box') {
    return <div style={{
      ...base,
      border: `1.5px dashed ${theme.tokens.color.muted}`,
      borderRadius: '4px',
    }}>{children}</div>
  }

  // tinted-left-border (default)
  return <div style={{
    ...base,
    borderLeft: `3px solid ${theme.tokens.color.primary}`,
    background: theme.tokens.color.surface === '#ffffff' ? '#fafafa' : theme.tokens.color.divider + '30',
    paddingLeft: '12px',
  }}>{children}</div>
}
