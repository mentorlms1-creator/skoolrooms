-- ============================================================================
-- 035_teacher_activity_snapshots.sql
-- Daily snapshot of teacher activity counts so the admin dashboard can chart
-- WAU/DAU over time. last_seen_at on the teachers row is overwritten on every
-- touch — without snapshots we can only know the *current* state, not the
-- trend. The cron at /api/cron/activity-snapshot writes one row per day.
--
-- Primary key on snapshot_date so re-running the cron the same day is a
-- no-op upsert (idempotent) instead of producing duplicates.
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_activity_snapshots (
  snapshot_date  date PRIMARY KEY,
  weekly_active  integer NOT NULL,  -- distinct teachers with last_seen_at within prior 7d
  daily_active   integer NOT NULL,  -- distinct teachers with last_seen_at within prior 24h
  total_teachers integer NOT NULL,  -- total non-deleted teachers at snapshot time
  created_at     timestamptz NOT NULL DEFAULT NOW()
);

-- Index for "give me the last N snapshots" (used by the dashboard chart).
CREATE INDEX IF NOT EXISTS teacher_activity_snapshots_date_desc_idx
  ON teacher_activity_snapshots (snapshot_date DESC);

ALTER TABLE teacher_activity_snapshots ENABLE ROW LEVEL SECURITY;

-- No public policies — only the service role (admin client / cron) reads or
-- writes this table. RLS-enabled with no policies = deny by default for
-- anon/authenticated callers.
