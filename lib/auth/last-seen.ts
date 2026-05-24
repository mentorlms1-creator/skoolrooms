// =============================================================================
// lib/auth/last-seen.ts — Track when each teacher was last active
//
// Called from the teacher dashboard layout on every render. The actual DB
// write is debounced so we hit the database at most once per teacher per
// DEBOUNCE_MS window, even across many quick page navigations.
//
// Debouncing strategy: when the teacher row is read by the layout (which
// already happens), the caller passes in the current value of last_seen_at.
// We only fire the update if it's null or older than the window. The fire is
// fire-and-forget — we never block the layout render on the write.
// =============================================================================

import { createAdminClient } from '@/supabase/server'

const DEBOUNCE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Maybe update `teachers.last_seen_at` to NOW(). No-op if the existing
 * `currentLastSeenAt` is within the debounce window.
 *
 * Fire-and-forget — the returned promise is intentionally unawaited by
 * callers. Errors are swallowed (logged) so a flaky DB write never breaks
 * dashboard rendering.
 */
export function touchTeacherLastSeen(
  teacherId: string,
  currentLastSeenAt: string | null,
): void {
  if (currentLastSeenAt) {
    const lastMs = new Date(currentLastSeenAt).getTime()
    if (Number.isFinite(lastMs) && Date.now() - lastMs < DEBOUNCE_MS) {
      return // recent enough — skip
    }
  }

  // Fire-and-forget update.
  void (async () => {
    try {
      const supabase = createAdminClient()
      await supabase
        .from('teachers')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', teacherId)
    } catch (err) {
      console.error('[touchTeacherLastSeen] failed', { teacherId, err })
    }
  })()
}
