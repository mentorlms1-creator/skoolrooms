// =============================================================================
// lib/pagination/cursor.ts — base64-JSON cursor encode/decode for Lane L.
//
// Cursors are opaque to clients: a base64 of JSON `{ t: created_at, i: id }`.
// Server decodes and rejects malformed input by returning null. Callers should
// treat null as "start from page 1" — never crash.
// =============================================================================

export type CursorPayload = {
  /** ISO timestamp of the cursor row (created_at by default). */
  t: string
  /** UUID of the cursor row (tiebreak when multiple rows share `t`). */
  i: string
}

export type CursorPage<T> = {
  rows: T[]
  nextCursor: string | null
}

/**
 * Encode a row reference into an opaque cursor token.
 */
export function encodeCursor(row: { created_at: string; id: string }): string {
  const payload: CursorPayload = { t: row.created_at, i: row.id }
  const json = JSON.stringify(payload)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf-8').toString('base64url')
  }
  // Edge runtime fallback (no Buffer): use btoa with URL-safe replacements.
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decode a cursor token. Returns null for any malformed/invalid input.
 * Callers MUST handle null (e.g. by returning 400 or falling back to page 1).
 */
export function decodeCursor(cursor: string | null | undefined): CursorPayload | null {
  if (!cursor || typeof cursor !== 'string') return null
  if (cursor.length > 256) return null

  let json: string
  try {
    if (typeof Buffer !== 'undefined') {
      json = Buffer.from(cursor, 'base64url').toString('utf-8')
    } else {
      const padded = cursor.replace(/-/g, '+').replace(/_/g, '/')
      json = atob(padded)
    }
  } catch {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null
  const candidate = parsed as Record<string, unknown>
  const t = candidate.t
  const i = candidate.i
  if (typeof t !== 'string' || typeof i !== 'string') return null
  if (!t || !i) return null

  // Light validation: t must look like an ISO date, i a uuid-shaped string.
  if (Number.isNaN(Date.parse(t))) return null
  if (!/^[0-9a-fA-F-]{16,64}$/.test(i)) return null

  return { t, i }
}

/**
 * Build the trailing slice from a "fetch one extra" pagination read.
 * If the read returned `pageSize + 1` rows, the last one becomes the cursor
 * for the next page; otherwise nextCursor is null.
 */
export function buildPage<T extends { created_at: string; id: string }>(
  rows: T[],
  pageSize: number,
): CursorPage<T> {
  if (rows.length <= pageSize) {
    return { rows, nextCursor: null }
  }
  const trimmed = rows.slice(0, pageSize)
  const last = trimmed[trimmed.length - 1]
  return { rows: trimmed, nextCursor: encodeCursor(last) }
}
