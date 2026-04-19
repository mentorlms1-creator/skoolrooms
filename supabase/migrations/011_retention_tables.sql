-- =============================================================================
-- 011_retention_tables.sql — teacher_testimonials table + RLS additions
-- =============================================================================

-- ============================================================================
-- teacher_testimonials (new table — Lane C owns this)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_role text,
  quote text NOT NULL,
  is_published bool NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for ordered retrieval per teacher
CREATE INDEX idx_teacher_testimonials_teacher_id ON teacher_testimonials (teacher_id, display_order);

-- RLS
ALTER TABLE teacher_testimonials ENABLE ROW LEVEL SECURITY;

-- Teacher manages own testimonials
CREATE POLICY "teachers_manage_own_testimonials"
  ON teacher_testimonials FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- Public read of published testimonials (used by public page — anon key)
CREATE POLICY "public_read_published_testimonials"
  ON teacher_testimonials FOR SELECT
  USING (is_published = true);

-- ============================================================================
-- RLS additions for cohort_feedback (Phase 2 — was admin-only)
-- ============================================================================

-- Teacher reads feedback for their own cohorts
CREATE POLICY "teachers_read_own_cohort_feedback"
  ON cohort_feedback FOR SELECT
  USING (
    cohort_id IN (
      SELECT id FROM cohorts
      WHERE teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

-- Student inserts own feedback (one per cohort enforced by UNIQUE constraint)
CREATE POLICY "students_insert_own_feedback"
  ON cohort_feedback FOR INSERT
  WITH CHECK (student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()));

-- Student reads own feedback (to know if they already submitted)
CREATE POLICY "students_read_own_feedback"
  ON cohort_feedback FOR SELECT
  USING (student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- RLS additions for referrals (Phase 2 — was admin-only)
-- ============================================================================

-- Teacher reads their own referrals (as referrer)
CREATE POLICY "teachers_read_own_referrals"
  ON referrals FOR SELECT
  USING (referrer_teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- Note: referral INSERT and status UPDATE always use service role (server actions
-- with supabaseAdmin) — no client-side insert policy needed.
