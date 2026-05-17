// lib/lesson-plan/blocks/Divider.tsx
import type { Theme } from '../themes/types'

export function Divider({ theme }: { theme: Theme }) {
  const variant = theme.components.divider
  if (variant === 'ornament') {
    return (
      <div style={{
        textAlign: 'center',
        margin: '16px 0',
        color: theme.tokens.color.muted,
        fontSize: '.8em',
        letterSpacing: '.5em',
      }}>✦ ✦ ✦</div>
    )
  }
  if (variant === 'shadow-band') {
    return (
      <div style={{
        height: '6px',
        margin: '20px 0',
        background: `linear-gradient(180deg, ${theme.tokens.color.divider}80, transparent)`,
      }} />
    )
  }
  return <hr style={{
    border: 'none',
    borderTop: `1px solid ${theme.tokens.color.divider}`,
    margin: '12px 0',
  }} />
}
