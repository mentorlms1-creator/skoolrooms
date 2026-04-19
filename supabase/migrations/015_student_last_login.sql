-- =============================================================================
-- 015_student_last_login.sql — Lane E2 (4)
-- Adds students.last_login_at + supporting indexes for the Student Health page.
-- =============================================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_students_last_login_at
  ON students (last_login_at) WHERE last_login_at IS NOT NULL;

-- Helper indexes for at-risk / no-submission lookups (idempotent).
CREATE INDEX IF NOT EXISTS idx_attendance_student_present
  ON attendance (student_id, present);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student
  ON assignment_submissions (student_id);
