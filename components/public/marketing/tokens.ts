/**
 * components/public/marketing/tokens.ts — Marketing site brand palette + fonts.
 *
 * The marketing pages use a fixed light-mode palette (lime/purple) handed
 * over from the design file. This is intentionally separate from the OKLCH
 * app theme — these pages never render in dark mode.
 */

export const C = {
  lime: '#C1F539',
  purple: '#7C57FC',
  dark: '#463699',
  black: '#111111',
  white: '#FFFFFF',
  offwhite: '#F5F4FF',
  gray: '#F0EEF8',
  mid: '#8B7EC8',
} as const

// next/font variables defined in app/layout.tsx
export const FONT_HEAD = 'var(--font-montserrat), sans-serif'
export const FONT_BODY = 'var(--font-poppins), sans-serif'

// WhatsApp number for the floating chat button (international format, no +).
// Leave empty to hide the button until the business number is ready.
export const WHATSAPP_NUMBER = ''
