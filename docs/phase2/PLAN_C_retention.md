# Lane C — Retention Features Plan

---

## Current state (audit)

### discount_codes
- **Schema (001_initial_schema.sql line 372):** `id`, `teacher_id`, `cohort_id`, `code text NOT NULL`, `discount_type text NOT NULL` (`fixed` or `percent`), `discount_value int NOT NULL`, `max_uses int` (nullable), `use_count int DEFAULT 0`, `expires_at timestamptz`, `created_at`. No `is_active` flag — deactivation via expiry or max_uses.
- **UNIQUE constraint:** `UNIQUE INDEX idx_discount_codes_cohort_code ON discount_codes(cohort_id, UPPER(code))` — codes are unique per cohort, case-insensitive (003_indexes.sql line 93).
- **RLS (002_rls_policies.sql line 284):** `teachers_manage_own_discount_codes` — teacher sees/edits only their own codes. `cohort_feedback` and `referrals` tables are RLS-enabled but admin-only (no student/teacher policies yet — need adding in migration 011).
- **student_payments columns:** `discount_code_id uuid` (nullable FK), `discounted_amount_pkr int NOT NULL` already present (001 line 192, 202). The payment flow in `lib/actions/enrollments.ts` already passes `discountedAmountPkr` through.
- **Existing code:** No Server Actions or API routes exist yet for discount CRUD or validation. `lib/db/` has no `discount-codes.ts` file. The pay page (`app/(teacher-public)/[subdomain]/join/[token]/pay/[enrollmentId]/page.tsx`) shows `discounted_amount_pkr` but has no discount-code entry UI.

### cohort_feedback
- **Schema (001 line 480):** `id`, `cohort_id uuid FK cohorts`, `student_id uuid FK students`, `rating int CHECK (1–5)`, `comment text nullable`, `created_at`. `UNIQUE(cohort_id, student_id)` — one feedback per student per cohort.
- **Indexes (003 line 1334):** `UNIQUE INDEX ON cohort_feedback(cohort_id, student_id)` + `INDEX ON cohort_feedback(cohort_id)`.
- **RLS:** RLS enabled but **no policies** — only admin (service role) can access. Needs teacher-read and student-insert policies in migration 011.
- **Existing code:** No db helpers, no actions, no UI. ARCHITECTURE.md §14 line 3530 specifies: "After cohort archives, show feedback prompt on next student portal login (once only per cohort)."

### referrals
- **Schema (001 line 493):** `id`, `referrer_teacher_id uuid FK teachers`, `referred_teacher_id uuid FK teachers UNIQUE`, `referral_code text NOT NULL`, `status text DEFAULT 'pending'` (`pending` → `credited`), `credit_applied_at timestamptz`, `created_at`.
- **teachers table:** Has `referral_code text UNIQUE` column (nullable). This is the teacher's personal referral code; the `referrals` table stores the same code per row for audit.
- **Indexes (003 line 1338):** `UNIQUE INDEX ON referrals(referred_teacher_id)` + `INDEX ON referrals(referrer_teacher_id)`.
- **RLS:** Enabled but no policies — admin-only currently. Needs teacher-read-own policy in 011.
- **ARCHITECTURE.md §5 line 1793–1794:** Two API routes specified: `POST /api/referrals/generate` and `POST /api/referrals/convert`. Since generate is teacher-authenticated, use a Server Action. Convert is called at teacher signup (system/server context) so a thin internal Server Action is fine.
- **Existing code:** No db helpers, no actions, no UI. `types/domain.ts` already has `'referral_converted'` EmailType.

### teacher_testimonials
- **MISSING** — not in 001_initial_schema.sql, 002_rls_policies.sql, or 003_indexes.sql. Migration 011 must CREATE this table.

### increment_discount_use() RPC
- **EXISTS** (004_functions.sql line 72). Atomically increments `use_count` with row lock. Returns `TRUE` on success, `FALSE` if expired or at max_uses. Ready to use.

---

## Gaps vs BUILD_PLAN Phase 2 Retention

| Gap | Status |
|-----|--------|
| Discount code CRUD Server Actions | Missing |
| Discount code db layer (`lib/db/discount-codes.ts`) | Missing |
| Discount code validation Server Action (public-callable) | Missing |
| Discount code UI (teacher: manage codes; student: enter code on pay page) | Missing |
| RLS policies for cohort_feedback (teacher read, student insert) | Missing — add in 011 |
| cohort_feedback db layer (`lib/db/feedback.ts`) | Missing |
| cohort_feedback Server Actions | Missing |
| cohort_feedback student prompt (post-archive, one-time) | Missing |
| cohort_feedback teacher view UI | Missing |
| RLS policies for referrals (teacher read own) | Missing — add in 011 |
| referrals db layer (`lib/db/referrals.ts`) | Missing |
| referrals Server Actions (generate, convert, credit) | Missing |
| referrals UI (teacher settings: my referrals) | Missing |
| signup page wires `?ref=` param | Missing |
| teacher_testimonials table | Missing — 011 creates it |
| teacher_testimonials CRUD Server Actions | Missing |
| teacher_testimonials UI (teacher settings + public page render) | Missing |
| discount_code_id uniqueness: validate + link at approval time | Missing — `approve` action must call `increment_discount_use()` |

---

## Migration 011

```sql
-- supabase/migrations/011_retention_tables.sql

-- ============================================================================
-- teacher_testimonials (new table — Lane C owns this)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_role text,
  quote text NOT NULL,
  is_published bool NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for ordered retrieval per teacher
CREATE INDEX idx_teacher_testimonials_teacher_id ON teacher_testimonials (teacher_id, display_order);

-- RLS
ALTER TABLE teacher_testimonials ENABLE ROW LEVEL SECURITY;

-- Teacher manages own testimonials
CREATE POLICY "teachers_manage_own_testimonials"
  ON teacher_testimonials FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- Public read of published testimonials (used by public page — anon key)
CREATE POLICY "public_read_published_testimonials"
  ON teacher_testimonials FOR SELECT
  USING (is_published = true);

-- ============================================================================
-- RLS additions for cohort_feedback (Phase 2 — was admin-only)
-- ============================================================================

-- Teacher reads feedback for their own cohorts
CREATE POLICY "teachers_read_own_cohort_feedback"
  ON cohort_feedback FOR SELECT
  USING (
    cohort_id IN (
      SELECT id FROM cohorts
      WHERE teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid())
    )
  );

-- Student inserts own feedback (one per cohort enforced by UNIQUE constraint)
CREATE POLICY "students_insert_own_feedback"
  ON cohort_feedback FOR INSERT
  WITH CHECK (student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()));

-- Student reads own feedback (to know if they already submitted)
CREATE POLICY "students_read_own_feedback"
  ON cohort_feedback FOR SELECT
  USING (student_id = (SELECT id FROM students WHERE supabase_auth_id = auth.uid()));

-- ============================================================================
-- RLS additions for referrals (Phase 2 — was admin-only)
-- ============================================================================

-- Teacher reads their own referrals (as referrer)
CREATE POLICY "teachers_read_own_referrals"
  ON referrals FOR SELECT
  USING (referrer_teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- Note: referral INSERT and status UPDATE always use service role (server actions
-- with supabaseAdmin) — no client-side insert policy needed.
```

---

## Implementation plan (ordered steps)

### Step 1: Discount codes — db layer + Server Actions
- **Files to CREATE:**
  - `lib/db/discount-codes.ts` — functions: `getDiscountCodesByCohort(cohortId)`, `getDiscountCodeById(id)`, `getDiscountCodeByCohortAndCode(cohortId, code)` (case-insensitive lookup), `createDiscountCode(data)`, `updateDiscountCode(id, data)`, `deleteDiscountCode(id)`
  - `lib/actions/discount-codes.ts` — Server Actions: `createDiscountCodeAction`, `updateDiscountCodeAction`, `deleteDiscountCodeAction`
- **Files to EDIT:** None (additive only)
- **Migration:** N/A (schema + RLS already exist)
- **Key rules:**
  - `createDiscountCodeAction` must call `canUseFeature(teacherId, 'discount_codes')` — reject with `FEATURE_LOCKED` if false
  - `discount_type` must be `'fixed'` or `'percent'`; for `percent`, `discount_value` must be 1–100; for `fixed`, must be > 0 and < cohort.fee_pkr
  - Code must be 6–8 chars uppercase alphanumeric (validate server-side)
  - Teacher ownership check: confirm cohort belongs to this teacher before insert
- **Testable:** Teacher creates/edits/deletes a discount code. Duplicate code on same cohort returns error. Feature-locked teacher is blocked.

---

### Step 2: Discount validation endpoint (public Server Action)
- **Files to CREATE:**
  - `lib/actions/validate-discount.ts` — `validateDiscountAction(cohortId: string, code: string)` Server Action. Returns `{ valid: true, discountedAmountPkr: number, type: string, value: number, codeId: string }` or `{ valid: false, error: string }`.
  - Logic: lookup by `getDiscountCodeByCohortAndCode` → check not expired (`expires_at < now()`) → check max_uses (`use_count >= max_uses` when max_uses not null) → compute `discountedAmountPkr` = `fee_pkr - discount_value` for fixed, `fee_pkr * (1 - discount_value/100)` for percent (floor to int, min 1 PKR) → return result. Does NOT call `increment_discount_use()`.
- **Files to EDIT:** None
- **Migration:** N/A
- **Note:** Server Action is callable from any Client Component on the pay page without needing an API route since it runs on the server. This is the preferred pattern per CLAUDE.md.
- **Testable:** Valid code → returns correct discounted amount. Expired code → `{ valid: false, error: 'Code expired' }`. Max uses reached → `{ valid: false, error: 'Code no longer available' }`.

---

### Step 3: Wire discount code into payment flow
- **Files to EDIT:**
  - `app/(teacher-public)/[subdomain]/join/[token]/pay/[enrollmentId]/page.tsx` — add discount code input field (text input + "Apply" button). On apply, call `validateDiscountAction`. Show "Saving Rs. X" badge. Store `codeId` in local state. Pass `codeId` + `discountedAmountPkr` to `submitScreenshotAction`.
  - `lib/actions/enrollments.ts` (or wherever `submitScreenshotAction` lives) — accept optional `discountCodeId` and `discountedAmountPkr`. Update `student_payments` row with `discount_code_id` and `discounted_amount_pkr`.
  - `app/api/student/enroll/route.ts` — if `discountCode` present in `EnrollInput`, validate server-side (same logic as Step 2) and set `discounted_amount_pkr` on the created payment row + `discount_code_id`. Call `increment_discount_use()` atomically at enrollment approval time (not at submission).
  - `lib/actions/enrollment-management.ts` (approve action) — after setting enrollment `active`, call `increment_discount_use(payment.discount_code_id)` if `discount_code_id` is non-null. If RPC returns `FALSE`, log a warning (code was valid at submission but expired/maxed between submission and approval) — do NOT block approval.
- **Migration:** N/A
- **Testable:** Student enters valid code on pay page → amount shows discounted. Teacher approves → `use_count` increments. Code at max_uses before approval → warning logged, enrollment still approved.

---

### Step 4: Discount code management UI (teacher dashboard)
- **Files to CREATE:**
  - `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/discount-codes/page.tsx` — Server Component. Lists existing codes for cohort, shows "Add Code" button.
  - `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/discount-codes/DiscountCodeForm.tsx` — Client Component. Form: code (auto-uppercase), type (select fixed/percent), value (int), max_uses (optional), expires_at (optional date).
- **Files to EDIT:**
  - `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/edit/page.tsx` — add "Discount Codes" link/tab pointing to the new page.
- **Migration:** N/A
- **Testable:** Teacher navigates to cohort → Discount Codes tab → creates code → appears in list → deletes it.

---

### Step 5: Cohort feedback — db layer + Server Actions
- **Files to CREATE:**
  - `lib/db/feedback.ts` — `submitCohortFeedback(data)`, `getFeedbackByCohort(cohortId)`, `getStudentFeedbackForCohort(cohortId, studentId)` (to check if already submitted)
  - `lib/actions/feedback.ts` — Server Actions: `submitFeedbackAction(cohortId, rating, comment?)`, `getCohortFeedbackAction(cohortId)` (teacher only)
- **Files to EDIT:** None
- **Migration:** 011 (adds RLS policies for cohort_feedback)
- **Key rules:**
  - `submitFeedbackAction`: requires student session → verify student was enrolled in this cohort (any enrollment status) → UNIQUE constraint on DB handles double-submit (catch and return `ALREADY_SUBMITTED`) → cohort must be `status='archived'`
  - `getCohortFeedbackAction`: requires teacher session → verify cohort belongs to teacher
- **Testable:** Enrolled student submits rating for archived cohort → saved. Double-submit → error. Non-enrolled student → blocked. Teacher fetches feedback → sees all ratings + comments.

---

### Step 6: Cohort feedback — student prompt UI
- **Files to EDIT:**
  - `app/(student)/student/payments/page.tsx` — for each enrollment where cohort is `archived` and student hasn't submitted feedback, show a dismissible "How was [Cohort Name]? Rate your experience" card with 1–5 star selector + optional text area + Submit. On submit, call `submitFeedbackAction`. Card disappears after submit (optimistic UI).
- **Files to CREATE:** None (use existing shadcn Dialog or inline card)
- **Migration:** 011 (needed for student RLS policies)
- **Testable:** Student with archived enrollment visits payments page → sees feedback prompt → submits → prompt disappears. Revisit → no prompt (already submitted).

---

### Step 7: Cohort feedback — teacher view UI
- **Files to EDIT:**
  - `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx` — for archived cohorts, add a "Feedback" section at bottom. Shows average rating (e.g., 4.2 / 5 from N reviews) + list of individual feedback rows (rating + comment + date). Server Component fetches via `getFeedbackByCohort`.
- **Migration:** 011
- **Testable:** Teacher with archived cohort visits students page → sees feedback section with ratings.

---

### Step 8: Referrals — db layer + Server Actions
- **Files to CREATE:**
  - `lib/db/referrals.ts` — `getReferralByCode(code)`, `getReferralsByReferrer(teacherId)`, `createReferral(data)`, `updateReferralStatus(id, status, creditAppliedAt?)`, `getTeacherReferralCode(teacherId)` (from `teachers.referral_code`)
  - `lib/actions/referrals.ts` — Server Actions:
    - `generateReferralCodeAction()`: teacher session required. If `teachers.referral_code` already set, return it. Otherwise, generate 6–8 char uppercase alphanumeric code (retry on UNIQUE conflict), `UPDATE teachers SET referral_code = code`, return `{ referralCode, referralUrl: platformUrl('/signup?ref=' + code) }`.
    - `convertReferralAction(referralCode, newTeacherId)`: server/admin context (called from teacher signup Server Action). Lookup teacher by `referral_code`. If found and `newTeacherId != referrerId` and no existing referral row for `newTeacherId`: create `referrals` row `status='pending'`. Idempotent — if row exists, skip.
    - `creditReferralAction(referredTeacherId)`: called from subscription approval Server Action. Find `referrals` row where `referred_teacher_id = referredTeacherId` AND `status='pending'`. Extend BOTH `referrer.plan_expires_at` and `referred.plan_expires_at` by 30 days (if currently NULL/expired, set to `now() + 30 days`; if future, add 30 days). Set `status='credited'`, `credit_applied_at=now()`. Send `referral_converted` email to referrer.
- **Files to EDIT:**
  - Teacher signup flow (wherever new teacher account is created — `app/api/auth/teacher/signup` or equivalent Server Action): after creating teacher row, check `req` for `?ref=CODE` param → call `convertReferralAction`.
  - Subscription approval action (admin approves teacher sub): after `plan_expires_at` is set → call `creditReferralAction(teacher.id)` for the referred teacher's first confirmed paid subscription. Guard: only credit once (`referrals.status != 'credited'`).
- **Migration:** 011 (adds teacher-read RLS policy for referrals)
- **ARCHITECTURE.md §14 line 3524:** "First referral_code in the signup URL wins. Store referral_code in session at signup start." — pass `ref` param through signup form as hidden field.
- **Testable:** Teacher A generates referral link. Teacher B signs up via link → `referrals` row created (pending). Admin approves Teacher B's first subscription → both get +30 days → `status='credited'` → Teacher A gets `referral_converted` email.

---

### Step 9: Referrals — teacher UI
- **Files to CREATE:**
  - `app/(teacher)/dashboard/settings/referrals/page.tsx` — Server Component. Shows: "Your referral link" (generate if not set), list of referrals table (referred teacher name/email, date, status: Pending/Credited).
- **Files to EDIT:**
  - Teacher settings sidebar nav (wherever nav items are defined) — add "Referrals" link under Settings.
- **Migration:** N/A
- **Testable:** Teacher visits Settings → Referrals → sees link and list.

---

### Step 10: Teacher testimonials — migration 011 + db layer + Server Actions
- **Files to CREATE:**
  - `lib/db/testimonials.ts` — `getTestimonialsByTeacher(teacherId)`, `getPublishedTestimonialsByTeacher(teacherId)` (public, no auth), `createTestimonial(data)`, `updateTestimonial(id, data)`, `deleteTestimonial(id)`
  - `lib/actions/testimonials.ts` — Server Actions: `createTestimonialAction`, `updateTestimonialAction`, `deleteTestimonialAction`, `reorderTestimonialsAction`
- **Migration:** 011 (CREATE TABLE teacher_testimonials + RLS)
- **Testable:** Teacher creates a testimonial (not published). Publishes it. Public page shows it. Deletes it.

---

### Step 11: Teacher testimonials — teacher management UI
- **Files to CREATE:**
  - `app/(teacher)/dashboard/settings/testimonials/page.tsx` — Server Component. Lists all testimonials (published + draft). Shows "Add Testimonial" button, publish/unpublish toggle, delete.
  - `app/(teacher)/dashboard/settings/testimonials/TestimonialForm.tsx` — Client Component. Fields: author_name, author_role (optional), quote, is_published toggle.
- **Files to EDIT:**
  - Teacher settings nav — add "Testimonials" link.
- **Testable:** Teacher adds 3 testimonials, publishes 2, reorders them. Draft stays hidden from public.

---

### Step 12: Teacher testimonials — public page render
- **Files to EDIT:**
  - `app/(teacher-public)/[subdomain]/page.tsx` — fetch `getPublishedTestimonialsByTeacher(teacher.id)`. If any, render a "What students say" section below courses, ordered by `display_order`. Each testimonial: quote (blockquote), author_name, author_role.
- **Files to CREATE:** `components/public/TestimonialsSection.tsx` — pure display component, no auth needed.
- **Migration:** N/A (table already created in 011)
- **Testable:** Teacher with published testimonials → public page shows them. Teacher with no published testimonials → section hidden.

---

## Shared code touches (coordination)

| File | Type of touch | Coordination note |
|------|--------------|-------------------|
| Teacher signup Server Action / `POST /api/auth/teacher/signup` | EDIT (additive) | Pass `ref` param through → call `convertReferralAction`. Does not conflict with Lane G (Google OAuth) because `convertReferralAction` is called after the teacher row is created regardless of auth method. Coordinate with Lane G owner to ensure their OAuth signup also calls this. |
| Subscription approval action (admin) | EDIT (additive) | Call `creditReferralAction` after `plan_expires_at` set. Lane H does not touch subscription approval. Safe. |
| `app/(teacher-public)/[subdomain]/page.tsx` | EDIT (additive) | Add testimonials section. Lane G may edit subdomain-change logic but not the public page render. No conflict expected. |
| `app/(student)/student/payments/page.tsx` | EDIT (additive) | Add feedback prompt cards. Phase 1.5 already modified this file. Additive only — do not remove existing monthly payment logic. |
| `app/(teacher-public)/[subdomain]/join/[token]/pay/[enrollmentId]/page.tsx` | EDIT (additive) | Add discount code input. Lane H does not touch this file. |
| `lib/actions/enrollment-management.ts` | EDIT (additive) | Add `increment_discount_use()` call in approve action. Minimal — one conditional call. |
| `app/api/student/enroll/route.ts` | EDIT (additive) | Validate + store discount_code_id on payment row creation. |
| Teacher settings nav items | EDIT | Add "Referrals" and "Testimonials" links. Coordinate with Lane G (subdomain change settings) and Lane H to avoid nav ordering conflicts. |

---

## Open questions for team-lead

1. **Discount at enroll vs at screenshot submit:** ARCHITECTURE.md §7 Flow B (line 1951) says "If discount code entered: POST /api/validate-discount → server validates" at the payment page level, suggesting the code is entered AFTER enrollment is created. The `enroll` route already creates the `student_payments` row with `discounted_amount_pkr`. Should we allow discount code entry before enrollment (passed in `EnrollInput.discountCode`) and validated atomically in `enroll`, or after enrollment on the pay page with a separate update? Current plan: **validate on pay page, update payment row with discount info, call `increment_discount_use` at approval time.** Confirm this is preferred.

2. **Referral code generation format:** ARCHITECTURE.md says 6–8 char uppercase alphanumeric. The `teachers.referral_code` field has `UNIQUE` but no length constraint in DB. Should codes be exactly 6 chars (simpler, matching reference code format) or allow 6–8? Current plan: **6 chars** for consistency with reference codes.

3. **Google OAuth referral wiring:** Lane G owns `POST /api/auth/teacher/signup` and OAuth signup. Lane C needs to hook `convertReferralAction` into both signup paths. Recommend: Lane C defines `convertReferralAction` as an exported Server Action; Lane G imports and calls it in both signup flows. Lane G owner needs to be aware.

4. **`creditReferralAction` trigger timing:** The architecture says "after referred teacher's first confirmed paid month." Subscription approval (admin approves screenshot) is the first confirmation event. Is this correct, or should it trigger after the first gateway payment (Phase 2 gateway)? Current plan: trigger at admin subscription approval, guarded by `status != 'credited'`.

5. **Testimonials `display_order`:** Should the UI support drag-to-reorder (complex) or simple up/down arrows (simple)? Current plan: **up/down arrow buttons** that swap `display_order` values — no drag-and-drop library needed.

6. **Feedback prompt placement:** Plan puts feedback prompt on `student/payments/page.tsx`. Alternative: dedicated banner on student dashboard home. Dashboard home is higher-traffic. Recommendation: **dashboard home** — easier to discover. Awaiting team-lead preference before building.

---

## Answers from team-lead

1. **Approved: validate on pay page, store on payment row, increment at approval.** Don't move it to enroll time — student may not have the code when they click enroll. Plan as written is correct.

2. **6 chars exact, uppercase alphanumeric.** Use safe charset (exclude 0/O, 1/I/L ambiguity) matching reference code format. Retry on UNIQUE conflict (very rare at 6 chars from 30+ char set).

3. **Referral conversion coordination with Lane G.** Lane C exports `convertReferralAction(referralCode, newTeacherId)` as a Server Action. Lane G MUST call it from:
   - `POST /api/auth/teacher/signup` (email+password) — if `?ref=` was in the referrer URL or passed in signup form
   - `app/api/auth/callback/route.ts` (Google OAuth) — when creating a brand-new teacher row via Google, if `?ref=` was threaded through the OAuth flow
   
   I'll update Lane G's brief so the implementer calls this. Lane C's implementer owns defining + exporting the action; Lane G's implementer owns calling it.
   
   For the `?ref=` to survive the Google OAuth round-trip, Lane G needs to append it to the `redirectTo` URL of `signInWithOAuth`. Flag this to implementer-g.

4. **Approved: credit at admin subscription approval.** Fires on first confirmed paid sub. Phase 2 gateway work (not in this batch) will add a second trigger at webhook. Guard with `status != 'credited'` — you already have this.

5. **Up/down arrow buttons for testimonials.** No drag-and-drop. Keep it simple.

6. **Feedback prompt on student dashboard home, not payments page.** Higher traffic, easier to discover. Render as a dismissible card at the top of the student dashboard for each archived cohort with un-submitted feedback. After submit OR dismiss, hide. (Use a cookie or a user_dismissed_feedback_prompts lookup — simplest: cookie `dismissed_feedback_{cohortId}`, 30-day TTL. No new table.)

## Migration 011 ownership confirmed
- Lane C owns migration 011 (teacher_testimonials + RLS additions for cohort_feedback + referrals).
- Lane G: no migration.
- Lane H: no migration expected; if overdue flagging needs one, Lane H gets 012.

## EmailType additions
Lane C adds: `'referral_converted'` already exists in EmailType per your audit (good — no edit needed to types/domain.ts). If you need other new types (e.g., `'cohort_feedback_received'` to email teacher on feedback), flag them now.

## Nav items coordination
Settings → Referrals and Settings → Testimonials are new. Lane G adds Settings → ChangeSubdomainSection (NOT a separate nav item, just a section on the existing Settings page).

- Lane C adds 2 new sub-routes under `/dashboard/settings/`: `referrals` and `testimonials`. If the Settings page is currently a flat single-page, convert the existing Settings to a sidebar-nav structure? NO — too much churn. Instead, add the new pages as distinct routes and link to them from the existing Settings page sidebar links list (not the main app sidebar). If the existing Settings page is split into subsections, add them as nav links in settings-specific navigation. Flag if you need to create a settings sub-nav; otherwise add as link rows on the main settings page.

## Subscription approval file
Lane C touches the subscription approval Server Action — that lives in `lib/actions/admin.ts` (Lane D's territory from batch 1). But Lane D isn't active this batch. Additive edit is fine; implementer-c should use anchor-specific Edit to avoid clobbering. The edit is a single conditional `creditReferralAction(teacher.id)` call after `plan_expires_at` is set.
