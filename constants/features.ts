/**
 * Feature key constants and display metadata for the Skool Rooms LMS platform.
 * Derived from ARCHITECTURE.md feature_registry seed data.
 *
 * These keys map 1:1 to the `feature_registry` table's `feature_key` column
 * and the `FeatureKey` type in `types/domain.ts`.
 */

import type { FeatureKey } from '@/types/domain'

/** Feature categories matching the feature_registry.category column */
export type FeatureCategory = 'scheduling' | 'payments' | 'communication' | 'analytics' | 'branding'

/** Display information for a feature */
export type FeatureInfo = {
  key: FeatureKey
  displayName: string
  description: string
  category: FeatureCategory
  isLimitBased: boolean
}

/**
 * Feature key constants — use these instead of raw strings.
 * Example: `canUseFeature(teacherId, FEATURE_KEYS.ATTENDANCE)`
 */
export const FEATURE_KEYS = {
  RECURRING_CLASSES: 'recurring_classes',
  STUDENT_PORTAL: 'student_portal',
  CLASS_REMINDERS: 'class_reminders',
  ANALYTICS_DASHBOARD: 'analytics_dashboard',
  ATTENDANCE: 'attendance_tracking',
  ASSIGNMENTS: 'assignment_submission',
  FEE_REMINDERS: 'fee_reminders',
  COHORT_ARCHIVE_HISTORY: 'cohort_archive_history',
  REVENUE_ANALYTICS: 'revenue_analytics',
  STUDENT_HEALTH_SIGNALS: 'student_health_signals',
  PROGRESS_REPORT_PDF: 'progress_report_pdf',
  WAITLIST: 'waitlist',
  DISCOUNT_CODES: 'discount_codes',
  WHATSAPP_NOTIFICATIONS: 'whatsapp_notifications',
  MULTI_TEACHER: 'multi_teacher',
  REMOVE_BRANDING: 'remove_branding',
  CUSTOM_DOMAIN: 'custom_domain',
} as const satisfies Record<string, FeatureKey>

/**
 * Complete feature registry with display metadata.
 * Mirrors the `feature_registry` table seed data from 005_seed_data.sql.
 *
 * All 17 features with their display names, descriptions, categories,
 * and whether they are limit-based.
 */
export const FEATURE_REGISTRY: readonly FeatureInfo[] = [
  {
    key: 'recurring_classes',
    displayName: 'Recurring Class Setup',
    description: 'Create recurring class schedules (daily/weekly/custom)',
    category: 'scheduling',
    isLimitBased: false,
  },
  {
    key: 'student_portal',
    displayName: 'Student Portal Access',
    description: 'Students get dedicated portal with dashboard',
    category: 'branding',
    isLimitBased: false,
  },
  {
    key: 'class_reminders',
    displayName: 'Class Reminder Emails',
    description: 'Automated 24h and 1h class reminder emails',
    category: 'communication',
    isLimitBased: false,
  },
  {
    key: 'analytics_dashboard',
    displayName: 'Analytics Dashboard',
    description: 'Revenue, student health, cohort analytics',
    category: 'analytics',
    isLimitBased: false,
  },
  {
    key: 'attendance_tracking',
    displayName: 'Attendance Tracking',
    description: 'Mark and view attendance per class session',
    category: 'scheduling',
    isLimitBased: false,
  },
  {
    key: 'assignment_submission',
    displayName: 'Assignment Submission',
    description: 'Create assignments and receive student submissions',
    category: 'scheduling',
    isLimitBased: false,
  },
  {
    key: 'fee_reminders',
    displayName: 'Monthly Fee Reminders',
    description: 'Automated billing day reminder emails for monthly cohorts',
    category: 'payments',
    isLimitBased: false,
  },
  {
    key: 'cohort_archive_history',
    displayName: 'Cohort Archive History',
    description: 'View full read-only history of archived cohorts',
    category: 'scheduling',
    isLimitBased: false,
  },
  {
    key: 'revenue_analytics',
    displayName: 'Revenue Analytics',
    description: 'Revenue per cohort, projected revenue, 6-month chart',
    category: 'analytics',
    isLimitBased: false,
  },
  {
    key: 'student_health_signals',
    displayName: 'Student Health Signals',
    description: 'At-risk, disengaged, overdue fee indicators',
    category: 'analytics',
    isLimitBased: false,
  },
  {
    key: 'progress_report_pdf',
    displayName: 'Progress Report PDF',
    description: 'One-click PDF progress report per student',
    category: 'analytics',
    isLimitBased: false,
  },
  {
    key: 'waitlist',
    displayName: 'Waitlist',
    description: 'Allow students to join waitlist when cohort is full',
    category: 'scheduling',
    isLimitBased: false,
  },
  {
    key: 'discount_codes',
    displayName: 'Discount Codes',
    description: 'Create per-cohort discount codes (fixed or percent)',
    category: 'payments',
    isLimitBased: false,
  },
  {
    key: 'whatsapp_notifications',
    displayName: 'WhatsApp Notifications',
    description: 'Class reminders and enrollment alerts via WhatsApp',
    category: 'communication',
    isLimitBased: false,
  },
  {
    key: 'multi_teacher',
    displayName: 'Multiple Teacher Accounts',
    description: 'Invite additional teachers to manage courses',
    category: 'branding',
    isLimitBased: true,
  },
  {
    key: 'remove_branding',
    displayName: 'Remove Platform Branding',
    description: 'Hide "Powered by Skool Rooms" footer on teacher subdomain',
    category: 'branding',
    isLimitBased: false,
  },
  {
    key: 'custom_domain',
    displayName: 'Custom Domain',
    description: 'Use your own .com domain instead of subdomain',
    category: 'branding',
    isLimitBased: false,
  },
] as const

/**
 * Feature registry indexed by feature key for O(1) lookups.
 */
export const FEATURE_REGISTRY_MAP: Readonly<Record<FeatureKey, FeatureInfo>> =
  FEATURE_REGISTRY.reduce(
    (acc, feature) => {
      acc[feature.key] = feature
      return acc
    },
    {} as Record<FeatureKey, FeatureInfo>,
  )

/**
 * Default feature flags per plan (launch defaults from ARCHITECTURE.md Section 13).
 * Used for seeding and reference — live values come from the plan_features table.
 */
export const DEFAULT_PLAN_FEATURES: Readonly<Record<string, Readonly<Record<FeatureKey, boolean>>>> = {
  free: {
    recurring_classes: false,
    student_portal: false,
    class_reminders: false,
    analytics_dashboard: false,
    attendance_tracking: false,
    assignment_submission: false,
    fee_reminders: false,
    cohort_archive_history: false,
    revenue_analytics: false,
    student_health_signals: false,
    progress_report_pdf: false,
    waitlist: false,
    discount_codes: false,
    whatsapp_notifications: false,
    multi_teacher: false,
    remove_branding: false,
    custom_domain: false,
  },
  solo: {
    recurring_classes: true,
    student_portal: true,
    class_reminders: true,
    analytics_dashboard: true,
    attendance_tracking: true,
    assignment_submission: true,
    fee_reminders: true,
    cohort_archive_history: true,
    revenue_analytics: true,
    student_health_signals: true,
    progress_report_pdf: true,
    waitlist: true,
    discount_codes: true,
    whatsapp_notifications: false,
    multi_teacher: false,
    remove_branding: true,
    custom_domain: false,
  },
  academy: {
    recurring_classes: true,
    student_portal: true,
    class_reminders: true,
    analytics_dashboard: true,
    attendance_tracking: true,
    assignment_submission: true,
    fee_reminders: true,
    cohort_archive_history: true,
    revenue_analytics: true,
    student_health_signals: true,
    progress_report_pdf: true,
    waitlist: true,
    discount_codes: true,
    whatsapp_notifications: true,
    multi_teacher: true,
    remove_branding: true,
    custom_domain: false, // Add-on in Phase 3
  },
} as const
