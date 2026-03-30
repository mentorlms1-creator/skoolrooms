// =============================================================================
// lib/rate-limit.ts — In-memory rate limiter (Phase 1)
// Simple sliding window rate limiter using Map.
// Upgrade to Upstash Redis in Phase 2 by swapping this implementation.
// =============================================================================

type RateLimitEntry = {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Clean up stale entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

let lastCleanup = Date.now()

function cleanup(windowMs: number): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now

  for (const [key, entry] of store.entries()) {
    const cutoff = now - windowMs
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param key - Unique identifier (e.g., `join:${ipHash}`, `signup:${ipHash}`)
 * @param maxRequests - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed, remaining } — whether the request is allowed and how many remain
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const cutoff = now - windowMs

  // Run periodic cleanup
  cleanup(windowMs)

  let entry = store.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
    }
  }

  // Record this request
  entry.timestamps.push(now)

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
  }
}
