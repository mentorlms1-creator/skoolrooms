// lib/lesson-plan/blocks/List.tsx
import type { Theme } from '../themes/types'
import { stripInline } from '../inline'

type Item = { text: string; ordered: boolean; marks?: number }
type Props = { items: Item[]; theme: Theme }

export function List({ items, theme }: Props) {
  const ordered = items[0]?.ordered ?? false
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag style={{
      fontFamily: theme.tokens.font.body,
      color: theme.tokens.color.text,
      paddingLeft: '20px',
      margin: `0 0 ${theme.tokens.space.paragraph}`,
      lineHeight: 1.55,
    }}>
      {items.map((it, i) => (
        <li key={i} style={{ marginBottom: '4px' }}>{stripInline(it.text)}</li>
      ))}
    </Tag>
  )
}
