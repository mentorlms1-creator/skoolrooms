-- ============================================================================
-- 018_attendance_edits.sql
-- Audit trail for attendance records edited past the 24-hour window.
-- Teachers can fix mistakes, but every late edit is logged with a reason.
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_edits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id     uuid NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  teacher_id        uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  previous_present  boolean NOT NULL,
  new_present       boolean NOT NULL,
  reason            text NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  edited_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_edits_attendance
  ON attendance_edits (attendance_id, edited_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_edits_teacher
  ON attendance_edits (teacher_id, edited_at DESC);

ALTER TABLE attendance_edits ENABLE ROW LEVEL SECURITY;

-- Teachers can read edits for their own attendance records.
CREATE POLICY attendance_edits_teacher_read
  ON attendance_edits FOR SELECT
  USING (
    teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
  );

-- Writes only through server actions (service role bypasses RLS).
