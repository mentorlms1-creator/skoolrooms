// =============================================================================
// lib/lesson-plan/themes/common-fontfaces.ts — @font-face declarations
// used by all themes. Noto Naskh Arabic is everywhere so Urdu glyphs in
// Latin-font themes fall back to readable Arabic-script characters.
// =============================================================================

import type { FontFace } from './types'

export const NOTO_NASKH_ARABIC: FontFace[] = [
  {
    family: 'Noto Naskh Arabic',
    src: '/fonts/themed/NotoNaskhArabic-400.woff2',
    weight: 400,
  },
  {
    family: 'Noto Naskh Arabic',
    src: '/fonts/themed/NotoNaskhArabic-700.woff2',
    weight: 700,
  },
]
