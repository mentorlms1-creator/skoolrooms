-- ============================================================================
-- 007_subscription_rejection_reason.sql
-- Add rejection_reason column to teacher_subscriptions table
-- ============================================================================

ALTER TABLE teacher_subscriptions ADD COLUMN IF NOT EXISTS rejection_reason text;
