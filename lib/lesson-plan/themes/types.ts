// =============================================================================
// lib/lesson-plan/themes/types.ts — Theme system type definitions.
// Themes are pure TypeScript objects (see ./classroom-classic.ts etc.) so
// the type system catches typos in token names and component variant slugs.
// =============================================================================

export const THEME_SLUGS = [
  'classroom-classic',
  'modern-notebook',
  'worksheet-pro',
  'academic-minimal',
  'playful-primary',
  'tech-stem',
  'studio-pad',
  'canvas',
] as const

export type ThemeSlug = (typeof THEME_SLUGS)[number]

export const DOC_TYPES = ['lesson-plan', 'assessment-sheet', 'worksheet'] as const
export type DocType = (typeof DOC_TYPES)[number]

export type ColorTokens = {
  primary: string
  accent: string
  text: string
  muted: string
  surface: string
  divider: string
}

export type FontTokens = {
  body: string
  heading: string
  mono: string
  urdu: string
}

export type SpaceTokens = {
  tightSection: string
  paragraph: string
  callout: string
}

export type PageTokens = {
  size: 'A4'
  margin: string
}

export type FontFace = {
  family: string
  src: string
  weight: 400 | 500 | 600 | 700
  style?: 'normal' | 'italic'
}

export type ComponentVariants = {
  coverHeader:  'standard' | 'name-class-date-strip' | 'cover-page-hero'
  objectives:   'callout-checklist' | 'numbered-list' | 'simple-bullets'
  materials:    'callout-bullets' | 'icon-grid' | 'inline-list'
  markingGrid:  'bordered-table' | 'shaded-table'
  questionRow:  'standard' | 'marks-badge-right' | 'answer-line-below'
  divider:      'thin-rule' | 'ornament' | 'shadow-band'
  figureBox:    'caption-below' | 'sketchpad-frame' | 'gallery-frame'
  callout:      'tinted-left-border' | 'dashed-box' | 'cream-card'
}

export type Theme = {
  slug: ThemeSlug
  name: string
  description: string
  tokens: {
    color: ColorTokens
    font: FontTokens
    space: SpaceTokens
    page: PageTokens
    fontFaces?: FontFace[]
  }
  components: ComponentVariants
}
