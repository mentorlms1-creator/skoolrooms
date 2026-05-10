-- ============================================================================
-- 021_soft_downgrade_anchor_grace.sql
-- Anchor the 30-day hard-cancel clock on grace_until, not the moment the cron
-- happens to fire. Prevents three bugs:
--   1. Delayed cron silently extending the soft-downgrade window.
--   2. Very-late cron lifting an already-hard-cancelled teacher back to
--      soft-downgrade by stamping a fresh now() that's still inside 30 days.
--   3. UI drift: getPlanState in the app already uses grace_until as the
--      anchor in the cron-lag fallback path; this aligns the DB with that.
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_soft_downgrade(
  p_teacher_id uuid
) RETURNS VOID AS $$
BEGIN
  UPDATE teachers SET
    plan = 'free',
    downgraded_at = grace_until
  WHERE id = p_teacher_id
    AND plan != 'free'
    AND grace_until IS NOT NULL
    AND grace_until < now()
    AND downgraded_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Backfill any rows already downgraded by the now()-based version.
-- Only touches rows where downgraded_at is later than grace_until (the
-- bug signature) — leaves any legitimate manually-set timestamps alone.
UPDATE teachers
SET downgraded_at = grace_until
WHERE downgraded_at IS NOT NULL
  AND grace_until IS NOT NULL
  AND downgraded_at > grace_until;
