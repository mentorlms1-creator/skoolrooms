-- ============================================================================
-- 016_certificates.sql — Certificate of completion (Phase 3 Lane J)
--
-- Adds:
--   - certificates table (issuance audit + future verification anchor)
--   - 'completed' enrollment status documented (no CHECK constraint exists,
--     so no DB change needed — application enforces the enum)
-- ============================================================================

CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  certificate_number text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by_teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_enrollment_id
  ON certificates(enrollment_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_certificate_number
  ON certificates(certificate_number);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_manage_own_cohort_certificates"
  ON certificates FOR ALL
  USING (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN cohorts c ON c.id = e.cohort_id
      WHERE c.teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

CREATE POLICY "students_read_own_certificates"
  ON certificates FOR SELECT
  USING (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      WHERE e.student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid())
    )
  );
