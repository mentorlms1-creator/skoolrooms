// =============================================================================
// lib/lesson-plan/themes/index.ts — Typed registry of all themes.
// Adding a theme: import it here, add to THEMES, and add the slug to
// THEME_SLUGS in types.ts (which also drives the DB CHECK constraint).
// =============================================================================

import type { Theme, ThemeSlug } from './types'
import { classroomClassic } from './classroom-classic'
import { modernNotebook }   from './modern-notebook'
import { worksheetPro }     from './worksheet-pro'
import { academicMinimal }  from './academic-minimal'
import { playfulPrimary }   from './playful-primary'
import { techStem }         from './tech-stem'
import { studioPad }        from './studio-pad'
import { canvas }           from './canvas'

export const THEMES: Record<ThemeSlug, Theme> = {
  'classroom-classic': classroomClassic,
  'modern-notebook':   modernNotebook,
  'worksheet-pro':     worksheetPro,
  'academic-minimal':  academicMinimal,
  'playful-primary':   playfulPrimary,
  'tech-stem':         techStem,
  'studio-pad':        studioPad,
  'canvas':            canvas,
}

export const DEFAULT_THEME_SLUG: ThemeSlug = 'classroom-classic'

/** Returns the theme by slug, falling back to DEFAULT_THEME if unknown. */
export function getTheme(slug: string | null | undefined): Theme {
  if (slug && slug in THEMES) return THEMES[slug as ThemeSlug]
  return THEMES[DEFAULT_THEME_SLUG]
}

export * from './types'
