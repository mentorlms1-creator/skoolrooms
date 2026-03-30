-- ============================================================================
-- 004_functions.sql
-- Postgres functions for atomic operations.
-- ============================================================================

-- ============================================================================
-- 1. Atomic enrollment slot check
--    Returns 'enrolled', 'waitlisted', or 'full'.
--    Uses FOR UPDATE to lock the cohort row and prevent race conditions.
-- ============================================================================
CREATE OR REPLACE FUNCTION enroll_student_atomic(
  p_cohort_id UUID,
  p_student_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_max INT;
  v_count INT;
  v_waitlist BOOL;
BEGIN
  SELECT max_students, waitlist_enabled INTO v_max, v_waitlist
  FROM cohorts WHERE id = p_cohort_id FOR UPDATE;

  SELECT COUNT(*) INTO v_count
  FROM enrollments
  WHERE cohort_id = p_cohort_id AND status = 'active';

  IF v_max IS NULL THEN RETURN 'enrolled'; END IF;
  IF v_count < v_max THEN RETURN 'enrolled'; END IF;
  IF v_waitlist THEN RETURN 'waitlisted'; END IF;
  RETURN 'full';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Atomic balance credit with outstanding debit deduction
--    Credits teacher balance. If deduct_outstanding is true and there is an
--    outstanding debit, deducts from the credit before adding to balance.
-- ============================================================================
CREATE OR REPLACE FUNCTION credit_teacher_balance(
  p_teacher_id UUID,
  p_amount INT,
  p_deduct_outstanding BOOL DEFAULT TRUE
) RETURNS VOID AS $$
DECLARE
  v_debit INT;
BEGIN
  SELECT outstanding_debit_pkr INTO v_debit
  FROM teacher_balances WHERE teacher_id = p_teacher_id FOR UPDATE;

  IF p_deduct_outstanding AND v_debit > 0 THEN
    UPDATE teacher_balances SET
      available_balance_pkr = available_balance_pkr + p_amount - LEAST(p_amount, v_debit),
      outstanding_debit_pkr = GREATEST(0, v_debit - p_amount),
      total_earned_pkr = total_earned_pkr + p_amount,
      updated_at = now()
    WHERE teacher_id = p_teacher_id;
  ELSE
    UPDATE teacher_balances SET
      available_balance_pkr = available_balance_pkr + p_amount,
      total_earned_pkr = total_earned_pkr + p_amount,
      updated_at = now()
    WHERE teacher_id = p_teacher_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Atomic discount code increment
--    Returns TRUE if the code was successfully incremented (valid and not
--    expired, not at max uses). Returns FALSE otherwise.
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_discount_use(
  p_code_id UUID
) RETURNS BOOL AS $$
DECLARE
  v_max INT;
  v_count INT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT max_uses, use_count, expires_at INTO v_max, v_count, v_expires
  FROM discount_codes WHERE id = p_code_id FOR UPDATE;

  IF v_expires IS NOT NULL AND v_expires < now() THEN RETURN FALSE; END IF;
  IF v_max IS NOT NULL AND v_count >= v_max THEN RETURN FALSE; END IF;

  UPDATE discount_codes SET use_count = use_count + 1 WHERE id = p_code_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Set grace period
--    Sets grace_until to plan_expires_at + 5 days for teachers whose paid
--    plan has expired and who don't already have a valid grace period.
--    Free plan never expires, so this only applies to paid plans.
-- ============================================================================
CREATE OR REPLACE FUNCTION set_grace_period(
  p_teacher_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE teachers SET
    grace_until = plan_expires_at + INTERVAL '5 days'
  WHERE id = p_teacher_id
    AND plan != 'free'
    AND plan_expires_at < now()
    AND (grace_until IS NULL OR grace_until < plan_expires_at);
END;
$$ LANGUAGE plpgsql;
