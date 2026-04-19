-- Prevent double-creation of payment rows for the same enrollment + month
-- Partial: only enforce when payment_month is set AND status is active
-- (allows rejected payments to be replaced by a new pending one)
CREATE UNIQUE INDEX IF NOT EXISTS student_payments_unique_month_per_enrollment
  ON student_payments(enrollment_id, payment_month)
  WHERE payment_month IS NOT NULL
    AND status IN ('pending_verification', 'confirmed');
