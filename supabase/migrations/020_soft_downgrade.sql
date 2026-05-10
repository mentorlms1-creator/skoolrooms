-- ============================================================================
-- 020_soft_downgrade.sql
-- Soft-downgrade plan-expiry flow: paid plan expires → 5d grace → downgrade to
-- free with grandfathered usage → 30d later → hard cancel.
-- See ARCHITECTURE.md §13 (business rules) and §9 (plan limits).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. teachers.downgraded_at — when soft-downgrade kicked in.
--    Anchors the 30-day clock to hard-cancel. NULL for any teacher not
--    currently in a downgraded state. Cleared on renewal.
-- ----------------------------------------------------------------------------
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS downgraded_at timestamptz NULL;

-- Lookups: "all currently downgraded teachers" + "due for hard-cancel"
CREATE INDEX IF NOT EXISTS idx_teachers_downgraded_at
  ON teachers (downgraded_at)
  WHERE downgraded_at IS NOT NULL;

-- Cron lookup: "paid plans whose grace has just expired and need downgrade"
CREATE INDEX IF NOT EXISTS idx_teachers_grace_pending_downgrade
  ON teachers (grace_until)
  WHERE downgraded_at IS NULL AND grace_until IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. apply_soft_downgrade(p_teacher_id) RPC
--    Idempotent: only flips a teacher who is past grace and not already
--    downgraded. Sets plan = 'free' and stamps downgraded_at = now().
--    plan_expires_at is left intact so we still know they were paid.
--    NOTE: superseded by migration 021 (which anchors downgraded_at on
--    grace_until instead of now() to avoid timeline drift on delayed cron).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_soft_downgrade(
  p_teacher_id uuid
) RETURNS VOID AS $$
BEGIN
  UPDATE teachers SET
    plan = 'free',
    downgraded_at = now()
  WHERE id = p_teacher_id
    AND plan != 'free'
    AND grace_until IS NOT NULL
    AND grace_until < now()
    AND downgraded_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. notifications_log.type values used by the new flow.
--    `notifications_log.type` is plain text (no CHECK), so no DDL needed —
--    but documenting here for posterity:
--      'plan_soft_downgraded'      — sent once on day 5
--      'plan_hard_cancel_warning'  — sent once on day 25 (5 days before cancel)
--      'plan_hard_cancelled'       — sent once on day 30+
--    (Existing 'plan_hard_locked' is retired; no row migration needed.)
-- ----------------------------------------------------------------------------
