-- ============================================================================
-- 002_rls_policies.sql
-- Enable RLS on ALL tables and create row-level security policies.
-- ============================================================================

-- ============================================================================
-- COURSES
-- ============================================================================
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_own_courses"
  ON courses FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- COHORTS
-- ============================================================================
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_own_cohorts"
  ON cohorts FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- CLASS_SESSIONS
-- ============================================================================
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_sessions"
  ON class_sessions FOR ALL
  USING (
    cohort_id IN (
      SELECT id FROM cohorts
      WHERE teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

CREATE POLICY "students_see_enrolled_sessions"
  ON class_sessions FOR SELECT
  USING (
    cohort_id IN (
      SELECT cohort_id FROM enrollments
      WHERE student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid())
        AND status = 'active'
    )
  );

-- ============================================================================
-- ANNOUNCEMENTS
-- ============================================================================
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_own_announcements"
  ON announcements FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "students_see_cohort_announcements"
  ON announcements FOR SELECT
  USING (
    cohort_id IN (
      SELECT cohort_id FROM enrollments
      WHERE student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid())
        AND status = 'active'
    )
  );

-- ============================================================================
-- ENROLLMENTS
-- ============================================================================
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_cohort_enrollments"
  ON enrollments FOR ALL
  USING (
    cohort_id IN (
      SELECT id FROM cohorts
      WHERE teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

CREATE POLICY "students_see_own_enrollments"
  ON enrollments FOR SELECT
  USING (student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- STUDENT_PAYMENTS
-- ============================================================================
ALTER TABLE student_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_cohort_payments"
  ON student_payments FOR ALL
  USING (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN cohorts c ON e.cohort_id = c.id
      WHERE c.teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

CREATE POLICY "students_see_own_payments"
  ON student_payments FOR SELECT
  USING (
    enrollment_id IN (
      SELECT id FROM enrollments
      WHERE student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid())
    )
  );

-- ============================================================================
-- ATTENDANCE
-- ============================================================================
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_session_attendance"
  ON attendance FOR ALL
  USING (
    class_session_id IN (
      SELECT cs.id FROM class_sessions cs
      JOIN cohorts c ON cs.cohort_id = c.id
      WHERE c.teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

CREATE POLICY "students_see_own_attendance"
  ON attendance FOR SELECT
  USING (student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- ASSIGNMENTS
-- ============================================================================
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_own_assignments"
  ON assignments FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "students_see_enrolled_assignments"
  ON assignments FOR SELECT
  USING (
    cohort_id IN (
      SELECT cohort_id FROM enrollments
      WHERE student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid())
        AND status = 'active'
    )
  );

-- ============================================================================
-- ASSIGNMENT_SUBMISSIONS
-- ============================================================================
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_cohort_submissions"
  ON assignment_submissions FOR SELECT
  USING (
    assignment_id IN (
      SELECT id FROM assignments
      WHERE teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

CREATE POLICY "students_manage_own_submissions"
  ON assignment_submissions FOR ALL
  USING (student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- ANNOUNCEMENT_COMMENTS
-- ============================================================================
ALTER TABLE announcement_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_announcement_comments"
  ON announcement_comments FOR ALL
  USING (
    announcement_id IN (
      SELECT id FROM announcements
      WHERE teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

CREATE POLICY "students_see_enrolled_announcement_comments"
  ON announcement_comments FOR SELECT
  USING (
    announcement_id IN (
      SELECT a.id FROM announcements a
      JOIN enrollments e ON a.cohort_id = e.cohort_id
      WHERE e.student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid())
        AND e.status = 'active'
    )
  );

-- ============================================================================
-- ANNOUNCEMENT_READS
-- ============================================================================
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_manage_own_reads"
  ON announcement_reads FOR ALL
  USING (student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()));

CREATE POLICY "teachers_see_own_announcement_reads"
  ON announcement_reads FOR SELECT
  USING (
    announcement_id IN (
      SELECT id FROM announcements
      WHERE teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

-- ============================================================================
-- TEACHERS
-- ============================================================================
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_select_own_row"
  ON teachers FOR SELECT
  USING (supabase_auth_id = auth.uid());

CREATE POLICY "teachers_update_own_row"
  ON teachers FOR UPDATE
  USING (supabase_auth_id = auth.uid());

-- ============================================================================
-- STUDENTS
-- ============================================================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_select_own_row"
  ON students FOR SELECT
  USING (supabase_auth_id = auth.uid());

CREATE POLICY "students_update_own_row"
  ON students FOR UPDATE
  USING (supabase_auth_id = auth.uid());

-- ============================================================================
-- TEACHER_PAYMENT_SETTINGS
-- ============================================================================
ALTER TABLE teacher_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_own_payment_settings"
  ON teacher_payment_settings FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- TEACHER_BALANCES
-- ============================================================================
ALTER TABLE teacher_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_balance"
  ON teacher_balances FOR SELECT
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- TEACHER_SUBSCRIPTIONS
-- ============================================================================
ALTER TABLE teacher_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_subscriptions"
  ON teacher_subscriptions FOR SELECT
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- TEACHER_PLAN_SNAPSHOT
-- ============================================================================
ALTER TABLE teacher_plan_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_snapshots"
  ON teacher_plan_snapshot FOR SELECT
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- TEACHER_PAYOUTS
-- ============================================================================
ALTER TABLE teacher_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_payouts"
  ON teacher_payouts FOR SELECT
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- DISCOUNT_CODES
-- ============================================================================
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_manage_own_discount_codes"
  ON discount_codes FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- COHORT_WAITLIST
-- ============================================================================
ALTER TABLE cohort_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_see_own_cohort_waitlists"
  ON cohort_waitlist FOR ALL
  USING (
    cohort_id IN (
      SELECT id FROM cohorts
      WHERE teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

CREATE POLICY "students_see_own_waitlist_entries"
  ON cohort_waitlist FOR SELECT
  USING (student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- PLANS (public read for pricing page)
-- ============================================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_public_read"
  ON plans FOR SELECT
  USING (true);

-- ============================================================================
-- FEATURE_REGISTRY (public read for pricing page)
-- ============================================================================
ALTER TABLE feature_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_registry_public_read"
  ON feature_registry FOR SELECT
  USING (true);

-- ============================================================================
-- PLAN_FEATURES (public read for pricing page)
-- ============================================================================
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_features_public_read"
  ON plan_features FOR SELECT
  USING (true);

-- ============================================================================
-- PLATFORM_SETTINGS (admin-only, no public policies — admin uses service role)
-- ============================================================================
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- NOTIFICATIONS_LOG (admin-only, no public policies — admin uses service role)
-- ============================================================================
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- EMAIL_DELIVERY_LOG (admin-only, no public policies — admin uses service role)
-- ============================================================================
ALTER TABLE email_delivery_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ADMIN_ACTIVITY_LOG (admin-only, no public policies — admin uses service role)
-- ============================================================================
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- EXPLORE_PAGE_VIEWS (admin-only, no public policies — admin uses service role)
-- ============================================================================
ALTER TABLE explore_page_views ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DIRECT_MESSAGES (Phase 2 — admin-only for now)
-- ============================================================================
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COHORT_FEEDBACK (Phase 2 — admin-only for now)
-- ============================================================================
ALTER TABLE cohort_feedback ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- REFERRALS (Phase 2 — admin-only for now)
-- ============================================================================
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
