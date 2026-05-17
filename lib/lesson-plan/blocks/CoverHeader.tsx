// lib/lesson-plan/blocks/CoverHeader.tsx
import type { Theme } from '../themes/types'

type Props = {
  theme: Theme
  courseName: string
  teacherName: string
  title: string
  updatedAtPkt: string
  /** When 'assessment-sheet' or 'worksheet', themes can use name-class-date-strip variant. */
  docType: 'lesson-plan' | 'assessment-sheet' | 'worksheet'
}

export function CoverHeader(props: Props) {
  const { theme, courseName, teacherName, title, updatedAtPkt, docType } = props
  const variant = theme.components.coverHeader
  const isWorksheet = docType !== 'lesson-plan'
  // Worksheet content gets the name-class-date-strip when the theme picks it OR
  // when the doc type itself implies a worksheet (over-rides standard variant).
  const useNameStrip = variant === 'name-class-date-strip' || isWorksheet

  if (variant === 'cover-page-hero') {
    return (
      <header style={{
        textAlign: 'center',
        margin: '0 0 32px',
        paddingBottom: '20px',
        borderBottom: `1px solid ${theme.tokens.color.divider}`,
      }}>
        <div style={{ fontSize: '.8em', color: theme.tokens.color.muted, marginBottom: '6px' }}>
          {teacherName} · {courseName}
        </div>
        <h1 style={{
          fontFamily: theme.tokens.font.heading,
          color: theme.tokens.color.primary,
          fontSize: '1.8em',
          margin: '8px 0',
          fontWeight: 700,
        }}>{title}</h1>
        <div style={{ fontSize: '.75em', color: theme.tokens.color.muted, marginTop: '8px' }}>
          Last updated {updatedAtPkt} (PKT)
        </div>
      </header>
    )
  }

  if (useNameStrip) {
    return (
      <header style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '.8em', color: theme.tokens.color.muted }}>
          {teacherName} · {courseName}
        </div>
        <h1 style={{
          fontFamily: theme.tokens.font.heading,
          color: theme.tokens.color.primary,
          fontSize: '1.5em',
          margin: '4px 0 12px',
          fontWeight: 700,
        }}>{title}</h1>
        <div style={{
          padding: '8px 0',
          borderTop: `1.5px solid ${theme.tokens.color.divider}`,
          borderBottom: `1.5px solid ${theme.tokens.color.divider}`,
          fontFamily: theme.tokens.font.mono,
          fontSize: '.9em',
        }}>
          Name: ________________________ Class: _____ Section: _____ Date: __________
        </div>
        <div style={{ fontSize: '.7em', color: theme.tokens.color.muted, marginTop: '6px' }}>
          Generated {updatedAtPkt} (PKT)
        </div>
      </header>
    )
  }

  // standard variant
  return (
    <header style={{
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: `1px solid ${theme.tokens.color.divider}`,
    }}>
      <div style={{ fontSize: '.75em', color: theme.tokens.color.muted }}>
        {teacherName} · {courseName}
      </div>
      <h1 style={{
        fontFamily: theme.tokens.font.heading,
        color: theme.tokens.color.primary,
        fontSize: '1.4em',
        margin: '4px 0',
        fontWeight: 700,
      }}>{title}</h1>
      <div style={{ fontSize: '.7em', color: theme.tokens.color.muted, marginTop: '4px' }}>
        Last updated {updatedAtPkt} (PKT)
      </div>
    </header>
  )
}
