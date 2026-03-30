// =============================================================================
// types/domain.ts — Business domain types (as const objects for tree-shaking)
// =============================================================================

// -----------------------------------------------------------------------------
// EmailType — All notification email types (Section 8 of ARCHITECTURE.md)
// -----------------------------------------------------------------------------
export const EmailType = {
  // Enrollment lifecycle
  ENROLLMENT_CONFIRMED: 'enrollment_confirmed',
  ENROLLMENT_PENDING: 'enrollment_pending',
  ENROLLMENT_REJECTED: 'enrollment_rejected',
  ENROLLMENT_REFUNDED_COHORT_FULL: 'enrollment_refunded_cohort_full',
  WAITLIST_JOINED_AFTER_PAYMENT_REFUND: 'waitlist_joined_after_payment_refund',

  // Withdrawal
  STUDENT_WITHDRAWAL_REQUESTED: 'student_withdrawal_requested',
  WITHDRAWAL_APPROVED: 'withdrawal_approved',
  WITHDRAWAL_REJECTED: 'withdrawal_rejected',

  // Class reminders
  CLASS_REMINDER_24H: 'class_reminder_24h',
  CLASS_REMINDER_1H: 'class_reminder_1h',
  CLASS_CANCELLED: 'class_cancelled',

  // Payment
  PAYMENT_APPROVED: 'payment_approved',
  PAYMENT_REJECTED: 'payment_rejected',

  // Subscription & plan
  SUBSCRIPTION_RENEWAL_REMINDER: 'subscription_renewal_reminder',
  GRACE_PERIOD_DAILY_REMINDER: 'grace_period_daily_reminder',
  PLAN_HARD_LOCKED: 'plan_hard_locked',
  TRIAL_ENDING_SOON: 'trial_ending_soon',
  PLAN_DOWNGRADED: 'plan_downgraded',

  // Payouts
  PAYOUT_REQUESTED: 'payout_requested',
  PAYOUT_PROCESSED: 'payout_processed',
  PAYOUT_FAILED: 'payout_failed',
  PAYOUT_PENDING_ACTION: 'payout_pending_action',

  // Admin notifications
  NEW_SUBSCRIPTION_SCREENSHOT: 'new_subscription_screenshot',
  GATEWAY_ERROR_ALERT: 'gateway_error_alert',

  // Refund debit
  REFUND_DEBIT_RECORDED: 'refund_debit_recorded',
  REFUND_DEBIT_RECOVERED: 'refund_debit_recovered',

  // Waitlist
  WAITLIST_JOINED: 'waitlist_joined',
  WAITLIST_SLOTS_AVAILABLE: 'waitlist_slots_available',

  // Fee reminders
  FEE_REMINDER: 'fee_reminder',
  FEE_OVERDUE_5DAY: 'fee_overdue_5day',

  // Content
  NEW_ANNOUNCEMENT: 'new_announcement',
  STUDENT_COMMENT: 'student_comment',
  COHORT_ARCHIVED: 'cohort_archived',

  // Nudge crons
  ENROLLMENT_UNVERIFIED_24H: 'enrollment_unverified_24h',
  SUBSCRIPTION_SCREENSHOT_PENDING_48H: 'subscription_screenshot_pending_48h',

  // Misc
  NEW_ENROLLMENT_NOTIFICATION: 'new_enrollment_notification',
  NEW_MESSAGE: 'new_message',
  REFERRAL_CONVERTED: 'referral_converted',
} as const

export type EmailType = (typeof EmailType)[keyof typeof EmailType]

// -----------------------------------------------------------------------------
// PlanSlug
// -----------------------------------------------------------------------------
export const PlanSlug = {
  FREE: 'free',
  SOLO: 'solo',
  ACADEMY: 'academy',
} as const

export type PlanSlug = (typeof PlanSlug)[keyof typeof PlanSlug]

// -----------------------------------------------------------------------------
// LimitKey — Plan numeric limit keys
// -----------------------------------------------------------------------------
export const LimitKey = {
  MAX_COURSES: 'max_courses',
  MAX_STUDENTS: 'max_students',
  MAX_COHORTS_ACTIVE: 'max_cohorts_active',
  MAX_STORAGE_MB: 'max_storage_mb',
  MAX_TEACHERS: 'max_teachers',
} as const

export type LimitKey = (typeof LimitKey)[keyof typeof LimitKey]

// -----------------------------------------------------------------------------
// FeatureKey — All feature keys from feature_registry (Section 3)
// -----------------------------------------------------------------------------
export const FeatureKey = {
  ATTENDANCE_TRACKING: 'attendance_tracking',
  ASSIGNMENT_SUBMISSION: 'assignment_submission',
  ANALYTICS_DASHBOARD: 'analytics_dashboard',
  STUDENT_PORTAL: 'student_portal',
  CLASS_REMINDERS: 'class_reminders',
  WHATSAPP_NOTIFICATIONS: 'whatsapp_notifications',
  PROGRESS_REPORT_PDF: 'progress_report_pdf',
  COHORT_ARCHIVE_HISTORY: 'cohort_archive_history',
  FEE_REMINDERS: 'fee_reminders',
  REVENUE_ANALYTICS: 'revenue_analytics',
  STUDENT_HEALTH_SIGNALS: 'student_health_signals',
  CUSTOM_DOMAIN: 'custom_domain',
  MULTI_TEACHER: 'multi_teacher',
  REMOVE_BRANDING: 'remove_branding',
  RECURRING_CLASSES: 'recurring_classes',
  WAITLIST: 'waitlist',
  DISCOUNT_CODES: 'discount_codes',
} as const

export type FeatureKey = (typeof FeatureKey)[keyof typeof FeatureKey]

// -----------------------------------------------------------------------------
// CohortStatus
// -----------------------------------------------------------------------------
export const CohortStatus = {
  DRAFT: 'draft',
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const

export type CohortStatus = (typeof CohortStatus)[keyof typeof CohortStatus]

// -----------------------------------------------------------------------------
// EnrollmentStatus
// -----------------------------------------------------------------------------
export const EnrollmentStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  REVOKED: 'revoked',
} as const

export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus]

// -----------------------------------------------------------------------------
// PaymentStatus
// -----------------------------------------------------------------------------
export const PaymentStatus = {
  PENDING_VERIFICATION: 'pending_verification',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
} as const

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

// -----------------------------------------------------------------------------
// PayoutStatus
// -----------------------------------------------------------------------------
export const PayoutStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus]

// -----------------------------------------------------------------------------
// SubscriptionStatus
// -----------------------------------------------------------------------------
export const SubscriptionStatus = {
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  REJECTED: 'rejected',
} as const

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]

// -----------------------------------------------------------------------------
// CourseStatus
// -----------------------------------------------------------------------------
export const CourseStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const

export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus]

// -----------------------------------------------------------------------------
// PaymentMethod
// -----------------------------------------------------------------------------
export const PaymentMethod = {
  GATEWAY: 'gateway',
  SCREENSHOT: 'screenshot',
  MANUAL: 'manual',
} as const

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

// -----------------------------------------------------------------------------
// FeeType
// -----------------------------------------------------------------------------
export const FeeType = {
  ONE_TIME: 'one_time',
  MONTHLY: 'monthly',
} as const

export type FeeType = (typeof FeeType)[keyof typeof FeeType]

// -----------------------------------------------------------------------------
// SessionType
// -----------------------------------------------------------------------------
export const SessionType = {
  GROUP: 'group',
  ONE_ON_ONE: 'one_on_one',
} as const

export type SessionType = (typeof SessionType)[keyof typeof SessionType]

// -----------------------------------------------------------------------------
// SubmissionStatus
// -----------------------------------------------------------------------------
export const SubmissionStatus = {
  SUBMITTED: 'submitted',
  REVIEWED: 'reviewed',
  OVERDUE: 'overdue',
} as const

export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus]

// -----------------------------------------------------------------------------
// WaitlistStatus
// -----------------------------------------------------------------------------
export const WaitlistStatus = {
  WAITING: 'waiting',
  ENROLLED: 'enrolled',
  EXPIRED: 'expired',
  REMOVED: 'removed',
} as const

export type WaitlistStatus = (typeof WaitlistStatus)[keyof typeof WaitlistStatus]

// -----------------------------------------------------------------------------
// DiscountType
// -----------------------------------------------------------------------------
export const DiscountType = {
  FIXED: 'fixed',
  PERCENT: 'percent',
} as const

export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType]

// -----------------------------------------------------------------------------
// FileType — Upload file categories (used by presign endpoint + FileUpload)
// -----------------------------------------------------------------------------
export const FileType = {
  THUMBNAIL: 'thumbnail',
  PROFILE: 'profile',
  ASSIGNMENT: 'assignment',
  ANNOUNCEMENT: 'announcement',
  SUBMISSION: 'submission',
  SCREENSHOT: 'screenshot',
  QR_CODE: 'qrcode',
} as const

export type FileType = (typeof FileType)[keyof typeof FileType]
