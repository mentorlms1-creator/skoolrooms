-- =============================================================================
-- 014_teacher_student_notes.sql — Lane E2 (3)
-- Private per-student notes owned by teachers. Never exposed to students/admin.
-- =============================================================================

CREATE TABLE IF NOT EXISTS teacher_student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES cohorts(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsn_teacher_student
  ON teacher_student_notes (teacher_id, student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tsn_cohort
  ON teacher_student_notes (cohort_id) WHERE cohort_id IS NOT NULL;

ALTER TABLE teacher_student_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_student_notes_owner ON teacher_student_notes;

CREATE POLICY teacher_student_notes_owner ON teacher_student_notes
  FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()))
  WITH CHECK (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- Students never see this table; no policy granted to them.
