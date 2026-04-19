-- One-time backfill: existing confirmed payments on monthly cohorts get
-- payment_month set to the cohort's first billing month so the cron stops
-- misfiring. Only touches NULL payment_months.
UPDATE student_payments p
SET payment_month = date_trunc('month', c.start_date)::date
FROM enrollments e
JOIN cohorts c ON c.id = e.cohort_id
WHERE p.enrollment_id = e.id
  AND p.payment_month IS NULL
  AND p.status = 'confirmed'
  AND c.fee_type = 'monthly'
  AND c.billing_day IS NOT NULL;
