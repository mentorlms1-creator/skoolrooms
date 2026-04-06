-- ============================================================================
-- 005_seed_data.sql
-- Seed data for plans, feature_registry, plan_features, and platform_settings.
-- Values match ARCHITECTURE.md Section 13 exactly.
-- ============================================================================

-- ============================================================================
-- PLANS (limits match ARCHITECTURE.md Section 13)
-- ============================================================================
INSERT INTO plans (name, slug, price_pkr, trial_days, transaction_cut_percent, max_courses, max_students, max_cohorts_active, max_storage_mb, max_teachers, display_order, is_active, is_visible) VALUES
  ('Free',    'free',    0,    0,  15.00, 1,    15,  1,    500,   1, 1, true, true),
  ('Solo',    'solo',    1999, 14, 10.00, 5,    50,  9999, 2048,  1, 2, true, true),
  ('Academy', 'academy', 3999, 14, 8.00,  9999, 200, 9999, 10240, 3, 3, true, true);

-- ============================================================================
-- FEATURE REGISTRY (17 features)
-- ============================================================================
INSERT INTO feature_registry (feature_key, display_name, description, category, is_limit_based) VALUES
  ('recurring_classes',       'Recurring Class Setup',       'Create recurring class schedules (daily/weekly/custom)',            'scheduling',     false),
  ('student_portal',          'Student Portal Access',       'Students get dedicated portal with dashboard',                     'branding',       false),
  ('class_reminders',         'Class Reminder Emails',       'Automated 24h and 1h class reminder emails',                      'communication',  false),
  ('analytics_dashboard',     'Analytics Dashboard',         'Revenue, student health, cohort analytics',                        'analytics',      false),
  ('attendance_tracking',     'Attendance Tracking',         'Mark and view attendance per class session',                       'scheduling',     false),
  ('assignment_submission',   'Assignment Submission',       'Create assignments and receive student submissions',               'scheduling',     false),
  ('fee_reminders',           'Monthly Fee Reminders',       'Automated billing day reminder emails for monthly cohorts',        'payments',       false),
  ('cohort_archive_history',  'Cohort Archive History',      'View full read-only history of archived cohorts',                  'scheduling',     false),
  ('revenue_analytics',       'Revenue Analytics',           'Revenue per cohort, projected revenue, 6-month chart',             'analytics',      false),
  ('student_health_signals',  'Student Health Signals',      'At-risk, disengaged, overdue fee indicators',                      'analytics',      false),
  ('progress_report_pdf',     'Progress Report PDF',         'One-click PDF progress report per student',                        'analytics',      false),
  ('waitlist',                'Waitlist',                    'Allow students to join waitlist when cohort is full',               'scheduling',     false),
  ('discount_codes',          'Discount Codes',              'Create per-cohort discount codes (fixed or percent)',              'payments',       false),
  ('whatsapp_notifications',  'WhatsApp Notifications',      'Class reminders and enrollment alerts via WhatsApp',              'communication',  false),
  ('multi_teacher',           'Multiple Teacher Accounts',   'Invite additional teachers to manage courses',                     'branding',       true),
  ('remove_branding',         'Remove Platform Branding',    'Hide "Powered by Skool Rooms" footer on teacher subdomain',          'branding',       false),
  ('custom_domain',           'Custom Domain',               'Use your own .com domain instead of subdomain',                   'branding',       false);

-- ============================================================================
-- PLAN FEATURES MATRIX (matches ARCHITECTURE.md Section 13)
-- ============================================================================

-- Free plan: ALL features disabled
INSERT INTO plan_features (plan_id, feature_key, is_enabled)
SELECT p.id, fr.feature_key, false
FROM plans p
CROSS JOIN feature_registry fr
WHERE p.slug = 'free';

-- Solo plan: all except multi_teacher, whatsapp_notifications, custom_domain
INSERT INTO plan_features (plan_id, feature_key, is_enabled)
SELECT p.id, fr.feature_key,
  CASE
    WHEN fr.feature_key IN (
      'multi_teacher',
      'whatsapp_notifications',
      'custom_domain'
    ) THEN false
    ELSE true
  END
FROM plans p
CROSS JOIN feature_registry fr
WHERE p.slug = 'solo';

-- Academy plan: all except custom_domain
INSERT INTO plan_features (plan_id, feature_key, is_enabled)
SELECT p.id, fr.feature_key,
  CASE
    WHEN fr.feature_key = 'custom_domain' THEN false
    ELSE true
  END
FROM plans p
CROSS JOIN feature_registry fr
WHERE p.slug = 'academy';

-- ============================================================================
-- PLATFORM SETTINGS (13 keys)
-- ============================================================================
INSERT INTO platform_settings (key, value, description) VALUES
  ('screenshot_payments_enabled',      'false', 'Show screenshot upload on payment pages'),
  ('payment_gateway_enabled',          'false', 'Enable gateway checkout'),
  ('active_gateway',                   'mock',  'safepay or payfast'),
  ('gateway_processing_fee_percent',   '2.50',  'Gateway fee % shown on payout breakdowns'),
  ('min_payout_amount_pkr',            '2500',  'Minimum balance for withdrawal'),
  ('payout_processing_days',           '3',     'SLA in business days shown to teachers'),
  ('r2_upload_limit_thumbnail_mb',     '5',     'Max course thumbnail size'),
  ('r2_upload_limit_profile_mb',       '2',     'Max profile photo size'),
  ('r2_upload_limit_assignment_mb',    '25',    'Max assignment file size'),
  ('r2_upload_limit_announcement_mb',  '25',    'Max announcement attachment size'),
  ('r2_upload_limit_submission_mb',    '50',    'Max student submission size'),
  ('refund_debit_recovery_enabled',    'true',  'Auto-deduct owed amounts from future earnings'),
  ('gateway_error_alert_threshold',    '5',     'Alert admin after N errors in 10 min');
