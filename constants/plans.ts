/**
 * Plan constants, upload limits, and reserved subdomains for the Skool Rooms LMS platform.
 * Derived from ARCHITECTURE.md Section 13 (Business Rules Reference).
 *
 * All values here are launch defaults. Live values are admin-configurable
 * via the `plans` table and `platform_settings` table. Never hardcode
 * these values in business logic — use `getLimit()` and `getPlatformSetting()`.
 */

import type { PlanSlug, LimitKey } from '@/types/domain'

// ═══════════════════════════════════════════
// Plan Types
// ═══════════════════════════════════════════

export type PlanLimits = {
  max_courses: number
  max_students: number
  max_cohorts_active: number
  max_storage_mb: number
  max_teachers: number
}

export type PlanDetails = {
  slug: PlanSlug
  name: string
  price_pkr: number
  trial_days: number
  transaction_cut_percent: number
  limits: PlanLimits
  display_order: number
  is_featured: boolean
}

// ═══════════════════════════════════════════
// Plan Slugs
// ═══════════════════════════════════════════

export const PLAN_SLUGS = {
  FREE: 'free',
  SOLO: 'solo',
  ACADEMY: 'academy',
} as const satisfies Record<string, PlanSlug>

// ═══════════════════════════════════════════
// Limit Keys
// ═══════════════════════════════════════════

export const LIMIT_KEYS = {
  MAX_COURSES: 'max_courses',
  MAX_STUDENTS: 'max_students',
  MAX_COHORTS_ACTIVE: 'max_cohorts_active',
  MAX_STORAGE_MB: 'max_storage_mb',
  MAX_TEACHERS: 'max_teachers',
} as const satisfies Record<string, LimitKey>

// ═══════════════════════════════════════════
// Plan Defaults (Launch Values)
// ═══════════════════════════════════════════

/**
 * Launch default plan configurations from ARCHITECTURE.md Section 13.
 * These values seed the `plans` table. Live values are admin-configurable.
 */
export const PLANS: Readonly<Record<PlanSlug, PlanDetails>> = {
  free: {
    slug: 'free',
    name: 'Free',
    price_pkr: 0,
    trial_days: 0,
    transaction_cut_percent: 15.0,
    limits: {
      max_courses: 1,
      max_students: 15,
      max_cohorts_active: 1,
      max_storage_mb: 500,
      max_teachers: 1,
    },
    display_order: 1,
    is_featured: false,
  },
  solo: {
    slug: 'solo',
    name: 'Solo',
    price_pkr: 1999,
    trial_days: 14,
    transaction_cut_percent: 10.0,
    limits: {
      max_courses: 5,
      max_students: 50,
      max_cohorts_active: 9999, // Unlimited
      max_storage_mb: 2048,
      max_teachers: 1,
    },
    display_order: 2,
    is_featured: true,
  },
  academy: {
    slug: 'academy',
    name: 'Academy',
    price_pkr: 3999,
    trial_days: 14,
    transaction_cut_percent: 8.0,
    limits: {
      max_courses: 9999, // Unlimited
      max_students: 200,
      max_cohorts_active: 9999, // Unlimited
      max_storage_mb: 10240,
      max_teachers: 3,
    },
    display_order: 3,
    is_featured: false,
  },
} as const

// ═══════════════════════════════════════════
// Upload Limits
// ═══════════════════════════════════════════

/** File type identifiers matching PresignInput.fileType in types/api.ts */
export type UploadFileType =
  | 'thumbnail'
  | 'profile'
  | 'assignment'
  | 'announcement'
  | 'submission'
  | 'screenshot'
  | 'qrcode'

/** Upload size limits in bytes. Matches ARCHITECTURE.md Section 13. */
export const UPLOAD_LIMITS: Readonly<Record<UploadFileType, number>> = {
  thumbnail: 5 * 1024 * 1024,     // 5 MB
  profile: 2 * 1024 * 1024,       // 2 MB
  assignment: 25 * 1024 * 1024,    // 25 MB
  announcement: 25 * 1024 * 1024,  // 25 MB
  submission: 50 * 1024 * 1024,    // 50 MB
  screenshot: 10 * 1024 * 1024,    // 10 MB
  qrcode: 2 * 1024 * 1024,        // 2 MB
} as const

/** Human-readable upload limit labels for error messages */
export const UPLOAD_LIMIT_LABELS: Readonly<Record<UploadFileType, string>> = {
  thumbnail: '5MB',
  profile: '2MB',
  assignment: '25MB',
  announcement: '25MB',
  submission: '50MB',
  screenshot: '10MB',
  qrcode: '2MB',
} as const

/** Allowed MIME types per upload file type */
export const UPLOAD_ALLOWED_FORMATS: Readonly<Record<UploadFileType, readonly string[]>> = {
  thumbnail: ['image/jpeg', 'image/png', 'image/webp'],
  profile: ['image/jpeg', 'image/png', 'image/webp'],
  assignment: ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  announcement: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  submission: ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'video/mp4'],
  screenshot: ['image/jpeg', 'image/png', 'application/pdf'],
  qrcode: ['image/jpeg', 'image/png', 'image/webp'],
} as const

// ═══════════════════════════════════════════
// Reserved Subdomains
// ═══════════════════════════════════════════

/**
 * Subdomains blocked from teacher registration.
 * Validated server-side during onboarding and subdomain change.
 */
export const RESERVED_SUBDOMAINS: readonly string[] = [
  'www',
  'students',
  'admin',
  'api',
  'mail',
  'smtp',
  'ftp',
  'pop',
  'imap',
  'dev',
  'staging',
  'test',
  'demo',
  'app',
  'dashboard',
  'portal',
  'help',
  'blog',
  'docs',
  'status',
  'cdn',
  'assets',
  'static',
  'files',
  'media',
] as const

// ═══════════════════════════════════════════
// Timing Rules
// ═══════════════════════════════════════════

/** Timing constants from ARCHITECTURE.md Section 13. All values in days unless noted. */
export const TIMING = {
  /** Days of full access after paid plan expiry before hard lock */
  GRACE_PERIOD_DAYS: 5,
  /** Default trial period for Solo/Academy (days) */
  TRIAL_DAYS: 14,
  /** Days before plan_expires_at to send renewal reminder email */
  RENEWAL_REMINDER_DAYS_BEFORE: 3,
  /** Days before trial_ends_at to send trial ending email */
  TRIAL_ENDING_REMINDER_DAYS_BEFORE: 2,
  /** Days before billing_day to send fee reminder */
  FEE_REMINDER_DAYS_BEFORE: 3,
  /** Days after billing_day to send overdue follow-up */
  FEE_OVERDUE_DAYS_AFTER: 5,
  /** Hours from marked_at within which attendance can be edited */
  ATTENDANCE_EDIT_WINDOW_HOURS: 24,
  /** Days from subdomain_changed_at before another change is allowed */
  SUBDOMAIN_CHANGE_COOLDOWN_DAYS: 30,
  /** Hours of inactivity before admin session timeout */
  ADMIN_SESSION_TIMEOUT_HOURS: 4,
  /** billing_day must be between 1 and this value (inclusive) */
  MAX_BILLING_DAY: 28,
} as const

// ═══════════════════════════════════════════
// Payout Defaults
// ═══════════════════════════════════════════

/** Minimum payout amount in PKR (admin-configurable via platform_settings) */
export const DEFAULT_MIN_PAYOUT_AMOUNT_PKR = 2500

/** Expected payout processing time in business days */
export const DEFAULT_PAYOUT_PROCESSING_DAYS = 3

// ═══════════════════════════════════════════
// Usage Thresholds
// ═══════════════════════════════════════════

/** Percentage thresholds for UsageBars component */
export const USAGE_THRESHOLDS = {
  /** Show amber/warning color at this percentage */
  WARNING_PERCENT: 80,
  /** Show red/danger color at this percentage */
  DANGER_PERCENT: 95,
  /** Hard block at this percentage */
  BLOCK_PERCENT: 100,
} as const

/** Value used to represent "unlimited" in plan limits (e.g., max_courses for Academy) */
export const UNLIMITED_VALUE = 9999
