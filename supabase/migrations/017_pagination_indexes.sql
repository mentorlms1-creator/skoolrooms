-- ============================================================================
-- 017_pagination_indexes.sql
-- Indexes supporting cursor pagination + filter pushdown for Lane L.
-- All indexes are CREATE INDEX IF NOT EXISTS so the migration is idempotent.
-- Use CONCURRENTLY in production to avoid table locks (run outside a tx).
-- ============================================================================

-- TEACHERS — explore cursor + admin list cursor
CREATE INDEX IF NOT EXISTS idx_teachers_public_listing
  ON teachers (created_at DESC, id DESC)
  WHERE is_publicly_listed = true AND is_suspended = false;

CREATE INDEX IF NOT EXISTS idx_teachers_created_at_id
  ON teachers (created_at DESC, id DESC);

-- COHORTS — explore aggregate scan
CREATE INDEX IF NOT EXISTS idx_cohorts_teacher_active
  ON cohorts (teacher_id)
  WHERE deleted_at IS NULL AND status <> 'archived';

-- ENROLLMENTS — cohort+status filter, cursor for teacher students page
CREATE INDEX IF NOT EXISTS idx_enrollments_cohort_status
  ON enrollments (cohort_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_created_at_id
  ON enrollments (created_at DESC, id DESC);

-- COURSES — explore category facets
CREATE INDEX IF NOT EXISTS idx_courses_teacher_status_published
  ON courses (teacher_id)
  WHERE status = 'published' AND deleted_at IS NULL;

-- DIRECT_MESSAGES — per-thread + per-recipient cursor scans
CREATE INDEX IF NOT EXISTS idx_direct_messages_thread_created
  ON direct_messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_created
  ON direct_messages (recipient_id, recipient_type, created_at DESC);

-- NOTIFICATIONS — per-user cursor scan
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, user_type, created_at DESC);

-- TEACHER_PAYOUTS — history cursor
CREATE INDEX IF NOT EXISTS idx_teacher_payouts_status_processed
  ON teacher_payouts (status, processed_at DESC NULLS LAST)
  WHERE status IN ('completed', 'failed');

-- STUDENT_PAYMENTS — fast pending-queue counts
CREATE INDEX IF NOT EXISTS idx_student_payments_pending
  ON student_payments (created_at DESC)
  WHERE status = 'pending_verification';
