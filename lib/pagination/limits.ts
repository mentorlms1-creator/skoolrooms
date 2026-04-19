// =============================================================================
// lib/pagination/limits.ts — Shared page-size constants for cursor pagination.
// =============================================================================

export const MAX_PAGE_SIZE = 100
export const DEFAULT_PAGE_SIZE = 50
export const EXPLORE_PAGE_SIZE = 24
export const NOTIFICATIONS_PAGE_SIZE = 20

/**
 * Clamp a requested page size into [1, MAX_PAGE_SIZE].
 * Always returns a safe integer; falls back to `fallback` when input is bad.
 */
export function clampLimit(
  requested: unknown,
  fallback: number = DEFAULT_PAGE_SIZE,
): number {
  const n = typeof requested === 'number' ? requested : Number(requested)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), MAX_PAGE_SIZE)
}
