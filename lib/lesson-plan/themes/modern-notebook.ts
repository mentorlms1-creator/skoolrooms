// =============================================================================
// Modern Notebook — Anthropic / warm editorial fork.
// Cream paper background, terracotta serif accent. Primary / middle school.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const modernNotebook: Theme = {
  slug: 'modern-notebook',
  name: 'Modern Notebook',
  description: 'Cream paper, terracotta serif headings — warm, primary / middle school feel.',
  tokens: {
    color: {
      primary: '#9a3412',
      accent:  '#ca8a04',
      text:    '#3a2e1f',
      muted:   '#78716c',
      surface: '#faf6ef',
      divider: '#e7e2d8',
    },
    font: {
      body:    "'Lora', Georgia, 'Iowan Old Style', serif",
      heading: "'Lora', 'Iowan Old Style', Georgia, serif",
      mono:    "ui-monospace, Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', 'Lora', Georgia, serif",
    },
    space: { tightSection: '8px', paragraph: '12px', callout: '12px' },
    page: { size: 'A4', margin: '22mm' },
    fontFaces: [
      ...NOTO_NASKH_ARABIC,
      { family: 'Lora', src: '/fonts/themed/Lora-400.woff2', weight: 400 },
      { family: 'Lora', src: '/fonts/themed/Lora-700.woff2', weight: 700 },
    ],
  },
  components: {
    coverHeader:  'standard',
    objectives:   'simple-bullets',
    materials:    'callout-bullets',
    markingGrid:  'bordered-table',
    questionRow:  'standard',
    divider:      'thin-rule',
    figureBox:    'caption-below',
    callout:      'cream-card',
  },
}
