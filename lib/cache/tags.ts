// =============================================================================
// lib/cache/tags.ts — Thin wrapper around Next 16's revalidateTag.
// Next 16 requires a profile (string | CacheLifeConfig) on every call; we
// standardize on `'default'` here so call sites stay short.
// =============================================================================

import { revalidateTag as nextRevalidateTag } from 'next/cache'

const DEFAULT_PROFILE = 'default'

/** Invalidate every cached entry tagged with `tag`. */
export function revalidateTag(tag: string): void {
  nextRevalidateTag(tag, DEFAULT_PROFILE)
}

/** Invalidate a list of tags in one call. */
export function revalidateTags(tags: string[]): void {
  for (const tag of tags) nextRevalidateTag(tag, DEFAULT_PROFILE)
}
