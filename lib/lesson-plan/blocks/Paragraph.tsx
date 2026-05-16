// lib/lesson-plan/blocks/Paragraph.tsx
import type { Theme } from '../themes/types'
import { stripInline } from '../inline'

export function Paragraph({ text, theme }: { text: string; theme: Theme }) {
  return (
    <p style={{
      fontFamily: theme.tokens.font.body,
      color: theme.tokens.color.text,
      margin: `0 0 ${theme.tokens.space.paragraph}`,
      lineHeight: 1.55,
    }}>{stripInline(text)}</p>
  )
}
