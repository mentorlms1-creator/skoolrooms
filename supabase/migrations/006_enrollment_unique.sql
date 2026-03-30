-- 006: Add UNIQUE constraint on (student_id, cohort_id) to prevent duplicate enrollments
-- This is a safety net alongside the application-level check in checkExistingEnrollment()
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_student_cohort
  ON enrollments (student_id, cohort_id);
