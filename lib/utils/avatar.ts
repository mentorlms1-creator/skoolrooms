// lib/utils/avatar.ts
//
// Deterministic avatar color + initials. Same student.id always maps to the
// same palette slot, so a given student looks identical wherever they appear
// in the app.

const PALETTE_SIZE = 8

/**
 * Returns a CSS color reference (e.g. "var(--avatar-3)") for a student.
 * Deterministic — same id always yields the same slot.
 * Inline-style usage: <div style={{ background: avatarColorVar(student.id) }} />
 */
export function avatarColorVar(studentId: string): string {
  let h = 0
  for (let i = 0; i < studentId.length; i++) {
    h = (h * 31 + studentId.charCodeAt(i)) | 0
  }
  return `var(--avatar-${(Math.abs(h) % PALETTE_SIZE) + 1})`
}

/**
 * "Aisha Khan" -> "AK", "Ali" -> "A", "" -> "?".
 * Takes up to the first two whitespace-separated tokens.
 */
export function avatarInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
