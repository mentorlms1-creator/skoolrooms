// lib/lesson-plan/blocks/Table.tsx
import type { Theme } from '../themes/types'
import { stripInline } from '../inline'

type Props = { header: string[]; rows: string[][]; theme: Theme }

export function Table({ header, rows, theme }: Props) {
  const borderColor = theme.tokens.color.divider
  return (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      margin: `8px 0 ${theme.tokens.space.paragraph}`,
      fontFamily: theme.tokens.font.body,
      fontSize: '.95em',
    }}>
      <thead>
        <tr>
          {header.map((h, i) => (
            <th key={i} style={{
              border: `1px solid ${borderColor}`,
              padding: '6px 8px',
              background: theme.tokens.color.divider + '40',
              textAlign: 'left',
              fontWeight: 600,
            }}>{stripInline(h)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {Array.from({ length: header.length }).map((_, j) => (
              <td key={j} style={{
                border: `1px solid ${borderColor}`,
                padding: '6px 8px',
              }}>{stripInline(row[j] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
