// =============================================================================
// Worksheet Pro — Vercel fork.
// B&W, monospace, dense, answer lines built in. For assessments / worksheets.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const worksheetPro: Theme = {
  slug: 'worksheet-pro',
  name: 'Worksheet Pro',
  description: 'B&W, monospace, answer lines — printable assessments and homework.',
  tokens: {
    color: {
      primary: '#000000',
      accent:  '#000000',
      text:    '#000000',
      muted:   '#525252',
      surface: '#ffffff',
      divider: '#000000',
    },
    font: {
      body:    "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      heading: "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      mono:    "ui-monospace, 'JetBrains Mono', Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', ui-monospace, monospace",
    },
    space: { tightSection: '6px', paragraph: '10px', callout: '10px' },
    page: { size: 'A4', margin: '18mm' },
    fontFaces: [...NOTO_NASKH_ARABIC],
  },
  components: {
    coverHeader:  'name-class-date-strip',
    objectives:   'simple-bullets',
    materials:    'inline-list',
    markingGrid:  'bordered-table',
    questionRow:  'answer-line-below',
    divider:      'thin-rule',
    figureBox:    'caption-below',
    callout:      'dashed-box',
  },
}
