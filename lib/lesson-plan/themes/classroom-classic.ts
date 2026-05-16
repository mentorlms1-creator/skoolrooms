// =============================================================================
// Classroom Classic — Notion-derived neutral default.
// Sans-serif, slate accent, restrained color. Safe for any subject.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const classroomClassic: Theme = {
  slug: 'classroom-classic',
  name: 'Classroom Classic',
  description: 'Neutral, sans serif, slate accent — safe default for any subject.',
  tokens: {
    color: {
      primary: '#37352f',
      accent:  '#1e3a8a',
      text:    '#37352f',
      muted:   '#787774',
      surface: '#ffffff',
      divider: '#e9e9e7',
    },
    font: {
      body:    "-apple-system, ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif",
      heading: "-apple-system, ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif",
      mono:    "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', -apple-system, ui-sans-serif, sans-serif",
    },
    space: {
      tightSection: '8px',
      paragraph:    '12px',
      callout:      '12px',
    },
    page: {
      size: 'A4',
      margin: '20mm',
    },
    fontFaces: [...NOTO_NASKH_ARABIC],
  },
  components: {
    coverHeader:  'standard',
    objectives:   'simple-bullets',
    materials:    'callout-bullets',
    markingGrid:  'bordered-table',
    questionRow:  'standard',
    divider:      'thin-rule',
    figureBox:    'caption-below',
    callout:      'tinted-left-border',
  },
}
