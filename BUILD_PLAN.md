# BUILD PLAN — Lumscribe LMS SaaS Platform

> Week-by-week implementation plan. Each week delivers something testable.
> Phase 1 = launch-ready MVP. Phase 2 = full feature set. Phase 3 = scale.

---

## Phase 1: MVP (8 Weeks)

**Goal:** A teacher can sign up, create a course, share a link, a student can enroll and pay via screenshot, teacher verifies, student gets access. You (admin) can approve teacher subscriptions and monitor platform health.

---

### Week 0 — Pre-Flight: Collect All Keys + Validate Access

> **Read in ARCHITECTURE.md before starting:**
> - §11 Environment Variables (line 2756–2859)

> **Do this BEFORE writing any code.** Collect every API key and token needed for Phase 1, write them to `.env.local`, and run a validation script that confirms each service is reachable. Nothing proceeds until all checks pass.

#### Keys to collect from you:

| # | Service | What you need to do | Key(s) we get |
|---|---------|-------------------|---------------|
| 1 | **Supabase** | Create project at supabase.com (free tier) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| 2 | **Brevo** | Create account at brevo.com (free tier) → Settings → SMTP & API → API Keys | `BREVO_API_KEY` |
| 3 | **Cloudflare** | Add your domain to Cloudflare (free tier) → API Tokens → Create Token (Zone:DNS:Edit) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` |
| 4 | **Cloudflare R2** | Cloudflare dashboard → R2 → Create Bucket → Manage R2 API Tokens | `CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_PUBLIC_URL` |
| 5 | **You decide** | Pick your platform domain (e.g. `lumscribe.com`) | `NEXT_PUBLIC_PLATFORM_DOMAIN` |
| 6 | **You decide** | Your admin email address | `ADMIN_EMAIL` |
| 7 | **Auto-generated** | We generate a random UUID for cron protection | `CRON_SECRET` |
| 8 | **Mock (no key needed)** | Payment gateway starts as mock — no real key until Phase 2 | `PAYMENT_GATEWAY=mock` |

#### Validation script (runs after `.env.local` is filled):

```
Check 1: Supabase connection
  → createClient() with anon key → supabase.from('_test').select() → expect connection success
  → createClient() with service role → supabase.auth.admin.listUsers() → expect success
  ✅ PASS / ❌ FAIL: "Supabase URL or keys are wrong"

Check 2: Brevo API
  → POST https://api.brevo.com/v3/account with api-key header
  → expect 200 with account info
  ✅ PASS / ❌ FAIL: "Brevo API key is invalid"

Check 3: Cloudflare DNS API
  → GET https://api.cloudflare.com/client/v4/zones/{ZONE_ID} with Bearer token
  → expect 200 with zone name matching your domain
  ✅ PASS / ❌ FAIL: "Cloudflare token or zone ID is wrong"

Check 4: Cloudflare R2
  → ListBuckets via S3-compatible API with R2 credentials
  → expect bucket name in list
  ✅ PASS / ❌ FAIL: "R2 credentials or bucket name is wrong"

Check 5: Domain config
  → NEXT_PUBLIC_PLATFORM_DOMAIN is not empty
  → ADMIN_EMAIL is valid email format
  → CRON_SECRET is at least 32 chars
  ✅ PASS / ❌ FAIL: "Missing or invalid value"

All 5 pass → print "✅ All services connected. Ready to build."
Any fail → print exact error + link to fix it. Do NOT proceed.
```

#### DNS setup (do once, during Week 0):
- [ ] Add domain to Cloudflare (if not already)
- [ ] Brevo: add DKIM + SPF DNS records for your domain (Settings → Senders & Domains)
- [ ] Cloudflare R2: enable public access on bucket, set custom domain if desired

#### `.env.local` template:
```bash
# Platform
NEXT_PUBLIC_PLATFORM_DOMAIN=
ADMIN_EMAIL=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Brevo
BREVO_API_KEY=
BREVO_FROM_EMAIL=noreply@yourdomain.com

# Cloudflare DNS
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=

# Cloudflare R2
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ENDPOINT=
CLOUDFLARE_R2_PUBLIC_URL=

# Cron Security (auto-generated UUID)
CRON_SECRET=

# Payment Gateway (mock until Phase 2)
PAYMENT_GATEWAY=mock
```

**Phase 2 keys (NOT needed now — collect later):**
- `SAFEPAY_API_KEY`, `SAFEPAY_SECRET_KEY`, `SAFEPAY_WEBHOOK_SECRET` — when gateway account approved
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` — when WhatsApp ready
- `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN` — when rate limiting upgraded from in-memory

---

### Week 1 — Foundation + Database + Auth

> **Read in ARCHITECTURE.md before starting:**
> - §1 Project Structure (line 46–309)
> - §2 Shared Code Architecture (line 311–590) — all subsections: types, functions, hooks, constants, contexts, data fetching, cron security
> - §3 Database Schema (line 593–1476) — all tables, RLS policies, indexes, Postgres functions, seed data
> - §4 Authentication (line 1480–1626) — all roles, login flows, password reset, role checks, subdomain routing
> - §5 Auth API (line 1634–1644)
> - §6 Realtime Subscriptions (line 1778–1791)
> - §9.4 Timezone Handling (line 2340–2368)
> - §9.6 File Storage R2 (line 2371–2394)
> - §9.7 Subdomain Provisioning (line 2396–2411)
> - §9.7c PaymentProvider Interface (line 2466–2490)
> - §10 UI Architecture (line 2568–2700) — theme, shared components, toast, loading, layouts
> - §11 Environment Variables (line 2756–2859)

Everything below this week is shared infrastructure that every other week depends on.

- [ ] **Run Week 0 validation script — all 5 checks must pass before proceeding**
- [ ] Next.js 16 project init + Tailwind CSS v4 (`@tailwindcss/postcss`) + React 19 + TypeScript strict mode
- [ ] `app/globals.css` with full `@theme` block (brand colors, ink, muted, paper, surface, border, success/warning/danger, font-sans, shadows)
- [ ] `next/font` Inter setup in root `layout.tsx`
- [ ] `postcss.config.mjs` with `@tailwindcss/postcss` only
- [ ] Supabase project created, all env vars wired in `.env.local`
- [ ] `supabase/client.ts` (browser — `@supabase/supabase-js`) + `supabase/server.ts` (SSR — `@supabase/ssr` with `getAll`/`setAll` cookie pattern)
- [ ] Migration `001_initial_schema.sql` — all core tables: teachers, courses, cohorts, class_sessions, students, enrollments, student_payments, teacher_subscriptions, teacher_payment_settings, teacher_balances, teacher_payouts, plans, plan_features, feature_registry, teacher_plan_snapshot, announcements, announcement_comments, announcement_reads, attendance, assignments, assignment_submissions, discount_codes, cohort_waitlist, platform_settings, explore_page_views, admin_activity_log, notifications_log, email_delivery_log
- [ ] Migration `002_rls_policies.sql` — all 19 RLS policies (courses, cohorts, class_sessions, announcements, enrollments, student_payments, attendance, assignments, assignment_submissions, announcement_comments, announcement_reads)
- [ ] Migration `003_indexes.sql` — all indexes from architecture (35+ indexes)
- [ ] Migration `004_functions.sql` — `enroll_student_atomic()`, `credit_teacher_balance()`, `increment_discount_use()`, `set_grace_period()`
- [ ] Migration `005_seed_data.sql` — 3 plans (Free/Solo/Academy), 17 feature_registry rows, plan_features matrix, platform_settings (12 keys)
- [ ] `types/api.ts` — `ApiResponse<T>`, `EnrollInput/Output`, `SubscribeInput/Output`, `PresignInput/Output`
- [ ] `types/domain.ts` — all enums: `EmailType`, `PlanSlug`, `LimitKey`, `FeatureKey`, `CohortStatus`, `EnrollmentStatus`, `PaymentStatus`, `PayoutStatus`
- [ ] `lib/platform/domain.ts` — `platformDomain()`, `teacherSubdomainUrl()`, `studentPortalUrl()`, `platformUrl()`
- [ ] `lib/platform/settings.ts` — `getPlatformSetting()` with 1-min cache, `isScreenshotPaymentsEnabled()`, `isGatewayEnabled()`
- [ ] `lib/plans/features.ts` — `canUseFeature(teacherId, featureKey)`
- [ ] `lib/plans/limits.ts` — `getLimit(teacherId, limitKey)`
- [ ] `lib/time/pkt.ts` — `currentPKT()`, `formatPKT()`, `getBillingDateForMonth()`
- [ ] `lib/email/sender.ts` — `sendEmail()` with Brevo integration (`@getbrevo/brevo`), notification_preferences check, notifications_log + email_delivery_log writes
- [ ] `lib/payment/provider.ts` — `PaymentProvider` interface
- [ ] `lib/payment/mock.ts` — Mock adapter (always succeeds, fake checkout URL)
- [ ] `lib/r2/upload.ts` — `getPresignedUploadUrl()` with Content-Length enforcement
- [ ] `lib/cloudflare/dns.ts` — `createSubdomainRecord()`, `deleteSubdomainRecord()`
- [ ] `constants/routes.ts`, `constants/features.ts`, `constants/plans.ts`
- [ ] `middleware.ts` — subdomain routing (students.domain → /student/*, xyz.domain → /teacher-public/xyz/*)
- [ ] Supabase Auth setup — teacher + student + admin roles via user_metadata
- [ ] `POST /api/auth/teacher/signup` — create auth user + teachers row (plan=free) + teacher_balances row
- [ ] `POST /api/auth/student/signup` — create auth user + students row
- [ ] `POST /api/auth/reset-password` — Supabase password reset for both roles
- [ ] `POST /api/auth/update-password` — new password from reset callback
- [ ] `POST /api/auth/teacher/resend-verification` — resend email verification (3/hr rate limit)
- [ ] `POST /api/auth/teacher/change-email` — set pending_email, send verification to new address, old email active until confirmed
- [ ] Teacher login page (`/login`)
- [ ] Student login page (`/student-login`)
- [ ] Forgot password pages (teacher + student)
- [ ] Reset password callback page (`/auth/reset-password`)
- [ ] `requireTeacher()`, `requireStudent()`, `requireAdmin()` auth guard functions (used in Server Components and Server Actions)
- [ ] Shared UI primitives: `Button` (variants + sizes + loading), `Input`, `Select`, `Modal`, `ConfirmModal`, `Toast`, `StatusBadge` (universal for all status types), `Card`, `DataTable` (sortable + filterable + paginated), `EmptyState`, `PageHeader`, `FileUpload` (universal R2 upload with auto size validation)
- [ ] `TeacherProvider` React Context — Server Component fetches teacher + plan + usage → passes to client children via Context
- [ ] `UIProvider` React Context — client-side UI state (toasts, confirm modals, sidebar)
- [ ] `useRealtime()` hook + `useToast()` hook
- [ ] `vercel.json` with all 9 cron schedules + `CRON_SECRET` env var for cron route protection

**Testable:** Teacher can sign up, verify email, log in. Student can sign up and log in. Password reset works.

---

### Week 2 — Teacher Onboarding + Course Creation

> **Read in ARCHITECTURE.md before starting:**
> - §3 `teachers` table (line 599–626), `courses` table (line 628–654)
> - §5 Teacher API (line 1660–1692) — onboarding, courses CRUD
> - §5 Cloudflare API (line 1646–1653), R2 Upload API (line 1654–1659)
> - §9.2 Onboarding Checklist System (line 2205–2236)
> - §9.6 File Storage R2 (line 2371–2394), §9.6 Plan Limit Enforcement (line 2412–2445)
> - §9.7 Subdomain Provisioning (line 2396–2411)
> - §10 Shared Components (line 2609–2656), Teacher Dashboard Layout (line 2657–2672)
> - §10b URL Route Map (line 2704–2751)
> - §13 Plan Limits (line 3090–3103), Upload Size Limits (line 3157–3177), Reserved Subdomains (line 3179–3185)
> - §14 Content Edge Cases (line 3227–3238)

- [ ] 3-step onboarding wizard UI (subject/level → subdomain picker → profile photo + bio)
- [ ] `POST /api/teacher/onboarding` — save step data
- [ ] `POST /api/teacher/onboarding/complete-step` — mark individual step done
- [ ] `onboarding_steps_json` tracking (5 steps: profile, payment details, course, cohort, link shared)
- [ ] Live subdomain availability checker (debounced client-side → check DB + reserved list)
- [ ] `POST /api/cloudflare/subdomain` — validate (regex + reserved blocklist + DB uniqueness) + create DNS CNAME via Cloudflare API
- [ ] Persistent onboarding checklist widget on dashboard (progress bar, auto-tick on step completion)
- [ ] `POST /api/r2/presign` — presigned URL generation with Content-Length + file type validation
- [ ] Profile photo upload (fileType: 'profile', fixed R2 key `profiles/{teacherId}/photo.{ext}`)
- [ ] Teacher dashboard layout (sidebar: Dashboard, Courses, Students, Payments, Earnings, Analytics, Settings)
- [ ] Teacher dashboard home page (stats skeleton, usage bars, onboarding checklist)
- [ ] `UsageBars` component (courses/students/cohorts/storage — amber 80%, red 95%, block 100%)
- [ ] `PlanLimitGuard` component (wraps features, shows upgrade nudge or hard block)
- [ ] `POST /api/teacher/courses` — create course (check `getLimit('max_courses')`, active-only count)
- [ ] `PATCH /api/teacher/courses/[id]` — edit course. Publish blocked without payment settings (400 `PAYMENT_SETUP_REQUIRED`)
- [ ] `DELETE /api/teacher/courses/[id]` — soft delete (blocked if active cohorts exist)
- [ ] Course creation page with TipTap rich text editor
- [ ] Course thumbnail upload via R2 presign
- [ ] Course list page (draft/published badges)
- [ ] Teacher public page on subdomain (`[subdomain].lumscribe.com`) — course listing + bio
- [ ] Marketing homepage at `lumscribe.com` — value prop, "Start Free" CTA, "Find a Teacher" link to explore, pricing overview
- [ ] `EmptyState` component for all list pages

**Testable:** Teacher completes onboarding, subdomain goes live, creates a course with thumbnail, publishes it, public page shows the course.

---

### Week 3 — Cohorts + Class Scheduling

> **Read in ARCHITECTURE.md before starting:**
> - §3 `cohorts` table (line 656–700), `class_sessions` table (line 702–715)
> - §5 Teacher API — cohorts + sessions (line 1670–1674)
> - §5 Cron Routes (line 1762–1774) — archive-cohorts
> - §9.3 Plan Expiry UI States (line 2238–2293) — archived cohort write guard pattern
> - §9.3b Recurring Class Session Expansion (line 2296–2320)
> - §9.6 Plan Limit Enforcement (line 2412–2445)
> - §9.8 Pending Visibility (line 2491–2517)
> - §13 Timing Rules (line 3136–3155)
> - §14 Enrollment Edge Cases (line 3214–3225), Content Edge Cases (line 3227–3238)

- [ ] `POST /api/teacher/cohorts` — create cohort (check `canUseFeature` + `getLimit`, generate invite_token)
- [ ] `PATCH /api/teacher/cohorts/[id]` — edit cohort (if max_students increases + waitlist has entries → send `waitlist_slots_available` email)
- [ ] `POST /api/teacher/cohorts/[id]/archive` — manual archive
- [ ] Cohort creation page (name, dates, fee_type, fee_pkr, billing_day 1-28 validation UI+API, max_students — null=unlimited)
- [ ] Cohort status badge component (Draft/Upcoming/Open/Full/Closed/Archived — computed from status + start_date + registration)
- [ ] Cohort pending visibility toggles (pending_can_see_schedule, pending_can_see_announcements)
- [ ] Cohort invite link generation + copy-to-clipboard (fires onboarding step 'link_shared')
- [ ] Public cohort enroll page at `/join/[token]` (3 states: enrollment form, Coming Soon, Registration Closed)
- [ ] Cohort picker UI when course has multiple open cohorts
- [ ] `DELETE /api/teacher/cohorts/[id]` — blocked if active enrollments or payments exist, must archive instead
- [ ] `POST /api/teacher/class-sessions` — create single or recurring sessions (eager expansion via rrule.js through cohort end_date, install `rrule` npm package)
- [ ] `POST /api/teacher/class-sessions/[id]/cancel` — cancel session + email enrolled students
- [ ] Teacher calendar view (weekly/monthly, cancelled sessions with badge)
- [ ] `/api/cron/archive-cohorts` — nightly: archive past-end-date cohorts + auto-reject pending enrollments + expire waitlist entries
- [ ] Archived cohort write guard on all content-write API routes (403 `COHORT_ARCHIVED`)

**Testable:** Teacher creates cohort under published course, sets schedule with recurring classes, shares invite link. Visiting link shows enrollment page. Archiving works.

---

### Week 4 — Student Enrollment + Screenshot Payments

> **Read in ARCHITECTURE.md before starting:**
> - §3 `students` table (line 717–733), `enrollments` table (line 735–748), `student_payments` table (line 752–776)
> - §4 Student Login Flow (line 1503–1522), Subdomain Routing (line 1599–1626)
> - §5 Teacher API — enrollment endpoints (line 1675–1678)
> - §5 Student API (line 1726–1735)
> - §5 Public endpoint `payment-info` (line 1724)
> - §6 Realtime Subscriptions (line 1778–1791)
> - §7 Flow B — Screenshot (line 1898–1930), Flow B — Manual (line 1931–1947)
> - §8 Every Email Trigger (line 2091–2131)
> - §9.1 Slot Locking (line 2181–2204)
> - §9.7b Reference Code Generation (line 2454–2465)
> - §9.8 Pending Visibility (line 2491–2517), §9.9 Before Cohort Start (line 2520–2538)
> - §10 Student Portal Layout (line 2673–2685)
> - §10b URL Route Map (line 2704–2751) — student + teacher-public routes
> - §14 Payment Edge Cases (line 3198–3212), Enrollment Edge Cases (line 3214–3225), Pending Visibility Edge Cases (line 3253–3260)

- [ ] Student registration at enrollment time (name, phone, email, password — or login if existing account)
- [ ] Multi-teacher account reuse (UNIQUE email on students, Supabase Auth recognises existing account)
- [ ] `POST /api/student/enroll` — atomic slot check via `enroll_student_atomic()`, create enrollment (pending) + student_payments row (pending_verification)
- [ ] Reference code generation (6-char from safe charset, UNIQUE constraint, displayed as REF-XXXXXX)
- [ ] `GET /api/public/cohort/[token]/payment-info` — public endpoint returning teacher bank details, QR code, instructions, fee amount
- [ ] Student payment page at `/join/[token]/pay/[enrollmentId]` — shows teacher bank details + QR code + reference code + screenshot upload
- [ ] Screenshot upload flow: student uploads proof → enrollment pending → teacher notified
- [ ] Reference code validation on payment submission (reject if code doesn't match enrollment)
- [ ] `POST /api/teacher/enrollments/[id]/approve` — approve screenshot: set enrollment active, calculate platform cut, credit balance, send confirmation email
- [ ] `POST /api/teacher/enrollments/[id]/reject` — reject with reason, student can resubmit
- [ ] `POST /api/teacher/enrollments/manual` — Mark as Paid (cash enrollment, platform_cut_pkr=0, balance NOT credited)
- [ ] `POST /api/teacher/students/create-and-enroll` — teacher adds brand-new student with temp password
- [ ] Teacher payment verification panel (pending list sorted by newest, full-size screenshot view, approve/reject buttons)
- [ ] Payment badge count on sidebar nav (realtime via Supabase subscription)
- [ ] Student portal layout (top nav: My Courses, Schedule, Payments, Settings)
- [ ] `students.lumscribe.com` routing working
- [ ] Student dashboard — upcoming classes with Meet links, grouped by teacher
- [ ] Student courses page — enrolled courses grouped by teacher
- [ ] Student schedule page — all upcoming classes across all teachers
- [ ] Student payments page — enrollment + payment status
- [ ] Student settings page
- [ ] Pending visibility enforcement in student portal (check cohort.pending_can_see_schedule/announcements for pending enrollments)
- [ ] Realtime subscriptions via `useRealtime()` hook: payment queue badge (teacher), enrollment status (student), admin payment queue, announcement board (live feed), announcement comments, teacher balance updates, waitlist updates
- [ ] Email notifications: `enrollment_confirmed`, `enrollment_rejected`, `enrollment_pending`, `new_enrollment_notification`

**Testable:** Full enrollment flow works end-to-end. Student finds cohort via invite link, uploads screenshot, teacher approves, student gets access to portal with classes and Meet links.

---

### Week 5 — Cohort Content (Announcements + Attendance + Assignments)

> **Read in ARCHITECTURE.md before starting:**
> - §3 Content Tables (line 899–968) — announcements, comments, reads, attendance, assignments, submissions
> - §3 RLS — announcements (line 1313–1320), comments (line 1372–1383), reads (line 1385–1392), attendance (line 1342–1351), assignments (line 1353–1361), submissions (line 1363–1370)
> - §5 Teacher API — announcements, attendance, assignments (line 1680–1682)
> - §5 Student API — submissions, announcement reads, withdrawal (line 1733–1735)
> - §5 Teacher Withdrawal Management (line 1736–1742)
> - §7 Refund Rules (line 1988–2030)
> - §8 Every Email Trigger (line 2091–2131) — new_announcement, student_comment, class_cancelled
> - §9.3 Archived cohort write guard (line 2282–2292)
> - §9.3c Assignment + Notification Start Date Guard (line 2323–2337)
> - §13 Timing Rules (line 3136–3155) — attendance edit window
> - §14 Content Edge Cases (line 3227–3238)

- [ ] `POST /api/teacher/announcements` — create announcement with optional R2 file attachment, email all cohort students
- [ ] Announcement board UI per cohort (teacher creates, students view + comment)
- [ ] Announcement file attachment upload (R2 presign, max 25MB)
- [ ] Student comment threads on announcements (`deleted_at` for teacher moderation)
- [ ] Email: `new_announcement` → students, `student_comment` → teacher
- [ ] Announcement seen-by indicator ("Seen by X of Y students" + expand to see who hasn't viewed)
- [ ] Announcement pinning (`pinned=true, pinned_at=now()`, pinned announcements sorted to top)
- [ ] `POST /api/teacher/attendance` — upsert attendance rows (checkbox per enrolled student)
- [ ] Cancelled session handling: Mark Attendance disabled, excluded from attendance denominator
- [ ] Attendance summary per student (X of Y non-cancelled classes)
- [ ] Student attendance view in portal
- [ ] `POST /api/teacher/assignments` — create assignment (cohort archived guard + start_date guard: block creation before cohort start_date)
- [ ] Assignment file attachment (R2 presign, max 25MB)
- [ ] `POST /api/student/submissions` — submit text answer or file upload (max 50MB)
- [ ] Teacher reviews submission → marks as Reviewed (no grades)
- [ ] Overdue submission flagging (past due_date + not submitted)
- [ ] Enrollment revocation: `POST /api/teacher/enrollments/[id]/revoke` — requires reason, student loses access, email with reason
- [ ] Refund recording on payment record (offline refund note for post-payout, in-app refund deducts `teacher_payout_amount_pkr` from balance)
- [ ] Student withdrawal: `POST /api/student/enrollments/[id]/withdraw` + `POST /api/teacher/enrollments/[id]/approve-withdrawal` + `POST /api/teacher/enrollments/[id]/reject-withdrawal`
- [ ] Withdrawal emails: `student_withdrawal_requested` → teacher, `withdrawal_approved` / `withdrawal_rejected` → student
- [ ] Per-teacher student blocking (revoked enrollment blocks re-enrollment with same teacher)
- [ ] `POST /api/student/announcements/[id]/read` — upsert announcement_reads (powers seen-by indicator)
- [ ] Attendance edit window (editable within 24h of marked_at, locked after)

**Testable:** Teacher posts announcement with file, students comment, teacher marks attendance, creates assignment, student submits, teacher reviews. Revoke and withdrawal flows work.

---

### Week 6 — Subscriptions + Plan System + Grace Period

> **Read in ARCHITECTURE.md before starting:**
> - §3 Plan Tables (line 839–896) — plans, plan_features, feature_registry, teacher_plan_snapshot
> - §3 `teacher_subscriptions` table (line 778–792)
> - §3 Postgres Functions — `set_grace_period()` (line 1465–1476)
> - §3 Seed Data — plans, features, platform_settings (line 1005–1078)
> - §5 Teacher API — subscribe endpoints (line 1665–1666), plan-details (line 1692)
> - §5 Admin API — subscription approve/reject (line 1716–1717)
> - §5 Cron Routes (line 1762–1774) — grace-period, trial-expiry, renewal-reminders
> - §7 Flow A — Teacher Subscription via Screenshot (line 1831–1856)
> - §8 Every Email Trigger (line 2091–2131) — subscription/grace/trial emails
> - §9.3 Plan Expiry UI States (line 2238–2293) — ExpiryBanner, hard lock, blocked actions
> - §9.6 Plan Limit Enforcement (line 2412–2445)
> - §13 Plan Limits (line 3090–3103), Feature Flags (line 3104–3124), Pricing (line 3126–3134), Timing Rules (line 3136–3155)
> - §14 Plan & Billing Edge Cases (line 3240–3251)

- [ ] Pricing page (public, 3 tiers with feature comparison)
- [ ] `POST /api/teacher/subscribe` — handles trial start (first time on paid plan) OR returns screenshot form
- [ ] `POST /api/teacher/subscribe/screenshot` — upload screenshot, create teacher_subscriptions (pending_verification, period_start, period_end=+30 days)
- [ ] Admin subscription verification queue (screenshot list, approve/reject)
- [ ] `POST /api/admin/subscriptions/[id]/approve` — set plan, plan_expires_at=period_end, grace_until=NULL, trial_ends_at=NULL, insert teacher_plan_snapshot
- [ ] `POST /api/admin/subscriptions/[id]/reject` — reject with reason
- [ ] `ExpiryBanner` component (4 states: expiry warning amber, grace orange, hard lock red, trial ending amber)
- [ ] `/api/cron/grace-period` — 3-step: set grace_until → daily reminders → hard lock email
- [ ] `set_grace_period()` Postgres function (sets `grace_until = plan_expires_at + 5 days`)
- [ ] Hard lock enforcement: API-level `PLAN_LOCKED` check on all content-write routes
- [ ] `/api/cron/trial-expiry` — downgrade expired trials to Free
- [ ] `/api/cron/renewal-reminders` — subscription renewal (3 days before) + trial ending (2 days before) emails
- [ ] Plan Management UI — plan list, edit limits, edit feature toggles (grouped by category)
- [ ] Grandfathering modal (auto-triggers when admin lowers a limit, shows affected teacher count, creates snapshots)
- [ ] `teacher_plan_snapshot` creation on subscription activation
- [ ] `GET /api/teacher/plan-details` — returns plan, limits, features, usage, grandfathered status (single endpoint for client-side gates)
- [ ] Teacher Settings → Plan page (current plan, features included vs locked, usage bars)
- [ ] Contextual upgrade nudges at 80% limit usage
- [ ] Plan limit counting rules: only `status='published'` courses count toward max_courses, only `status='active'` cohorts count toward max_cohorts_active (drafts + archived excluded)

**Testable:** Teacher hits plan limit → sees upgrade prompt → uploads subscription screenshot → admin approves → plan activates. Trial starts on paid plan selection, auto-downgrades. Grace period and hard lock work after expiry.

---

### Week 7 — Admin Panel + Teacher Analytics

> **Read in ARCHITECTURE.md before starting:**
> - §3 `admin_activity_log` table (line 1105–1117), `notifications_log` (line 1161–1173), `email_delivery_log` (line 1175–1187)
> - §3 `teacher_payment_settings` table (line 794–806), `teacher_balances` (line 808–818)
> - §4 Admin Login Flow (line 1524–1553), Role Check Pattern (line 1599–1626)
> - §5 Teacher API — analytics + notification settings (line 1688–1692)
> - §5 Admin API — teacher management, subscriptions, activity log (line 1714–1724)
> - §8 Opt-Out Fields (line 2132–2175)
> - §9.10 Storage Breakdown by Category (line 2539–2556)
> - §10 Admin Layout (line 2686–2700)
> - §10b URL Route Map — admin routes (line 2740–2751)
> - §12b Admin KPI Reference (line 3057–3085)
> - §13 Minimum Payout (line 3187–3192)
> - §14 Auth Edge Cases (line 3298–3311), Payment Edge Cases (line 3198–3212)

- [ ] Admin auth + protected routes (`requireAdmin()`, session timeout 4h, login lockout after 5 failures)
- [ ] Admin login page at `/admin/login` (not linked from public pages)
- [ ] Admin dashboard layout (sidebar: Dashboard, Teachers, Payments, Payouts, Plans, Settings, Operations)
- [ ] Admin dashboard home: MRR (sum of active paid subs), new signups this week/month, churn this month, plan distribution donut chart
- [ ] Teacher health panel: dormant (no login 14d), zero-student (paid, 0 enrolled), expiring next 7d, pending screenshots >48h, new signups
- [ ] Teacher account list — name, plan, status, last login, student count (sortable + searchable)
- [ ] Teacher detail page — profile, plan info, subscription history, activity log
- [ ] `POST /api/admin/teachers/[id]/change-plan` — manual plan override
- [ ] `POST /api/admin/teachers/[id]/extend-expiry` — extend plan_expires_at by N days
- [ ] `POST /api/admin/teachers/[id]/extend-trial` — extend trial_ends_at by N days
- [ ] `POST /api/admin/teachers/[id]/suspend` — suspend teacher (log to admin_activity_log)
- [ ] `POST /api/admin/teachers/[id]/reactivate` — reactivate teacher
- [ ] `GET /api/admin/teachers/[id]/activity-log` — filtered activity log per teacher
- [ ] Admin → Settings → Platform Settings page (toggle screenshot_payments_enabled, edit min_payout_amount, gateway_processing_fee_percent)
- [ ] Operations panel: total active cohorts, total students, pending payment queue count
- [ ] Teacher analytics page: revenue this month vs last (% change), pending unverified, overdue fees
- [ ] `GET /api/teacher/analytics/revenue` — per-cohort breakdown, 6-month chart data
- [ ] `GET /api/teacher/analytics/storage` — storage used per category (R2 list by prefix)
- [ ] Teacher analytics: storage usage bar with 80%/95% warnings + breakdown by category
- [ ] Teacher analytics: recently joined students (last 7 days)
- [ ] Student health signals: overdue fees (monthly cohort unpaid), recently joined
- [ ] Cohort analytics: slot utilisation (X/Y filled per cohort)
- [ ] Teacher payment settings page (bank name, IBAN, JazzCash, EasyPaisa, QR code upload, instructions)
- [ ] `PATCH /api/teacher/settings/notifications` — notification preference toggles
- [ ] Teacher Settings → Notifications page UI (per-type toggles, business-critical emails greyed out/locked, email volume counter per type this month from notifications_log)

**Testable:** Admin can log in, view dashboard metrics, manage teachers (suspend, change plan, extend), approve subscriptions. Teachers see revenue analytics and storage breakdown.

---

### Week 8 — Waitlist + Fee Reminders + Explore Page + Launch Prep

> **Read in ARCHITECTURE.md before starting:**
> - §3 `cohort_waitlist` table (line 986–1001), `explore_page_views` table (line 1069–1079)
> - §3 Explore Page Query Strategy (line 1080–1104)
> - §5 Student API — waitlist endpoints (line 1731–1732)
> - §5 Cron Routes (line 1762–1774) — fee-reminders, class-reminders, enrollment-nudge, subscription-nudge
> - §7 Waitlist Flow (line 2057–2087)
> - §8 Every Email Trigger (line 2091–2131) — fee_reminder, class_reminder, waitlist emails
> - §9.5 Rate Limiting (line 2356–2369)
> - §9.10 Gateway Error Monitoring (line 2557–2565)
> - §10b URL Route Map (line 2704–2751) — explore, pricing routes
> - §13 Upload Size Limits (line 3157–3177), Reserved Subdomains (line 3179–3185), Timing Rules (line 3136–3155)
> - §14 Waitlist Edge Cases (line 3262–3272), Notification Edge Cases (line 3323–3332), Storage Edge Cases (line 3313–3321)

- [ ] `POST /api/student/waitlist/join` — public (no account required), insert with name/phone/email
- [ ] `POST /api/student/waitlist/leave` — remove from waitlist (by student_id or email)
- [ ] Waitlist management panel (teacher view: student name, phone, email, date joined, position)
- [ ] Waitlist teacher notification (on max_students increase via cohort PATCH)
- [ ] `/api/cron/fee-reminders` — monthly cohort fee reminders (3 days before billing_day), multi-teacher batching for same student
- [ ] Billing day validation: UI + API block values 29/30/31 (max 28)
- [ ] Overdue fee badges in teacher dashboard
- [ ] Explore page at `/explore` — SSR with ISR (1h cache), teacher directory with filters
- [ ] Explore page SQL query (JOIN teachers → courses → cohorts, filter by publicly_listed + open cohorts + not suspended + not locked)
- [ ] Client-side filtering: subject, level, fee range, open cohorts toggle
- [ ] Teacher card component: photo, name, subjects, levels, starting fee (MIN cohort fee), active student count, city
- [ ] Greyed "Not accepting students" when all cohorts closed, hidden when no cohorts at all
- [ ] Hard-locked + suspended teachers excluded from explore
- [ ] Teacher explore settings: subject tags, teaching levels, is_publicly_listed toggle (Settings → Privacy)
- [ ] `explore_page_views` tracking — daily-unique per IP hash (SHA-256 via x-forwarded-for header)
- [ ] `GET /api/teacher/analytics/explore-views` — view count for teacher analytics
- [ ] `/api/cron/class-reminders` — hourly: 24h and 1h reminders
- [ ] `/api/cron/enrollment-nudge` — daily: 24h unverified screenshot nudge to teacher
- [ ] `/api/cron/subscription-nudge` — daily: 48h pending subscription screenshot nudge to admin
- [ ] Rate limiting on `/join/[token]` (10/IP/hr), student signup (3/IP/hr), teacher signup (10/IP/hr), R2 presign (20/user/min)
- [ ] Reserved subdomain blocklist (server-side validation)
- [ ] Full end-to-end test pass: signup → onboarding → course → cohort → invite link → student enroll → screenshot → approve → student portal access → attendance → announcement → assignment

**Testable:** Full platform launch-ready. All P1 features working. Explore page live. Fee reminders firing. Waitlist functional. Rate limiting active.

---

## Phase 2: Full Feature Set (Month 2–3)

**Goal:** Integrate payment gateway, reduce manual work, add retention features, automate revenue.

### Payment Gateway (Week 9–10)
- [ ] Real gateway adapter (Safepay or Payfast) — implement `PaymentProvider` interface
- [ ] Set `PAYMENT_GATEWAY=safepay` in env + flip `payment_gateway_enabled=true`
- [ ] Teacher subscription via gateway — auto-renewal, no admin approval needed
- [ ] Student enrollment via gateway — auto-enrollment on webhook confirmation
- [ ] `POST /api/webhooks/payment` — verify signature, idempotency check, process subscription or enrollment
- [ ] Platform cut calculation + atomic balance crediting via `credit_teacher_balance()`
- [ ] Discount code atomic use_count increment via `increment_discount_use()` in webhook
- [ ] `/api/cron/reconcile` — nightly: fetch gateway transactions, compare to DB, flag mismatches
- [ ] Gateway error monitoring (alert admin after N errors in 10 min — `gateway_error_alert` email)
- [ ] Cohort-full race condition handling in webhook: refund + add to waitlist or send `enrollment_refunded_cohort_full` email
- [ ] `refund_debit_recorded` + `refund_debit_recovered` emails for outstanding debit lifecycle

### Earnings + Payouts (Week 10–11)
- [ ] Teacher earnings dashboard — available balance, pending, all-time total, outstanding debit
- [ ] `POST /api/teacher/payouts` — request payout (one active request at a time, balance ≥ min)
- [ ] Admin payout processing queue — see requests, LIVE bank details, process, mark complete/failed
- [ ] `POST /api/admin/payouts/[id]/complete` — snapshot bank details for audit, credit total_paid_out
- [ ] `POST /api/admin/payouts/[id]/fail` — restore available_balance
- [ ] Post-payout refund handling — "Record Offline Refund" flow
- [ ] Outstanding debit recovery — auto-deduct from future earnings via `credit_teacher_balance()`
- [ ] Admin earnings panel — gross collected, platform cuts, payouts processed, net revenue

### Retention Features (Week 11–13)
- [ ] Discount codes per cohort — `POST/PATCH/DELETE /api/teacher/discount-codes`
- [ ] `POST /api/validate-discount` — code validation on payment page
- [ ] Direct messaging — `POST /api/messages/send`, `GET /api/messages/thread`, `POST /api/messages/read` — teacher ↔ student async threads, email notifications, read receipts. Create `direct_messages` table migration.
- [ ] Cohort feedback — `POST /api/cohort/feedback` (student), `GET /api/cohort/feedback` (teacher) — prompted after archive, 1-5 rating + optional comment, teacher-only. Create `cohort_feedback` table migration.
- [ ] Cohort duplication — copy schedule to new cohort (one click)
- [ ] In-app notification bell + history (unread count in nav)
- [ ] Subdomain change flow (PATCH endpoint, 30-day cooldown, confirmation modal, old DNS delete + new create)
- [ ] Google OAuth for teacher login
- [ ] Teacher reviews/testimonials on public page
- [ ] Referral program — `POST /api/referrals/generate`, `POST /api/referrals/convert` — referral link, conversion tracking at signup, 1-month credit after first paid month. Create `referrals` table migration.
- [ ] Progress report PDF generation (@react-pdf/renderer)
- [ ] WhatsApp notifications (Twilio — class reminders, enrollment alerts)

### Admin Enhancements (Week 13–14)
- [ ] Admin: MRR chart (12 months), churn rate %, conversion rate (Free→Paid), ARPU, LTV
- [ ] Admin: bulk email all teachers
- [ ] Admin: view-as teacher (read-only shadow view)
- [ ] Admin: full activity log per teacher
- [ ] Admin emergency password reset (generate recovery link)
- [ ] Admin wipe test account (safety guard on email pattern)
- [ ] Create new plan, archive plan, delete plan (zero-subscriber guard)
- [ ] Plan preview before publishing changes
- [ ] Grandfathered teachers list — filterable table

### Teacher Polish (Week 14–15)
- [ ] Teacher subscription history page (Settings → Billing)
- [ ] Teacher Settings → Plan: full features list (included vs locked), grandfathered badge
- [ ] Course categories and tags (discovery filtering)
- [ ] Curriculum / weekly outline builder (structured syllabus)
- [ ] Free course toggle (fee_pkr = 0)
- [ ] Class rescheduling flow (cancel + create new, notify students)
- [ ] Student parent/guardian contact fields
- [ ] Student progress tracking (classes attended)
- [ ] Private teacher notes per student
- [ ] Teacher analytics: at-risk students (<70% attendance), disengaged (no login 10d), no submissions
- [ ] Teacher analytics: revenue per cohort, projected revenue, cohort completion rate
- [ ] Overdue assignment flagging + second fee reminder (5 days after billing day)
- [ ] Explore page: star ratings on teacher cards (from cohort feedback data)
- [ ] Explore page: city/location filter

---

## Phase 3: DEFERRED — Not Being Built Now

> **This phase is deliberately deferred.** These features are documented in the SaaS Plan for future reference only. Do NOT build any of these until Phase 1 and Phase 2 are fully shipped, the platform is profitable, and the group class model is validated with real users. Revisit scope and priorities at that time — requirements will likely change based on actual user feedback.

- Custom domain per teacher (their own .com)
- Class recordings via Cloudflare R2
- One-on-one session type (availability slots, student booking, per-session fee)
- Parent/guardian portal (K-12 market)
- Certificate of completion (auto-generated PDF)
- Multi-teacher team management (invite flow, shared courses, team roster)
- iCal/Google Calendar export
- Bulk student import via CSV
- Public star ratings on explore page
- R2 orphan cleanup cron
- Advanced admin analytics (Net Revenue Retention, cohort-level performance)
- Performance optimization (pagination at 500+ teachers, edge caching)

---

## Timeline Summary

| Phase | Duration | Outcome |
|-------|----------|---------|
| **Phase 1** | 8 weeks | MVP live — teachers signup, create courses, students enroll via screenshot, admin approves subscriptions |
| **Phase 2** | 6–7 weeks | Payment gateway live, payouts automated, retention features (messaging, referrals, WhatsApp), full admin analytics |
| **Phase 3** | Deferred | Not being built now. Revisit after profitability. |

**Phase 1 launch requires:** Vercel Pro ($20/mo for wildcard SSL), Supabase Free tier, Cloudflare Free tier, Brevo Free tier (300 emails/day). Total: ~Rs. 5,600/mo. Break-even at 3 paying teachers.
