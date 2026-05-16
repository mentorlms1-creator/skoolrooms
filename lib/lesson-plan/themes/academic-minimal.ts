// =============================================================================
// Academic Minimal — Apple fork.
// Mostly white, generous whitespace, refined sans + serif headings.
// O-Level / Cambridge / formal academic content.
// =============================================================================

import type { Theme } from './types'
import { NOTO_NASKH_ARABIC } from './common-fontfaces'

export const academicMinimal: Theme = {
  slug: 'academic-minimal',
  name: 'Academic Minimal',
  description: 'Refined, generous whitespace, serif headings — formal academic content.',
  tokens: {
    color: {
      primary: '#000000',
      accent:  '#1c1c1e',
      text:    '#1c1c1e',
      muted:   '#3a3a3c',
      surface: '#ffffff',
      divider: '#d2d2d7',
    },
    font: {
      body:    "-apple-system, 'SF Pro Text', system-ui, sans-serif",
      heading: "'PlayfairDisplay', 'New York', 'Times New Roman', serif",
      mono:    "ui-monospace, 'SF Mono', Menlo, monospace",
      urdu:    "'Noto Naskh Arabic', -apple-system, system-ui, sans-serif",
    },
    space: { tightSection: '12px', paragraph: '16px', callout: '14px' },
    page: { size: 'A4', margin: '25mm' },
    fontFaces: [
      ...NOTO_NASKH_ARABIC,
      { family: 'PlayfairDisplay', src: '/fonts/themed/PlayfairDisplay-400.woff2', weight: 400 },
    ],
  },
  components: {
    coverHeader:  'cover-page-hero',
    objectives:   'numbered-list',
    materials:    'inline-list',
    markingGrid:  'shaded-table',
    questionRow:  'standard',
    divider:      'thin-rule',
    figureBox:    'caption-below',
    callout:      'tinted-left-border',
  },
}
