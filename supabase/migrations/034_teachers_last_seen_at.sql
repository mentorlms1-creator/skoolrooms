-- ============================================================================
-- 034_teachers_last_seen_at.sql
-- Track when each teacher was last active. Updated (debounced to once per
-- 5 minutes) by the teacher dashboard layout — a strong "online" signal
-- regardless of how long the auth cookie has been alive.
--
-- Nullable: existing teachers (and new ones who haven't loaded the dashboard
-- since this migration) read as NULL until their first dashboard visit. The
-- admin UI renders "Never" in that case.
-- ============================================================================

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Index supports admin sorting by "most recently active" without a full scan.
-- NULLS LAST so teachers who never logged in sink to the bottom of recency sorts.
CREATE INDEX IF NOT EXISTS teachers_last_seen_at_desc_idx
  ON teachers (last_seen_at DESC NULLS LAST);
