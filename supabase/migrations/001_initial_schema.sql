-- ============================================================================
-- Lumscribe LMS — Initial Schema
-- Migration 001: All 31 tables in dependency order
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. plans (no dependencies — referenced by teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  price_pkr int NOT NULL,
  is_active bool DEFAULT true,
  is_visible bool DEFAULT true,
  is_featured bool DEFAULT false,
  display_order int NOT NULL,
  max_courses int NOT NULL,
  max_students int NOT NULL,
  max_cohorts_active int NOT NULL,
  max_storage_mb int NOT NULL,
  max_teachers int DEFAULT 1,
  trial_days int DEFAULT 14,
  transaction_cut_percent decimal(5,2) NOT NULL,
  grandfathered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 2. feature_registry (no dependencies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS feature_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  is_limit_based bool DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 3. plan_features (depends on: plans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id),
  feature_key text NOT NULL,
  is_enabled bool NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, feature_key)
);

-- ============================================================================
-- 4. teachers (depends on: plans via slug)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_auth_id uuid UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  pending_email text,
  email_verified_at timestamptz,
  subdomain text UNIQUE NOT NULL,
  subdomain_changed_at timestamptz,
  plan text NOT NULL DEFAULT 'free' REFERENCES plans(slug),
  plan_expires_at timestamptz,
  grace_until timestamptz,
  trial_ends_at timestamptz,
  onboarding_completed bool DEFAULT false,
  onboarding_steps_json jsonb DEFAULT '{"profile_complete": false, "payment_details_set": false, "course_created": false, "cohort_created": false, "link_shared": false}',
  referral_code text UNIQUE,
  is_publicly_listed bool DEFAULT true,
  subject_tags text[] DEFAULT '{}',
  teaching_levels text[] DEFAULT '{}',
  profile_photo_url text,
  city text,
  bio text,
  notification_preferences_json jsonb DEFAULT '{}',
  is_suspended bool DEFAULT false,
  suspended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 5. courses (depends on: teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  thumbnail_url text,
  category text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 6. cohorts (depends on: courses, teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  name text NOT NULL,
  session_type text DEFAULT 'group',
  start_date date NOT NULL,
  end_date date NOT NULL,
  max_students int,
  fee_type text NOT NULL,
  fee_pkr int NOT NULL,
  billing_day int CHECK (billing_day >= 1 AND billing_day <= 28),
  invite_token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  is_registration_open bool DEFAULT true,
  pending_can_see_schedule bool DEFAULT false,
  pending_can_see_announcements bool DEFAULT false,
  waitlist_enabled bool DEFAULT false,
  archived_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 7. class_sessions (depends on: cohorts, self-referencing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id),
  meet_link text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int DEFAULT 60,
  is_recurring bool DEFAULT false,
  recurrence_rule text,
  cancelled_at timestamptz,
  rescheduled_to_id uuid REFERENCES class_sessions(id),
  deleted_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 8. students (no dependencies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_auth_id uuid UNIQUE,
  name text NOT NULL,
  phone text NOT NULL,
  email text UNIQUE NOT NULL,
  pending_email text,
  parent_name text,
  parent_phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 9. enrollments (depends on: students, cohorts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  cohort_id uuid NOT NULL REFERENCES cohorts(id),
  status text NOT NULL DEFAULT 'pending',
  reference_code text UNIQUE NOT NULL,
  withdrawal_requested_at timestamptz,
  withdrawal_reason text,
  revoke_reason text,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 10. student_payments (depends on: enrollments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id),
  amount_pkr int NOT NULL,
  discounted_amount_pkr int NOT NULL,
  platform_cut_pkr int NOT NULL,
  teacher_payout_amount_pkr int NOT NULL,
  payment_month date,
  payment_method text NOT NULL,
  gateway_transaction_id text,
  idempotency_key text UNIQUE,
  screenshot_url text,
  transaction_id text,
  reference_code text NOT NULL,
  discount_code_id uuid,
  status text NOT NULL,
  verified_at timestamptz,
  rejection_reason text,
  refunded_at timestamptz,
  refund_note text,
  platform_absorbed_refund bool DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 11. teacher_subscriptions (depends on: teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  plan text NOT NULL,
  amount_pkr int NOT NULL,
  payment_method text NOT NULL,
  gateway_transaction_id text,
  screenshot_url text,
  status text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 12. teacher_payment_settings (depends on: teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid UNIQUE NOT NULL REFERENCES teachers(id),
  payout_bank_name text,
  payout_account_title text,
  payout_iban text,
  jazzcash_number text,
  easypaisa_number text,
  qr_code_url text,
  instructions text,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 13. teacher_balances (depends on: teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid UNIQUE NOT NULL REFERENCES teachers(id),
  available_balance_pkr int DEFAULT 0,
  pending_balance_pkr int DEFAULT 0,
  total_earned_pkr int DEFAULT 0,
  total_paid_out_pkr int DEFAULT 0,
  outstanding_debit_pkr int DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 14. teacher_payouts (depends on: teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  amount_pkr int NOT NULL,
  bank_details_snapshot_json jsonb,
  status text NOT NULL,
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  admin_note text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 15. teacher_plan_snapshot (depends on: teachers, plans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_plan_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  plan_id uuid NOT NULL REFERENCES plans(id),
  snapshot_json jsonb NOT NULL,
  captured_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 16. announcements (depends on: cohorts, teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  body text NOT NULL,
  file_url text,
  pinned bool DEFAULT false,
  pinned_at timestamptz,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 17. announcement_comments (depends on: announcements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcement_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id),
  author_id uuid NOT NULL,
  author_type text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- ============================================================================
-- 18. announcement_reads (depends on: announcements, students)
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id),
  student_id uuid NOT NULL REFERENCES students(id),
  read_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, student_id)
);

-- ============================================================================
-- 19. attendance (depends on: class_sessions, students)
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id uuid NOT NULL REFERENCES class_sessions(id),
  student_id uuid NOT NULL REFERENCES students(id),
  present bool NOT NULL,
  marked_at timestamptz DEFAULT now(),
  UNIQUE(class_session_id, student_id)
);

-- ============================================================================
-- 20. assignments (depends on: cohorts, teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  title text NOT NULL,
  description text NOT NULL,
  file_url text,
  due_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- ============================================================================
-- 21. assignment_submissions (depends on: assignments, students)
-- ============================================================================
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id),
  student_id uuid NOT NULL REFERENCES students(id),
  text_answer text,
  file_url text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  status text NOT NULL,
  UNIQUE(assignment_id, student_id)
);

-- ============================================================================
-- 22. discount_codes (depends on: teachers, cohorts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  cohort_id uuid NOT NULL REFERENCES cohorts(id),
  code text NOT NULL,
  discount_type text NOT NULL,
  discount_value int NOT NULL,
  max_uses int,
  use_count int DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 23. cohort_waitlist (depends on: cohorts, students)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cohort_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id),
  student_id uuid REFERENCES students(id),
  student_name text NOT NULL,
  student_phone text NOT NULL,
  student_email text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  status text NOT NULL,
  teacher_note text,
  UNIQUE(cohort_id, student_email)
);

-- ============================================================================
-- 24. platform_settings (no dependencies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 25. explore_page_views (depends on: teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS explore_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  viewer_ip_hash text NOT NULL,
  source text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 26. admin_activity_log (no strict FK — teacher_id is optional)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid,
  action_type text NOT NULL,
  performed_by text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 27. notifications_log (no dependencies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text NOT NULL,
  recipient_id uuid NOT NULL,
  type text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  metadata jsonb,
  sent_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 28. email_delivery_log (depends on: notifications_log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_log_id uuid REFERENCES notifications_log(id),
  recipient_email text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  provider_message_id text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 29. direct_messages (Phase 2 — schema created now; depends on: teachers, students)
-- ============================================================================
CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  student_id uuid NOT NULL REFERENCES students(id),
  sender_type text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 30. cohort_feedback (Phase 2 — schema created now; depends on: cohorts, students)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cohort_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES cohorts(id),
  student_id uuid NOT NULL REFERENCES students(id),
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cohort_id, student_id)
);

-- ============================================================================
-- 31. referrals (Phase 2 — schema created now; depends on: teachers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_teacher_id uuid NOT NULL REFERENCES teachers(id),
  referred_teacher_id uuid UNIQUE NOT NULL REFERENCES teachers(id),
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  credit_applied_at timestamptz,
  created_at timestamptz DEFAULT now()
);
