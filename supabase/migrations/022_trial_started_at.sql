-- ============================================================================
-- 022_trial_started_at.sql
-- Make trial-eligibility tamper-proof.
--
-- Bug it fixes: hasPriorPaidPlan() relied on `trial_ends_at` and the existence
-- of a `teacher_subscriptions` row. Both signals get destroyed along the
-- soft-downgrade timeline (trial-expiry cron nulls trial_ends_at; admin approval
-- nulls it too; test-seeded teachers never had a subscription row). A teacher
-- whose paid plan expired and was soft-downgraded to free could click "Renew"
-- and silently receive a fresh 14-day trial.
--
-- Fix: a dedicated `trial_started_at` column that is set exactly once on first
-- trial start and never cleared by any flow. Eligibility = trial_started_at
-- IS NULL (combined with no-prior-subscription / not-currently-downgraded
-- checks in the application layer for defense-in-depth).
-- ============================================================================

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

-- Conservative backfill: anyone who has any evidence of having been on a paid
-- plan gets a non-null trial_started_at, locking them out of future trials.
-- Rules in priority order:
--   1. Earliest teacher_subscriptions row → that's when they first paid.
--   2. trial_ends_at - 14 days → reconstruct from a still-set or recently-set
--      trial window (TIMING.TRIAL_DAYS = 14).
--   3. Anything else suggesting paid history (non-free plan, plan_expires_at
--      set, grace_until set, downgraded_at set) → fall back to created_at.
-- Everyone else (truly never-paid teachers) stays NULL and remains
-- trial-eligible.
UPDATE teachers
SET trial_started_at = COALESCE(
  (
    SELECT MIN(created_at)
    FROM teacher_subscriptions
    WHERE teacher_id = teachers.id
  ),
  trial_ends_at - INTERVAL '14 days',
  CASE
    WHEN plan <> 'free'
      OR plan_expires_at IS NOT NULL
      OR grace_until IS NOT NULL
      OR downgraded_at IS NOT NULL
    THEN created_at
  END
)
WHERE trial_started_at IS NULL;
