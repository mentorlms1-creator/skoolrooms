// =============================================================================
// Playful Primary — Material fork.
// Bright accents, larger fonts, friendly. K-3.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const playfulPrimary: Theme = {
  slug: 'playful-primary',
  name: 'Playful Primary',
  description: 'Bright accents, friendly type — early primary classes (K-3).',
  tokens: {
    color: {
      primary: '#7c3aed',
      accent:  '#ec4899',
      text:    '#1a1a2e',
      muted:   '#52525b',
      surface: '#ffffff',
      divider: '#fce7f3',
    },
    font: {
      body:    "system-ui, 'Lexend', -apple-system, sans-serif",
      heading: "system-ui, 'Lexend', -apple-system, sans-serif",
      mono:    "ui-monospace, monospace",
      urdu:    "'Noto Naskh Arabic', system-ui, sans-serif",
    },
    space: { tightSection: '10px', paragraph: '14px', callout: '14px' },
    page: { size: 'A4', margin: '20mm' },
    fontFaces: [...NOTO_NASKH_ARABIC],
  },
  components: {
    coverHeader:  'standard',
    objectives:   'callout-checklist',
    materials:    'icon-grid',
    markingGrid:  'shaded-table',
    questionRow:  'standard',
    divider:      'ornament',
    figureBox:    'caption-below',
    callout:      'cream-card',
  },
}
