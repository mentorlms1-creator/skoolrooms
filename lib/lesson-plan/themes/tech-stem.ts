// =============================================================================
// Tech & STEM — Stripe fork.
// Blue/violet accents, mono for equations. Math, physics, chem, bio, comp sci.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const techStem: Theme = {
  slug: 'tech-stem',
  name: 'Tech & STEM',
  description: 'Blue/violet accents, mono code — math, physics, chemistry, biology, computing.',
  tokens: {
    color: {
      primary: '#635bff',
      accent:  '#0a2540',
      text:    '#0a2540',
      muted:   '#425466',
      surface: '#ffffff',
      divider: '#e3e8ee',
    },
    font: {
      body:    "'Inter', -apple-system, system-ui, sans-serif",
      heading: "'Inter', -apple-system, system-ui, sans-serif",
      mono:    "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', 'Inter', system-ui, sans-serif",
    },
    space: { tightSection: '8px', paragraph: '12px', callout: '12px' },
    page: { size: 'A4', margin: '20mm' },
    fontFaces: [...NOTO_NASKH_ARABIC],
  },
  components: {
    coverHeader:  'standard',
    objectives:   'numbered-list',
    materials:    'callout-bullets',
    markingGrid:  'bordered-table',
    questionRow:  'marks-badge-right',
    divider:      'thin-rule',
    figureBox:    'caption-below',
    callout:      'tinted-left-border',
  },
}
