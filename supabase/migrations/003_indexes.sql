-- ============================================================================
-- 003_indexes.sql
-- Performance indexes for all tables.
-- ============================================================================

-- ============================================================================
-- ENROLLMENTS
-- ============================================================================
CREATE INDEX idx_enrollments_cohort_id ON enrollments (cohort_id);
CREATE INDEX idx_enrollments_student_id ON enrollments (student_id);

-- ============================================================================
-- STUDENT_PAYMENTS
-- ============================================================================
CREATE INDEX idx_student_payments_enrollment_id ON student_payments (enrollment_id);
CREATE INDEX idx_student_payments_created_at ON student_payments (created_at);

-- ============================================================================
-- CLASS_SESSIONS
-- ============================================================================
CREATE INDEX idx_class_sessions_cohort_id ON class_sessions (cohort_id);
CREATE INDEX idx_class_sessions_scheduled_at ON class_sessions (scheduled_at);

-- ============================================================================
-- ATTENDANCE
-- ============================================================================
CREATE INDEX idx_attendance_class_session_id ON attendance (class_session_id);
CREATE INDEX idx_attendance_student_id ON attendance (student_id);

-- ============================================================================
-- ANNOUNCEMENTS
-- ============================================================================
CREATE INDEX idx_announcements_cohort_id ON announcements (cohort_id);

-- ============================================================================
-- ANNOUNCEMENT_READS
-- ============================================================================
CREATE INDEX idx_announcement_reads_announcement_id ON announcement_reads (announcement_id);
CREATE INDEX idx_announcement_reads_student_id ON announcement_reads (student_id);

-- ============================================================================
-- ASSIGNMENTS
-- ============================================================================
CREATE INDEX idx_assignments_cohort_id ON assignments (cohort_id);

-- ============================================================================
-- ASSIGNMENT_SUBMISSIONS
-- ============================================================================
CREATE INDEX idx_assignment_submissions_assignment_id ON assignment_submissions (assignment_id);
CREATE INDEX idx_assignment_submissions_student_id ON assignment_submissions (student_id);

-- ============================================================================
-- NOTIFICATIONS_LOG
-- ============================================================================
CREATE INDEX idx_notifications_log_recipient ON notifications_log (recipient_id, recipient_type);
CREATE INDEX idx_notifications_log_type ON notifications_log (type);
CREATE INDEX idx_notifications_log_sent_at ON notifications_log (sent_at);

-- ============================================================================
-- EMAIL_DELIVERY_LOG
-- ============================================================================
CREATE INDEX idx_email_delivery_log_provider_message_id ON email_delivery_log (provider_message_id);
CREATE INDEX idx_email_delivery_log_status ON email_delivery_log (status);
CREATE INDEX idx_email_delivery_log_notification_log_id ON email_delivery_log (notification_log_id);

-- ============================================================================
-- COHORTS
-- ============================================================================
CREATE INDEX idx_cohorts_course_id ON cohorts (course_id);

-- ============================================================================
-- COHORT_WAITLIST
-- ============================================================================
CREATE INDEX idx_cohort_waitlist_cohort_id ON cohort_waitlist (cohort_id);
CREATE INDEX idx_cohort_waitlist_cohort_status ON cohort_waitlist (cohort_id, status);

-- ============================================================================
-- TEACHER_PLAN_SNAPSHOT
-- ============================================================================
CREATE INDEX idx_teacher_plan_snapshot_teacher_id ON teacher_plan_snapshot (teacher_id);

-- ============================================================================
-- TEACHER_PAYOUTS
-- ============================================================================
CREATE INDEX idx_teacher_payouts_teacher_status ON teacher_payouts (teacher_id, status);
CREATE INDEX idx_teacher_payouts_created_at ON teacher_payouts (created_at);

-- ============================================================================
-- DISCOUNT_CODES
-- ============================================================================
CREATE INDEX idx_discount_codes_cohort_id ON discount_codes (cohort_id);
CREATE INDEX idx_discount_codes_teacher_id ON discount_codes (teacher_id);
CREATE UNIQUE INDEX idx_discount_codes_cohort_code ON discount_codes (cohort_id, UPPER(code));

-- ============================================================================
-- ADMIN_ACTIVITY_LOG
-- ============================================================================
CREATE INDEX idx_admin_activity_log_teacher_id ON admin_activity_log (teacher_id);
CREATE INDEX idx_admin_activity_log_action_type ON admin_activity_log (action_type);
CREATE INDEX idx_admin_activity_log_created_at ON admin_activity_log (created_at);

-- ============================================================================
-- EXPLORE_PAGE_VIEWS
-- ============================================================================
CREATE INDEX idx_explore_page_views_teacher_created ON explore_page_views (teacher_id, created_at);

-- ============================================================================
-- PHASE 2 TABLES
-- ============================================================================
CREATE INDEX idx_direct_messages_thread ON direct_messages (teacher_id, student_id);
CREATE INDEX idx_direct_messages_created_at ON direct_messages (created_at);
CREATE INDEX idx_cohort_feedback_cohort_id ON cohort_feedback (cohort_id);
CREATE INDEX idx_referrals_referrer ON referrals (referrer_teacher_id);

-- ============================================================================
-- TEACHER_SUBSCRIPTIONS
-- ============================================================================
CREATE INDEX idx_teacher_subscriptions_teacher_id ON teacher_subscriptions (teacher_id);
