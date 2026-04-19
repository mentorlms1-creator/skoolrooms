-- =============================================================================
-- 012_course_curriculum.sql
-- Adds course_curriculum_items: per-course weekly outline items (Lane E1).
-- =============================================================================

CREATE TABLE IF NOT EXISTS course_curriculum_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  week_number int NOT NULL CHECK (week_number >= 1),
  title text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_course_order
  ON course_curriculum_items(course_id, display_order);

ALTER TABLE course_curriculum_items ENABLE ROW LEVEL SECURITY;

-- Teacher RW: only the owning teacher can manage curriculum items
DROP POLICY IF EXISTS curriculum_teacher_rw ON course_curriculum_items;
CREATE POLICY curriculum_teacher_rw ON course_curriculum_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      JOIN teachers t ON t.id = c.teacher_id
      WHERE c.id = course_curriculum_items.course_id
        AND t.supabase_auth_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses c
      JOIN teachers t ON t.id = c.teacher_id
      WHERE c.id = course_curriculum_items.course_id
        AND t.supabase_auth_id = auth.uid()
    )
  );

-- Public read: anyone (anon or authed) can read curriculum for published courses
DROP POLICY IF EXISTS curriculum_public_read ON course_curriculum_items;
CREATE POLICY curriculum_public_read ON course_curriculum_items
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_curriculum_items.course_id
        AND c.status = 'published'
        AND c.deleted_at IS NULL
    )
  );
