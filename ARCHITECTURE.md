# ARCHITECTURE.md — LMS SaaS Platform (Skool Rooms)

> **This is the single source of truth for Claude Code.**
> Read this entire file before writing any code. Every system, pattern, and rule is here.
> Platform domain placeholder: `skoolrooms.com` — controlled by `NEXT_PUBLIC_PLATFORM_DOMAIN` env var.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16 |
| UI | React | 19 |
| Styling | Tailwind CSS (CSS-first config via `@theme`, no tailwind.config.js) | v4 |
| Database + Auth | Supabase (`@supabase/ssr` for server auth, `@supabase/supabase-js` for client) | Latest |
| File Storage | Cloudflare R2 | — |
| DNS | Cloudflare DNS API | — |
| Email | Brevo (`@getbrevo/brevo`) | — |
| Hosting | Vercel Pro (wildcard SSL) | — |
| Language | TypeScript (strict mode) | 5.x |

> **Next.js 16 note:** All `params` and `searchParams` in page/layout components are `Promise` types — must use `await` in server components or `use()` in client components. `cookies()` and `headers()` are also async.
> **Tailwind v4 note:** No `tailwind.config.js`. Theme defined in CSS via `@theme` directive in `app/globals.css`. PostCSS uses `@tailwindcss/postcss` (replaces `tailwindcss` + `autoprefixer`).
> **Supabase note:** Use `@supabase/ssr` package (NOT deprecated `@supabase/auth-helpers-nextjs`). Server client uses `getAll`/`setAll` cookie pattern.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Shared Code Architecture](#2-shared-code-architecture)
3. [Database Schema](#3-database-schema)
4. [Authentication](#4-authentication)
5. [API Layer](#5-api-layer)
6. [Realtime Subscriptions](#6-realtime-subscriptions)
7. [Payment Flows](#7-payment-flows)
8. [Notifications](#8-notifications)
9. [Critical Systems](#9-critical-systems)
10. [UI Architecture](#10-ui-architecture)
11. [Environment Variables](#11-environment-variables)
12. [Phased Build Plan](#12-phased-build-plan)
13. [Business Rules Reference](#13-business-rules-reference)
14. [Edge Cases](#14-edge-cases)

---

## 1. Project Structure

### Every Folder and File

```
/
├── app/                                  # Next.js 16 App Router
│   │
│   ├── (platform)/                       # skoolrooms.com routes
│   │   ├── layout.tsx                    # Platform root layout
│   │   ├── page.tsx                      # Marketing homepage
│   │   ├── explore/
│   │   │   └── page.tsx                  # Public teacher directory (SSR)
│   │   ├── login/
│   │   │   └── page.tsx                  # Teacher login
│   │   ├── signup/
│   │   │   └── page.tsx                  # Teacher signup
│   │   ├── subscribe/
│   │   │   └── page.tsx                  # Teacher subscription payment page
│   │   ├── pricing/
│   │   │   └── page.tsx                  # Pricing page (public)
│   │   └── admin/                        # Admin panel — requires admin role
│   │       ├── layout.tsx                # Admin layout + auth guard
│   │       ├── page.tsx                  # Admin dashboard
│   │       ├── teachers/
│   │       │   ├── page.tsx              # Teacher list
│   │       │   └── [teacherId]/page.tsx  # Teacher detail + actions
│   │       ├── payments/
│   │       │   └── page.tsx              # Subscription screenshot queue
│   │       ├── payouts/
│   │       │   └── page.tsx              # Payout processing queue
│   │       ├── plans/
│   │       │   ├── page.tsx              # Plan list
│   │       │   └── [planId]/page.tsx     # Plan editor
│   │       ├── settings/
│   │       │   └── page.tsx              # Platform settings
│   │       ├── operations/
│   │       │   └── page.tsx              # System health panel
│   │       ├── earnings/
│   │       │   └── page.tsx              # Platform earnings panel (Phase 2)
│   │       └── analytics/
│   │           └── page.tsx              # KPI dashboard (Phase 2) — /admin/analytics
│   │
│   ├── (teacher)/                        # Teacher dashboard — requires teacher auth
│   │   ├── layout.tsx                    # Teacher layout + auth guard
│   │   ├── onboarding/                   # Post-signup onboarding (requires teacher auth)
│   │   │   ├── layout.tsx                # Onboarding layout
│   │   │   ├── step-1/page.tsx           # Subject + teaching level
│   │   │   ├── step-2/page.tsx           # Subdomain picker
│   │   │   └── step-3/page.tsx           # Profile photo + bio
│   │   ├── dashboard/
│   │   │   ├── page.tsx                  # Teacher home (stats, usage bars, todos)
│   │   │   ├── courses/
│   │   │   │   ├── page.tsx              # Course list
│   │   │   │   ├── new/page.tsx          # Create course
│   │   │   │   └── [courseId]/
│   │   │   │       ├── page.tsx          # Course detail
│   │   │   │       ├── edit/page.tsx     # Edit course
│   │   │   │       └── cohorts/
│   │   │   │           ├── new/page.tsx  # Create cohort
│   │   │   │           └── [cohortId]/
│   │   │   │               ├── page.tsx  # Cohort overview
│   │   │   │               ├── students/page.tsx
│   │   │   │               ├── schedule/page.tsx
│   │   │   │               ├── announcements/page.tsx
│   │   │   │               ├── assignments/page.tsx
│   │   │   │               ├── attendance/page.tsx
│   │   │   │               └── payments/page.tsx
│   │   │   ├── students/
│   │   │   │   ├── page.tsx              # All students across courses
│   │   │   │   └── [studentId]/page.tsx  # Student detail
│   │   │   ├── payments/
│   │   │   │   ├── page.tsx              # Payment verification queue (screenshot mode)
│   │   │   │   └── history/page.tsx
│   │   │   ├── earnings/
│   │   │   │   └── page.tsx              # Balance + payout request
│   │   │   ├── messages/
│   │   │   │   └── page.tsx              # Direct messages with students (Phase 2)
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx              # Revenue + student health signals
│   │   │   └── settings/
│   │   │       ├── page.tsx              # Profile settings
│   │   │       ├── payments/page.tsx     # Bank / payout details
│   │   │       ├── notifications/page.tsx # Notification preferences
│   │   │       ├── plan/page.tsx         # Current plan + usage + grandfathered limits
│   │   │       └── billing/page.tsx      # Subscription history log (Phase 2)
│   │
│   ├── (student)/                        # students.skoolrooms.com — requires student auth
│   │   └── student/                      # Nested for /student/* URL prefix
│   │       ├── layout.tsx
│   │       ├── page.tsx                  # Student dashboard (upcoming classes)
│   │       ├── courses/
│   │       │   └── [enrollmentId]/page.tsx  # Enrolled course detail
│   │       ├── settings/
│   │       │   └── form.tsx              # Student settings form
│   │       └── loading.tsx               # Student portal loading skeleton
│   │
│   ├── (teacher-public)/                 # Rewrite target for teacher subdomains
│   │   ├── layout.tsx
│   │   └── [subdomain]/
│   │       ├── page.tsx                  # Teacher public landing page
│   │       ├── courses/
│   │       │   └── [courseId]/page.tsx
│   │       └── join/
│   │           └── [token]/
│   │               ├── page.tsx              # Cohort enroll page (or Coming Soon / Waitlist / Closed based on state)
│   │               └── pay/
│   │                   └── [enrollmentId]/
│   │                       └── page.tsx      # Payment page — student auth required
│   │
│   ├── student-login/
│   │   └── page.tsx                      # Student login/signup
│   ├── forgot-password/
│   │   └── page.tsx                      # Teacher forgot password (email entry)
│   ├── auth/
│   │   └── reset-password/
│   │       └── page.tsx                  # Password reset callback (token from URL)
│   ├── student-forgot-password/
│   │   └── page.tsx                      # Student forgot password
│   │
│   └── api/                              # API Routes — webhooks, crons, external integrations ONLY
│       ├── auth/
│       │   └── callback/route.ts         # Supabase OAuth callback handler
│       ├── cloudflare/
│       │   └── subdomain/route.ts        # Create/update DNS record via Cloudflare API
│       ├── r2/
│       │   └── presign/route.ts          # Generate pre-signed R2 upload URLs
│       ├── student/
│       │   └── enroll/route.ts           # Atomic student enrollment (slot check + payment)
│       ├── explore/
│       │   └── track/route.ts            # Analytics tracking for explore page views
│       ├── public/
│       │   └── cohort/[token]/
│       │       └── payment-info/route.ts # Public payment info for student payment page
│       ├── webhooks/
│       │   └── payment/route.ts          # Payment gateway webhook handler (NOT YET BUILT)
│       └── cron/
│           ├── archive-cohorts/route.ts  # Nightly: archive past-end-date cohorts
│           ├── fee-reminders/route.ts    # Daily 12:00 UTC: fee reminder emails
│           ├── class-reminders/route.ts  # Hourly: 24h and 1h class reminders
│           ├── trial-expiry/route.ts     # Daily: downgrade expired trials
│           ├── renewal-reminders/route.ts # Daily 08:00 UTC: subscription + trial ending emails
│           ├── grace-period/route.ts      # Daily 07:00 UTC: grace emails + hard lock
│           ├── enrollment-nudge/route.ts  # Daily 14:00 UTC: 24h unverified enrollment nudge
│           └── subscription-nudge/route.ts # Daily 09:00 UTC: 48h admin screenshot nudge
│
├── lib/                                  # All business logic — no raw Supabase in components
│   ├── utils.ts                          # cn() utility (clsx + tailwind-merge) for class composition
│   ├── payment/
│   │   ├── provider.ts                   # PaymentProvider interface + active instance
│   │   ├── safepay.ts                    # Safepay adapter
│   │   ├── payfast.ts                    # Payfast adapter
│   │   └── mock.ts                       # Mock adapter (dev + screenshot-primary mode)
│   ├── plans/
│   │   ├── features.ts                   # canUseFeature(teacherId, featureKey)
│   │   └── limits.ts                     # getLimit(teacherId, limitKey)
│   ├── platform/
│   │   ├── domain.ts                     # platformDomain(), teacherSubdomainUrl(), studentPortalUrl()
│   │   └── settings.ts                   # getPlatformSetting() with 1min cache
│   ├── time/
│   │   └── pkt.ts                        # currentPKT(), formatPKT()
│   ├── r2/
│   │   └── upload.ts                     # getPresignedUploadUrl(), deleteR2File()
│   ├── cloudflare/
│   │   └── dns.ts                        # createSubdomainRecord(), deleteSubdomainRecord()
│   ├── email/
│   │   └── sender.ts                     # sendEmail() — all emails go through here
│   └── db/                               # Service layer — all DB queries go here
│       ├── teachers.ts
│       ├── students.ts
│       ├── courses.ts
│       ├── cohorts.ts
│       ├── enrollments.ts
│       ├── payments.ts
│       ├── balances.ts
│       ├── announcements.ts
│       ├── attendance.ts
│       ├── assignments.ts
│       ├── plans.ts
│       ├── waitlist.ts
│       ├── notifications.ts
│       ├── messages.ts
│       ├── referrals.ts
│       ├── feedback.ts
│       └── notifications.ts              # notifications_log + email_delivery_log queries
│   └── actions/                          # Server Actions — all mutations go here (NOT API routes)
│       ├── admin.ts                      # Admin panel mutations
│       ├── announcements.ts              # Create/update announcements
│       ├── assignments.ts                # Create/update assignments
│       ├── attendance.ts                 # Save attendance records
│       ├── class-sessions.ts             # Create/cancel class sessions
│       ├── cohorts.ts                    # Create/update/archive cohorts
│       ├── courses.ts                    # Create/update/delete courses
│       ├── enrollment-management.ts      # Approve/reject/manual enrollments, withdrawals
│       ├── enrollments.ts                # Student enrollment + payment flow
│       ├── onboarding.ts                 # Teacher onboarding steps
│       ├── student-payments.ts           # Student payment submissions
│       ├── student-settings.ts           # Student profile updates
│       ├── subscriptions.ts              # Teacher subscription + screenshot upload
│       ├── teacher-settings.ts           # Teacher profile, payment settings, notifications
│       └── waitlist.ts                   # Waitlist join/leave
│
├── components/
│   ├── ui/                               # Generic, reusable primitives — SHARED across all roles
│   │   │
│   │   │ # ── shadcn/ui primitives (installed via `npx shadcn@latest add <name>`) ──
│   │   ├── button.tsx                    # Variants: default, destructive, outline, secondary, ghost, link. Sizes: default, sm, lg, icon.
│   │   ├── card.tsx                      # Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
│   │   ├── input.tsx                     # Base input primitive
│   │   ├── label.tsx                     # Form label (Radix)
│   │   ├── select.tsx                    # Radix select with trigger, content, items
│   │   ├── textarea.tsx                  # Multi-line text input
│   │   ├── dialog.tsx                    # Modal dialog (replaces old Modal.tsx)
│   │   ├── alert-dialog.tsx              # Confirm dialog (replaces old ConfirmModal.tsx)
│   │   ├── badge.tsx                     # Badge variants: default, secondary, destructive, outline
│   │   ├── sidebar.tsx                   # Collapsible sidebar (desktop) + Sheet (mobile)
│   │   ├── sheet.tsx                     # Slide-out drawer (used by sidebar mobile + PublicNavbar)
│   │   ├── command.tsx                   # Command palette (cmdk)
│   │   ├── table.tsx                     # Table, TableHeader, TableBody, TableRow, TableHead, TableCell
│   │   ├── dropdown-menu.tsx             # Radix dropdown menu
│   │   ├── calendar.tsx                  # Date picker calendar
│   │   ├── popover.tsx                   # Radix popover
│   │   ├── chart.tsx                     # Recharts wrapper with theme-aware colors
│   │   ├── progress.tsx                  # Progress bar
│   │   ├── skeleton.tsx                  # Loading skeleton
│   │   ├── switch.tsx                    # Toggle switch
│   │   ├── separator.tsx                 # Horizontal/vertical separator
│   │   ├── tooltip.tsx                   # Radix tooltip
│   │   │
│   │   │ # ── Custom compositions (PascalCase — wrap shadcn primitives) ──
│   │   ├── SidebarShell.tsx              # Unified sidebar shell for teacher, admin, and student roles
│   │   ├── ThemeToggle.tsx               # Dark/light mode toggle (uses next-themes)
│   │   ├── NotificationBell.tsx          # Notification icon with unread count indicator
│   │   ├── CommandPalette.tsx            # Cmd+K quick navigation (wraps command.tsx)
│   │   ├── DateRangeFilter.tsx           # Date range picker for dashboards (wraps calendar + popover)
│   │   ├── StatusBadge.tsx               # Universal status badge — wraps shadcn Badge. Works for CohortStatus, EnrollmentStatus, PaymentStatus, PayoutStatus.
│   │   ├── Spinner.tsx                   # Loading spinner (sm/md/lg sizes)
│   │   ├── DataTable.tsx                 # Sortable, filterable, paginated table. Uses @tanstack/react-table + shadcn table primitives.
│   │   ├── FileUpload.tsx                # Universal R2 upload: accepts fileType prop → auto-validates size + content type. Shows progress. Includes `capture="environment"` for mobile camera.
│   │   ├── RichTextEditor.tsx            # TipTap wrapper
│   │   ├── PageHeader.tsx                # Page title + optional action button (consistent across all pages)
│   │   ├── EmptyState.tsx                # Icon + title + description + CTA button
│   │   ├── UsageBars.tsx                 # Plan limit bars (courses/students/storage). Amber 80%, red 95%, block 100%.
│   │   ├── SessionCard.tsx               # Class session display (Meet link, time in PKT, cancelled badge).
│   │   ├── PaymentRow.tsx                # Payment record display (amount, status badge, date, method).
│   │   └── PlanLimitGuard.tsx            # Wraps features — shows UpgradeNudge at 80%, hard block at 100%.
│   ├── teacher/                          # Teacher-SPECIFIC compositions (use ui/ primitives)
│   │   ├── PaymentVerificationCard.tsx   # Extends PaymentRow with screenshot viewer + approve/reject
│   │   ├── CohortCard.tsx                # Cohort summary card for course detail page
│   │   ├── UpgradeNudge.tsx              # Contextual upgrade banner
│   │   ├── ExpiryBanner.tsx              # 4-state plan expiry banner (amber/orange/red/trial)
│   │   ├── PaymentCard.tsx               # Payment summary card for teacher dashboard
│   │   ├── PaymentSettingsForm.tsx        # Bank account / payout method settings form
│   │   ├── NotificationSettingsForm.tsx   # Email notification preferences form
│   │   └── OnboardingChecklist.tsx        # Post-signup onboarding progress checklist
│   ├── student/                          # Student-SPECIFIC compositions
│   │   ├── TeacherGroup.tsx              # Groups enrollments by teacher in student portal
│   │   └── EnrollmentStatus.tsx          # Enrollment status with payment action
│   ├── admin/                            # Admin-SPECIFIC compositions
│   │   ├── TeacherHealthCard.tsx          # Dormant/zero-student/expiring indicators
│   │   ├── PlanEditor.tsx                # Plan limits + feature toggles editor
│   │   ├── GrandfatheringModal.tsx        # Shows affected teachers when limit lowered
│   │   ├── PayoutCard.tsx                # Extends PaymentRow with bank details + process actions
│   │   ├── TeacherDetailActions.tsx       # Action buttons on teacher detail page (suspend, reset, etc.)
│   │   └── PlatformSettingsForm.tsx       # Platform-wide settings editor form
│   └── public/                           # Public page compositions
│       ├── CourseCard.tsx                 # Course display for teacher subdomain
│       ├── TeacherCard.tsx               # Teacher card for explore page (photo, subjects, fee, students)
│       ├── TeacherBio.tsx                # Bio section on teacher subdomain
│       └── EnrollButton.tsx              # Enroll CTA (handles full/waitlist/closed states)
│
├── hooks/                                # Client-side React hooks — ONLY in 'use client' components
│   ├── useRealtime.ts                    # Supabase realtime subscription wrapper
│   ├── useToast.ts                       # Toast notification hook
│   └── use-mobile.ts                     # Mobile breakpoint detection (used by sidebar)
│
├── providers/                            # React Context providers (replace Zustand for server/client bridge)
│   ├── TeacherProvider.tsx               # Server Component fetches teacher data → passes via Context to client children
│   ├── StudentProvider.tsx               # Same pattern for student portal
│   └── UIProvider.tsx                    # Client-side UI state (modals, sidebar, toasts)
│
├── types/                                # Shared TypeScript types
│   ├── database.ts                       # Auto-generated from Supabase (supabase gen types)
│   ├── api.ts                            # ApiResponse<T> shape + all API input/output types
│   └── domain.ts                         # Business domain types (Plan, Cohort, etc.)
│
├── constants/
│   ├── plans.ts                          # Plan slugs, default values
│   ├── features.ts                       # Feature key constants
│   ├── routes.ts                         # Route constants (never hardcode paths)
│   └── nav-items.ts                      # Sidebar navigation items per role (teacher, admin, student)
│
├── components.json                      # shadcn CLI configuration (component paths, aliases, style)
├── middleware.ts                         # Subdomain routing
│
└── supabase/
    ├── client.ts                         # Browser Supabase client (@supabase/supabase-js)
    ├── server.ts                         # Server Supabase client (@supabase/ssr — uses getAll/setAll cookie pattern)
    └── migrations/
        ├── 001_initial_schema.sql
        ├── 002_rls_policies.sql
        ├── 003_indexes.sql
        ├── 004_functions.sql             # enroll_student_atomic, credit_teacher_balance
        ├── 005_seed_data.sql             # Plans, features, platform_settings
        ├── 006_enrollment_unique.sql     # Unique constraint on enrollments
        ├── 007_subscription_rejection_reason.sql  # Rejection reason field
        ├── 008_payment_month_unique.sql  # Partial unique (enrollment_id, payment_month) for monthly loop
        └── 009_backfill_payment_month.sql # Backfill payment_month on pre-existing confirmed monthly payments
```

---

## 2. Shared Code Architecture

### 2.1 Types — `types/api.ts`

```typescript
// Consistent API response shape — used by every API route
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

// Enrollment API
export type EnrollInput = {
  cohortId: string
  studentId: string
  discountCode?: string
  idempotencyKey: string
}
export type EnrollOutput = {
  checkoutUrl?: string        // gateway mode
  enrollmentId: string
  status: 'active' | 'pending_verification' | 'waitlisted'
}

// Subscription API
export type SubscribeInput = {
  planSlug: string
  idempotencyKey: string
}
export type SubscribeOutput = {
  checkoutUrl?: string
  subscriptionId: string
}

// Upload API
export type PresignInput = {
  fileType: 'thumbnail' | 'profile' | 'qrcode' | 'assignment' | 'announcement' | 'submission' | 'screenshot'
  contentType: string
  fileName: string
  sizeBytes: number
}
export type PresignOutput = {
  uploadUrl: string
  publicUrl: string
  key: string
}
```

### 2.2 Domain Types — `types/domain.ts`

```typescript
export type EmailType =
  | 'enrollment_confirmed' | 'enrollment_pending' | 'enrollment_rejected'
  | 'enrollment_refunded_cohort_full' | 'waitlist_joined_after_payment_refund'
  | 'student_withdrawal_requested' | 'withdrawal_approved' | 'withdrawal_rejected'
  | 'class_reminder_24h' | 'class_reminder_1h' | 'class_cancelled'
  | 'payment_approved' | 'payment_rejected'
  | 'subscription_renewal_reminder' | 'grace_period_daily_reminder'
  | 'plan_hard_locked' | 'trial_ending_soon' | 'plan_downgraded'
  | 'payout_requested' | 'payout_processed' | 'payout_failed'
  | 'payout_pending_action'                  // Admin: new payout request awaiting processing
  | 'new_subscription_screenshot'            // Admin: teacher submitted subscription screenshot
  | 'gateway_error_alert'                    // Admin: N gateway errors in 10 min
  | 'refund_debit_recorded' | 'refund_debit_recovered'
  | 'waitlist_joined' | 'waitlist_slots_available'
  | 'fee_reminder' | 'fee_overdue_5day'
  | 'new_announcement' | 'student_comment' | 'cohort_archived'
  | 'enrollment_unverified_24h' | 'subscription_screenshot_pending_48h'
  | 'new_enrollment_notification' | 'new_message' | 'referral_converted'

export type PlanSlug = 'free' | 'solo' | 'academy'
export type LimitKey = 'max_courses' | 'max_students' | 'max_cohorts_active' | 'max_storage_mb' | 'max_teachers'
export type FeatureKey =
  | 'attendance_tracking'
  | 'assignment_submission'
  | 'analytics_dashboard'
  | 'student_portal'
  | 'class_reminders'
  | 'whatsapp_notifications'
  | 'progress_report_pdf'
  | 'cohort_archive_history'
  | 'fee_reminders'
  | 'revenue_analytics'
  | 'student_health_signals'
  | 'custom_domain'
  | 'multi_teacher'
  | 'remove_branding'
  | 'recurring_classes'
  | 'waitlist'
  | 'discount_codes'

export type CohortStatus = 'upcoming' | 'active' | 'archived'
export type EnrollmentStatus = 'pending' | 'active' | 'rejected' | 'withdrawn' | 'revoked'
export type PaymentStatus = 'pending_verification' | 'confirmed' | 'rejected' | 'refunded'
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed'
```

### 2.3 Universal Functions (must use — never bypass)

#### `platformDomain()` — `lib/platform/domain.ts`

```typescript
export const platformDomain = () => process.env.NEXT_PUBLIC_PLATFORM_DOMAIN!
export const teacherSubdomainUrl = (sub: string, path = '') => `https://${sub}.${platformDomain()}${path}`
export const studentPortalUrl = (path = '') => `https://students.${platformDomain()}${path}`
export const platformUrl = (path = '') => `https://${platformDomain()}${path}`
```

#### `canUseFeature()` — `lib/plans/features.ts`

```typescript
// Checks snapshot first (grandfathered), falls back to live plan_features
export async function canUseFeature(teacherId: string, featureKey: FeatureKey): Promise<boolean>
```

#### `getLimit()` — `lib/plans/limits.ts`

```typescript
// Checks snapshot first (grandfathered), falls back to live plans table
export async function getLimit(teacherId: string, limitKey: LimitKey): Promise<number>
```

#### `getPlatformSetting()` — `lib/platform/settings.ts`

```typescript
// Cached (1 min TTL). Never hardcode these values.
export async function getPlatformSetting(key: string): Promise<string | null>
export async function isScreenshotPaymentsEnabled(): Promise<boolean>
export async function isGatewayEnabled(): Promise<boolean>
export async function getMinPayoutAmount(): Promise<number>
export async function getUploadLimitMb(type: FileType): Promise<number>
```

#### `formatPKT()` — `lib/time/pkt.ts`

```typescript
// All timestamps stored UTC. All display in PKT (UTC+5).
export function currentPKT(): Date
export function formatPKT(utc: string | Date, format: 'date' | 'time' | 'datetime' | 'relative'): string
export function getBillingDateForMonth(billingDay: number, year: number, month: number): Date
```

#### `sendEmail()` — `lib/email/sender.ts`

```typescript
// All emails go through here. Checks notification preferences. Logs delivery.
export async function sendEmail(params: {
  to: string
  type: EmailType
  recipientId: string
  recipientType: 'teacher' | 'student'
  data: Record<string, unknown>
}): Promise<void>
```

### 2.4 Hooks — `hooks/` (Client Components ONLY)

> Any component importing from `hooks/` MUST have `'use client'` directive.

```typescript
// hooks/useRealtime.ts — Supabase realtime subscription wrapper
export function useRealtime<T>(
  table: string,
  filter: string,         // e.g. "cohort_id=eq.{id}"
  onInsert?: (row: T) => void,
  onUpdate?: (row: T) => void,
  onDelete?: (row: T) => void
)

// hooks/useToast.ts — Toast notification hook
export function useToast() {
  // Returns: { addToast, removeToast }
}
```

### 2.5 Constants — `constants/`

```typescript
// constants/routes.ts — never hardcode route strings
export const ROUTES = {
  TEACHER_DASHBOARD: '/dashboard',
  TEACHER_COURSES: '/dashboard/courses',
  TEACHER_SETTINGS: '/dashboard/settings',
  STUDENT_DASHBOARD: '/',       // relative to students.skoolrooms.com
  ADMIN_DASHBOARD: '/admin',
  JOIN_COHORT: (token: string) => `/join/${token}`,
} as const

// constants/features.ts
export const FEATURES = {
  ATTENDANCE: 'attendance_tracking',
  ASSIGNMENTS: 'assignment_submission',
  ANALYTICS: 'analytics_dashboard',
  // ... all FeatureKey values as constants
} as const
```

### 2.6 Server/Client Data Flow — React Context (NOT Zustand)

> **Why React Context over Zustand:** Next.js 16 defaults to Server Components. Zustand requires browser context and can't be populated from Server Components. React Context bridges the server/client boundary cleanly — Server Components fetch data, pass to Context Provider, Client Components consume via `useContext()`.

```typescript
// providers/TeacherProvider.tsx
// Server Component fetches teacher data in layout.tsx → wraps children in this provider
// Client Components access via useTeacherContext()

'use client'
import { createContext, useContext } from 'react'

type TeacherContextType = {
  teacher: Teacher
  plan: { slug: string; limits: Record<string, number>; features: Record<string, boolean> }
  usage: { courses: number; students: number; storageMb: number; cohortsActive: number }
  isGrandfathered: boolean
  isNearLimit: (key: string) => boolean  // >= 80%
  isAtLimit: (key: string) => boolean    // >= 100%
}

const TeacherContext = createContext<TeacherContextType | null>(null)
export const useTeacherContext = () => {
  const ctx = useContext(TeacherContext)
  if (!ctx) throw new Error('useTeacherContext must be used within TeacherProvider')
  return ctx
}

// Usage in teacher layout.tsx (Server Component):
// const teacher = await requireTeacher()
// const planDetails = await getTeacherPlanDetails(teacher.id)
// return <TeacherProvider value={{ teacher, ...planDetails }}>{children}</TeacherProvider>
```

```typescript
// providers/UIProvider.tsx — Client-only UI state
'use client'
// Manages: toasts, confirm modals, sidebar open/close
// Consumed by: Toast component, ConfirmModal, sidebar toggle
```

### 2.7 Data Fetching Rules

> **These rules prevent duplicate API calls and stale data.**

| Rule | Pattern |
|------|---------|
| **Server Components fetch initial data** | `layout.tsx` and `page.tsx` are Server Components by default. They call `lib/db/` functions directly (with service role client). Pass data to Client Components as props. |
| **Client Components NEVER fetch on mount** | No `useEffect(() => fetch(...))` pattern. Data comes from props or Context (populated by parent Server Component). |
| **Mutations go through Server Actions** | Use Next.js 16 Server Actions for all form submissions and button actions. NOT traditional `POST /api/` routes from client-side `fetch()`. API routes exist for: webhooks, crons, and external integrations only. |
| **Realtime updates via `useRealtime()` hook** | For live data (payment badge, enrollment status, announcements). Subscription created in Client Component, updates local state or context. |
| **Plan/usage data via TeacherContext** | Fetched once in teacher `layout.tsx`, available everywhere via `useTeacherContext()`. Refreshed on page navigation (Server Component re-renders layout). |
| **Direct Supabase reads for public pages** | Explore page, teacher subdomain — Server Components query Supabase directly with RLS. No API route needed. |

```typescript
// CORRECT — Server Component fetches, passes to Client
// app/(teacher)/dashboard/page.tsx (Server Component)
export default async function DashboardPage() {
  const teacher = await requireTeacher()
  const stats = await getTeacherDashboardStats(teacher.id)
  return <DashboardClient stats={stats} />
}

// WRONG — Client Component fetches on mount
'use client'
export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  useEffect(() => { fetch('/api/teacher/stats').then(...) }, [])  // ❌ NEVER DO THIS
}
```

### 2.8 Cron Route Security

```typescript
// All cron routes MUST validate CRON_SECRET before executing:
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ... cron logic
}
```

---

## 3. Database Schema

> All timestamps stored UTC. RLS enabled on every table. Display times via `formatPKT()`.

### Core Tables

#### `teachers`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| supabase_auth_id | uuid | UNIQUE, FK → auth.users | |
| name | text | NOT NULL | |
| email | text | NOT NULL | Current verified email |
| pending_email | text | nullable | New email awaiting verification |
| email_verified_at | timestamptz | nullable | |
| subdomain | text | UNIQUE, NOT NULL | e.g. `ahmed` |
| subdomain_changed_at | timestamptz | nullable | 30-day change cooldown |
| plan | text | NOT NULL, FK → plans.slug, default 'free' | |
| plan_expires_at | timestamptz | nullable | null = free forever |
| grace_until | timestamptz | nullable | 5 days after expiry |
| trial_ends_at | timestamptz | nullable | Auto-downgrade to free |
| onboarding_completed | bool | default false | |
| onboarding_steps_json | jsonb | default see below | Per-step completion tracking |
| referral_code | text | UNIQUE, nullable | Generated at signup for referral program |
| is_publicly_listed | bool | default true | |
| subject_tags | text[] | default '{}' | |
| teaching_levels | text[] | default '{}' | |
| profile_photo_url | text | nullable | R2 URL — `profiles/{teacherId}.{ext}` |
| city | text | nullable | Optional — for location-based explore filtering (Phase 2) |
| notification_preferences_json | jsonb | default '{}' | |
| is_suspended | bool | default false | |
| suspended_at | timestamptz | nullable | |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

#### `courses`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| teacher_id | uuid | FK → teachers.id | |
| title | text | NOT NULL | |
| description | text | nullable | Rich text HTML |
| status | text | NOT NULL, default 'draft' | `draft` or `published` |
| thumbnail_url | text | nullable | R2 URL |
| category | text | nullable | Phase 2 — course category for discovery filtering |
| tags | text[] | default '{}' | Phase 2 — course tags for discovery filtering |
| created_at | timestamptz | default now() | |
| deleted_at | timestamptz | nullable | Soft delete |
| updated_at | timestamptz | default now() | |

**`onboarding_steps_json` default value:**
```sql
'{
  "profile_complete": false,
  "payment_details_set": false,
  "course_created": false,
  "cohort_created": false,
  "link_shared": false
}'::jsonb
```

**Note:** No `price_pkr` on courses. Price is set per cohort. `cohorts.fee_pkr = 0` is valid for free courses (no payment page shown, enrollment is immediate). Free course toggle planned for Phase 2.

#### `cohorts`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| course_id | uuid | FK → courses.id | |
| teacher_id | uuid | FK → teachers.id | Denormalised for fast queries |
| name | text | NOT NULL | e.g. `Batch Jan–Mar 2025` |
| session_type | text | default 'group' | `group` or `one_on_one` |
| start_date | date | NOT NULL | |
| end_date | date | NOT NULL | |
| max_students | int | nullable | null = unlimited |
| fee_type | text | NOT NULL | `one_time` or `monthly` |
| fee_pkr | int | NOT NULL | |
| billing_day | int | nullable | 1–28 only (UI + API block 29/30/31). Monthly cohorts only. |
| invite_token | text | UNIQUE, NOT NULL | Auto-generated UUID |
| status | text | NOT NULL, default 'upcoming' | `draft` \| `upcoming` \| `active` \| `archived` |
| is_registration_open | bool | default true | |
| pending_can_see_schedule | bool | default false | |
| pending_can_see_announcements | bool | default false | |
| waitlist_enabled | bool | default false | |

**Cohort status transitions:**
```
draft → upcoming    Teacher publishes cohort (or parent course publishes while cohort has start_date set)
upcoming → active   Automatic: when start_date <= today. Checked at query time — NOT stored via cron.
                    UI computes: if status='upcoming' AND start_date <= today, display as 'active'.
active → archived   Automatic: archive-cohorts cron (end_date < today). OR manual: teacher clicks archive.
archived → active   NOT allowed. Once archived, cohort is permanently read-only. Teacher creates new cohort.
```

**Cohort status badge display (UI):**
| DB Status | Computed Status | UI Badge | Condition |
|-----------|----------------|----------|-----------|
| `draft` | draft | Draft | Course or cohort is draft |
| `upcoming` | upcoming | Upcoming | start_date in future + registration open |
| `upcoming` | active (computed) | Open | start_date <= today (treat as active at query time) |
| `active` | active | Open | registration open + slots available |
| `active` | active | Full | registration open + slots = 0 |
| `active` | active | Closed | `is_registration_open = false` |
| `archived` | archived | Archived | End date passed |

> **Important:** `upcoming → active` is computed at query time, not stored. This avoids needing a cron to flip status. Any query that needs "active cohorts" should use: `WHERE (status = 'active' OR (status = 'upcoming' AND start_date <= CURRENT_DATE)) AND status != 'archived'`.
| archived_at | timestamptz | nullable | Set when status changes to 'archived'. `status` is the canonical field — `archived_at` records when it happened. Always query by `status`, not `archived_at`. |
| deleted_at | timestamptz | nullable | |
| updated_at | timestamptz | default now() | |

#### `class_sessions`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| cohort_id | uuid | FK → cohorts.id | NOT course_id |
| meet_link | text | NOT NULL | Google Meet URL |
| scheduled_at | timestamptz | NOT NULL | UTC |
| duration_minutes | int | default 60 | |
| is_recurring | bool | default false | |
| recurrence_rule | text | nullable | `FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| cancelled_at | timestamptz | nullable | |
| rescheduled_to_id | uuid | nullable FK → class_sessions.id | Phase 2 — points to replacement session when rescheduled |
| deleted_at | timestamptz | nullable | |
| updated_at | timestamptz | default now() | |

#### `students`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| supabase_auth_id | uuid | UNIQUE, FK → auth.users | |
| name | text | NOT NULL | |
| phone | text | NOT NULL | |
| email | text | UNIQUE, NOT NULL | One account per email. If student enrolls with second teacher, existing account is reused. |
| pending_email | text | nullable | |
| parent_name | text | nullable | Phase 2 — K-12 market |
| parent_phone | text | nullable | Phase 2 — K-12 market |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

> **Multi-teacher enrollment:** Student signs up once. On second enrollment with a different teacher, Supabase Auth recognises the email → same `auth.users` row → same `students` row. No duplicate accounts. Profile is global — name/phone changes affect all teachers' views. Student portal groups enrollments by teacher.

> **Student blocking:** There is no global student suspension. When a teacher revokes an enrollment (`status = 'revoked'`), that student loses access to ONLY that teacher's cohort. Other teachers' enrollments are unaffected. If a teacher wants to prevent a student from re-enrolling, the enrollment API must check: `SELECT * FROM enrollments WHERE student_id = ? AND cohort_id IN (SELECT id FROM cohorts WHERE teacher_id = ?) AND status = 'revoked'` — if any revoked enrollment exists for this teacher, block new enrollments with that teacher. This is per-teacher blocking, not platform-wide.

#### `enrollments`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| student_id | uuid | FK → students.id | |
| cohort_id | uuid | FK → cohorts.id | |
| status | text | NOT NULL, default 'pending' | `pending` \| `active` \| `rejected` \| `withdrawn` \| `revoked` |
| reference_code | text | UNIQUE, NOT NULL | 6-char for payment matching |
| withdrawal_requested_at | timestamptz | nullable | |
| withdrawal_reason | text | nullable | |
| revoke_reason | text | nullable | |
| revoked_at | timestamptz | nullable | |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

### Payment Tables

#### `student_payments`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| enrollment_id | uuid | FK → enrollments.id | |
| amount_pkr | int | NOT NULL | Full amount before discount |
| discounted_amount_pkr | int | NOT NULL | Actual amount charged |
| platform_cut_pkr | int | NOT NULL | Recorded permanently at payment time |
| teacher_payout_amount_pkr | int | NOT NULL | Recorded permanently at payment time |
| payment_month | date | nullable | Monthly cohorts only. Stored as `YYYY-MM-01` (first of month). Set on creation: initial enrollment payment uses `firstBillingMonth(cohort.start_date, cohort.billing_day)`; each subsequent month is created by `createNextMonthPaymentAction`. Null for one-time cohorts and manual enrollments. Drives the `fee-reminders` cron idempotency check and the teacher per-payment view ordering. |
| payment_method | text | NOT NULL | `gateway` \| `screenshot` \| `manual` |
| gateway_transaction_id | text | nullable | |
| idempotency_key | text | UNIQUE | UUID generated before checkout |
| screenshot_url | text | nullable | R2 URL |
| transaction_id | text | nullable | Human-entered ref |
| reference_code | text | NOT NULL | Matches enrollment.reference_code. **Validated on submission:** API rejects if `reference_code != enrollment.reference_code` for the targeted enrollment. Prevents cross-enrollment payment mismatches. |
| discount_code_id | uuid | nullable FK → discount_codes | |
| status | text | NOT NULL | `pending_verification` \| `confirmed` \| `rejected` \| `refunded` |
| verified_at | timestamptz | nullable | |
| rejection_reason | text | nullable | |
| refunded_at | timestamptz | nullable | |
| refund_note | text | nullable | |
| platform_absorbed_refund | bool | default false | |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

> **Partial unique index on `(enrollment_id, payment_month)`** (migration `008_payment_month_unique.sql`): enforced when `payment_month IS NOT NULL AND status IN ('pending_verification', 'confirmed')`. Prevents two pending / confirmed rows for the same enrollment + month from coexisting, which would break the monthly loop's idempotency. Rejected payments are excluded from the constraint so a student can re-upload after rejection. `createPayment` catches the unique-violation (Postgres `23505`) and returns a `PAYMENT_ALREADY_EXISTS` sentinel; `createNextMonthPaymentAction` re-reads the existing row and returns its id (idempotent).

#### `teacher_subscriptions`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| teacher_id | uuid | FK → teachers.id | |
| plan | text | NOT NULL | Plan slug at payment time |
| amount_pkr | int | NOT NULL | |
| payment_method | text | NOT NULL | `gateway` or `screenshot` |
| gateway_transaction_id | text | nullable | |
| screenshot_url | text | nullable | |
| status | text | NOT NULL | `pending_verification` \| `active` \| `rejected` |
| period_start | date | NOT NULL | |
| period_end | date | NOT NULL | |
| approved_at | timestamptz | nullable | |
| created_at | timestamptz | default now() | |

#### `teacher_payment_settings`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| teacher_id | uuid | UNIQUE FK → teachers.id | One row per teacher |
| payout_bank_name | text | nullable | |
| payout_account_title | text | nullable | |
| payout_iban | text | nullable | |
| jazzcash_number | text | nullable | |
| easypaisa_number | text | nullable | |
| qr_code_url | text | nullable | R2 URL — JazzCash/EasyPaisa QR code image for student-facing payment page |
| instructions | text | nullable | Shown to students on payment page (e.g. "Include reference code in remarks") |
| updated_at | timestamptz | default now() | |

#### `teacher_balances`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| teacher_id | uuid | UNIQUE FK → teachers.id | |
| available_balance_pkr | int | default 0 | Ready to withdraw |
| pending_balance_pkr | int | default 0 | Requested, not yet processed |
| total_earned_pkr | int | default 0 | All-time gross |
| total_paid_out_pkr | int | default 0 | All-time paid |
| outstanding_debit_pkr | int | default 0 | Owed to platform |
| updated_at | timestamptz | default now() | |

#### `teacher_payouts`

> **Bank details are read LIVE from `teacher_payment_settings` at admin process time — NOT snapshotted at request time.** Rationale: teacher may update their bank details specifically because old ones stopped working. Using stale details would cause failed transfers. The `bank_details_snapshot_json` column is populated only when admin clicks "Complete" — for audit trail purposes.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| teacher_id | uuid | FK → teachers.id | |
| amount_pkr | int | NOT NULL | |
| bank_details_snapshot_json | jsonb | nullable | Written at process time (NOT request time) — audit trail |
| status | text | NOT NULL | `pending` \| `processing` \| `completed` \| `failed` |
| requested_at | timestamptz | default now() | |
| processed_at | timestamptz | nullable | |
| admin_note | text | nullable | Tx ref or failure reason |
| created_at | timestamptz | default now() | |

**Admin payout queue UI:** Shows teacher name, amount, LIVE bank details from `teacher_payment_settings`, date requested. If `teacher_payment_settings.updated_at > teacher_payouts.requested_at`, admin UI shows warning: "Bank details updated after this request was made — verify with teacher before processing."

### Plan Tables

#### `plans`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| name | text | NOT NULL | e.g. `Solo` |
| slug | text | UNIQUE, NOT NULL | e.g. `solo` |
| price_pkr | int | NOT NULL | |
| is_active | bool | default true | |
| is_visible | bool | default true | |
| is_featured | bool | default false | |
| display_order | int | NOT NULL | |
| max_courses | int | NOT NULL | |
| max_students | int | NOT NULL | |
| max_cohorts_active | int | NOT NULL | |
| max_storage_mb | int | NOT NULL | |
| max_teachers | int | default 1 | |
| trial_days | int | default 14 | |
| transaction_cut_percent | decimal(5,2) | NOT NULL | e.g. `8.00` |
| grandfathered_at | timestamptz | nullable | Last time a limit was lowered |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

#### `plan_features`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| plan_id | uuid | FK → plans.id | |
| feature_key | text | NOT NULL | Matches feature_registry |
| is_enabled | bool | NOT NULL | |
| updated_at | timestamptz | default now() | |
| | | UNIQUE(plan_id, feature_key) | |

#### `feature_registry`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| feature_key | text | UNIQUE, NOT NULL | |
| display_name | text | NOT NULL | |
| description | text | NOT NULL | |
| category | text | NOT NULL | `scheduling` \| `payments` \| `communication` \| `analytics` \| `branding` |
| is_limit_based | bool | default false | |
| created_at | timestamptz | default now() | |

#### `teacher_plan_snapshot`

> **When snapshot is created:** On every subscription activation (gateway webhook confirms OR admin approves screenshot). NOT on trial start. NOT on renewal of the SAME plan.
> **When snapshot is replaced:** If teacher UPGRADES plan, new snapshot overwrites old. Grandfathered limits from old plan are gone — new plan limits apply.
> **When snapshot is used:** `getLimit()` and `canUseFeature()` check snapshot FIRST. If snapshot exists AND snapshot limits are MORE generous than live plan → use snapshot (grandfathered). Otherwise → use live plan.
> **Grandfathering modal trigger:** When admin edits a plan and LOWERS any numeric limit, compare new limit against all active teachers on that plan. Teachers whose current usage exceeds the new limit → insert/update their snapshot with current (higher) limits. Display modal to admin showing affected count.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| teacher_id | uuid | FK → teachers.id | |
| plan_id | uuid | FK → plans.id | |
| snapshot_json | jsonb | NOT NULL | Full limits + features at subscription time |
| captured_at | timestamptz | default now() | |

### Content Tables

#### `announcements`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| cohort_id | uuid | FK → cohorts.id | |
| teacher_id | uuid | FK → teachers.id | Denormalised |
| body | text | NOT NULL | Rich text HTML |
| file_url | text | nullable | R2 URL |
| pinned | bool | default false | |
| pinned_at | timestamptz | nullable | Set when pinned=true. Used for sort order among pinned announcements. |
| created_at | timestamptz | default now() | |
| deleted_at | timestamptz | nullable | |
| updated_at | timestamptz | default now() | |

#### `announcement_comments`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| announcement_id | uuid | FK → announcements.id | |
| author_id | uuid | NOT NULL | teachers.id or students.id |
| author_type | text | NOT NULL | `teacher` or `student` |
| body | text | NOT NULL | |
| created_at | timestamptz | default now() | |
| deleted_at | timestamptz | nullable | Teacher can soft-delete inappropriate comments |

#### `announcement_reads`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| announcement_id | uuid | FK → announcements.id | |
| student_id | uuid | FK → students.id | |
| read_at | timestamptz | default now() | |
| | | UNIQUE(announcement_id, student_id) | |

#### `attendance`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| class_session_id | uuid | FK → class_sessions.id | |
| student_id | uuid | FK → students.id | |
| present | bool | NOT NULL | |
| marked_at | timestamptz | default now() | |
| | | UNIQUE(class_session_id, student_id) | |

#### `assignments`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| cohort_id | uuid | FK → cohorts.id | |
| teacher_id | uuid | FK → teachers.id | |
| title | text | NOT NULL | |
| description | text | NOT NULL | |
| file_url | text | nullable | |
| due_date | timestamptz | NOT NULL | |
| created_at | timestamptz | default now() | |
| deleted_at | timestamptz | nullable | |

#### `assignment_submissions`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| assignment_id | uuid | FK → assignments.id | |
| student_id | uuid | FK → students.id | |
| text_answer | text | nullable | |
| file_url | text | nullable | |
| submitted_at | timestamptz | default now() | |
| reviewed_at | timestamptz | nullable | |
| status | text | NOT NULL | `submitted` \| `reviewed` \| `overdue` |
| | | UNIQUE(assignment_id, student_id) | |

### Commerce Tables

#### `discount_codes`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| teacher_id | uuid | FK → teachers.id | Denormalised for fast admin queries |
| cohort_id | uuid | FK → cohorts.id | |
| code | text | NOT NULL | Case-insensitive in queries (UPPER() on insert + query) |
| discount_type | text | NOT NULL | `fixed` or `percent` |
| discount_value | int | NOT NULL | PKR or % |
| max_uses | int | nullable | null = unlimited |
| use_count | int | default 0 | Only incremented on confirmed webhook |
| expires_at | timestamptz | nullable | |
| created_at | timestamptz | default now() | |

#### `cohort_waitlist`

> **Waitlist is teacher-managed (manual contact).** Students can join with or without an account. Teacher sees full contact details in waitlist tab and contacts students directly via WhatsApp/email outside the platform. Platform does NOT auto-enroll from waitlist.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| cohort_id | uuid | FK → cohorts.id | |
| student_id | uuid | nullable FK → students.id | Null if student joins without account |
| student_name | text | NOT NULL | Denormalised — student may not have account |
| student_phone | text | NOT NULL | Visible to teacher for WhatsApp outreach |
| student_email | text | NOT NULL | Visible to teacher for email outreach |
| joined_at | timestamptz | default now() | |
| status | text | NOT NULL | `waiting` \| `enrolled` \| `expired` \| `removed` |
| teacher_note | text | nullable | Optional note when teacher removes student |
| | | UNIQUE(cohort_id, student_email) | Prevent duplicate waitlist entries |

### Platform Tables

#### `platform_settings`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| key | text | UNIQUE, NOT NULL | |
| value | text | NOT NULL | Always stored as string |
| description | text | NOT NULL | Shown in admin UI |
| updated_at | timestamptz | default now() | |

**Plans seed data note — Free plan must have trial_days = 0:**
```sql
-- Free plan: no trial, never expires
INSERT INTO plans (name, slug, price_pkr, trial_days, transaction_cut_percent, ...)
VALUES ('Free', 'free', 0, 0, 15.00, ...);

-- Solo plan: 14-day trial
INSERT INTO plans (name, slug, price_pkr, trial_days, transaction_cut_percent, ...)
VALUES ('Solo', 'solo', 1999, 14, 10.00, ...);

-- Academy plan: 14-day trial
INSERT INTO plans (name, slug, price_pkr, trial_days, transaction_cut_percent, ...)
VALUES ('Academy', 'academy', 3999, 14, 8.00, ...);
```

**Platform settings seed data:**
```sql
INSERT INTO platform_settings (key, value, description) VALUES
  ('screenshot_payments_enabled', 'false', 'Show screenshot upload on payment pages'),
  ('payment_gateway_enabled', 'false', 'Enable gateway checkout'),
  ('active_gateway', 'mock', 'safepay or payfast'),
  ('gateway_processing_fee_percent', '2.50', 'Gateway fee % shown on payout breakdowns'),
  ('min_payout_amount_pkr', '2500', 'Minimum balance for withdrawal'),
  ('payout_processing_days', '3', 'SLA in business days shown to teachers'),
  ('r2_upload_limit_thumbnail_mb', '5', 'Max course thumbnail size'),
  ('r2_upload_limit_profile_mb', '2', 'Max profile photo size'),
  ('r2_upload_limit_assignment_mb', '25', 'Max assignment file size'),
  ('r2_upload_limit_announcement_mb', '25', 'Max announcement attachment size'),
  ('r2_upload_limit_submission_mb', '50', 'Max student submission size'),
  ('refund_debit_recovery_enabled', 'true', 'Auto-deduct owed amounts from future earnings'),
  ('gateway_error_alert_threshold', '5', 'Alert admin after N errors in 10 min');
```

**Feature registry seed data (005_seed_data.sql):**
```sql
INSERT INTO feature_registry (feature_key, display_name, description, category, is_limit_based) VALUES
  ('recurring_classes', 'Recurring Class Setup', 'Create recurring class schedules (daily/weekly/custom)', 'scheduling', false),
  ('student_portal', 'Student Portal Access', 'Students get dedicated portal with dashboard', 'branding', false),
  ('class_reminders', 'Class Reminder Emails', 'Automated 24h and 1h class reminder emails', 'communication', false),
  ('analytics_dashboard', 'Analytics Dashboard', 'Revenue, student health, cohort analytics', 'analytics', false),
  ('attendance_tracking', 'Attendance Tracking', 'Mark and view attendance per class session', 'scheduling', false),
  ('assignment_submission', 'Assignment Submission', 'Create assignments and receive student submissions', 'scheduling', false),
  ('fee_reminders', 'Monthly Fee Reminders', 'Automated billing day reminder emails for monthly cohorts', 'payments', false),
  ('cohort_archive_history', 'Cohort Archive History', 'View full read-only history of archived cohorts', 'scheduling', false),
  ('revenue_analytics', 'Revenue Analytics', 'Revenue per cohort, projected revenue, 6-month chart', 'analytics', false),
  ('student_health_signals', 'Student Health Signals', 'At-risk, disengaged, overdue fee indicators', 'analytics', false),
  ('progress_report_pdf', 'Progress Report PDF', 'One-click PDF progress report per student', 'analytics', false),
  ('waitlist', 'Waitlist', 'Allow students to join waitlist when cohort is full', 'scheduling', false),
  ('discount_codes', 'Discount Codes', 'Create per-cohort discount codes (fixed or percent)', 'payments', false),
  ('whatsapp_notifications', 'WhatsApp Notifications', 'Class reminders and enrollment alerts via WhatsApp', 'communication', false),
  ('multi_teacher', 'Multiple Teacher Accounts', 'Invite additional teachers to manage courses', 'branding', true),
  ('remove_branding', 'Remove Platform Branding', 'Hide "Powered by Skool Rooms" footer on teacher subdomain', 'branding', false),
  ('custom_domain', 'Custom Domain', 'Use your own .com domain instead of subdomain', 'branding', false);
```

#### `explore_page_views`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| teacher_id | uuid | FK → teachers.id | |
| viewer_ip_hash | text | NOT NULL | SHA-256 of viewer's IP. Never store raw IP. Hash: `crypto.createHash('sha256').update(ip).digest('hex')` |
| source | text | NOT NULL | `explore`, `search`, `direct` |
| created_at | timestamptz | default now() | |

> **IP extraction on Vercel:** Use `req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()` to get real client IP behind Vercel's edge network. Fallback to `req.ip` if available.
> **Deduplication:** Insert one row per `(teacher_id, viewer_ip_hash, DATE(created_at))` combination. Before INSERT, check: `SELECT 1 FROM explore_page_views WHERE teacher_id = ? AND viewer_ip_hash = ? AND created_at >= CURRENT_DATE`. If exists, skip. This gives daily-unique view counts without over-counting reloads.

### Explore Page Query Strategy

> **SSR query** — server component queries Supabase directly (no API route needed). Cached via Next.js ISR with 1-hour revalidation (`revalidate: 3600`).

```sql
-- Explore page teacher list (cached 1 hour via ISR)
SELECT t.id, t.name, t.profile_photo_url, t.subject_tags, t.teaching_levels, t.city,
       MIN(ch.fee_pkr) AS starting_fee,
       COUNT(DISTINCT e.student_id) AS active_student_count
FROM teachers t
JOIN courses c ON c.teacher_id = t.id AND c.status = 'published' AND c.deleted_at IS NULL
JOIN cohorts ch ON ch.course_id = c.id AND ch.is_registration_open = true
  AND (ch.status = 'active' OR (ch.status = 'upcoming' AND ch.start_date <= CURRENT_DATE))
LEFT JOIN enrollments e ON e.cohort_id = ch.id AND e.status = 'active'
WHERE t.is_publicly_listed = true
  AND t.is_suspended = false
  AND (t.plan_expires_at > now() OR t.plan = 'free')
  AND (t.grace_until IS NULL OR t.grace_until > now())  -- exclude hard-locked
GROUP BY t.id
ORDER BY active_student_count DESC, t.created_at ASC;
```

> **Pagination:** Not needed at launch (< 100 teachers). Add cursor-based pagination at 500+ teachers.
> **Client-side filtering:** Subject, level, fee range, open cohorts toggle — all filter the pre-fetched SSR list client-side. No additional server queries on filter change.

### `admin_activity_log`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| teacher_id | uuid nullable | Subject of action |
| action_type | text | e.g. `plan_changed`, `account_suspended`, `payout_processed` |
| performed_by | text | `admin` or `system` |
| metadata | jsonb | Action details |
| created_at | timestamptz | |

### Phase 2 Tables

> These tables support Phase 2 features. Schema defined here for completeness — build when Phase 2 starts.

#### `direct_messages`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| teacher_id | uuid | FK → teachers.id | |
| student_id | uuid | FK → students.id | |
| sender_type | text | NOT NULL | `teacher` or `student` |
| body | text | NOT NULL | Plain text — no rich text needed |
| read_at | timestamptz | nullable | Set when recipient opens the message. Drives unread badge. |
| created_at | timestamptz | default now() | |

> One async thread per teacher-student pair. RLS: teachers see only messages with their students, students see only messages with their enrolled teachers.

#### `cohort_feedback`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| cohort_id | uuid | FK → cohorts.id | |
| student_id | uuid | FK → students.id | |
| rating | int | NOT NULL, CHECK (1-5) | 1–5 star rating |
| comment | text | nullable | Optional written feedback |
| created_at | timestamptz | default now() | |
| | | UNIQUE(cohort_id, student_id) | One feedback per student per cohort |

> All feedback is private (teacher-only visible). Prompted to student after cohort archives on next portal login. Public ratings deferred to Phase 3.

#### `referrals`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| referrer_teacher_id | uuid | FK → teachers.id | Teacher who shared the referral link |
| referred_teacher_id | uuid | FK → teachers.id, UNIQUE | Teacher who signed up via referral. UNIQUE = can only be referred once. |
| referral_code | text | NOT NULL | Same as `teachers.referral_code` of the referrer |
| status | text | NOT NULL, default 'pending' | `pending` \| `converted` |
| credit_applied_at | timestamptz | nullable | When referrer received 1-month free credit |
| created_at | timestamptz | default now() | |

> Referrer gets 1 month free credit AFTER referred teacher's first confirmed paid month (not at signup). `referrals.convert` API checks this at subscription confirmation.

### Logging & Notification Tables

#### `notifications_log`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| recipient_type | text | NOT NULL | `teacher` or `student` |
| recipient_id | uuid | NOT NULL | FK to teachers.id or students.id based on recipient_type |
| type | text | NOT NULL | Matches `EmailType` — e.g. `enrollment_confirmed`, `class_reminder_24h` |
| channel | text | NOT NULL | `email` or `whatsapp` |
| status | text | NOT NULL, default 'sent' | `sent` \| `skipped` \| `failed` |
| metadata | jsonb | nullable | Email-specific variables (teacher name, amounts, etc.) |
| sent_at | timestamptz | default now() | |

> **Every `sendEmail()` call writes to this table** — even opt-out skips (status='skipped'). Powers: email volume counter in teacher notification settings, admin email health dashboard.

#### `email_delivery_log`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| notification_log_id | uuid | nullable FK → notifications_log.id | Links to the sent notification |
| recipient_email | text | NOT NULL | |
| type | text | NOT NULL | Same `EmailType` value |
| status | text | NOT NULL | `sent` \| `delivered` \| `bounced` \| `failed` |
| provider_message_id | text | nullable | Brevo API message ID — for webhook correlation |
| error_message | text | nullable | Bounce/failure reason from Brevo webhook |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

> Brevo webhooks update `status` via `provider_message_id` lookup. Admin Operations panel reads bounce/failure counts from this table.

### Required Indexes

```sql
-- enrollments
CREATE INDEX ON enrollments (cohort_id);
CREATE INDEX ON enrollments (student_id);

-- student_payments
CREATE INDEX ON student_payments (enrollment_id);
CREATE UNIQUE INDEX ON student_payments (idempotency_key);

-- class_sessions
CREATE INDEX ON class_sessions (cohort_id);
CREATE INDEX ON class_sessions (scheduled_at);

-- attendance
CREATE INDEX ON attendance (class_session_id);
CREATE INDEX ON attendance (student_id);

-- announcements
CREATE INDEX ON announcements (cohort_id);

-- announcement_reads
CREATE INDEX ON announcement_reads (announcement_id);
CREATE INDEX ON announcement_reads (student_id);

-- assignments
CREATE INDEX ON assignments (cohort_id);

-- assignment_submissions
CREATE INDEX ON assignment_submissions (assignment_id);
CREATE INDEX ON assignment_submissions (student_id);

-- notifications_log
CREATE INDEX ON notifications_log (recipient_id, recipient_type);
CREATE INDEX ON notifications_log (type);
CREATE INDEX ON notifications_log (sent_at);

-- email_delivery_log
CREATE INDEX ON email_delivery_log (provider_message_id);
CREATE INDEX ON email_delivery_log (status);
CREATE INDEX ON email_delivery_log (notification_log_id);

-- cohorts
CREATE UNIQUE INDEX ON cohorts (invite_token);
CREATE INDEX ON cohorts (course_id);

-- cohort_waitlist
CREATE INDEX ON cohort_waitlist (cohort_id);
CREATE INDEX ON cohort_waitlist (cohort_id, status);
CREATE UNIQUE INDEX ON cohort_waitlist (cohort_id, student_email);

-- plan_features
CREATE UNIQUE INDEX ON plan_features (plan_id, feature_key);

-- teacher_plan_snapshot
CREATE INDEX ON teacher_plan_snapshot (teacher_id);

-- teacher_balances
CREATE UNIQUE INDEX ON teacher_balances (teacher_id);

-- teacher_payouts
CREATE INDEX ON teacher_payouts (teacher_id, status);

-- platform_settings
CREATE UNIQUE INDEX ON platform_settings (key);

-- teachers - referral code lookup
CREATE UNIQUE INDEX ON teachers (referral_code) WHERE referral_code IS NOT NULL;

-- discount_codes
CREATE INDEX ON discount_codes (cohort_id);
CREATE INDEX ON discount_codes (teacher_id);
CREATE UNIQUE INDEX ON discount_codes (cohort_id, UPPER(code));  -- Codes unique per cohort, case-insensitive

-- admin_activity_log
CREATE INDEX ON admin_activity_log (teacher_id);
CREATE INDEX ON admin_activity_log (action_type);
CREATE INDEX ON admin_activity_log (created_at);

-- explore_page_views (compound for per-teacher date-range queries)
CREATE INDEX ON explore_page_views (teacher_id, created_at);

-- student_payments (timeline queries)
CREATE INDEX ON student_payments (created_at);

-- teacher_payouts (timeline queries)
CREATE INDEX ON teacher_payouts (created_at);

-- Phase 2 tables
-- direct_messages
CREATE INDEX ON direct_messages (teacher_id, student_id);
CREATE INDEX ON direct_messages (created_at);

-- cohort_feedback
CREATE UNIQUE INDEX ON cohort_feedback (cohort_id, student_id);
CREATE INDEX ON cohort_feedback (cohort_id);

-- referrals
CREATE UNIQUE INDEX ON referrals (referred_teacher_id);
CREATE INDEX ON referrals (referrer_teacher_id);
```

### RLS Policies

```sql
-- TEACHERS: own their data
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_courses" ON courses FOR ALL
  USING (teacher_id = auth.uid());

ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_cohorts" ON cohorts FOR ALL
  USING (teacher_id = auth.uid());

-- STUDENTS: see only their enrolled cohort data
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_see_enrolled_sessions" ON class_sessions FOR SELECT
  USING (cohort_id IN (
    SELECT cohort_id FROM enrollments
    WHERE student_id = auth.uid() AND status = 'active'
  ));

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_announcements" ON announcements FOR ALL
  USING (teacher_id = auth.uid());
CREATE POLICY "students_see_cohort_announcements" ON announcements FOR SELECT
  USING (cohort_id IN (
    SELECT cohort_id FROM enrollments
    WHERE student_id = auth.uid() AND status = 'active'
  ));

-- ENROLLMENTS: teachers see only enrollments in their cohorts, students see their own
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_see_own_cohort_enrollments" ON enrollments FOR ALL
  USING (cohort_id IN (SELECT id FROM cohorts WHERE teacher_id = auth.uid()));
CREATE POLICY "students_see_own_enrollments" ON enrollments FOR SELECT
  USING (student_id = auth.uid());

-- STUDENT PAYMENTS: teachers see only payments for their cohorts, students see their own
ALTER TABLE student_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_see_own_cohort_payments" ON student_payments FOR ALL
  USING (enrollment_id IN (
    SELECT e.id FROM enrollments e
    JOIN cohorts c ON e.cohort_id = c.id
    WHERE c.teacher_id = auth.uid()
  ));
CREATE POLICY "students_see_own_payments" ON student_payments FOR SELECT
  USING (enrollment_id IN (
    SELECT id FROM enrollments WHERE student_id = auth.uid()
  ));

-- ATTENDANCE: teachers see their sessions, students see their own
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_see_own_session_attendance" ON attendance FOR ALL
  USING (class_session_id IN (
    SELECT id FROM class_sessions WHERE cohort_id IN (
      SELECT id FROM cohorts WHERE teacher_id = auth.uid()
    )
  ));
CREATE POLICY "students_see_own_attendance" ON attendance FOR SELECT
  USING (student_id = auth.uid());

-- ASSIGNMENTS: teachers see their cohorts, students see enrolled cohorts
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own_assignments" ON assignments FOR ALL
  USING (teacher_id = auth.uid());
CREATE POLICY "students_see_enrolled_assignments" ON assignments FOR SELECT
  USING (cohort_id IN (
    SELECT cohort_id FROM enrollments
    WHERE student_id = auth.uid() AND status = 'active'
  ));

-- ASSIGNMENT SUBMISSIONS: teachers see submissions in their cohorts, students see their own
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_see_own_cohort_submissions" ON assignment_submissions FOR SELECT
  USING (assignment_id IN (
    SELECT id FROM assignments WHERE teacher_id = auth.uid()
  ));
CREATE POLICY "students_manage_own_submissions" ON assignment_submissions FOR ALL
  USING (student_id = auth.uid());

-- ANNOUNCEMENT COMMENTS: teachers see comments on their announcements, students see enrolled
ALTER TABLE announcement_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_see_own_announcement_comments" ON announcement_comments FOR ALL
  USING (announcement_id IN (
    SELECT id FROM announcements WHERE teacher_id = auth.uid()
  ));
CREATE POLICY "students_see_enrolled_announcement_comments" ON announcement_comments FOR SELECT
  USING (announcement_id IN (
    SELECT a.id FROM announcements a
    JOIN enrollments e ON a.cohort_id = e.cohort_id
    WHERE e.student_id = auth.uid() AND e.status = 'active'
  ));

-- ANNOUNCEMENT READS: students manage their own, teachers see for their announcements
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_manage_own_reads" ON announcement_reads FOR ALL
  USING (student_id = auth.uid());
CREATE POLICY "teachers_see_own_announcement_reads" ON announcement_reads FOR SELECT
  USING (announcement_id IN (
    SELECT id FROM announcements WHERE teacher_id = auth.uid()
  ));

-- All admin operations use supabaseAdmin (service role) — bypasses RLS
-- NEVER expose service role key to the browser
```

### Postgres Functions (Migrations)

```sql
-- Atomic enrollment slot check (prevents race condition on last slot)
CREATE OR REPLACE FUNCTION enroll_student_atomic(
  p_cohort_id UUID, p_student_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_max INT; v_count INT; v_waitlist BOOL;
BEGIN
  SELECT max_students, waitlist_enabled INTO v_max, v_waitlist
  FROM cohorts WHERE id = p_cohort_id FOR UPDATE;

  SELECT COUNT(*) INTO v_count FROM enrollments
  WHERE cohort_id = p_cohort_id AND status = 'active';

  IF v_max IS NULL THEN RETURN 'enrolled'; END IF;
  IF v_count < v_max THEN RETURN 'enrolled'; END IF;
  IF v_waitlist THEN RETURN 'waitlisted'; END IF;
  RETURN 'full';
END; $$ LANGUAGE plpgsql;

-- Atomic balance credit (prevents race on concurrent payments)
CREATE OR REPLACE FUNCTION credit_teacher_balance(
  p_teacher_id UUID,
  p_amount INT,
  p_deduct_outstanding BOOL DEFAULT TRUE
) RETURNS VOID AS $$
DECLARE v_debit INT;
BEGIN
  SELECT outstanding_debit_pkr INTO v_debit
  FROM teacher_balances WHERE teacher_id = p_teacher_id FOR UPDATE;

  IF p_deduct_outstanding AND v_debit > 0 THEN
    UPDATE teacher_balances SET
      available_balance_pkr = available_balance_pkr + p_amount - LEAST(p_amount, v_debit),
      outstanding_debit_pkr = GREATEST(0, v_debit - p_amount),
      total_earned_pkr = total_earned_pkr + p_amount,
      updated_at = now()
    WHERE teacher_id = p_teacher_id;
  ELSE
    UPDATE teacher_balances SET
      available_balance_pkr = available_balance_pkr + p_amount,
      total_earned_pkr = total_earned_pkr + p_amount,
      updated_at = now()
    WHERE teacher_id = p_teacher_id;
  END IF;
END; $$ LANGUAGE plpgsql;

-- Atomic discount code use_count increment (prevents race on last available use)
CREATE OR REPLACE FUNCTION increment_discount_use(
  p_code_id UUID
) RETURNS BOOL AS $$
DECLARE
  v_max INT; v_count INT; v_expires TIMESTAMPTZ;
BEGIN
  SELECT max_uses, use_count, expires_at INTO v_max, v_count, v_expires
  FROM discount_codes WHERE id = p_code_id FOR UPDATE;

  IF v_expires IS NOT NULL AND v_expires < now() THEN RETURN FALSE; END IF;
  IF v_max IS NOT NULL AND v_count >= v_max THEN RETURN FALSE; END IF;

  UPDATE discount_codes SET use_count = use_count + 1 WHERE id = p_code_id;
  RETURN TRUE;
END; $$ LANGUAGE plpgsql;

-- Set grace_until when plan expires (called by grace-period cron or on plan expiry detection)
CREATE OR REPLACE FUNCTION set_grace_period(
  p_teacher_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE teachers SET
    grace_until = plan_expires_at + INTERVAL '5 days'
  WHERE id = p_teacher_id
    AND plan != 'free'
    AND plan_expires_at < now()
    AND (grace_until IS NULL OR grace_until < plan_expires_at);
END; $$ LANGUAGE plpgsql;
```

---

## 4. Authentication

### User Roles

| Role | Auth Method | Session Scope | Notes |
|------|------------|---------------|-------|
| Teacher | Email + password via Supabase Auth | skoolrooms.com + subdomains | Teachers share session across their own subdomain |
| Student | Email + password via Supabase Auth | students.skoolrooms.com | One account, enroll with multiple teachers |
| Admin | Email + password via Supabase Auth | skoolrooms.com/admin only | Separate admin role metadata |

### Teacher Login Flow

```
1. Teacher visits skoolrooms.com/login
2. Enters email + password
3. Supabase Auth validates → returns session
4. Server fetches teachers row by supabase_auth_id
5. If teacher.is_suspended → redirect to /suspended page
6. If !teacher.onboarding_completed → redirect to /onboarding/step-1
7. If teacher.trial_ends_at < now() AND plan = 'free' → grace period logic
8. Set session cookie → redirect to /dashboard
```

### Student Login Flow

```
1. Student visits students.skoolrooms.com OR is redirected from teacher subdomain
2. If no account: self-registers at enrollment time (name, phone, email, password)
3. Supabase Auth creates auth.users row
4. students row created linked to auth.users.id
5. Session valid on students.skoolrooms.com
```

### Admin Login Flow

```
1. Admin visits skoolrooms.com/admin
2. Middleware checks: is user authenticated AND has admin role metadata?
3. Admin role stored in auth.users user_metadata: { role: 'admin' }
4. Session timeout: 4 hours idle — then forced re-login (Supabase Auth JWT expiry)
5. All admin API routes check role via supabaseAdmin before executing
6. Failed login lockout: admin account locked after 5 consecutive failed attempts → alert email sent to admin's registered email
7. Admin login URL: `platformUrl('/admin/login')` — not linked from any public page
```

### Password Reset — Teachers and Students (Self-Serve)

Both flows use Supabase Auth built-in email reset:

```
Teacher/Student clicks "Forgot Password?" on login page
  ↓
Enters email address
  ↓
POST /api/auth/reset-password { email, role: 'teacher' | 'student' }
  ↓
supabase.auth.resetPasswordForEmail(email, { redirectTo: resetCallbackUrl })
  ↓
User receives email with reset link
  ↓
User clicks link → lands on /auth/reset-password?token=xxx
  ↓
User enters new password
  ↓
supabase.auth.updateUser({ password: newPassword })
  ↓
Redirect to login page with success toast
```

**Pages required:**
- `app/(platform)/forgot-password/page.tsx` — email entry form
- `app/(platform)/auth/reset-password/page.tsx` — new password form (token from URL)
- `app/(student)/forgot-password/page.tsx` — student variant
- Same Supabase Auth reset works for both roles — differentiated by `redirectTo` URL

### Admin — Emergency Password Reset for Teacher (P2)

```
Admin finds teacher in Teacher Account List
  ↓
POST /api/admin/teachers/[id]/reset-password
  ↓
supabase.auth.admin.generateLink({ type: 'recovery', email: teacher.email })
  ↓
Admin is shown the reset link (single use, 1hr expiry)
  ↓
Admin sends link to teacher via WhatsApp/email manually
  ↓
INSERT admin_activity_log { action_type: 'password_reset_generated', teacher_id }
```

### Role Check Pattern

```typescript
// In server components / API routes:
import { createClient } from '@/supabase/server'

export async function requireTeacher() {
  const supabase = await createClient()  // @supabase/ssr — async in Next.js 16
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AuthError('Not authenticated')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!teacher) throw new AuthError('Teacher not found')
  if (teacher.is_suspended) throw new AuthError('Account suspended')
  return teacher
}

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') throw new AuthError('Forbidden')
  return user
}
```

### Subdomain Routing — `middleware.ts`

```typescript
export function middleware(req: NextRequest) {
  const host = req.headers.get('host')?.replace(':3000','').replace(':3001','') ?? ''
  const domain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN!

  // students.skoolrooms.com → /student/*
  if (host === `students.${domain}`) {
    return NextResponse.rewrite(new URL(`/student${req.nextUrl.pathname}`, req.url))
  }

  // ahmed.skoolrooms.com → /teacher-public/ahmed/*
  const subdomain = host.replace(`.${domain}`, '')
  if (subdomain && subdomain !== domain && subdomain !== 'students' && subdomain !== 'www') {
    return NextResponse.rewrite(
      new URL(`/teacher-public/${subdomain}${req.nextUrl.pathname}`, req.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## 5. API Layer

> **Mutations use Server Actions** (`lib/actions/*.ts`), NOT API routes. Server Actions are called directly from Server Components and Client Components via form actions or `startTransition`. API routes (`app/api/`) exist ONLY for: webhooks, crons, external integrations (Cloudflare, R2, OAuth callback), and public endpoints.
>
> **Data reads** happen in Server Components via `lib/db/*.ts` (service layer). Client Components receive data via props from Server Component parents or React Context (TeacherProvider/StudentProvider).

> **Implementation note:** The tables below document the business logic for each operation. In the codebase, these are implemented as **Server Actions** in `lib/actions/*.ts` (not REST API routes), except where noted as actual API routes. The input/output/logic columns remain accurate regardless of transport mechanism.
>
> ### Server Action Files
>
> | File | Operations |
> |------|------------|
> | `lib/actions/admin.ts` | Admin panel mutations (teacher management, subscription approval/rejection) |
> | `lib/actions/announcements.ts` | Create/update announcements |
> | `lib/actions/assignments.ts` | Create/update assignments |
> | `lib/actions/attendance.ts` | Save attendance records |
> | `lib/actions/class-sessions.ts` | Create/cancel class sessions |
> | `lib/actions/cohorts.ts` | Create/update/archive cohorts |
> | `lib/actions/courses.ts` | Create/update/delete courses |
> | `lib/actions/enrollment-management.ts` | Approve/reject/manual enrollments, withdrawal management |
> | `lib/actions/enrollments.ts` | Student enrollment + payment flow |
> | `lib/actions/onboarding.ts` | Teacher onboarding step completion |
> | `lib/actions/student-payments.ts` | Student payment screenshot submissions |
> | `lib/actions/student-settings.ts` | Student profile updates |
> | `lib/actions/subscriptions.ts` | Teacher subscription + screenshot upload |
> | `lib/actions/teacher-settings.ts` | Teacher profile, payment settings, notifications |
> | `lib/actions/waitlist.ts` | Waitlist join/leave |
>
> ### Actual API Routes (server-side only)
>
> These are real `app/api/` route handlers — used for webhooks, crons, OAuth, and external service integrations:
>
> | Route | Purpose |
> |-------|---------|
> | `api/auth/callback/route.ts` | Supabase OAuth callback |
> | `api/cloudflare/subdomain/route.ts` | Cloudflare DNS management |
> | `api/r2/presign/route.ts` | R2 presigned upload URLs |
> | `api/student/enroll/route.ts` | Atomic student enrollment |
> | `api/explore/track/route.ts` | Explore page view tracking |
> | `api/public/cohort/[token]/payment-info/route.ts` | Public payment info endpoint |
> | `api/webhooks/payment/route.ts` | Payment gateway webhook (NOT YET BUILT) |
> | `api/cron/*` | 8 cron jobs (see Cron Routes section below) |

### Auth API

| Route | Method | Auth | Input | Output | Logic |
|-------|--------|------|-------|--------|-------|
| `/api/auth/teacher/signup` | POST | None | `{ name, email, password }` | `{ teacherId }` | Create Supabase auth user + teachers row (plan='free', trial_ends_at=NULL, plan_expires_at=NULL) + teacher_balances row. Teacher starts on Free plan. Plan upgrade happens later via `/subscribe` page. |
| `/api/auth/teacher/resend-verification` | POST | None | `{ email }` | `{ sent: true }` | Resend Supabase verification email |
| `/api/auth/teacher/change-email` | POST | Teacher | `{ newEmail }` | `{ pending: true }` | Set pending_email, send verification |
| `/api/auth/reset-password` | POST | None | `{ email, role }` | `{ sent: true }` | supabase.auth.resetPasswordForEmail() — works for both teacher and student |
| `/api/auth/update-password` | POST | Any | `{ password }` | `{ updated: true }` | supabase.auth.updateUser({ password }) — called from reset callback page |
| `/api/auth/student/signup` | POST | None | `{ name, phone, email, password }` | `{ studentId }` | Create Supabase auth + students row |
| `/api/admin/teachers/[id]/reset-password` | POST | Admin | — | `{ resetLink: string }` | Generate single-use recovery link via Supabase Auth Admin API. Log to admin_activity_log. |

### Cloudflare API

| Route | Method | Auth | Input | Output | Logic |
|-------|--------|------|-------|--------|-------|
| `/api/cloudflare/subdomain` | POST | Teacher | `{ subdomain }` | `{ created: true }` | Validate not taken → POST to Cloudflare DNS API → update teachers.subdomain |
| `/api/cloudflare/subdomain` | PATCH | Teacher | `{ newSubdomain }` | `{ updated: true }` | Check 30-day cooldown (subdomain_changed_at) → validate not taken → create new DNS CNAME → delete old DNS CNAME → update teachers.subdomain + subdomain_changed_at. Show confirmation modal in UI first. |
| `/api/cloudflare/subdomain` | DELETE | Admin | `{ subdomain }` | `{ deleted: true }` | Delete DNS record via Cloudflare API |

### R2 Upload API

| Route | Method | Auth | Input | Output | Logic |
|-------|--------|------|-------|--------|-------|
| `/api/r2/presign` | POST | Teacher or Student | `PresignInput` | `PresignOutput` | Validate file size via getPlatformSetting → generate R2 presigned PUT URL. **Profile photo + QR code uploads:** use fileType `'profile'` or `'qrcode'`. After successful R2 upload, client calls PATCH `/api/teacher/settings` to save the publicUrl to `teachers.profile_photo_url` or `teacher_payment_settings.qr_code_url`. |

### Teacher API

| Route | Method | Auth | Input | Output | Logic |
|-------|--------|------|-------|--------|-------|
| `/api/teacher/onboarding` | POST | Teacher | `{ step, data }` | `{ completed: bool }` | Save onboarding step data |
| `/api/teacher/subscribe` | POST | Teacher | `{ planSlug, idempotencyKey }` | `{ checkoutUrl?, subscriptionId }` | **First-time subscription OR renewal.** If teacher.plan='free' and plan has trial_days>0 and no prior subscription: set `teachers.plan=planSlug, trial_ends_at=now()+trial_days` (trial start — no payment needed). Otherwise: gateway mode → create checkout, screenshot mode → return screenshot form URL. Works for both new subscriptions and monthly renewals. |
| `/api/teacher/subscribe/screenshot` | POST | Teacher | `{ planSlug, screenshotUrl, transactionId }` | `{ subscriptionId }` | Upload screenshot → INSERT teacher_subscriptions (status: pending_verification, period_start=now(), period_end=now()+30 days) → notify admin. |
| `/api/teacher/courses` | POST | Teacher | `{ title, description }` | `{ courseId }` | Check getLimit('max_courses') → create course |
| `/api/teacher/courses/[id]` | PATCH | Teacher | Course fields | `{ updated: true }` | Validate ownership → update. If `status = 'published'`: check `teacher_payment_settings` row exists with ≥ 1 payout method — if not, return 400 `PAYMENT_SETUP_REQUIRED`. |
| `/api/teacher/courses/[id]` | DELETE | Teacher | — | `{ deleted: true }` | Check no active cohorts → soft delete |
| `/api/teacher/cohorts` | POST | Teacher | Cohort fields | `{ cohortId, inviteToken }` | Check canUseFeature + getLimit → create cohort + generate invite_token |
| `/api/teacher/cohorts/[id]` | PATCH | Teacher | Cohort fields | `{ updated: true }` | Update cohort. **If `max_students` increased AND `cohort_waitlist` has `status='waiting'` entries for this cohort:** send `waitlist_slots_available` email to teacher synchronously (not cron — immediate feedback). |
| `/api/teacher/cohorts/[id]/archive` | POST | Teacher | — | `{ archived: true }` | Set status=archived, archived_at=now() |
| `/api/teacher/class-sessions` | POST | Teacher | Session fields | `{ sessionId }` | Create single or recurring sessions |
| `/api/teacher/class-sessions/[id]/cancel` | POST | Teacher | `{ reason? }` | `{ cancelled: true }` | Set cancelled_at → send emails to enrolled students |
| `/api/teacher/enrollments/[id]/approve` | POST | Teacher | — | `{ approved: true }` | Screenshot mode: set enrollment active + send email |
| `/api/teacher/enrollments/[id]/reject` | POST | Teacher | `{ reason }` | `{ rejected: true }` | Set enrollment rejected + send email with reason |
| `/api/teacher/enrollments/manual` | POST | Teacher | `{ studentId, cohortId, amountPkr, note }` | `{ enrollmentId }` | Create enrollment active + payment row (method: manual) + email |
| `/api/teacher/students/create-and-enroll` | POST | Teacher | `{ name, phone, email, cohortId, amountPkr, note }` | `{ studentId, enrollmentId }` | Teacher adds brand-new student (no existing account): create students row + Supabase auth user with temp password → send welcome email with login details → manual enrollment |
| `/api/admin/teachers/[id]/wipe-test-account` | POST | Admin | — | `{ wiped: true }` | DEV/QA only. Hard-deletes all teacher data: courses, cohorts, enrollments, payments, students, R2 files. Requires confirmation token. Guard: only works if teacher.email contains '+test' or has test_account flag. |
| `/api/teacher/announcements` | POST | Teacher | `{ cohortId, body, fileUrl? }` | `{ announcementId }` | Create + email all cohort students |
| `/api/teacher/assignments` | POST | Teacher | `{ cohortId, title, description, dueDate, fileUrl? }` | `{ assignmentId }` | Create + email students |
| `/api/teacher/attendance` | POST | Teacher | `{ sessionId, records: [{studentId, present}] }` | `{ saved: true }` | Upsert attendance rows |
| `/api/teacher/payouts` | POST | Teacher | `{ amountPkr }` | `{ payoutId }` | Validate balance ≥ min + bank details set → create payout row → debit available_balance |
| `/api/teacher/discount-codes` | POST | Teacher | `{ cohortId, code, type, value, maxUses?, expiresAt? }` | `{ codeId }` | Check canUseFeature('discount_codes') → create |
| `/api/teacher/discount-codes/[id]` | PATCH | Teacher | `{ maxUses?, expiresAt? }` | `{ updated: true }` | Update code settings. Cannot change code string or discount value after creation. |
| `/api/teacher/discount-codes/[id]` | DELETE | Teacher | — | `{ deleted: true }` | Delete code. Only if use_count = 0 — otherwise archive (set expires_at = now()). |
| `/api/teacher/onboarding/complete-step` | POST | Teacher | `{ step: string }` | `{ completed: bool }` | Mark onboarding step complete. If all 5 done → set onboarding_completed = true. |
| `/api/teacher/analytics/storage` | GET | Teacher | — | `{ total, limit, breakdown }` | Returns storage used per category (thumbnails/assignments/announcements/submissions) via R2 list() by key prefix. |
| `/api/teacher/analytics/explore-views` | GET | Teacher | `{ period }` | `{ views, bySource }` | Returns explore page view count for this teacher, split by source (explore/search/direct). |
| `/api/teacher/analytics/revenue` | GET | Teacher | `{ period }` | `{ thisMonth, lastMonth, change, pending, byCohort[], chart[] }` | Revenue this month vs last (% change), pending unverified, per-cohort breakdown, 6-month chart data. Projected revenue = active monthly students × fee. |
| `/api/teacher/settings/notifications` | PATCH | Teacher | `{ preferences: Record<string, boolean> }` | `{ updated: true }` | Update `notification_preferences_json`. Rejects attempts to disable business-critical emails. |
| `/api/teacher/plan-details` | GET | Teacher | — | `{ plan, limits, features, usage, isGrandfathered }` | Returns current plan info, all feature flags (enabled/locked), current usage counts, and whether teacher has grandfathered limits. Single endpoint for client-side plan gates. |

### Phase 2 API Endpoints (build in Phase 2)

| Route | Method | Auth | Input | Output | Logic |
|-------|--------|------|-------|--------|-------|
| `/api/teacher/students/[id]/notes` | PATCH | Teacher | `{ notes: string }` | `{ updated: true }` | Private teacher notes per student. Notes are teacher-scoped — different teachers cannot see each other's notes for the same student. |
| `/api/teacher/cohorts/[id]/duplicate` | POST | Teacher | `{ newStartDate, newEndDate, newName }` | `{ newCohortId }` | Copy cohort settings + class session schedule to new cohort. Does NOT copy enrollments or payments. |
| `/api/teacher/students/[id]/notes` | PATCH | Teacher | `{ notes }` | `{ updated: true }` | Update private teacher notes per student |
| `/api/teacher/subscription/history` | GET | Teacher | — | `{ subscriptions[] }` | Teacher's own subscription history (from teacher_subscriptions) |
| `/api/messages/send` | POST | Teacher or Student | `{ recipientId, recipientType, body }` | `{ messageId }` | Create direct_messages row. Send email notification to recipient. |
| `/api/messages/thread` | GET | Teacher or Student | `{ otherPartyId, otherPartyType }` | `{ messages[] }` | Fetch message thread ordered by created_at |
| `/api/messages/read` | POST | Teacher or Student | `{ messageId }` | `{ read: true }` | Set read_at on direct_messages row |
| `/api/referrals/generate` | POST | Teacher | — | `{ referralCode, referralUrl }` | Create or return existing referrals row for this teacher. referralUrl = platformUrl(`/signup?ref=${code}`) |
| `/api/referrals/convert` | POST | System | `{ referralCode, newTeacherId }` | `{ credited: true }` | Called at teacher signup if ref param present. Set referrals.status = 'converted'. Credit applied after new teacher's first paid month. |
| `/api/cohort/feedback` | POST | Student | `{ cohortId, rating, comment? }` | `{ feedbackId }` | Shown to student after cohort archives. One per student per cohort (UNIQUE). All feedback private (teacher-only) — no `isPrivate` flag needed. Public ratings deferred to Phase 3. |
| `/api/cohort/feedback` | GET | Teacher | `{ cohortId }` | `{ feedback[] }` | Teacher views all feedback for a cohort. All feedback is private — visible to teacher only. |
| `/api/admin/teachers/[id]/reset-password` | POST | Admin | — | `{ resetLink }` | Generate Supabase Admin recovery link. Log action. Return link to admin to share manually. |
| `/api/admin/teachers/[id]/wipe-test-account` | POST | Admin | `{ confirmToken }` | `{ wiped: true }` | Hard delete all data for test accounts only. |
| `/api/admin/payouts/[id]/complete` | POST | Admin | `{ adminNote }` | `{ completed: true }` | Mark payout completed. Snapshot LIVE bank details from teacher_payment_settings into bank_details_snapshot_json (audit trail). Update teacher_balances.pending_balance -= amount, total_paid_out += amount. Send email. |
| `/api/admin/payouts/[id]/fail` | POST | Admin | `{ adminNote }` | `{ failed: true }` | Mark payout failed. Restore available_balance += amount, pending_balance -= amount. Send email. |
| `/api/admin/teachers/bulk-email` | POST | Admin | `{ subject, body, targetFilter? }` | `{ sent: number }` | Send email to all active teachers (or filtered subset). Log to admin_activity_log. |
| `/api/admin/analytics` | GET | Admin | `{ period, metric }` | KPI data | Returns full KPI dashboard data. period: 'monthly' \| 'quarterly' \| 'half-yearly' \| 'annual'. |
| `/api/admin/teachers/[id]/activity-log` | GET | Admin | `{ page?, limit? }` | `{ entries[], total }` | Filtered activity log per teacher from admin_activity_log. Sortable by created_at. |
| `/api/admin/subscriptions/[id]/approve` | POST | Admin | — | `{ approved: true }` | Approve teacher subscription screenshot. **Exact logic:** `teacher_subscriptions.status='active', approved_at=now()`. `teachers.plan=planSlug, plan_expires_at=teacher_subscriptions.period_end, grace_until=NULL, trial_ends_at=NULL`. INSERT `teacher_plan_snapshot`. Send `payment_approved` email. **This also serves as the unlock flow** — if teacher was hard-locked, setting `grace_until=NULL` lifts the lock immediately. |
| `/api/admin/subscriptions/[id]/reject` | POST | Admin | `{ reason }` | `{ rejected: true }` | Reject teacher subscription screenshot. Update teacher_subscriptions.status = 'rejected'. Send payment_rejected email. |
| `/api/validate-discount` | POST | Student | `{ cohortId, code }` | `{ valid, discountedAmount, type, value }` | Validates discount code: correct cohort, not expired, uses remaining. Does NOT increment use_count. |
| `/api/admin/teachers/[id]/change-plan` | POST | Admin | `{ planSlug, expiresAt? }` | `{ updated: true }` | Manual plan override without payment. Sets `teachers.plan=planSlug, plan_expires_at=expiresAt (or now()+30d), grace_until=NULL, trial_ends_at=NULL`. INSERT teacher_plan_snapshot. Log to admin_activity_log. |
| `/api/admin/teachers/[id]/extend-expiry` | POST | Admin | `{ days }` | `{ newExpiresAt }` | Extend plan_expires_at by N days. If grace_until is set and would now be before new plan_expires_at + 5 days, also extend grace_until. Log to admin_activity_log. |
| `/api/admin/teachers/[id]/extend-trial` | POST | Admin | `{ days }` | `{ newTrialEndsAt }` | Extend trial_ends_at by N days. Only works if trial is active (trial_ends_at > now()). Log to admin_activity_log. |
| `/api/admin/teachers/[id]/suspend` | POST | Admin | `{ reason }` | `{ suspended: true }` | Set is_suspended=true, suspended_at=now(). Log to admin_activity_log. Teacher can't log in. Students retain access to enrolled cohort content. Cron jobs skip suspended teacher's emails. |
| `/api/admin/teachers/[id]/reactivate` | POST | Admin | — | `{ reactivated: true }` | Set is_suspended=false. Log to admin_activity_log. Does NOT reset plan_expires_at — if plan expired during suspension, teacher enters grace/lock on next login. |
| `/api/public/cohort/[token]/payment-info` | GET | None | — | `{ fee, bankDetails, qrCodeUrl, instructions, referenceCode? }` | **Public endpoint** for student payment page. Returns teacher's payment settings + cohort fee. If student is authenticated and has a pending enrollment for this cohort, also returns reference_code. No auth required for bank details (student needs to see them to pay). |

### Student API

| Route | Method | Auth | Input | Output | Logic |
|-------|--------|------|-------|--------|-------|
| `/api/student/enroll` | POST | Student | `EnrollInput` | `EnrollOutput` | Atomic slot check → discount validation → create checkout or screenshot flow |
| `/api/student/waitlist/join` | POST | None (public) | `{ cohortId, name, phone, email }` | `{ position: number }` | Add to cohort_waitlist. Account NOT required. If student logged in, also set student_id. |
| `/api/student/waitlist/leave` | POST | Student or by email | `{ cohortId, email? }` | `{ left: true }` | Remove from waitlist. Logged-in students match by student_id, anonymous by email. |
| `/api/student/submissions` | POST | Student | `{ assignmentId, textAnswer?, fileUrl? }` | `{ submissionId }` | Create submission |
| `/api/student/announcements/[id]/read` | POST | Student | — | `{ marked: true }` | Upsert announcement_reads |
| `/api/student/enrollments/[id]/withdraw` | POST | Student | `{ reason? }` | `{ requested: true }` | Set `withdrawal_requested_at = now()`, `withdrawal_reason`. Status stays `active` until teacher decides. Send email + badge to teacher. |

### Teacher Withdrawal Management

| Route | Method | Auth | Input | Output | Logic |
|-------|--------|------|-------|--------|-------|
| `/api/teacher/enrollments/[id]/approve-withdrawal` | POST | Teacher | — | `{ approved: true }` | Set `enrollment.status = 'withdrawn'`. Student loses access. Send email to student. |
| `/api/teacher/enrollments/[id]/reject-withdrawal` | POST | Teacher | `{ note? }` | `{ rejected: true }` | Clear `withdrawal_requested_at`. Enrollment stays active. Send email to student with note. |

### Payment Webhook

| Route | Method | Auth | Notes |
|-------|--------|------|-------|
| `/api/webhooks/payment` | POST | Signature header | Verify signature first. Idempotency check. Process subscription or enrollment. |

**Webhook handler logic:**
```
1. Verify gateway signature → 401 if invalid
2. Idempotency check on idempotency_key → 200 if duplicate
3. Read metadata.type:
   - 'subscription': update teacher_subscriptions + teachers.plan/plan_expires_at
   - 'enrollment': calculate cuts → student_payments row → teacher_balances credit (atomic) → enrollment active → emails
4. On 'enrollment' payment for full cohort (race): refund + waitlist or apologetic email
5. Increment discount_codes.use_count if code was applied
6. Return 200
```

### Cron Routes (Vercel Cron — protected by CRON_SECRET header)

| Route | Schedule | Logic |
|-------|----------|-------|
| `/api/cron/archive-cohorts` | Daily 00:00 UTC | Find cohorts where end_date < today AND status != 'archived' → archive + auto-reject pending enrollments + notify students. **Also:** expire all `cohort_waitlist` entries (status='waiting') for archived cohorts → set status='expired'. |
| `/api/cron/fee-reminders` | Daily 12:00 UTC (5pm PKT) | Find monthly cohorts where billing_day is 3 days away. For each active enrollment: check if `student_payments` row exists with `payment_month = current billing month AND status IN ('confirmed', 'pending_verification')`. If NO matching payment → queue `fee_reminder` email. **Multi-teacher batching:** If same student has unpaid fees across multiple teachers on the same billing_day, send ONE combined email listing all outstanding cohorts (group by student_id before sending). `payment_month` stores first of month (e.g., 2026-03-01). |
| `/api/cron/class-reminders` | Every hour | Find sessions in next 24h (for 24h reminder) and next 1h (for 1h reminder) → send emails |
| `/api/cron/trial-expiry` | Daily 06:00 UTC | Find teachers where trial_ends_at < now() AND plan != 'free' → downgrade to free → send plan_downgraded email |
| `/api/cron/renewal-reminders` | Daily 08:00 UTC | Find teachers where plan_expires_at is within 3 days AND plan != 'free' → send subscription_renewal_reminder email. Find teachers where trial_ends_at is within 2 days AND plan != 'free' → send trial_ending_soon email. |
| `/api/cron/reconcile` | Daily 02:00 UTC | Fetch gateway transactions from 02:00 UTC yesterday to 02:00 UTC today → compare against `student_payments` + `teacher_subscriptions` → flag mismatches in admin operations panel |
| `/api/cron/grace-period` | Daily 07:00 UTC | **Step 1:** Find teachers where `plan_expires_at < now() AND grace_until IS NULL AND plan != 'free'` → call `set_grace_period()` to set `grace_until = plan_expires_at + 5 days`. **Step 2:** Find teachers where `plan_expires_at < now() AND grace_until > now() AND plan != 'free'` → send `grace_period_daily_reminder` email (days 1–5). **Step 3:** Find teachers where `grace_until < now() AND grace_until IS NOT NULL AND plan != 'free'` → hard lock active → send `plan_hard_locked` email (once, track via admin_activity_log to avoid re-sending). |
| `/api/cron/enrollment-nudge` | Daily 14:00 UTC | Find teacher-verifiable enrollment screenshots (screenshot method) unverified for >24h → send enrollment_unverified_24h nudge to teacher |
| `/api/cron/subscription-nudge` | Daily 09:00 UTC | Find admin subscription screenshots pending >48h → send subscription_screenshot_pending_48h alert to admin |

---

## 6. Realtime Subscriptions

Supabase Realtime used for live UI updates. All subscriptions go through `useRealtime()` hook.

| What subscribes | Table | Filter | Event | Who sees it | Why |
|----------------|-------|--------|-------|------------|-----|
| Teacher payment queue badge | `student_payments` | `enrollment.cohort.teacher_id = teacherId` | INSERT | Teacher dashboard | Badge count updates live |
| Teacher subscription queue | `teacher_subscriptions` | `teacher_id = teacherId` | UPDATE | Subscribe page | Approval confirmation |
| Cohort announcement board | `announcements` | `cohort_id = cohortId` | INSERT | Student portal + teacher | Live feed |
| Announcement comments | `announcement_comments` | `announcement_id = announcementId` | INSERT | Announcement thread | Live comments |
| Student enrollment status | `enrollments` | `id = enrollmentId` | UPDATE | Student portal | Approval feedback |
| Teacher waitlist | `cohort_waitlist` | `cohort_id = cohortId` | INSERT, UPDATE | Teacher cohort view | Live waitlist |
| Admin payment queue | `teacher_subscriptions` | None (admin sees all) | INSERT | Admin dashboard | Live queue |
| Teacher balance | `teacher_balances` | `teacher_id = teacherId` | UPDATE | Teacher earnings page | Balance updates |

---

## 7. Payment Flows

### Flow A — Teacher Subscription via Gateway (Phase 2+)

```
Teacher selects plan on pricing page
  ↓
POST /api/teacher/subscribe { planSlug, idempotencyKey }
  ↓
Server: isGatewayEnabled()? → if false: show screenshot form
  ↓
PaymentProvider.createCheckout({
  amountPkr: plan.price_pkr,
  description: `Skool Rooms ${plan.name} Plan`,
  metadata: { type: 'subscription', teacherId, planSlug },
  idempotencyKey,
  successUrl: platformUrl('/subscribe/success'),
  cancelUrl: platformUrl('/subscribe'),
})
  ↓
Teacher redirected to gateway hosted checkout
  ↓
[Gateway processes payment]
  ↓
POST /api/webhooks/payment (gateway fires this)
  ↓
Verify signature → idempotency check
  ↓
INSERT teacher_subscriptions (status: active)
  ↓
UPDATE teachers SET plan = planSlug, plan_expires_at = now() + 30 days
  ↓
INSERT teacher_plan_snapshot (snapshot of current plan limits + features)
  ↓
sendEmail(teacher, 'payment_approved')
```

### Flow A — Teacher Subscription via Screenshot (Launch Primary)

```
Teacher fills screenshot upload form on /subscribe
  ↓
Teacher uploads bank transfer screenshot + transaction ID
  ↓
POST /api/teacher/subscribe/screenshot
  ↓
Upload screenshot to R2 → INSERT teacher_subscriptions (status: pending_verification)
  ↓
sendEmail(admin, 'new_subscription_screenshot')
  ↓
Admin opens Admin → Payments queue
  ↓
Admin views screenshot → clicks Approve
  ↓
POST /api/admin/subscriptions/[id]/approve
  ↓
UPDATE teacher_subscriptions status = 'active'
UPDATE teachers SET plan, plan_expires_at
INSERT teacher_plan_snapshot
  ↓
sendEmail(teacher, 'payment_approved')
```

### Flow B — Student Enrollment via Gateway (Phase 2+)

```
Student clicks 'Enroll Now' on cohort page
  ↓
If discount code entered: POST /api/validate-discount → server validates
  ↓
POST /api/student/enroll { cohortId, studentId, discountCode?, idempotencyKey }
  ↓
Server: enroll_student_atomic() → 'enrolled' | 'waitlisted' | 'full'
  ↓ (if 'full' + waitlist) → redirect to waitlist flow
  ↓ (if 'full' + no waitlist) → show "Cohort Full" error
  ↓
PaymentProvider.createCheckout({
  amountPkr: discountedAmount,
  metadata: { type: 'enrollment', cohortId, studentId, discountCodeId }
})
  ↓
Student redirected to gateway
  ↓
[Gateway processes payment]
  ↓
POST /api/webhooks/payment
  ↓
Verify signature → idempotency check
  ↓
platform_cut_pkr = amount × (plan.transaction_cut_percent / 100)
teacher_payout_amount_pkr = amount − platform_cut_pkr
  ↓
INSERT student_payments (status: confirmed, all cut fields recorded)
  ↓
credit_teacher_balance(teacherId, teacher_payout_amount_pkr) — atomic
  ↓
INSERT enrollments (status: active)  ← NO teacher approval for gateway
  ↓
INCREMENT discount_codes.use_count (if code used)
  ↓
sendEmail(student, 'enrollment_confirmed')
sendEmail(teacher, 'new_enrollment_notification')
```

### Flow B — Student Enrollment via Screenshot

```
Student uploads transfer screenshot on payment page
  ↓
INSERT student_payments (status: pending_verification)
INSERT enrollments (status: pending)
  ↓
sendEmail(teacher, 'pending_enrollment_notification')
  ↓
Teacher views screenshot in Payment Verification panel
  ↓
Teacher clicks Approve or Reject
  ↓
On Approve:
  UPDATE enrollments status = 'active'
  UPDATE student_payments status = 'confirmed'
  Calculate cuts: platform_cut_pkr = amount × (plan.transaction_cut_percent / 100)
                  teacher_payout_amount_pkr = amount − platform_cut_pkr
  credit_teacher_balance(teacherId, teacher_payout_amount_pkr) — atomic
  NOTE: In screenshot mode, student paid teacher's bank directly. The balance credit
        represents the teacher's net earnings AFTER platform cut. Teacher can withdraw
        this amount via payout. Platform cut is owed by teacher — collected at payout time
        (deducted from payout amount before transfer).
  sendEmail(student, 'enrollment_confirmed')
  ↓
On Reject:
  UPDATE enrollments status = 'rejected'
  UPDATE student_payments status = 'rejected', rejection_reason
  sendEmail(student, 'enrollment_rejected', { reason })
  → Student can resubmit new screenshot
```

### Flow B — Manual Enrollment (Cash / In-Person)

```
Teacher opens Students → Manual Enroll
  ↓
POST /api/teacher/enrollments/manual { studentId, cohortId, amountPkr, note }
  ↓
INSERT enrollments (status: active)
INSERT student_payments (payment_method: 'manual', status: confirmed)
  ↓
teacher_balances NOT updated (cash is already with teacher — platform never held these funds)
  ↓
student_payments.platform_cut_pkr = 0, teacher_payout_amount_pkr = 0 (no platform involvement)
  ↓
sendEmail(student, 'enrollment_confirmed')
```

> **Manual enrollment earnings rule:** Manual/cash payments do NOT credit `teacher_balances` because the money went directly to the teacher, not through the platform. These payments appear in the teacher's payment history for record-keeping but are excluded from: available_balance, payout calculations, and platform cut metrics. The teacher's "Earnings" dashboard only shows gateway-processed and screenshot-verified payments — i.e., money that flowed through the platform.

### Flow B — Monthly Recurring Payment (Existing Enrollment)

> **Scope:** only runs for active enrollments in cohorts where `fee_type = 'monthly'`. The initial payment is still created by `/api/student/enroll` (§Flow B Screenshot); this flow covers every month after that.

```
Student visits /student/payments
  ↓
Page computes outstanding months per active monthly enrollment:
  schedule = monthlyBillingSchedule(cohort.start_date, cohort.end_date)
  settled  = months where a payment row exists with status ∈ {confirmed, pending_verification}
  outstanding = schedule − settled
  status per month: overdue (due < today PKT) | due (within 7 days) | upcoming (> 7 days out)
  ↓
Student clicks "Pay now" on an outstanding row
  ↓
createNextMonthPaymentAction(enrollmentId, paymentMonth)
  ↓
Guards:
  - auth: student owns the enrollment
  - cohort.fee_type === 'monthly' AND cohort.status !== 'archived'
  - paymentMonth ∈ monthlyBillingSchedule(cohort)
  ↓
Idempotency — check getPaymentByEnrollmentAndMonth(enrollmentId, paymentMonth):
  - existing confirmed           → error: "This month is already paid."
  - existing pending_verification → return { paymentId: existing.id } (no insert)
  - existing rejected            → reset to pending_verification, clear screenshot_url + rejection_reason, return that id
  - none                         → INSERT student_payments (status: pending_verification,
                                    screenshot_url: null, payment_method: 'screenshot',
                                    payment_month: paymentMonth, platform_cut_pkr: 0,
                                    teacher_payout_amount_pkr: 0, fresh reference_code,
                                    idempotency_key: `monthly-${enrollmentId}-${paymentMonth}`)
                                    — catches 23505 (concurrent insert) via PAYMENT_ALREADY_EXISTS
                                      and returns the winning row's id
  ↓
Student is redirected to /join/[token]/pay/[enrollmentId]?paymentId=<id>
  ↓
Student uploads screenshot → submitScreenshotAction(enrollmentId, screenshotUrl, paymentId)
  ↓
When paymentId is passed, the action targets that specific row (it does NOT require
enrollment.status === 'pending' — the enrollment is already 'active' for a monthly re-upload).
  ↓
Teacher opens EnrollmentPaymentsModal (per-enrollment payment history)
  ↓
Teacher clicks Approve on the month's row
  ↓
approveMonthlyPaymentAction(paymentId)
  ↓
Guards: teacher owns cohort, payment.status === 'pending_verification', screenshot_url set,
        payment_method !== 'manual'
  ↓
confirmPaymentAndCreditBalance() — shared core with initial enrollment approval:
  platform_cut_pkr = discounted × (plan.transaction_cut_percent / 100)
  teacher_payout_amount_pkr = discounted − platform_cut_pkr
  UPDATE student_payments status='confirmed', verified_at=now(), cut fields set
  credit_teacher_balance(teacherId, teacher_payout_amount_pkr, deduct_outstanding=true)
  ↓
sendEmail(student, 'enrollment_confirmed', { paymentMonth })
  ↓
On Reject: rejectMonthlyPaymentAction(paymentId, reason)
  UPDATE student_payments status='rejected', rejection_reason
  sendEmail(student, 'enrollment_rejected', { paymentMonth, reason })
  → Student can re-upload via the same outstanding-month row (reset path above)
```

> **Why payment_month is set at creation, not at approval:** the `fee-reminders` cron's idempotency check is `payment_month = current billing month AND status IN ('confirmed', 'pending_verification')`. If we only set `payment_month` at approval, a student who uploaded a screenshot on Apr 2 but isn't approved until Apr 6 would receive an Apr 5 reminder asking them to pay again. Setting it at creation closes this window.

### Payout Flow

```
Teacher sees available_balance ≥ min_payout_amount_pkr
  ↓
Teacher clicks "Request Payout" on Earnings page
  ↓
POST /api/teacher/payouts { amountPkr }
  ↓
Server validates: balance sufficient + bank details set + no existing payout with status IN ('pending', 'processing')
  ↓ (reject if existing pending/processing payout exists — one active request at a time)
  ↓
INSERT teacher_payouts (status: pending) — NO bank detail snapshot yet
  ↓
UPDATE teacher_balances:
  available_balance -= amount
  pending_balance += amount
  ↓
sendEmail(teacher, 'payout_requested')
sendEmail(admin, 'payout_pending_action')
  ↓
Admin opens Admin → Payouts queue
  ↓
Admin sees LIVE bank details from teacher_payment_settings (not a snapshot)
  ↓ (if teacher_payment_settings.updated_at > teacher_payouts.requested_at → show warning)
  ↓
Admin manually transfers via bank/JazzCash using the LIVE bank details
  ↓
Admin marks Completed → POST /api/admin/payouts/[id]/complete { adminNote }
  ↓
UPDATE teacher_payouts:
  status = 'completed', processed_at = now(), admin_note
  bank_details_snapshot_json = current teacher_payment_settings (for audit trail)
UPDATE teacher_balances: pending_balance -= amount, total_paid_out += amount
  ↓
sendEmail(teacher, 'payout_processed')
```

### Refund Rules (Per v11)

**Refund available only while amount is still in teacher's platform balance:**
- Refund option shown on payment record ONLY if `teacher_balances.available_balance_pkr >= payment.amount_pkr`
- Once a payout is processed and balance is reduced, refund is automatically locked for payments in that payout
- Payment record shows: "Refund available" OR "Refund unavailable — amount already paid out"

**Post-payout refund — teacher handles offline:**
```
Teacher wants to refund a payment that's already been paid out
  ↓
Teacher handles transfer personally outside platform (bank/JazzCash/cash)
  ↓
Teacher clicks 'Record Offline Refund' on the payment record
  ↓
Enters: refund amount + note (e.g. "Rs. 3,500 returned via JazzCash")
  ↓
UPDATE student_payments: refunded_at = now(), refund_note saved
  ↓
Platform admin receives notification (for records only — no action needed)
  ↓
teacher_balances NOT changed (platform never had the money)
```

**This design prevents negative balances entirely — platform never owes money it doesn't have.**

**In-app refund (while balance available):**

> **Refund amount = `teacher_payout_amount_pkr`** (the amount credited to teacher's balance, NOT the full `amount_pkr`). Teacher was credited Rs. 2,700 on a Rs. 3,000 payment (10% cut) → refund deducts Rs. 2,700 from available_balance. The Rs. 300 platform cut is also refunded to maintain clean accounting. Check: `available_balance >= teacher_payout_amount_pkr`.

> **Refund target is a specific payment, not the enrollment.** Monthly cohorts produce one payment row per month, each with its own `teacher_payout_amount_pkr`. `recordRefundAction` accepts an optional `paymentId` form field — when set, that exact payment is refunded (used by the per-payment modal). When omitted, the action falls back to the latest `status='confirmed'` payment for the enrollment (legacy shortcut for one-time cohorts and the standalone dropdown action). A `.gte('available_balance_pkr', refundAmount)` guard on the balance update blocks races when two refunds are attempted at once.

```
Teacher clicks 'Refund' on payment record (only shown if available_balance >= teacher_payout_amount_pkr)
  ↓
Confirm refund amount (shows: "Refund Rs. 2,700 to student")
  ↓
UPDATE student_payments status = 'refunded', refunded_at = now()
  ↓
UPDATE teacher_balances available_balance -= teacher_payout_amount_pkr
  (atomic: .gte() guard on available_balance_pkr — fails if insufficient, surfaces "use offline" error)
  ↓
sendEmail(student, 'enrollment_refunded')
sendEmail(admin, 'refund_recorded')
```

**Revoke + refund coupling (removing a student from a cohort):**

> When a teacher clicks "Remove student", the `RevokeDialog` renders a single opt-in checkbox offering to also refund the most recent confirmed payment. The checkbox is ONLY shown when the refund is in-app eligible (`status='confirmed'` AND not refunded AND `payment_method !== 'manual'` AND `available_balance >= teacher_payout_amount_pkr` AND `teacher_payout_amount_pkr > 0`). The dialog chains two server actions sequentially:
>
> 1. `revokeEnrollmentAction(enrollmentId, { reason })` — always runs
> 2. `recordRefundAction(enrollmentId, { refund_mode: 'in_app', refund_note: 'Refunded as part of removal' })` — only if checkbox checked
>
> If step 2 fails after step 1 succeeded, the dialog surfaces a partial-success toast: *"[Student] was removed, but refund failed: [reason]. Try again from the Record refund option."* The standalone "Record refund" option stays on the dropdown for the keep-them-enrolled case and for refunding specific past months on monthly enrollments.

### Outstanding Debit — When Platform Absorbs a Refund

> `teacher_balances.outstanding_debit_pkr` tracks money the teacher owes the platform. This happens ONLY in one scenario:

```
Gateway payment confirmed → platform already credited teacher's balance
  ↓
Student disputes payment with their bank (chargeback) OR admin issues refund via gateway
  ↓
Platform absorbs the refund (money leaves platform account)
  ↓
But teacher's balance was already credited — teacher owes platform
  ↓
UPDATE student_payments: status = 'refunded', platform_absorbed_refund = true
UPDATE teacher_balances: outstanding_debit_pkr += teacher_payout_amount_pkr
  ↓
sendEmail(teacher, 'refund_debit_recorded') — "Rs. X has been debited from your future earnings"
  ↓
On next payment to this teacher: credit_teacher_balance() auto-deducts outstanding debit
  (controlled by platform_settings.refund_debit_recovery_enabled)
  ↓
When outstanding_debit_pkr reaches 0: sendEmail(teacher, 'refund_debit_recovered')
```

> **Admin dashboard:** Teachers with outstanding_debit > 0 shown in Operations panel. Admin can manually clear debit if needed (e.g., platform decides to eat the loss).

### Waitlist Flow (Manual — Teacher Manages Contact)

```
Cohort full + waitlist_enabled = true
  ↓
Student visits /join/[token] → sees "Cohort Full — Join Waitlist" page
  ↓
Student fills: name, phone, email (account creation NOT required)
  ↓
POST /api/student/waitlist/join { cohortId, name, phone, email }
  ↓
INSERT cohort_waitlist (status: 'waiting', student_name, student_phone, student_email)
  If student is logged in: also set student_id
sendEmail(student, 'waitlist_joined')
  ↓
Teacher sees waitlist tab per cohort: student name, phone, email, date joined, position
  ↓
When teacher increases max_students:
  System sends notification to teacher: "You have X students waiting — slots are now available."
  ↓
Teacher manually contacts waitlisted students via WhatsApp/email (using visible contact details)
  Platform does NOT auto-enroll from waitlist.
  ↓
When student completes enrollment: teacher updates waitlist status to 'enrolled'
  ↓
Student can remove themselves from waitlist at any time
Teacher can remove students from waitlist (optional note field)
  ↓
On cohort archive: all 'waiting' entries → status = 'expired'. No notification sent.
```

---

## 8. Notifications

### Every Email Trigger

| Email Type | Trigger | Recipient | Can Opt Out? | Channel |
|-----------|---------|-----------|-------------|---------|
| `enrollment_confirmed` | Enrollment active | Student | No | Email |
| `enrollment_pending` | Screenshot submitted | Student | No | Email |
| `enrollment_rejected` | Teacher rejects | Student | No | Email |
| `class_reminder_24h` | 24h before session | Student + Teacher | Yes | Email → WhatsApp P2 |
| `class_reminder_1h` | 1h before session | Student + Teacher | Yes | Email → WhatsApp P2 |
| `class_cancelled` | Teacher cancels session | Student | No | Email |
| `payment_approved` | Admin approves subscription | Teacher | No | Email |
| `payment_rejected` | Admin rejects subscription | Teacher | No | Email |
| `subscription_renewal_reminder` | 3 days before expiry | Teacher | No | Email |
| `grace_period_daily_reminder` | Days 1–5 after expiry (daily) | Teacher | No | Email |
| `plan_hard_locked` | Day 6 after expiry — read-only lock applied | Teacher | No | Email |
| `trial_ending_soon` | 2 days before trial ends | Teacher | No | Email |
| `plan_downgraded` | Trial expired / grace ended | Teacher | No | Email |
| `payout_processed` | Admin marks payout complete | Teacher | No | Email |
| `payout_failed` | Admin marks payout failed | Teacher | No | Email |
| `refund_debit_recorded` | Platform absorbs refund | Teacher | No | Email |
| `refund_debit_recovered` | Debit fully recovered | Teacher | No | Email |
| `waitlist_joined` | Student joins waitlist | Student | Yes | Email |
| `waitlist_slots_available` | Teacher increases max_students while waitlist has entries | Teacher | No | Email — "You have X students waiting — slots are now available" |
| `fee_reminder` | 3 days before billing day | Student | Yes | Email |
| `fee_overdue_5day` | 5 days after billing day, not paid | Student | Yes | Email |
| `new_announcement` | Teacher posts announcement | All cohort students | Yes | Email |
| `student_comment` | Student comments on announcement | Teacher | Yes | Email |
| `cohort_archived` | Cohort end date passed | Enrolled students | No | Email |
| `enrollment_unverified_24h` | Teacher has not verified screenshot for 24h | Teacher | Yes | Email — nudge to check pending enrollments |
| `subscription_screenshot_pending_48h` | Admin has not approved subscription screenshot for 48h | Admin | No | Email — admin action required |
| `new_enrollment_notification` | Student enrolls (any method) | Teacher | Yes | Email |
| `new_message` | New direct message received | Teacher or Student | Yes | Email (P2) |
| `referral_converted` | Referred teacher paid first month | Referring teacher | No | Email — credit applied (P2) |
| `payout_requested` | Teacher requests payout | Teacher | No | Email — confirmation of request |
| `payout_pending_action` | New payout request awaiting admin | Admin | No | Email — admin action required |
| `new_subscription_screenshot` | Teacher submits subscription screenshot | Admin | No | Email — admin action required |
| `enrollment_refunded_cohort_full` | Gateway payment confirmed but cohort full (race) | Student | No | Email — refund issued |
| `waitlist_joined_after_payment_refund` | Gateway paid, cohort full, added to waitlist | Student | No | Email — refund + waitlist |
| `gateway_error_alert` | N gateway errors in 10 min window | Admin | No | Email — immediate alert |

### Opt-Out Fields

Stored in `teachers.notification_preferences_json`:
```json
{
  "class_reminder_24h": true,
  "class_reminder_1h": true,
  "fee_reminder": true,
  "new_enrollment_notification": true,
  "student_comment": true,
  "waitlist_joined": true,
  "enrollment_unverified_24h": true,
  "new_message": true
}
```

**Settings → Notifications page also shows:**
- Email count sent this month per type (e.g. "Class Reminder 24h: sent 12 times this month")
- This is for teacher awareness — not a setting, just a counter
- Sourced from `notifications_log` filtered by `recipient_id + created_at >= start_of_month`

**Cannot be opted out (transactional/financial — always sent regardless of preferences):**
- `payment_approved`, `payment_rejected`
- `subscription_renewal_reminder`
- `grace_period_daily_reminder`, `plan_hard_locked`
- `trial_ending_soon`, `plan_downgraded`
- `payout_processed`, `payout_failed`
- `refund_debit_recorded`, `refund_debit_recovered`
- `enrollment_confirmed`, `enrollment_rejected`
- `cohort_archived`

Every email type requires these minimum variables:
```typescript
const emailData = {
  teacherName: string,      // for teacher emails
  studentName: string,      // for student emails
  platformName: string,     // "Skool Rooms"
  platformUrl: string,      // platformUrl()
  // ... type-specific variables
}
```

> **Student notification preferences:** Students do NOT have per-teacher or per-enrollment notification toggles in Phase 1. All student emails are controlled by the teacher's preferences for their cohort + the global opt-out rules above. Per-enrollment student notification preferences are a Phase 2+ feature if needed.

---

## 9. Critical Systems

### 9.1 Slot Locking — Preventing Double Enrollment

The `enroll_student_atomic` Postgres function uses `SELECT FOR UPDATE` to lock the cohort row. This is called **inside the webhook handler** — not at checkout creation time.

**Important:** Checkout URL can be generated even if cohort looks full at that moment. The slot is only "claimed" when payment confirms. Always check in webhook, never at checkout.

If payment confirms but cohort is now full (race condition):
```typescript
// In webhook handler:
const result = await supabaseAdmin.rpc('enroll_student_atomic', { p_cohort_id, p_student_id })
if (result === 'full') {
  await payments.refund(transactionId, amountPkr)
  await sendEmail(student, 'enrollment_refunded_cohort_full')
  return
}
if (result === 'waitlisted') {
  await payments.refund(transactionId, amountPkr)
  // Add to waitlist with student details (student has account since they paid via gateway)
  await addToWaitlist(cohortId, { studentId, name: student.name, phone: student.phone, email: student.email })
  await sendEmail(student, 'waitlist_joined_after_payment_refund')
  return
}
// 'enrolled' → proceed normally
```

### 9.2 Onboarding Checklist System

**5-step persistent checklist** shown at top of teacher dashboard until all steps complete. Dismissible after step 3, but re-appears if incomplete steps remain.

#### Step tracking — add `onboarding_steps_json` column to `teachers` table:

```sql
ALTER TABLE teachers ADD COLUMN onboarding_steps_json jsonb DEFAULT '{
  "profile_complete": false,
  "payment_details_set": false,
  "course_created": false,
  "cohort_created": false,
  "link_shared": false
}'::jsonb;
```

#### When each step marks complete:

| Step | Task | Completes When | How Detected |
|------|------|----------------|-------------|
| 1 | Complete your profile | Profile photo uploaded + bio saved | R2 upload + bio save on Step 3 of onboarding |
| 2 | Set up payout details | teacher_payment_settings row has at least one payout method | Check on settings save |
| 3 | Create your first course | First course with status='published' exists | After course publish |
| 4 | Create your first cohort | First cohort created (any status) | After cohort creation |
| 5 | Share your link | Teacher clicks "Copy Link" on cohort invite | Front-end click event → POST /api/teacher/onboarding/complete-step { step: 'link_shared' } |

Step 5 is tracked by a client-side click handler on the Copy Link button that fires a lightweight POST. No back-end verification needed — honour system.

#### `onboarding_completed` flag:
Set to `true` when all 5 steps in `onboarding_steps_json` are `true`. Check on each step completion. Once true, the checklist widget is hidden permanently.

---

### 9.3 Plan Expiry UI States

**ExpiryBanner component** — shown at top of teacher dashboard in three escalating states:

| State | Condition | Banner Colour | Message |
|-------|-----------|--------------|---------|
| Expiry warning | `plan_expires_at` within 3 days | Amber | "Your plan expires in X days. Renew to keep access." |
| Grace period | `plan_expires_at` passed, `grace_until` in future | Orange | "Your plan expired. You have X days of full access remaining." |
| Hard locked | `grace_until` passed | Red | "Your account is read-only. Renew to create new content." |
| Trial ending | `trial_ends_at` within 2 days | Amber | "Your free trial ends in X days. Upgrade to keep your features." |

**Hard Read-Only Lock — What Is Blocked:**

When `grace_until < now()` (hard lock active):

| Action | Blocked? | Notes |
|--------|---------|-------|
| Create course | ✅ Blocked | API returns 403 PLAN_LOCKED |
| Edit existing course | ✅ Blocked | |
| Create cohort | ✅ Blocked | |
| Create class session | ✅ Blocked | |
| Post announcement | ✅ Blocked | |
| Create assignment | ✅ Blocked | |
| Mark attendance | ✅ Blocked | |
| Add student | ✅ Blocked | |
| View existing data | ✅ Allowed | Read-only access to all existing content |
| Request payout | ✅ Allowed | Financial access never blocked |
| Download reports | ✅ Allowed | |
| Update profile | ✅ Allowed | |
| Renew subscription | ✅ Allowed | Primary action from lock screen |
| Students affected | ❌ No | Students retain read access to enrolled cohort content |

**API lock check pattern** — add to all write routes for locked teachers:

```typescript
// In API routes that create/modify content:
if (teacher.grace_until && new Date(teacher.grace_until) < new Date()) {
  return Response.json(
    { success: false, error: 'Account is read-only. Renew your plan to continue.', code: 'PLAN_LOCKED' },
    { status: 403 }
  )
}

// ALSO check cohort archived status on all cohort-scoped write routes:
const cohort = await getCohort(cohortId)
if (cohort.status === 'archived') {
  return Response.json(
    { success: false, error: 'This cohort is archived. No changes allowed.', code: 'COHORT_ARCHIVED' },
    { status: 403 }
  )
}
```

> **Archived cohort write guard:** Apply to ALL routes that create/modify cohort content: announcements, assignments, attendance, class sessions, enrollments. Archived cohorts are permanently read-only for both teachers and students.

---

### 9.3b Recurring Class Session Expansion

When a teacher creates a recurring class schedule, the system **eagerly expands** the recurrence rule into individual `class_sessions` rows:

```typescript
// POST /api/teacher/class-sessions { cohortId, meetLink, scheduledAt, isRecurring, recurrenceRule }
//
// If isRecurring = true:
//   1. Parse recurrenceRule (e.g., 'FREQ=WEEKLY;BYDAY=MO,WE,FR')
//   2. Generate individual session rows from scheduledAt until cohort.end_date
//   3. INSERT all rows into class_sessions (each with own id, same meet_link, is_recurring=true)
//   4. Store recurrence_rule on the FIRST session only (as the "parent")
//
// Why eager expansion (not virtual):
//   - Attendance must be marked per individual session (needs real row)
//   - Class reminders cron queries class_sessions.scheduled_at (needs real rows)
//   - Cancelling one occurrence = set cancelled_at on that specific row
//
// Changing recurrence mid-cohort:
//   - Teacher deletes future sessions (DELETE WHERE scheduled_at > now() AND cohort_id = ?)
//   - Creates new recurring schedule from today → cohort.end_date
//   - Past sessions with attendance data are NEVER deleted
//
// Library: use rrule.js (npm: rrule) to parse iCal RRULE strings
```

---

### 9.3c Assignment + Notification Start Date Guard

```typescript
// POST /api/teacher/assignments — before creating:
// If cohort.start_date > currentPKT():
//   - Allow creation (teacher may want to prep assignments before start)
//   - But do NOT send email notification to students
//   - Instead: queue notification to fire on cohort.start_date via a scheduled flag
//   - OR: simply don't notify — teacher posts announcement when ready
//
// Recommended approach (simpler): Block assignment creation before start_date.
// Teacher can create assignments in advance as drafts (add status field to assignments: 'draft' | 'published')
// Publish auto-triggers email notification. Drafts are teacher-only visible.
```

---

### 9.4 Timezone Handling

- **All timestamps stored UTC in the database**
- **All timestamps displayed in PKT (UTC+5) using `formatPKT()`**
- **Vercel Cron schedules are UTC — use 12:00 UTC for daily user-facing actions (= 5pm PKT)**
- **`currentPKT()` for evaluating "today" in Pakistani context**
- **Billing day cap:** billing_day is constrained to 1–28 in UI (values 29/30/31 blocked). Guarantees billing day exists in every month including February. Teachers wanting end-of-month billing use day 28.

```typescript
// CORRECT
const displayTime = formatPKT(session.scheduled_at, 'datetime')

// WRONG — never do this
const displayTime = new Date(session.scheduled_at).toLocaleString()
```

### 9.5 Rate Limiting

| Endpoint | Limit | Per |
|----------|-------|-----|
| `/join/[token]` enrollment page | 10 attempts | IP per hour |
| `/api/auth/teacher/signup` | 10 requests | IP per hour |
| `/api/auth/student/signup` | 3 accounts | IP per hour |
| `/api/auth/teacher/resend-verification` | 3 requests | Email per hour |
| `/api/r2/presign` | 20 requests | User per minute |
| `/api/cloudflare/subdomain` | 3 requests | Teacher per hour |
| Any API route | 100 requests | IP per minute (global) |

Implement via `@upstash/ratelimit` + Vercel Edge KV, or simple in-memory for Phase 1.

### 9.6 File Storage (Cloudflare R2)

```typescript
// lib/r2/upload.ts

// Flow: client requests presigned URL → uploads directly to R2 → sends publicUrl back
export async function getPresignedUploadUrl(params: {
  key: string              // e.g. 'thumbnails/teacher-id/course-id.jpg'
  contentType: string
  maxSizeBytes: number
}): Promise<{ uploadUrl: string; publicUrl: string }>

// R2 key structure:
// thumbnails/{teacherId}/{courseId}.{ext}
// assignments/{cohortId}/{assignmentId}.{ext}
// announcements/{cohortId}/{announcementId}.{ext}
// submissions/{assignmentId}/{studentId}.{ext}
// screenshots/{type}/{entityId}/{timestamp}.jpg    // type: 'subscription' | 'enrollment'
// profiles/{teacherId}.{ext}                        // Teacher profile photo
// qrcodes/{teacherId}.{ext}                         // JazzCash/EasyPaisa QR code image

// File size limits enforced server-side (from platform_settings)
// Client-side limits are display-only only
```

### 9.7 Subdomain Provisioning

```typescript
// lib/cloudflare/dns.ts

export async function createSubdomainRecord(subdomain: string): Promise<void> {
  // 1. Validate subdomain format: lowercase alphanumeric + hyphens, 3-30 chars
  // 2. Check not reserved: ['www', 'students', 'admin', 'api', 'mail', 'smtp', 'ftp']
  // 3. POST to Cloudflare DNS API:
  //    { type: 'CNAME', name: subdomain, content: 'cname.vercel-dns.com', proxied: true }
  // 4. DNS propagates immediately (Cloudflare is instant for proxied records)
}

// Subdomain validation regex: /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/
// Reserved words are hard-blocked server-side
```

### 9.6 Plan Limit Enforcement

**The `PlanLimitGuard` component** wraps any feature that has a plan restriction:

```typescript
// components/teacher/PlanLimitGuard.tsx
// Shows content if within limit, shows UpgradeNudge at 80%, shows RED warning at 95%, shows hard block at 100%
// Storage-specific thresholds: amber=80%, red=95%, block=100%
// Other limits (courses, students, cohorts): amber=80%, block=100%

<PlanLimitGuard feature="max_courses" current={courses.length}>
  <CreateCourseButton />
</PlanLimitGuard>
```

**Three visual states for limits:**
| % Used | State | Colour | Action |
|--------|-------|--------|--------|
| < 80% | Normal | — | None |
| 80–94% | Warning | Amber | Show nudge banner on relevant page |
| 95–99% | Critical | Red | Show urgent upgrade banner (storage only) |
| 100% | Blocked | Red | Hard block — cannot add more, upgrade required |

**Hard blocks must also be validated server-side** — never trust client-side checks alone:

```typescript
// In every API route that creates a resource:
const limit = await getLimit(teacher.id, 'max_courses')
const current = await countTeacherCourses(teacher.id)
if (current >= limit) {
  return Response.json({ success: false, error: 'Plan limit reached', code: 'LIMIT_REACHED' }, { status: 403 })
}
```

### 9.7 Idempotency

Every payment initiation generates a UUID `idempotencyKey` client-side before calling the API. This key is:
- Stored in `student_payments.idempotency_key` and `teacher_subscriptions.gateway_transaction_id`
- Checked in the webhook handler before processing
- If record with same key exists: return 200, take no action
- **Retention:** Idempotency keys are never deleted. The UNIQUE index on `student_payments.idempotency_key` is the permanent check. Keys are UUIDs — collision is statistically impossible, so no TTL or cleanup needed.

### 9.7b Reference Code Generation

Enrollment reference codes are 6-character alphanumeric strings used by students to tag bank transfers for payment matching.

```typescript
// Character set: uppercase letters + digits, excluding confusing chars
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No 0/O, 1/I/L
// Generate: 6 random chars from CHARSET
// Check UNIQUE constraint on enrollments.reference_code — retry on collision (extremely rare)
// Display format: "REF-XXXXXX" (prefix is UI-only, DB stores just the 6 chars)
```

### 9.7c PaymentProvider Interface

```typescript
// lib/payment/provider.ts
export interface PaymentProvider {
  createCheckout(params: {
    amountPkr: number
    description: string
    metadata: Record<string, string>   // { type: 'subscription'|'enrollment', entityId, ... }
    idempotencyKey: string
    successUrl: string
    cancelUrl: string
  }): Promise<{ checkoutUrl: string; sessionId: string }>

  refund(transactionId: string, amountPkr?: number): Promise<{ success: boolean; error?: string }>

  verifyWebhook(payload: string, signature: string): Promise<{ valid: boolean; event?: WebhookEvent }>

  fetchTransactions(from: Date, to: Date): Promise<GatewayTransaction[]>  // For reconciliation cron
}

// Mock adapter: always returns success, generates fake checkoutUrl pointing to /api/webhooks/payment/mock-callback
// Useful for local dev and screenshot-primary mode
```

### 9.8 Pending Visibility — Student Portal Logic

`cohorts.pending_can_see_schedule` and `cohorts.pending_can_see_announcements` control what students with `enrollment.status = 'pending'` can see before teacher approves them.

**Teacher toggles these per cohort** in Cohort Settings → Enrollment Options.

**API endpoint:**
```
PATCH /api/teacher/cohorts/[id]  { pending_can_see_schedule: bool, pending_can_see_announcements: bool }
```

**Student portal enforcement:**

```typescript
// When fetching sessions / announcements for a student:
if (enrollment.status === 'pending') {
  if (!cohort.pending_can_see_schedule) {
    sessions = []   // hide sessions
  }
  if (!cohort.pending_can_see_announcements) {
    announcements = []  // hide announcements
  }
}
// Active enrollments always see everything
// Rejected/withdrawn/revoked → return 403
```

---

### 9.9 What Students See Before Cohort Start Date

When a student enrolls in a cohort whose `start_date` is in the future:

| Feature | Visible? | Notes |
|---------|---------|-------|
| Class schedule | ✅ Yes | Immediately after enrollment approved |
| Announcement board | ✅ Yes | Teacher can post pre-start announcements |
| Google Meet links | ✅ Yes | Visible with correct future dates |
| Assignments | ❌ No | Hidden until `cohort.start_date` passes |
| Attendance marking | ❌ No | Not tracked until `cohort.start_date` passes |

**Student portal banner for upcoming cohorts:**
> "This cohort starts on [date formatted in PKT]. You're enrolled! Check back on the start date for your first class."

**Enforcement:** API routes for assignments and attendance must check `cohort.start_date <= currentPKT()` before returning data. Return empty array + message if before start date — not a 403.

---

### 9.10 Storage Breakdown by Category

R2 key structure encodes category. Query by key prefix using Cloudflare R2 list() API:

```
thumbnails/{teacherId}/...      → category: thumbnails
assignments/{cohortId}/...      → category: assignments  
announcements/{cohortId}/...    → category: announcements
submissions/{assignmentId}/...  → category: submissions
```

**Storage breakdown shown on ALL plans** (not gated behind analytics plan feature). Available in:
- Teacher Dashboard → Storage Panel
- Teacher Settings → Storage
- Admin → Teacher profile

---

### 9.10 Gateway Error Monitoring

```typescript
// Tracked in platform_settings.gateway_error_alert_threshold (default: 5)
// If N errors occur within any 10-minute window → email admin immediately
// All gateway errors logged to admin_activity_log with action_type: 'gateway_error'
```

---

### 9.11 Monthly Payment Loop

Monthly cohorts (`cohorts.fee_type = 'monthly'`) produce one `student_payments` row per billing month. The initial enrollment row is created by `/api/student/enroll` with `payment_month = firstBillingMonth(cohort.start_date, cohort.billing_day)`; every subsequent month is created on demand by `createNextMonthPaymentAction` when the student initiates payment for that month.

**Helpers in `lib/time/pkt.ts`:**

```typescript
firstOfMonthPKT(date: Date): string
// Returns 'YYYY-MM-01' for `date` evaluated in PKT. Used anywhere we need
// "this month" in Pakistani context (avoids UTC midnight rolling a PKT-evening
// request back into the previous month).

firstBillingMonth(cohortStartDate: string, billingDay: number): string
// First payment_month for a brand-new enrollment:
//   max(cohort.start_date month, today in PKT month) as 'YYYY-MM-01'.
// Pre-start enrollments tag the cohort's start month; mid-cycle enrollments
// tag the current month forward (no back-billing).

monthlyBillingSchedule(startDate: string, endDate: string): string[]
// Every billing month between cohort start and end, inclusive on both ends,
// one entry per calendar month as 'YYYY-MM-01'. Drives both the student
// outstanding-months UI and the createNextMonthPaymentAction schedule guard.

dueDateForMonth(paymentMonth: string, billingDay: number): string
// 'YYYY-MM-DD' due date for a given month, used to label Overdue/Due/Upcoming.
```

**Outstanding months — student portal computation (`/student/payments`):**

```
schedule     = monthlyBillingSchedule(cohort.start_date, cohort.end_date)
settled      = { p.payment_month : p in enrollment.payments AND p.status ∈ {confirmed, pending_verification} }
outstanding  = schedule − settled

For each month in outstanding:
  dueDate = dueDateForMonth(month, cohort.billing_day)
  status =
    dueDate < todayPKT                     → 'overdue'
    dueDate > todayPKT AND > 7 days away   → 'upcoming'
    otherwise                              → 'due'   (within 7 days, or due today)
  Sort: overdue first, then dueDate asc
```

**Idempotency guarantees:**

1. Partial unique index on `(enrollment_id, payment_month)` restricted to `status IN ('pending_verification', 'confirmed')` (migration `008`) — a student can re-upload after rejection, but cannot have two in-flight rows for the same month.
2. `createNextMonthPaymentAction` checks `getPaymentByEnrollmentAndMonth` before inserting:
   - existing confirmed → reject
   - existing pending → return its id (no insert)
   - existing rejected → reset the same row to pending (clear `screenshot_url` + `rejection_reason`), reuse its id
3. If a concurrent insert wins the race, `createPayment` catches Postgres `23505` and returns a `PAYMENT_ALREADY_EXISTS` sentinel; the action re-reads the winning row and returns its id.
4. `idempotency_key` is deterministic: `monthly-${enrollmentId}-${paymentMonth}` — doubles as a secondary guard.

**Cron alignment (`/api/cron/fee-reminders`):**

The cron computes the target billing month via `firstOfMonthPKT(today + 3 days)` and, for each active enrollment whose cohort's `billing_day` is 3 days out, skips if `student_payments` has any row with that `payment_month` in `{'confirmed', 'pending_verification'}`. Because every payment row is tagged with `payment_month` at creation time, the cron never sends a reminder for a month the student has already paid or is currently awaiting verification for.

**Migration `009_backfill_payment_month.sql`** backfills existing confirmed payments on monthly cohorts (pre-loop data) with `payment_month = date_trunc('month', cohort.start_date)` so the cron stops misfiring on legacy enrollments.

---

## 10. UI Architecture

### Theme

OKLCH dual-mode (light + dark) theme defined in `app/globals.css`:

- CSS variables in `:root` (light) and `.dark` (dark) define all colors in OKLCH color space
- `@theme inline` maps CSS variables to Tailwind utilities
- `@custom-variant dark (&:is(.dark *))` enables dark mode via class strategy
- `next-themes` ThemeProvider in root layout with `attribute="class"`
- Color palette: purple primary, orange accent, warm neutral backgrounds
- Font: Inter loaded via `next/font` in `app/layout.tsx`

```
RULE: Never use raw hex (#2563EB) or Tailwind defaults (bg-blue-500) in components.
Always use semantic tokens: bg-primary, text-foreground, border-border, bg-muted, text-muted-foreground, etc.
To change the entire look: edit globals.css @theme block + CSS variables. Zero component changes needed.
```

> **PostCSS config:** `postcss.config.mjs` uses `@tailwindcss/postcss` only (replaces `tailwindcss` + `autoprefixer`).

### Component System

All UI components live in `components/ui/`. Two categories:

**shadcn/ui primitives** (lowercase filenames) — installed via `npx shadcn@latest add <name>`:
- These are owned code, not a library. Customize directly in the file.
- Built on Radix UI primitives for accessibility (keyboard nav, screen readers, focus management).
- Examples: `button.tsx`, `dialog.tsx`, `select.tsx`, `table.tsx`, `badge.tsx`, `sidebar.tsx`

**Custom compositions** (PascalCase filenames) — wrap shadcn primitives:
- `SidebarShell.tsx` — unified sidebar for all 3 roles (teacher, admin, student)
- `DataTable.tsx` — uses `@tanstack/react-table` + shadcn `table.tsx` for sort/filter/pagination
- `StatusBadge.tsx` — wraps shadcn `badge.tsx` with status-aware color logic
- `CommandPalette.tsx` — wraps `command.tsx` for Cmd+K navigation
- `DateRangeFilter.tsx` — wraps `calendar.tsx` + `popover.tsx` for dashboard date filtering
- `ThemeToggle.tsx`, `NotificationBell.tsx`, `PageHeader.tsx`, `EmptyState.tsx`, etc.

**Class composition:** Use `cn()` from `lib/utils.ts` (clsx + tailwind-merge) for all conditional class logic.

**Icons:** Use `lucide-react` for all icons. Tree-shakeable. Import: `import { IconName } from 'lucide-react'`.

### Dark Mode

Dark mode is fully supported across the platform:

- `ThemeToggle` in sidebar for all logged-in users (teacher, admin, student)
- Marketing pages follow system preference
- All new components MUST work in both light and dark themes
- Use semantic tokens only — never hardcode light-only or dark-only colors
- Test with both themes before marking any UI work complete

### Navigation

**Authenticated pages (teacher, admin, student):**
- Unified `SidebarShell` wrapping shadcn `Sidebar` component
- Desktop: collapsible sidebar (icon-only or full)
- Mobile: slides out as a `Sheet` (shadcn) overlay
- Navigation items defined in `constants/nav-items.ts` per role
- Command palette (`Cmd+K` / `Ctrl+K`) for quick navigation across all pages
- `NotificationBell` with unread count indicator in sidebar header

**Public/marketing pages:**
- `PublicNavbar` with responsive Sheet for mobile menu

### Dashboard Layout

Bento grid layout for all dashboards:
```
Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
Card types:
  - Stat card (1x1) — single metric with trend indicator
  - Chart card (2x1) — Recharts line/bar/area via dynamic import (no SSR)
  - List card (1x1 or 2x1) — recent items with links
  - Circle card (1x1) — circular progress indicator
```

- `DateRangeFilter` on teacher + admin dashboards for time-scoped data
- Charts use Recharts via `next/dynamic` with `ssr: false` (client components only)
- Chart colors pulled from CSS variables via shadcn `chart.tsx` for theme consistency

### Shared Component Patterns

```typescript
// Every page has consistent structure:
<PageHeader title="Courses" action={<Button>Create Course</Button>} />

// Usage bars appear on teacher dashboard header:
<UsageBars
  items={[
    { label: 'Courses', current: 4, max: 5 },
    { label: 'Students', current: 43, max: 50 },
    { label: 'Storage', current: 1200, max: 2048, unit: 'MB' },
  ]}
/>

// Empty states for every list:
<EmptyState
  icon={BookOpenIcon}
  title="No courses yet"
  description="Create your first course to start enrolling students."
  action={<Button>Create Course</Button>}
/>
```

### Loading States

```typescript
// Server components: use Next.js loading.tsx per route segment
// Client mutations: use local loading state + button disabled
// Show Skeleton components for lists (never blank screens)
// Use Spinner for inline loading indicators
```

### Mobile-First Responsive Patterns

#### Viewport Height
Use `min-h-dvh` instead of `min-h-screen` on layout wrappers. Mobile Safari's dynamic viewport makes `100vh` unreliable.

#### Touch Targets (44px minimum)
All interactive elements must have a minimum 44px touch target (Apple HIG / WCAG). shadcn components handle this via their built-in sizing.

#### Responsive Tables
DataTable provides responsive behavior. For simpler tables, use the card view pattern on mobile:
```html
<div class="hidden md:block"><Table>...</Table></div>
<div class="md:hidden space-y-3">{/* Stacked cards */}</div>
```

#### Image Optimization
Use `next/image` for lazy loading, WebP/AVIF format negotiation, and responsive `sizes`.

#### Camera Capture
`FileUpload` includes `capture="environment"` for direct camera access on mobile.

#### Responsive Padding
Container elements use `p-4 sm:p-6` (tighter on mobile, standard on desktop).

---

## 10b. Complete URL Route Map

Every route in the platform. Developers must implement all routes exactly as listed.

| URL | Access | Description |
|-----|--------|-------------|
| `[subdomain].skoolrooms.com` | Public | Teacher public profile + course listing |
| `[subdomain].skoolrooms.com/courses/[slug]` | Public | Individual course page with cohort list |
| `[subdomain].skoolrooms.com/join/[token]` | Public | Cohort enroll page (or waitlist/coming-soon if closed/draft) |
| `[subdomain].skoolrooms.com/pay/[enrollment_id]` | Student auth | Payment page after enrollment created |
| `skoolrooms.com` | Public | Marketing homepage |
| `skoolrooms.com/explore` | Public | Teacher directory (SSR, Google-indexed) |
| `skoolrooms.com/pricing` | Public | Plan pricing page |
| `skoolrooms.com/login` | Guest only | Teacher login (redirects to dashboard if auth) |
| `skoolrooms.com/signup` | Guest only | Teacher signup → onboarding |
| `skoolrooms.com/forgot-password` | Guest only | Teacher password reset request |
| `skoolrooms.com/auth/reset-password` | Guest only | Teacher new password form (token in URL) |
| `skoolrooms.com/dashboard` | Teacher auth | Teacher main dashboard |
| `skoolrooms.com/dashboard/courses` | Teacher auth | Course management |
| `skoolrooms.com/dashboard/courses/new` | Teacher auth | Create new course |
| `skoolrooms.com/dashboard/courses/[id]` | Teacher auth | Individual course + cohort list |
| `skoolrooms.com/dashboard/courses/[id]/cohorts/new` | Teacher auth | Create new cohort for course |
| `skoolrooms.com/dashboard/courses/[id]/cohorts/[cohortId]` | Teacher auth | Cohort management (students, schedule, announcements, assignments, attendance, payments) |
| `skoolrooms.com/dashboard/students` | Teacher auth | Student roster across all cohorts |
| `skoolrooms.com/dashboard/payments` | Teacher auth | Payment verification queue + history |
| `skoolrooms.com/dashboard/earnings` | Teacher auth | Balance, payout history, request payout |
| `skoolrooms.com/dashboard/analytics` | Teacher auth | Revenue, student health, cohort analytics |
| `skoolrooms.com/dashboard/settings` | Teacher auth | Profile, payments, notifications, plan, billing |
| `skoolrooms.com/subscribe` | Teacher auth | Platform subscription / upgrade page |
| `students.skoolrooms.com` | Student auth | Student portal — all enrollments |
| `students.skoolrooms.com/courses` | Student auth | Enrolled courses grouped by teacher |
| `students.skoolrooms.com/schedule` | Student auth | Upcoming classes across all teachers |
| `students.skoolrooms.com/billing` | Student auth | Payment history + enrollment statuses |
| `students.skoolrooms.com/messages` | Student auth | Direct message inbox (Phase 2) |
| `students.skoolrooms.com/settings` | Student auth | Student profile settings |
| `students.skoolrooms.com/forgot-password` | Guest only | Student password reset request |
| `skoolrooms.com/admin` | Admin auth | Admin dashboard (not linked publicly) |
| `skoolrooms.com/admin/login` | Guest only | Admin login — not linked from any public page |
| `skoolrooms.com/admin/teachers` | Admin auth | Teacher management list |
| `skoolrooms.com/admin/teachers/[id]` | Admin auth | Teacher detail — profile, activity log, plan, actions (suspend/extend/reset) |
| `skoolrooms.com/admin/payments` | Admin auth | Subscription payment queue |
| `skoolrooms.com/admin/payouts` | Admin auth | Teacher payout request queue |
| `skoolrooms.com/admin/plans` | Admin auth | Plan management |
| `skoolrooms.com/admin/settings` | Admin auth | Platform settings |
| `skoolrooms.com/admin/analytics` | Admin auth | Full KPI dashboard (Phase 2) |
| `skoolrooms.com/admin/earnings` | Admin auth | Platform earnings panel (Phase 2) |
| `skoolrooms.com/admin/operations` | Admin auth | System health panel |

> **Note:** All URLs use `platformDomain()` — never hardcode `skoolrooms.com`. The route map above uses the current placeholder domain.

---

## 11. Environment Variables

```bash
# ════════════════════════════════════════
# PLATFORM
# ════════════════════════════════════════
NEXT_PUBLIC_PLATFORM_DOMAIN=skoolrooms.com
# Change this one value to rename the platform domain. Nothing else changes.

# ════════════════════════════════════════
# SUPABASE
# ════════════════════════════════════════
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
# ⚠️ SUPABASE_SERVICE_ROLE_KEY is server-only. NEVER expose to browser.

# ════════════════════════════════════════
# CLOUDFLARE
# ════════════════════════════════════════
CLOUDFLARE_API_TOKEN=xxxx
# Scopes needed: Zone:DNS:Edit for the skoolrooms.com zone
CLOUDFLARE_ZONE_ID=xxxx

# ════════════════════════════════════════
# CLOUDFLARE R2
# ════════════════════════════════════════
CLOUDFLARE_R2_ACCESS_KEY=xxxx
CLOUDFLARE_R2_SECRET_KEY=xxxx
CLOUDFLARE_R2_BUCKET=skoolrooms-files
CLOUDFLARE_R2_ENDPOINT=https://xxxx.r2.cloudflarestorage.com
CLOUDFLARE_R2_PUBLIC_URL=https://files.skoolrooms.com
# R2 bucket must have public access enabled for public URLs

# ════════════════════════════════════════
# PAYMENT GATEWAY
# ════════════════════════════════════════
PAYMENT_GATEWAY=mock
# Values: 'mock' | 'safepay' | 'payfast'
# Start with 'mock'. Switch to real gateway when account approved.
# This is the ONLY change needed to go live with payments.

SAFEPAY_API_KEY=
SAFEPAY_SECRET_KEY=
SAFEPAY_WEBHOOK_SECRET=
SAFEPAY_ENVIRONMENT=sandbox
# safepay_environment: 'sandbox' | 'production'

PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=
PAYFAST_SANDBOX=true

# ════════════════════════════════════════
# EMAIL
# ════════════════════════════════════════
BREVO_API_KEY=xkeysib-xxxx
BREVO_FROM_EMAIL=noreply@skoolrooms.com
# Brevo requires domain verification via DNS (DKIM + SPF records)

# ════════════════════════════════════════
# CRON SECURITY
# ════════════════════════════════════════
CRON_SECRET=xxxx
# All cron routes check: Authorization: Bearer ${CRON_SECRET}
# Set in vercel.json cron configuration headers

# ════════════════════════════════════════
# WHATSAPP (Phase 2)
# ════════════════════════════════════════
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# ════════════════════════════════════════
# RATE LIMITING (Phase 1 can skip, Phase 2 add)
# ════════════════════════════════════════
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# ════════════════════════════════════════
# ADMIN
# ════════════════════════════════════════
ADMIN_EMAIL=admin@skoolrooms.com
# Used to create the first admin account in seed script
```

### `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/archive-cohorts",   "schedule": "0 0 * * *"  },
    { "path": "/api/cron/fee-reminders",     "schedule": "0 12 * * *" },
    { "path": "/api/cron/class-reminders",   "schedule": "0 * * * *"  },
    { "path": "/api/cron/trial-expiry",      "schedule": "0 6 * * *"  },
    { "path": "/api/cron/renewal-reminders", "schedule": "0 8 * * *"  },
    { "path": "/api/cron/reconcile",         "schedule": "0 2 * * *"  },
    { "path": "/api/cron/grace-period",      "schedule": "0 7 * * *"  },
    { "path": "/api/cron/enrollment-nudge",  "schedule": "0 14 * * *" },
    { "path": "/api/cron/subscription-nudge","schedule": "0 9 * * *"  }
  ]
}
```

---

## 12. Phased Build Plan

### Week 1 — Foundation

- [ ] Next.js 16 project init + Tailwind CSS v4 + TypeScript
- [ ] Supabase project created, env vars wired
- [ ] All database tables created (`001_initial_schema.sql`)
- [ ] All RLS policies (`002_rls_policies.sql`)
- [ ] All indexes (`003_indexes.sql`)
- [ ] All Postgres functions — `enroll_student_atomic`, `credit_teacher_balance` (`004_functions.sql`)
- [ ] Seed data — plans, plan_features, feature_registry, platform_settings (`005_seed_data.sql`)
- [ ] `platformDomain()`, `teacherSubdomainUrl()`, `studentPortalUrl()` — wired to env var
- [ ] Subdomain routing middleware
- [ ] `PaymentProvider` interface + Mock adapter
- [ ] `canUseFeature()` + `getLimit()`
- [ ] `getPlatformSetting()` with cache
- [ ] `formatPKT()` + `currentPKT()` + `getBillingDateForMonth()`
- [ ] `sendEmail()` wrapper + Brevo integration (`@getbrevo/brevo`) + delivery logging
- [ ] `supabase/client.ts` + `supabase/server.ts`
- [ ] `ApiResponse<T>` type + error handling pattern
- [ ] Teacher signup + email verification
- [ ] Supabase Auth setup (teacher + student + admin roles)
- [ ] Password reset flow — teacher and student (forgot password pages + reset callback page)

### Week 2 — Teacher Onboarding + Courses

- [ ] Teacher login page
- [ ] 3-step onboarding wizard
- [ ] Live subdomain availability checker
- [ ] Cloudflare DNS subdomain provisioning (`/api/cloudflare/subdomain`)
- [ ] Teacher dashboard layout + sidebar
- [ ] `onboarding_steps_json` column on teachers table (migration)
- [ ] Persistent 5-step onboarding checklist widget (shown until all complete, dismissible after step 3)
- [ ] Checklist auto-completion triggers wired to: profile save, payment settings save, course publish, cohort create, link copy
- [ ] Link-copy tracking: POST /api/teacher/onboarding/complete-step { step: 'link_shared' }
- [ ] Usage bars component (amber at 80%, red at 95% for storage, hard block at 100%)
- [ ] Course creation (title, description with TipTap, status)
- [ ] Course thumbnail upload via R2 presigned URL
- [ ] R2 presign API route + server-side size validation
- [ ] Teacher public page on subdomain (course listing)
- [ ] Teacher bio/about section

### Week 3 — Cohorts + Scheduling

- [ ] Create cohort from course (all fields)
- [ ] Cohort invite link generation
- [ ] Public cohort enroll page at `/join/[token]`
- [ ] Cohort status management
- [ ] Cohort pending visibility toggles (pending_can_see_schedule, pending_can_see_announcements)
- [ ] Class session creation (single + recurring)
- [ ] Teacher calendar view
- [ ] Cancel class + student email notification
- [ ] Auto-archive cron
- [ ] Pending enrollment auto-reject on archive

### Week 4 — Student Portal + Enrollment

- [ ] Student registration at enrollment
- [ ] `students.skoolrooms.com` routing
- [ ] Student dashboard (upcoming classes, enrolled courses)
- [ ] Student login/signup page
- [ ] Student portal multi-teacher grouping
- [ ] Screenshot payment upload flow (student side)
- [ ] Teacher payment verification panel (approve/reject)
- [ ] Manual enrollment (Mark as Paid)
- [ ] Enrollment status page (student)
- [ ] Email notifications: enrollment_confirmed, enrollment_rejected, enrollment_pending

### Week 5 — Announcements + Attendance + Assignments

- [ ] Announcement board per cohort (teacher creates)
- [ ] Announcement file attachment (R2)
- [ ] Student comment threads
- [ ] Email: new_announcement → students, student_comment → teacher
- [ ] Seen-by indicator
- [ ] Attendance marking per class session
- [ ] Cancelled session handling in attendance
- [ ] Student attendance view in portal
- [ ] Assignment creation (title, description, file, due date)
- [ ] Student submission (text + file)
- [ ] Teacher marks submission as reviewed
- [ ] Overdue submission flagging

### Week 6 — Subscriptions + Plan Management

- [ ] Pricing page
- [ ] Subscription screenshot upload flow
- [ ] Admin subscription verification queue
- [ ] 5-day grace period logic (grace_until = plan_expires_at + 5 days)
- [ ] ExpiryBanner component (4 states: expiry warning amber, grace orange, hard lock red, trial ending amber)
- [ ] Grace period daily reminder emails (days 1–5 after expiry) via grace-period cron
- [ ] Hard lock enforcement: grace_until cron → set lock, send plan_hard_locked email
- [ ] API-level PLAN_LOCKED check on all content-write routes
- [ ] 14-day trial auto-downgrade cron
- [ ] Plan Management UI (list, edit limits, edit features)
- [ ] Grandfathering modal (auto-triggers when admin lowers limit)
- [ ] teacher_plan_snapshot on subscription
- [ ] Teacher plan settings page (current plan + features + usage)
- [ ] Subscription renewal reminder emails (3 days before expiry)
- [ ] Contextual upgrade nudges at 80% limit

### Week 7 — Admin Panel + Analytics

- [ ] Admin auth + protected routes
- [ ] Admin dashboard: MRR, signups, churn, plan distribution
- [ ] Teacher health panel (dormant, zero-student, expiring, screenshots >48h)
- [ ] Teacher account list + search + sort
- [ ] Admin actions: suspend/reactivate, plan change, extend expiry, resend verification
- [ ] Admin view-as teacher (read-only shadow view)
- [ ] Operations panel: gateway errors, storage totals, active cohorts
- [ ] Teacher analytics: revenue this month vs last, pending revenue, overdue fees
- [ ] Teacher analytics: storage usage bar with 80%/95% warnings
- [ ] Teacher analytics: storage breakdown by category (thumbnails / assignments / announcements / submissions)
- [ ] Teacher analytics: profile views this month (from explore_page_views table)
- [ ] Teacher analytics: recently joined students (new in last 7 days) — P1 signal
- [ ] Student health signals: overdue fees (monthly cohort unpaid), recently joined (last 7 days)
- [ ] Student health signals (P2): at-risk attendance <70%, disengaged (no login 10 days), no submissions
- [ ] Cohort analytics: slot utilisation (X/Y filled)

### Week 8 — Waitlist + Fee Reminders + Explore Page + Polish

- [ ] Waitlist join form (public — no account required: name, phone, email)
- [ ] Waitlist leave flow (student self-removal from portal or by email)
- [ ] Waitlist management panel (teacher view: student name, phone, email, date joined, position)
- [ ] Waitlist teacher notification (system notifies teacher when max_students increases: "X students waiting — slots available")
- [ ] Monthly fee reminder cron (daily 12:00 UTC)
- [ ] Billing day validation: UI + API block values 29/30/31 (max is 28)
- [ ] Overdue fee badges in teacher dashboard
- [ ] Fee overdue follow-up reminder (5 days after billing day)
- [ ] Explore page (SSR, teacher directory with filters)
- [ ] Cohort picker UI (course with multiple open cohorts → picker before enrollment)
- [ ] Explore teacher card: greyed "Not accepting students" when all cohorts closed (not hidden)
- [ ] Explore teacher hidden when no cohorts at all
- [ ] Hard-locked teachers auto-excluded from explore (re-appear after renewal, max 1hr cache delay)
- [ ] Teacher explore settings: subject tags, teaching levels, is_publicly_listed (Settings → Privacy)
- [ ] Anonymous view tracking (SHA-256 IP hash, no PII stored)
- [ ] Profile view count in teacher analytics
- [ ] Notification preferences settings page
- [ ] Rate limiting on `/join/[token]` endpoint
- [ ] Reserved subdomain blocklist
- [ ] Full end-to-end test pass

---

### Phase 2 — Gateway + Retention (Month 2–3)

- [ ] Cohort duplication — copy schedule to new cohort (one click)
- [ ] Real gateway adapter (Safepay or Payfast)
- [ ] Flip `payment_gateway_enabled = true`
- [ ] Teacher subscription auto-renewal
- [ ] Enrollment via gateway + webhook handler
- [ ] Platform cut calculation + balance crediting
- [ ] Teacher earnings dashboard + payout flow
- [ ] Admin payout processing queue
- [ ] Post-payout refund handling
- [ ] Discount codes (per cohort, fixed/percent)
- [ ] Daily reconciliation cron
- [ ] WhatsApp notifications (Twilio)
- [ ] Progress report PDF (@react-pdf/renderer)
- [ ] Cohort duplication
- [ ] In-app notification bell + history (unread count in nav)
- [ ] Subdomain change flow (PATCH endpoint, 30-day cooldown, confirmation modal, old DNS delete)
- [ ] Google OAuth for teacher login
- [ ] Teacher reviews on public page
- [ ] Direct messaging — teacher ↔ student async threads (message list, thread view, email notifications, read receipts)
- [ ] Referral program — referral link generation (/signup?ref=CODE), conversion tracking at signup, 1-month credit after first paid month
- [ ] Admin: MRR chart, churn rate, ARPU
- [ ] Admin: bulk email all teachers
- [ ] Admin earnings panel (gross collected, platform cuts, payouts processed, net platform earnings)
- [ ] Teacher subscription history page (Settings → Billing)
- [ ] Admin emergency password reset (generate recovery link)
- [ ] Admin wipe test account (test accounts only — safety guard on email)
- [ ] Cohort feedback collection (prompted after archive, private by default, 1-5 rating + optional comment)
- [ ] Course categories and tags (discovery filtering on teacher public page)
- [ ] Curriculum / weekly outline builder (structured syllabus per cohort)
- [ ] Free course toggle (fee_pkr = 0 on cohort — lead gen for teachers)
- [ ] Class rescheduling flow (cancel + create new session, notify students of new time)
- [ ] Student parent/guardian contact fields (parent_name, parent_phone on students table)

### Phase 3 — Scale (Post-Profitability)

- [ ] Custom domain per teacher (their own .com)
- [ ] Class recordings via Cloudflare R2
- [ ] One-on-one session type (cohorts with session_type: 'one_on_one')
- [ ] Parent/guardian portal (K-12 market — uses parent contact fields from Phase 2)
- [ ] Certificate of completion (PDF)
- [ ] Multi-teacher team management (invite flow, shared courses, team roster page — schema supports via max_teachers)
- [ ] Public star ratings on explore page (from cohort feedback data — add is_public opt-in)
- [ ] Safepay checkout on teacher course pages (student gateway payments)
- [ ] iCal/Google Calendar export
- [ ] Bulk student import via CSV

---

## 12b. Admin KPI Reference

Full KPI dashboard available at `/admin/analytics` (Phase 2). All figures PKR. Period selectable unless noted.

| KPI | Period Options | Notes |
|-----|---------------|-------|
| MRR | Current month, last month, trend | Sum of all active paid subscriptions |
| ARR | Current | MRR × 12 |
| Revenue Growth Rate | Monthly, Quarterly, Half-yearly | % change MRR period-over-period |
| Gross Revenue (Student Payments) | Daily/Weekly/Monthly/Quarterly/Half-yearly/Annual | Total collected before cuts |
| Platform Cut Collected | Monthly, Quarterly, Half-yearly, Annual | Sum of `platform_cut_pkr` on confirmed payments |
| Total Payouts Processed | Monthly, Quarterly, Annual | Sum of completed `teacher_payouts` |
| Net Platform Revenue | Monthly, Quarterly, Half-yearly, Annual | Cuts − gateway fees |
| ARPU | Monthly | MRR ÷ active paid teachers |
| LTV | Rolling | Avg months subscribed × avg plan price |
| New Signups | Daily, Weekly, Monthly, Quarterly | Free + paid, split by plan |
| Free → Paid Conversion Rate | Monthly, Quarterly | Upgrades ÷ Free signups in period |
| Churn Rate | Monthly, Quarterly, Half-yearly | Didn't renew ÷ total paid last period |
| Plan Distribution | Current snapshot | Count + % per plan (donut chart) |
| Active Students Platform-wide | Current, Monthly trend | ≥ 1 active enrollment |
| Total Enrollments | Monthly, Quarterly, Annual | Split by fee type (one-time / monthly) |
| Active Cohorts | Current | status = active platform-wide |
| Classes Scheduled | Next 7 days, next 30 days | Upcoming sessions all teachers |
| Pending Payouts | Current | Count + total PKR owed |
| Storage Utilisation | Current | Total R2 used vs total plan allocations |
| Email Delivery Health | Last 7 days, last 30 days | Sent / bounced / failed per email type |
| Explore Page Views | Daily, Weekly, Monthly | Unique by IP hash |
| Waitlist Signups | Monthly, Quarterly | Demand signal for teachers |

---

## 13. Business Rules Reference

### Plan Limits (Launch Defaults)

| Limit | Free | Solo | Academy |
|-------|------|------|---------|
| max_courses | 1 | 5 | Unlimited (9999) |
| max_students | 15 | 50 | 200 |
| max_cohorts_active | 1 | Unlimited | Unlimited |
| max_storage_mb | 500 | 2048 | 10240 |
| max_teachers | 1 | 1 | 3 |
| trial_days | 0 | 14 | 14 |
| transaction_cut_percent | 15.00 | 10.00 | 8.00 |

*All values are admin-configurable. Never hardcode.*

### Feature Flags (Launch Defaults)

| Feature | Free | Solo | Academy |
|---------|------|------|---------|
| recurring_classes | ✗ | ✓ | ✓ |
| student_portal | ✗ | ✓ | ✓ |
| class_reminders | ✗ | ✓ | ✓ |
| analytics_dashboard | ✗ | ✓ | ✓ |
| attendance_tracking | ✗ | ✓ | ✓ |
| assignment_submission | ✗ | ✓ | ✓ |
| fee_reminders | ✗ | ✓ | ✓ |
| cohort_archive_history | ✗ | ✓ | ✓ |
| revenue_analytics | ✗ | ✓ | ✓ |
| student_health_signals | ✗ | ✓ | ✓ |
| progress_report_pdf | ✗ | ✓ | ✓ |
| waitlist | ✗ | ✓ | ✓ |
| discount_codes | ✗ | ✓ | ✓ |
| whatsapp_notifications | ✗ | ✗ | ✓ |
| multi_teacher | ✗ | ✗ | ✓ |
| remove_branding | ✗ | ✓ | ✓ |
| custom_domain | ✗ | ✗ | Add-on (P3) |

### Pricing

| Plan | Monthly Price |
|------|--------------|
| Free | Rs. 0 |
| Solo | Rs. 1,999 |
| Academy | Rs. 3,999 |

> **Note:** Free plan has `trial_days = 0` (no trial, free forever). Solo and Academy have `trial_days = 14` by default. When seeding `plans` table, set `trial_days = 0` for the Free plan explicitly.

### Timing Rules

| Event | Timing |
|-------|--------|
| Grace period after plan expiry | 5 days full access → hard read-only lock |
| Trial period | 14 days (Solo/Academy default) |
| Renewal reminder email | 3 days before plan_expires_at |
| Trial ending soon email | 2 days before trial_ends_at |
| Subscription renewal attempt | 3 days before expiry (gateway auto-renewal) |
| Fee reminder | 3 days before billing_day |
| Fee overdue follow-up | 5 days after billing_day if not paid |
| Attendance mark edit window | 24 hours from marked_at |
| Subdomain change cooldown | 30 days from subdomain_changed_at |
| Admin session timeout | 4 hours idle |
| Cron: archive cohorts | 00:00 UTC daily |
| Cron: fee reminders | 12:00 UTC daily (5pm PKT) |
| Cron: class reminders | Every hour |
| Cron: trial expiry | 06:00 UTC daily |
| Cron: waitlist expiry | :30 every hour |
| Cron: reconciliation | 02:00 UTC daily |

### Upload Size Limits

| File Type | Max Size | Allowed Formats | Setting Key |
|-----------|----------|-----------------|-------------|
| Course thumbnail | 5MB | JPG, PNG, WebP | `r2_upload_limit_thumbnail_mb` |
| Profile photo | 2MB | JPG, PNG, WebP | `r2_upload_limit_profile_mb` |
| Assignment brief | 25MB | PDF, JPG, PNG, DOCX | `r2_upload_limit_assignment_mb` |
| Announcement attachment | 25MB | PDF, JPG, PNG, DOCX, XLSX, PPTX | `r2_upload_limit_announcement_mb` |
| Student submission | 50MB | PDF, JPG, PNG, DOCX, MP4 | `r2_upload_limit_submission_mb` |
| Screenshot (payment) | 10MB | JPG, PNG, PDF | Hardcoded |

**All limits enforced server-side before R2 upload. Error message must be specific:** "File too large. Maximum size for [type] is [limit]." Never a generic error.

**Update platform_settings seed data to match:**
```sql
('r2_upload_limit_thumbnail_mb', '5', ...),
('r2_upload_limit_profile_mb', '2', ...),
('r2_upload_limit_assignment_mb', '25', ...),
('r2_upload_limit_announcement_mb', '25', ...),
('r2_upload_limit_submission_mb', '50', ...),
```

### Reserved Subdomains (Block server-side)

```
www, students, admin, api, mail, smtp, ftp, pop, imap,
dev, staging, test, demo, app, dashboard, portal, help,
blog, docs, status, cdn, assets, static, files, media
```

### Minimum Payout

| Setting | Default | Configurable? |
|---------|---------|--------------|
| min_payout_amount_pkr | 2,500 | Yes — platform_settings |
| payout_processing_days | 3 | Yes — platform_settings |

---

## 14. Edge Cases

### Payment Edge Cases

| Scenario | Rule |
|----------|------|
| Webhook fires twice for same payment | Check `idempotency_key` in `student_payments` — if exists, return 200 and take no action |
| Student pays but cohort full (race condition) | `enroll_student_atomic` catches it. Refund via gateway + add to waitlist (if enabled) or notify apologetically. Still create `student_payments` row with status = 'refunded' |
| Student applies discount code but code expires mid-checkout | Validation happens server-side at checkout creation. If code invalid at that point, reject. Code is not validated again at webhook. |
| Discount code use_count incremented on failed payment | NEVER increment use_count until confirmed webhook. Client application and checkout creation do NOT increment. |
| Teacher requests payout with insufficient balance | UI disables button below minimum. Server also validates with hard check. Both must pass. |
| Teacher updates bank details after requesting payout | Payout uses LIVE bank details from `teacher_payment_settings` at the time admin processes it — NOT a snapshot. Rationale: teacher may have updated details because old ones stopped working. If admin sees `teacher_payment_settings.updated_at` is AFTER `teacher_payouts.requested_at`, admin UI shows a warning: "Bank details updated after this request was made — verify with teacher before processing." |
| Post-payout refund exceeds teacher's current balance | Set `outstanding_debit_pkr`. Auto-recover from future earnings via `credit_teacher_balance()`. Notify teacher. |
| Plan limit check — which courses count | Only courses with `status = 'published'` AND `deleted_at IS NULL` count toward `max_courses` limit. Draft courses and soft-deleted courses are excluded. Same logic for `max_cohorts_active` — only `status = 'active'` cohorts count. |
| Gateway down when student tries to enroll | Show user-friendly error. No enrollment or payment row created. idempotencyKey is discarded — new one generated on retry. |
| Screenshot payment submitted for archived cohort | Block at API level: check cohort.status != 'archived' before processing any payment. |
| Teacher submits subscription screenshot twice | Admin sees both in queue. Second approval attempt returns error: "Subscription already active for this period." |
| Teacher flips cohort `fee_type` after enrollments have paid | BLOCK via `updateCohortAction` guard: `countActiveConfirmedEnrollments(cohortId) > 0` + `fee_type` differs from current → return `{ success: false, code: 'FEE_TYPE_LOCKED' }` with message "Cannot change fee type — N student(s) have confirmed payments. Archive this cohort and create a new one to switch." UI disables the fee_type select with the same explanation. Rationale: switching one-time ↔ monthly mid-cohort would invalidate the billing schedule for students already committed under the original terms. |
| Teacher changes `billing_day` after monthly enrollments have paid | Same guard as fee_type, but only when `cohort.fee_type === 'monthly'` (billing_day is meaningless for one_time cohorts). Changing the day mid-cycle would break the `fee-reminders` cron's `payment_month` idempotency window. |
| Student uploads a second screenshot for a month already paid | Blocked before R2 upload: `createNextMonthPaymentAction` returns "This month is already paid." when an existing `confirmed` row is found. Rejected rows are reset, not duplicated. |
| Student retries "Pay now" after a network glitch | `createNextMonthPaymentAction` is idempotent — returns the existing pending row's id if one exists. Student lands on the same payment page, no duplicate row created. Concurrent double-submits are caught by the partial unique index + `PAYMENT_ALREADY_EXISTS` sentinel. |

### Enrollment Edge Cases

| Scenario | Rule |
|----------|------|
| Draft course / upcoming cohort on enroll page | Three states for `/join/[token]` page: (1) Course published + cohort active + registration open → show enrollment. (2) Cohort is draft OR parent course is draft → show "Coming Soon" page (not a 404 — invite link is valid, content just isn't ready). (3) `is_registration_open = false` → show "Registration Closed" page. |
| Draft cohort invite link shared early | Deliberately allowed. Teacher can share invite link while cohort is still in draft — students see "Coming Soon". Useful for building anticipation before launch. |
| `is_registration_open = false` | Enroll page shows "Registration closed" — no payment, no waitlist shown. |
| Course has multiple open cohorts | Show cohort picker UI before enrollment. Lists each cohort with: name, dates, schedule summary, fee, slots remaining. Closed cohorts (`is_registration_open = false`) hidden from picker. Student selects one cohort then proceeds to enrollment. Single-cohort courses skip the picker entirely. |
| Student enrolls in same cohort twice | UNIQUE constraint on `(student_id, cohort_id)` in enrollments prevents duplicate rows. API checks before creating. |
| Pending enrollment at cohort archive | Nightly archive cron auto-rejects screenshot-pending enrollments. Send rejection email to each affected student. |
| Gateway-paid enrollment in cohort that auto-archives | If gateway payment confirmed but cohort has since auto-archived: set `student_payments.status = 'pending_refund_review'`. Flagged in admin Operations panel. Admin issues refund via gateway and notifies student manually. |
| Cohort with 0 max_students set | This means unlimited. Never block enrollment for null max_students. |
| Teacher revokes a student mid-cohort without refunding | `RevokeDialog` renders an opt-in "Also refund Rs. X" checkbox whenever the enrollment's most recent payment is in-app refund eligible. Teacher must consciously tick it — default is unchecked. If left unchecked, revoke proceeds alone and the standalone "Record refund" dropdown option remains available afterward. Chained action order is revoke → refund; if the refund step fails after revoke succeeded, the dialog surfaces a partial-success toast instructing the teacher to retry the refund from the dropdown. |

### Content Edge Cases

| Scenario | Rule |
|----------|------|
| Delete course with active cohorts | BLOCK: "Archive all active/upcoming cohorts before deleting this course." |
| Teacher tries to publish course with no payment details set | BLOCK publish with prompt: "Set up your payment details before publishing. Students need to know how to pay you." Link to Settings → Payments. Enforced server-side on `PATCH /api/teacher/courses/[id]` when `status = 'published'`. |
| Delete cohort with confirmed payments | BLOCK: "This cohort has payment records. Archive it instead." Soft delete only. |
| Assignment due date in the past | Allow (useful for retroactive). Submissions accepted but flagged as 'overdue'. |
| Mark attendance on cancelled session | UI greyed out. API rejects: "Cannot mark attendance for a cancelled session." Cancelled sessions excluded from denominator in attendance summary. |
| Assignment submission after due date | Allow submission but auto-flag as 'overdue'. Teacher can still mark as reviewed. |
| Teacher pins more than 3 announcements | Allow any number of pins. UI shows all pinned at top, sorted by pinned_at. |
| Seen-by expand | Teacher can click the "Seen by X of Y" indicator to expand a list of which specific students have NOT yet viewed the announcement. Sourced from `announcement_reads` — any enrolled student without a matching row is "unseen". |

### Plan & Billing Edge Cases

| Scenario | Rule |
|----------|------|
| Admin lowers plan limit that some teachers exceed | Grandfathering modal shows count. Existing teachers keep their limits via `teacher_plan_snapshot`. New signups get new lower limit. |
| Teacher is grandfathered AND upgrades plan | On upgrade, new snapshot captured with new plan limits. Grandfathered limits are replaced. Cannot return to grandfathered limits. |
| billing_day > 28 | UI blocks values 29/30/31 at input — validated server-side too. Teachers use day 28 for end-of-month billing. No fallback needed since max is 28. |
| Plan price changes | New price applies to NEW subscriptions only. Teachers already subscribed pay old price until next renewal. |
| Archive plan with active subscribers | Existing subscribers keep access until their `plan_expires_at`. No new signups to that plan. |
| Delete plan | Only allowed if zero active subscribers. Confirmation modal required. |
| Teacher on Free plan (no expiry) | `plan_expires_at = null` = never expires. Grace period and renewal reminders do not apply. |
| Trial ends → grace period logic | Trial expiry: plan auto-downgrades to Free (no grace). Grace period is only for paid plan expiry. |

### Pending Visibility Edge Cases

| Scenario | Rule |
|----------|------|
| Student with pending enrollment visits schedule page | Check `cohort.pending_can_see_schedule`. If false: return empty array + message "Schedule visible after enrollment is confirmed" |
| Student with pending enrollment visits announcements | Check `cohort.pending_can_see_announcements`. If false: empty array |
| Teacher changes pending_can_see_schedule after students are pending | Immediate effect — next page load they either see or don't see. No backfill needed. |
| Pending student tries to mark attendance or submit assignment | Block: status must be 'active'. Return 403 ENROLLMENT_PENDING. |

### Waitlist Edge Cases

| Scenario | Rule |
|----------|------|
| Teacher views waitlist | Show: student name, phone number, email, date joined, position in queue. Full contact details visible so teacher can reach out via WhatsApp directly. |
| Teacher contacts waitlisted student | Manual contact only — teacher uses the phone number / email shown to message via WhatsApp or email outside the platform. Platform does NOT auto-send offer emails or auto-enroll from waitlist. |
| Teacher increases max_students | System sends notification to teacher: "You have X students waiting — slots are now available." Teacher then manually contacts them. |
| Teacher removes student from waitlist | Optional note field. No email sent to student on removal (manual process). |
| Student removes themselves from waitlist | Students can remove themselves from the waitlist at any time from student portal. |
| Cohort archives with waitlisted students | All waiting entries → status = 'expired'. No email sent. |
| Waitlist token behaviour | Invite token is NOT invalidated when cohort is full — visiting the link shows waitlist signup page. Token only expires when cohort is archived. |

### Direct Messages Edge Cases (Phase 2)

| Scenario | Rule |
|----------|------|
| Teacher messages student not enrolled in any of their cohorts | Block: teacher can only message students in their own cohorts. Validate on send. |
| Student messages teacher they are not enrolled with | Block: student can only message teachers they are actively enrolled with. |
| Message thread — no prior messages | Thread page shows empty state, not 404. |

### Referral Edge Cases (Phase 2)

| Scenario | Rule |
|----------|------|
| Teacher tries to refer themselves | Block: referred_teacher_id cannot equal referrer_teacher_id. |
| Referred teacher churns before 1 month | Credit is applied after new teacher's first confirmed paid month. If they churn, no credit issued. |
| Multiple referrers claim same teacher | First referral_code in the signup URL wins. Store referral_code in session at signup start. |

### Feedback Edge Cases (Phase 2/3)

| Scenario | Rule |
|----------|------|
| When to prompt for feedback | After cohort archives, show feedback prompt to enrolled students on next student portal login (once only per cohort). |
| Private vs public | Default: private (visible to teacher only). Future Phase 3: public star ratings on explore page if student opts in. |
| Student submits feedback for cohort they left early | Allow — they were enrolled. Their rating is included in teacher's average. |

### Auth Edge Cases

| Scenario | Rule |
|----------|------|
| Teacher visits their own subdomain while logged in | Show teacher dashboard at subdomain (not student portal). Middleware checks auth role. |
| Student visits teacher subdomain | Show public teacher page. Student login redirects to students.skoolrooms.com. |
| Unverified teacher tries to log in | Show banner: "Please verify your email" with resend button. Block dashboard access. |
| Suspended teacher tries to log in | Show suspension notice page. Cannot access any teacher features. |
| Suspended teacher's students | Students RETAIN read access to enrolled cohort content (schedule, announcements, materials). Students CANNOT enroll in new cohorts. All cron jobs (class reminders, fee reminders) skip suspended teacher's cohorts: add `WHERE teacher.is_suspended = false` filter. |
| Suspended teacher's subdomain | Subdomain remains accessible. Public page shows "This teacher is currently unavailable." — NOT a 404. Courses visible but enrollment blocked. |
| Suspension and plan timers | Suspension does NOT pause plan timers. If plan expires during suspension, teacher enters grace/lock normally. Admin must manually extend expiry after reactivation if needed. Rationale: simpler implementation, admin has extend-expiry endpoint for edge cases. |
| Teacher changes email | Set `pending_email`, send verification to new address. Email changes only on click. Old email remains active until confirmed. |
| Admin session expires mid-action | API returns 401. Frontend redirects to admin login. No data corruption — operations are atomic. |
| Subdomain change — old URL redirect | When teacher changes subdomain, old CNAME is deleted. Visiting old URL returns 404. **No automatic redirect.** Teacher is warned in confirmation modal: "All previously shared links will break." Rationale: DNS redirect requires keeping old CNAME, which blocks that subdomain from being claimed by another teacher. |

### Storage Edge Cases

| Scenario | Rule |
|----------|------|
| Upload exceeds plan storage limit | Server checks: current R2 usage + file size > max_storage_mb? → reject with STORAGE_LIMIT error. UI shows amber warning at 80%, block at 100%. |
| R2 presigned URL size enforcement | Generate presigned URL with `Content-Length` condition matching the declared `sizeBytes`. R2 rejects uploads that exceed this. Client cannot lie about file size and upload a larger file. |
| Profile photo replacement | When teacher uploads a new profile photo, the R2 presign endpoint uses a FIXED key: `profiles/{teacherId}/photo.{ext}`. Old file at same key is overwritten automatically by R2 (same key = replace). Update `teachers.profile_photo_url` with new publicUrl. No orphan cleanup needed. |
| Teacher deletes file | Soft-delete the DB reference, schedule R2 key deletion. Do NOT immediately delete (screenshot may be needed for disputes). |
| R2 upload succeeds but DB save fails | File is now orphaned in R2. Background cleanup cron (Phase 2) finds R2 keys with no DB reference older than 24h and deletes them. For Phase 1: log the orphaned key, clean manually. |

### Notification Edge Cases

| Scenario | Rule |
|----------|------|
| Email to opted-out teacher | `sendEmail()` checks `notification_preferences_json` — skips delivery but still logs to `notifications_log` with status 'skipped'. |
| Transactional email to opted-out teacher | Financial/payment emails are ALWAYS sent regardless of preferences. |
| Brevo bounces an email | Brevo webhook updates `email_delivery_log.status = 'bounced'`. Admin sees bounce count in Operations panel. |
| Class reminder for cancelled session | `class-reminders` cron skips sessions where `cancelled_at IS NOT NULL`. |
| Fee reminder for one-time cohort | Cron checks `cohort.fee_type = 'monthly'` before sending. One-time cohorts NEVER get fee reminders. |

---

*End of ARCHITECTURE.md*
*Domain: `NEXT_PUBLIC_PLATFORM_DOMAIN` — change this one env var to rename the platform.*
*Last updated: March 2026*
