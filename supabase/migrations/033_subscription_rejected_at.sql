-- ============================================================================
-- 033_subscription_rejected_at.sql
-- Add rejected_at timestamp to teacher_subscriptions for audit/history view.
--
-- approved_at already exists for the approval timestamp; this is its symmetric
-- counterpart for rejections so the admin history view can display "Rejected
-- on [datetime]" the same way it shows "Approved on [datetime]".
--
-- Backfill: existing rejected rows are left NULL (we don't know when they
-- were rejected). The UI renders gracefully without a timestamp in that case.
-- ============================================================================

ALTER TABLE teacher_subscriptions
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
