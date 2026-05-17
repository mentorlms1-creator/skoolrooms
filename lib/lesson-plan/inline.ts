// =============================================================================
// lib/lesson-plan/inline.ts — Inline text helpers for themed rendering.
// =============================================================================

const EMOJI_RE = /\p{Extended_Pictographic}/gu
const URDU_RANGE_RE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/

/** Removes emoji codepoints + inline markdown markers (** * `). */
export function stripInline(text: string): string {
  return text
    .replace(EMOJI_RE, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** True if the text contains any Urdu/Arabic-script codepoints. */
export function hasUrduChars(text: string): boolean {
  return URDU_RANGE_RE.test(text)
}

/** Splits text into Latin and Urdu segments. Each segment renders with its
 *  appropriate font. Used for mixed-language content (e.g. English headings
 *  with Urdu body text). */
export type InlineSegment = { text: string; isUrdu: boolean }
export function segmentByScript(text: string): InlineSegment[] {
  if (!hasUrduChars(text)) return [{ text, isUrdu: false }]
  const segments: InlineSegment[] = []
  let buf = ''
  let bufIsUrdu = URDU_RANGE_RE.test(text[0] ?? '')
  for (const ch of text) {
    const chIsUrdu = URDU_RANGE_RE.test(ch)
    if (chIsUrdu === bufIsUrdu) {
      buf += ch
    } else {
      if (buf) segments.push({ text: buf, isUrdu: bufIsUrdu })
      buf = ch
      bufIsUrdu = chIsUrdu
    }
  }
  if (buf) segments.push({ text: buf, isUrdu: bufIsUrdu })
  return segments
}
