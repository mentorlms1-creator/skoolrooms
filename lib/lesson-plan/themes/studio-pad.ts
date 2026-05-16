// =============================================================================
// Studio Pad — sketchbook feel.
// Dotted paper, hand-drawn-style accents, image placeholders prominent.
// Art / craft / drawing / design.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const studioPad: Theme = {
  slug: 'studio-pad',
  name: 'Studio Pad',
  description: 'Sketchbook feel, dotted paper, image placeholders — art and craft subjects.',
  tokens: {
    color: {
      primary: '#a16207',
      accent:  '#ca8a04',
      text:    '#1f2937',
      muted:   '#6b7280',
      surface: '#fefce8',
      divider: '#fef3c7',
    },
    font: {
      body:    "'Caveat', system-ui, sans-serif",
      heading: "'Caveat', system-ui, sans-serif",
      mono:    "ui-monospace, monospace",
      urdu:    "'Noto Naskh Arabic', system-ui, sans-serif",
    },
    space: { tightSection: '8px', paragraph: '14px', callout: '14px' },
    page: { size: 'A4', margin: '20mm' },
    fontFaces: [
      ...NOTO_NASKH_ARABIC,
      { family: 'Caveat', src: '/fonts/themed/Caveat-400.woff2', weight: 400 },
    ],
  },
  components: {
    coverHeader:  'standard',
    objectives:   'simple-bullets',
    materials:    'icon-grid',
    markingGrid:  'bordered-table',
    questionRow:  'standard',
    divider:      'ornament',
    figureBox:    'sketchpad-frame',
    callout:      'dashed-box',
  },
}
