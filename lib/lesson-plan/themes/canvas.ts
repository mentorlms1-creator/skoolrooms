// =============================================================================
// Canvas — gallery aesthetic.
// Sparse, mostly white, figure-with-caption boxes prominent.
// Photography / film / design.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const canvas: Theme = {
  slug: 'canvas',
  name: 'Canvas',
  description: 'Gallery aesthetic, sparse, figure-with-caption — photography / film / design.',
  tokens: {
    color: {
      primary: '#171717',
      accent:  '#404040',
      text:    '#171717',
      muted:   '#737373',
      surface: '#ffffff',
      divider: '#e5e5e5',
    },
    font: {
      body:    "'Inter', -apple-system, system-ui, sans-serif",
      heading: "'Inter', -apple-system, system-ui, sans-serif",
      mono:    "ui-monospace, Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', 'Inter', system-ui, sans-serif",
    },
    space: { tightSection: '12px', paragraph: '18px', callout: '14px' },
    page: { size: 'A4', margin: '25mm' },
    fontFaces: [...NOTO_NASKH_ARABIC],
  },
  components: {
    coverHeader:  'cover-page-hero',
    objectives:   'simple-bullets',
    materials:    'inline-list',
    markingGrid:  'bordered-table',
    questionRow:  'standard',
    divider:      'shadow-band',
    figureBox:    'gallery-frame',
    callout:      'tinted-left-border',
  },
}
