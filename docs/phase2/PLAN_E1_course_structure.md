# Lane E1 — Course Structure + Scheduling Polish Plan

Scope: course discovery taxonomy (categories + tags), curriculum/weekly outline builder, free-course (fee_pkr=0) flow polish, and class rescheduling flow with student notifications.

---

## Current state (audit)

### Categories / tags
- `courses.category` (`text nullable`) and `courses.tags` (`text[] default '{}'`) **already exist** in `001_initial_schema.sql:100-101`. Marked "Phase 2 — for discovery filtering."
- `teachers.subject_tags` (`text[]`) and `teachers.teaching_levels` (`text[]`) exist on the teacher row and are surfaced in `lib/db/explore.ts:44`. Explore filters today consume these — NOT course-level.
- No UI to set `courses.category` or `courses.tags`. The course create/edit form (`app/(teacher)/dashboard/courses/new/form.tsx`, `.../[courseId]/edit/form.tsx`) only has title, description, thumbnail, status.
- `components/public/ExploreFilters.tsx` filters by teacher subject_tags + teaching_levels + max fee + open-cohorts toggle. No course-level filter.
- `app/(teacher-public)/[subdomain]/page.tsx` renders `CourseCard` with title/description/thumbnail. No category/tag display.

### Curriculum / outline
- **No table, no UI, no actions.** Nothing in `lib/db/`, `lib/actions/`, `app/(teacher)/dashboard/courses/[courseId]/`. The Phase 2 backlog in ARCHITECTURE.md §3268 references it as "per cohort" but the more reusable model is per-course (one curriculum applies to every cohort of that course).
- ARCHITECTURE.md §13 backlog lists "Curriculum / weekly outline builder (structured syllabus per cohort)" — needs a clarifying decision (see "Open Question" below).

### Free course toggle
- Schema already permits `fee_pkr = 0`. `lib/actions/cohorts.ts:118` and `:286` validate `feePkr >= 0`.
- ARCHITECTURE.md §701 confirms: "`cohorts.fee_pkr = 0` is valid for free courses (no payment page shown, enrollment is immediate). Free course toggle planned for Phase 2."
- **What's broken today** for fee_pkr=0:
  - `app/api/student/enroll/route.ts:271-289` always creates a `student_payments` row with `status = PENDING_VERIFICATION` and `payment_method = SCREENSHOT` — even for fee=0. The student lands on `/join/[token]/pay/[enrollmentId]` and is asked to upload a screenshot of nothing. Enrollment stays `pending` forever.
  - `app/(teacher-public)/[subdomain]/join/[token]/page.tsx:170-174` shows "Fee Rs. 0 one-time" — readable but the CTA button is disabled (`disabled` set on button line 192) because the page doesn't yet have a real Enroll-Now flow wired (the Phase 1 wiring lives elsewhere; we'll need to confirm).
  - Cohort create/edit forms (`.../cohorts/new/form.tsx`, `.../cohorts/[cohortId]/edit/form.tsx`) accept fee=0 silently. There's no explicit "Free" toggle and the billing_day field still appears for monthly+free.
- `cohorts.fee_pkr=0` does **not** prevent platform_cut calc: `confirmPaymentAndCreditBalance` (`lib/actions/student-payments.ts:54`) runs but with discounted=0 → cut=0 → payout=0 → no balance credit. Safe but pointless work.

### Class rescheduling
- `class_sessions.rescheduled_to_id uuid REFERENCES class_sessions(id)` **already exists** in `001_initial_schema.sql:146` (and ARCHITECTURE.md §760 confirms "Phase 2 — points to replacement session when rescheduled").
- No UI button, no server action, no email. `app/.../schedule/session-list.tsx` only offers Cancel today.
- No `rescheduled_from_id` reverse FK — but `rescheduled_to_id` on the original session is enough; the new session can be looked up by querying `class_sessions WHERE rescheduled_to_id = oldId` for reverse traversal (or we add a generated index).
- `EmailType` (`types/domain.ts:25`) has `CLASS_CANCELLED` but **no `CLASS_RESCHEDULED`**. ARCHITECTURE.md §8 table lists `class_cancelled` only. We'll add a new email type.

---

## Decisions (lock these before building)

### D1 — Categories: enum, not free-form
- **Use a fixed enum** stored as a `text` column (`courses.category`) with a small allowed set.
- Reason: free-form invites duplicates ("Maths", "Math", "Mathematics"); enum keeps Explore filter chips stable and lets us seed sensible Pakistan-tutor verticals. Enums also avoid migrating to a join table later.
- Allowed values (initial set; admin-extendable later if needed — out of scope for this lane):
  `'mathematics' | 'science' | 'physics' | 'chemistry' | 'biology' | 'english' | 'urdu' | 'computer_science' | 'business_studies' | 'accounting' | 'economics' | 'islamic_studies' | 'general_knowledge' | 'test_prep' | 'languages' | 'art_music' | 'other'`
- Stored as text (no Postgres enum type — too rigid for SaaS; we want to add categories without migrations). Validation lives in a TypeScript constant in `constants/course-categories.ts`.

### D2 — Tags: free-form, course-level
- `courses.tags text[]` already exists. Free-form, max 5, normalized to lowercase, trimmed, deduped, max 24 chars each.
- Used for fine-grained filter chips in addition to the category enum (e.g. category=mathematics, tag=fsc-1, tag=federal-board).

### D3 — Explore filter consumes BOTH teacher subject_tags AND course category/tags
- Teacher subject_tags stay (already in use, drives top-level chips). We **add** course category as a primary filter facet and course tags as secondary/free-text search.
- For Lane F (explore polish), this means the explore card shows the teacher's most-frequent course category as a primary chip; selecting a category in the filter restricts to teachers who have at least one course in that category.
- `lib/db/explore.ts:getExplorableTeachers` will need a join to `courses` (already touches `cohorts`; one extra join). Lane F will own the actual filter UI changes; this lane only ships the data + Lane F docs the dependency.

### D4 — Curriculum: per-course, not per-cohort
- A curriculum is a property of the course (the syllabus is the same across cohorts). Storing per-cohort would force teachers to re-enter the same outline for every January/March/June batch.
- ARCHITECTURE.md §3268 says "per cohort" but that's a backlog one-liner; we'll override based on the workflow (a teacher running 4 cohorts of "O-Level Maths" doesn't want 4 outlines).
- Table: `course_curriculum_items` keyed by `course_id`.
- Trade-off: a teacher can't customize the outline for a single batch. We accept this for v1 — if we hear demand later we add a `cohort_id` override column.

### D5 — Free cohort = auto-approve, no payment row
- For `cohort.fee_pkr = 0`: enrollment skips both the payment record and the screenshot-upload flow. Status goes straight to `active`.
- Impact on revenue/cuts: zero (the cut is calculated only on confirmed payments). Platform earns nothing from free cohorts — that's by design, they're a lead-gen feature.
- The Phase 1 monthly-fee cron (`app/api/cron/fee-reminders/route.ts`) needs to skip free cohorts (no payment_month rows to chase).

### D6 — Reschedule = cancel old + create new (linked via rescheduled_to_id)
- Two rows: original session gets `cancelled_at = now()` AND `rescheduled_to_id = newSessionId`. New session is a fresh `class_sessions` row inheriting meet_link by default (teacher can override).
- We do NOT mutate `scheduled_at` on the original — auditability matters (a parent should be able to see "this class was originally Mon 5pm, moved to Tue 6pm").
- One new EmailType: `class_rescheduled` (sent to all students enrolled in the cohort with status `active` or `pending` honoring `pending_can_see_schedule`).
- Recurring sessions: rescheduling a single occurrence inside a recurring series only affects that one row. The series rule itself isn't touched. (Bulk reschedule of an entire series is out of scope for Phase 2.)

---

## Open question for team-lead

**OQ1 — Curriculum scope**: ARCHITECTURE.md backlog says "per cohort" but D4 above proposes "per course." If team-lead wants per-cohort (to allow per-batch customization), the migration needs `cohort_id` instead of `course_id` and the UI moves under cohort detail. Default: per-course unless told otherwise. Flag to team-lead in completion message.

---

## Implementation plan (ordered)

### Step 1 — Add course category constant + validation

**Files to CREATE:**
- `constants/course-categories.ts` — `COURSE_CATEGORIES` const array with `{ value, label }` objects, plus `CourseCategory` type and `isValidCourseCategory(v: string)` helper.

**Files to EDIT:**
- `types/domain.ts` — re-export `CourseCategory` for ergonomics.

**Migration:** none (column exists).

**Testable:** Import constant, validate each value, snapshot the list length (17 entries).

---

### Step 2 — Course form: add category select + tags input

**Files to EDIT:**
- `app/(teacher)/dashboard/courses/new/form.tsx` — add a `Select` for category (using `Select` from `components/ui/select`) and a tags input (free-text comma-separated, normalized client-side, max 5).
- `app/(teacher)/dashboard/courses/[courseId]/edit/form.tsx` — same fields, pre-filled.
- `lib/actions/courses.ts` — `createCourseAction` and `updateCourseAction` accept `category` and `tags` from FormData. Validation: category must be in `COURSE_CATEGORIES` or null; tags must be `string[]`, ≤5, each ≤24 chars, lowercased+trimmed+deduped server-side. Reject otherwise.
- `lib/db/courses.ts` — `createCourse(...)` signature takes `category?: string | null` and `tags?: string[]`; `updateCourse` already accepts arbitrary `Record<string, unknown>` so no signature change but the SQL UPDATE writes whichever keys are present.

**UI components:** reuse `components/ui/select` (shadcn primitive) for category. For tags, build a small inline composition using `Input` + `Badge` (no new component file — keep it inline in the two forms; if we end up duplicating logic in 3+ places, extract to `components/teacher/TagInput.tsx` later).

**Edge cases:**
- Empty/blank category → store NULL (treat as "Uncategorized" in UI).
- Tag normalization: lowercase, trim, dedupe, drop empties. If a teacher submits "Math, math, MATH" we store `["math"]`.
- Tag count limit enforced both client-side (UX) and server-side (security).

**Migration:** none.

**Testable:** Create course with category + 3 tags → DB row has expected values. Edit existing course → category/tags preserved on save. Submit tag string with garbage → normalized correctly.

---

### Step 3 — Surface category/tags on public course view

**Files to EDIT:**
- `components/public/CourseCard.tsx` — show category badge (small, top-left over thumbnail) and tag chips below description.
- `app/(teacher-public)/[subdomain]/page.tsx` — pass through `category` + `tags` from `getPublishedCoursesByTeacher` query (already returns full course rows).
- `lib/db/courses.ts:getPublishedCoursesByTeacher` — confirm select includes `category, tags` (likely `select('*')` already does).

**Migration:** none.

**Testable:** Teacher subdomain page renders category badge + tag chips.

---

### Step 4 — Lane F dependency surface (data only)

**Files to EDIT:**
- `lib/db/explore.ts` — extend `ExplorableTeacher` type with `course_categories: string[]` (distinct categories across the teacher's published courses). Modify the cohort fetch step to also pull `courses.category, courses.tags` for the cohort's course (one join). Aggregate distinct category values per teacher into the result.

**Why here, not in Lane F:** the `ExplorableTeacher` shape is shared. Lane F builds the filter UI; this lane ships the data so Lane F isn't blocked.

**Migration:** none (depends only on existing `courses` columns).

**Testable:** `getExplorableTeachers()` returns rows with `course_categories` populated. Verify a teacher with two courses (math + physics) gets `['mathematics','physics']`.

**Dependency note for Lane F:** `course_categories` is now available; the explore filter UI can add a category facet.

---

### Step 5 — Curriculum table migration

**Files to CREATE:**
- `supabase/migrations/012_course_curriculum.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS course_curriculum_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    week_number int NOT NULL CHECK (week_number >= 1),
    title text NOT NULL,
    description text,
    display_order int NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX idx_curriculum_course_order
    ON course_curriculum_items(course_id, display_order);

  ALTER TABLE course_curriculum_items ENABLE ROW LEVEL SECURITY;

  -- Teacher can manage their own course's curriculum
  CREATE POLICY curriculum_teacher_rw ON course_curriculum_items
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM courses c
        JOIN teachers t ON t.id = c.teacher_id
        WHERE c.id = course_curriculum_items.course_id
          AND t.supabase_auth_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM courses c
        JOIN teachers t ON t.id = c.teacher_id
        WHERE c.id = course_curriculum_items.course_id
          AND t.supabase_auth_id = auth.uid()
      )
    );

  -- Public read for published courses (so students/visitors see the outline)
  CREATE POLICY curriculum_public_read ON course_curriculum_items
    FOR SELECT TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1 FROM courses c
        WHERE c.id = course_curriculum_items.course_id
          AND c.status = 'published'
          AND c.deleted_at IS NULL
      )
    );
  ```

**Why ON DELETE CASCADE:** if a teacher hard-deletes a course (rare; we soft-delete via `deleted_at`), curriculum items go with it. For soft delete the items remain harmlessly orphaned-by-status — public read policy already filters by `deleted_at IS NULL`.

**Why both `week_number` AND `display_order`:** week_number is the human label ("Week 3"); display_order is the canonical sort key (so teachers can reorder mid-course without re-numbering weeks). Two cohorts could legitimately have items at week 3 in different orders if we ever add per-cohort overrides — keeping them separate now avoids painful migration later.

**Testable:** Apply migration. INSERT a row as a teacher (RLS allows). SELECT as anon for a published course (allowed); for a draft course (denied).

---

### Step 6 — Curriculum DB helpers

**Files to CREATE:**
- `lib/db/course-curriculum.ts`:
  - `type CurriculumItem` mirrors the table row.
  - `getCurriculumByCourse(courseId: string): Promise<CurriculumItem[]>` — ordered by `display_order asc`.
  - `createCurriculumItem(input: { courseId, weekNumber, title, description?, displayOrder })` returns the row.
  - `updateCurriculumItem(itemId: string, courseId: string, updates: Partial<{ weekNumber, title, description, displayOrder }>)` — verifies course ownership via RLS.
  - `deleteCurriculumItem(itemId: string, courseId: string)` — hard delete.
  - `reorderCurriculumItems(courseId: string, orderedIds: string[])` — single transaction, sets `display_order = index` for each ID. Use service role + a Postgres CTE/UPDATE FROM (avoids N round trips). If too complex, ship N updates inside a single client request (acceptable; reorder is rare).

**Migration:** none beyond Step 5.

**Testable:** CRUD round-trip + reorder verifies ordering.

---

### Step 7 — Curriculum server actions

**Files to CREATE:**
- `lib/actions/course-curriculum.ts`:
  - `createCurriculumItemAction(courseId, formData)` — auth + ownership + `checkPlanLock` + `cohort.status` not relevant (course-level). Validate week_number >=1, title 2-120 chars, description ≤2000 chars.
  - `updateCurriculumItemAction(itemId, courseId, formData)` — same validation. Re-verify the item belongs to the given course (defense in depth).
  - `deleteCurriculumItemAction(itemId, courseId)` — auth + ownership.
  - `reorderCurriculumItemsAction(courseId, orderedIds: string[])` — auth + ownership.

**Pattern:** match `lib/actions/courses.ts` style — `getAuthenticatedTeacher`, ownership check via `getCourseById`, return `ApiResponse`.

**Plan-lock:** all four actions call `checkPlanLock(teacher)` and return `getPlanLockError()` on lock.

**Testable:** Each action rejects unauthenticated, wrong-teacher, locked-plan calls. Happy path persists.

---

### Step 8 — Curriculum builder UI (teacher)

**Files to CREATE:**
- `app/(teacher)/dashboard/courses/[courseId]/curriculum/page.tsx` — Server Component. Auth + ownership + fetch `getCurriculumByCourse`. Renders `CurriculumBuilder` client component with initial items. Uses `PageHeader` with backHref to `cohort detail`.
- `app/(teacher)/dashboard/courses/[courseId]/curriculum/curriculum-builder.tsx` — Client Component. List view of items with drag handles (use simple up/down buttons for v1 — drag-and-drop libraries are a tax we don't need to pay yet). Inline "Add Week" button opens a small inline form (or a `Dialog`). Edit/delete buttons per row. Calls the server actions; uses `toast` + `useUIContext.confirm` for delete.

**Files to EDIT:**
- `app/(teacher)/dashboard/courses/[courseId]/page.tsx` — add a "Curriculum" card link alongside existing manage links. (Need to confirm this page exists; if there's no course detail page yet outside cohorts, attach the link to `cohorts/[cohortId]/page.tsx` quick-links.)
- `constants/routes.ts` — add `ROUTES.TEACHER.courseCurriculum(courseId)`.

**UI components used:**
- `Card`, `Button`, `Input`, `Label`, `Textarea`, `Dialog` (or inline form), `EmptyState`.
- No new shadcn install needed.

**Edge cases:**
- Empty state: "No outline yet" with prominent "Add first week" button.
- Reorder: optimistic update on client (move row in state immediately), rollback toast on server error.
- Long descriptions: render with `whitespace-pre-line` so teachers can use line breaks. Don't add a rich text editor — keep it plain for v1.
- Plan-locked teacher sees the page but all action buttons disabled with `getPlanLockError` toast on click (consistent with existing pages).

**Testable:** Create a 3-item curriculum, reorder, edit titles, delete one, verify DB matches UI.

---

### Step 9 — Curriculum public view (student + visitor)

**Files to EDIT:**
- `app/(teacher-public)/[subdomain]/page.tsx` — for each `CourseCard`, link to a course detail subpage (or render an "Outline" expandable section inline). For v1, **inline** is simpler: pass `curriculum` to `CourseCard` and render below the description.
- `components/public/CourseCard.tsx` — accept optional `curriculum: CurriculumItem[]`; if non-empty, render a "What you'll learn" section listing weeks + titles (collapsed initially, expandable on click for performance with long outlines).
- `lib/db/courses.ts:getPublishedCoursesByTeacher` — extend to also fetch curriculum items per course (single query: `SELECT ... courses.*, course_curriculum_items(*)` with Supabase nested select). Returns `course & { curriculum: CurriculumItem[] }`.

**Edge cases:**
- A course with zero curriculum items: render nothing (no "Coming soon" placeholder — that adds noise).
- Curriculum on the student's enrolled-course view (`app/(student)/student/courses/[enrollmentId]/page.tsx`) — out of scope for this lane unless trivial. Defer to E2 if it adds friction. (Decision: inline a simple read-only outline section if it fits in <30 LOC; otherwise defer.)

**Testable:** Public visit to teacher subdomain shows curriculum under each course.

---

### Step 10 — Free cohort UI: explicit toggle

**Files to EDIT:**
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/new/form.tsx`:
  - Add "Free course" `Checkbox` (use `components/ui/checkbox`) above the fee fields.
  - When checked: hide fee_type (force `one_time`), hide fee_pkr, hide billing_day. Set those FormData values to `one_time` / `0` / null on submit.
  - Add muted helper text under the toggle: "Free cohorts skip payment — students enroll instantly. You won't earn from this cohort."
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/edit/form.tsx`:
  - Same toggle. **Lock** the toggle if `confirmedEnrollmentCount > 0` (analogous to the existing fee_type lock) — switching free↔paid mid-cohort breaks billing semantics for already-enrolled students.
  - If currently free (`fee_pkr === 0` && `fee_type === 'one_time'`), pre-check the toggle and hide the fee inputs.

**Files to EDIT (validation):**
- `lib/actions/cohorts.ts:createCohortAction` — when fee=0, force `fee_type='one_time'` and `billing_day=null` server-side regardless of what the form sent. Reject `fee=0` + `fee_type='monthly'` (no monthly free cohorts; doesn't make sense).
- `lib/actions/cohorts.ts:updateCohortAction` — same forcing. Add to the existing fee_type lock check: if changing fee_pkr from 0 to >0 or vice versa AND there are confirmed enrollments, reject with code `FREE_TOGGLE_LOCKED`.

**Migration:** none.

**Testable:** Create free cohort, edit, toggle free off → blocked when enrollments exist.

---

### Step 11 — Free cohort enrollment flow (auto-approve, no payment)

**Files to EDIT:**
- `app/api/student/enroll/route.ts`:
  - After step 11 ("enrolled" RPC result) — branch on `cohort.fee_pkr === 0`:
    - Create enrollment with `status='active'` directly (skip 'pending').
    - **Do NOT** create a `student_payments` row at all (the Phase 1 logic that creates a row even when the result is "enrolled" is at lines 271-289 — wrap in `if (cohort.fee_pkr > 0)`).
    - Skip the screenshot upload page redirect; instead respond with `{ status: 'active' }` so the client redirects to the student dashboard or course page directly.
- `app/(teacher-public)/[subdomain]/join/[token]/page.tsx:170-198`:
  - Re-enable the Enroll button (the disabled state on line 192 looks like a Phase 1 stub).
  - When `cohort.fee_pkr === 0`: change CTA copy from "Enroll Now" to "Join for free", and skip the `/pay/[enrollmentId]` redirect on the client side (handled by the API response, but tighten the UX too).
  - Below the fee row, when fee=0, show a subtle "Free — no payment required" line in place of the discount/payment hint.
- `app/(teacher-public)/[subdomain]/join/[token]/pay/[enrollmentId]/page.tsx`:
  - If the enrollment's cohort is free, redirect to the student dashboard (defensive — the API shouldn't send the user here, but a manual URL paste should not show a confusing screenshot form).

**Email:**
- For free enrollments, still send `enrollment_confirmed` to the student (already sent from the approval flow today; we reuse the same sendEmail call but it now happens at the moment of enrollment, not at admin approval).
- Send `new_enrollment_notification` to the teacher (same as paid enrollments).

**Audit checklist (what breaks for fee=0):**
| Surface | Impact | Action |
|---|---|---|
| `app/api/cron/fee-reminders/route.ts` | Iterates cohorts, may try to send reminders for free cohorts | EDIT: add `WHERE fee_pkr > 0` to the cron query |
| `app/(teacher)/dashboard/earnings/page.tsx` | Free enrollments show as 0 income — already correct | No change |
| `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx` | Student row may show "no payment" status | EDIT: render "Free" badge for free-cohort enrollments instead of "No payment" |
| Withdrawal/refund flow | Free enrollment has no payment → refund button must hide | EDIT: hide refund button when `payment === null` |
| Discount codes for free cohort | Pointless | EDIT: discount-code page shows banner "Free cohort — codes inactive" |
| `confirmPaymentAndCreditBalance` | Never called for free → safe | No change |

**Testable:** Student joins free cohort → status=active immediately, no payment row, no screenshot prompt, dashboard shows enrolled.

---

### Step 12 — Class rescheduling: email type + template

**Files to EDIT:**
- `types/domain.ts` — add `CLASS_RESCHEDULED: 'class_rescheduled'` under "Class reminders" group.
- `lib/email/sender.ts` — extend `buildSubject` and `buildHtmlContent` switches to handle `class_rescheduled`. Subject: `${platformName} — Class Rescheduled`. Body: cohort name, original time (PKT, formatted), new time (PKT, formatted), meet_link (in case it changed), teacher name, reason (optional).

**Migration:** none.

**Testable:** Call `sendEmail({ type: 'class_rescheduled', ... })` with mock data → builds correct subject/HTML.

---

### Step 13 — Reschedule server action

**Files to EDIT:**
- `lib/actions/class-sessions.ts` — add `rescheduleSessionAction(sessionId, formData)`:
  - Auth + ownership + plan-lock + cohort-not-archived (same guards as `cancelSessionAction`).
  - Validate `new_scheduled_at` (required, must be in the future) and optional `new_meet_link` (defaults to original) and optional `reason` (≤500 chars).
  - Reject if `session.cancelled_at !== null` or `session.rescheduled_to_id !== null` (already cancelled/rescheduled).
  - In a single block: insert new session row (mirror `createSession` with `is_recurring=false, recurrence_rule=null`), then UPDATE original `class_sessions` row with `cancelled_at = now(), rescheduled_to_id = newSessionId, updated_at = now()`. If both succeed, send `class_rescheduled` email + in-app notification to all enrolled students (active + pending where `pending_can_see_schedule`).
  - Use `lib/db/class-sessions.ts:createSession` + a new helper `markSessionRescheduled(oldId, newId)` (UPDATE-only).
- `lib/db/class-sessions.ts` — add `markSessionRescheduled(oldId: string, newId: string): Promise<ClassSessionRow | null>`.

**Atomicity note:** We don't have a Postgres function for this and the two writes are independent. Risk: insert succeeds, update fails → orphaned new session. Mitigation: if the UPDATE fails, we soft-delete the new row (`deleted_at = now()`). Acceptable for v1 — true atomicity requires an RPC and the failure mode is rare.

**Email recipients query:** reuse the join pattern from `getUpcomingSessionsByStudent` — fetch enrollments for `cohort_id` with `status in ('active', 'pending')`, filter pending by `cohort.pending_can_see_schedule`, then look up student emails via `lib/db/students.ts`.

**Testable:** Reschedule a session → original is cancelled with `rescheduled_to_id` populated, new session exists, students receive email.

---

### Step 14 — Reschedule UI

**Files to EDIT:**
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/session-list.tsx` — add a "Reschedule" button next to "Cancel" (only for future, non-cancelled, non-already-rescheduled sessions, non-archived cohort).
- `components/teacher/SessionCard.tsx` — accept optional `rescheduleButton` slot mirroring `cancelButton`.

**Files to CREATE:**
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/RescheduleDialog.tsx` — Client Component. `Dialog` wrapping a small form: date input, time input, optional new meet link (default current), optional reason textarea. Submit calls `rescheduleSessionAction`. On success: toast "Session rescheduled. {N} students notified." and `router.refresh()`.

**UI behavior on rescheduled sessions:**
- Original session card renders with a muted "Rescheduled to {newDate}" label below the time, and the cancel/reschedule buttons disappear.
- The new session card renders normally and shows "Rescheduled from {oldDate}" (lookup via `class_sessions WHERE id = original.rescheduled_to_id`). For v1 we can skip the back-link UI if it's expensive — the email does the heavy lifting.

**Edge cases:**
- Reschedule a session inside a recurring series: only the one occurrence moves. Add a small note in the dialog: "This will only reschedule this single session, not the recurring series."
- New time in the past: rejected server-side AND blocked client-side via min attribute on date input.
- Cohort archived between dialog open and submit: server-side guard returns `COHORT_ARCHIVED`; surface the error toast.
- If a session has already been rescheduled once (`rescheduled_to_id != null`), the button is hidden.

**Testable:** Open dialog, pick new datetime, submit → original cancelled, new appears, email sent. Try rescheduling an already-rescheduled session → button absent.

---

### Step 15 — Student view: rescheduled session display

**Files to EDIT:**
- `lib/db/class-sessions.ts:getUpcomingSessionsByStudent` — already filters `cancelled_at IS NULL`, so the original cancelled session naturally drops out. The new session appears via its own row. No change needed for the upcoming list.
- `app/(student)/student/schedule/page.tsx` (or wherever upcoming sessions render — confirm path during build) — optional: show a subtle "Rescheduled" badge on sessions where `rescheduled_from_id` lookup returns a hit. **Defer this** unless there's leftover budget; the email + the new session showing up is sufficient signal.

**Migration:** none.

**Testable:** Student dashboard upcoming list reflects the new time after reschedule; no duplicate.

---

## File summary

### Create
- `constants/course-categories.ts`
- `supabase/migrations/012_course_curriculum.sql`
- `lib/db/course-curriculum.ts`
- `lib/actions/course-curriculum.ts`
- `app/(teacher)/dashboard/courses/[courseId]/curriculum/page.tsx`
- `app/(teacher)/dashboard/courses/[courseId]/curriculum/curriculum-builder.tsx`
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/RescheduleDialog.tsx`

### Edit
- `types/domain.ts` (CourseCategory re-export, add `CLASS_RESCHEDULED`)
- `lib/db/courses.ts` (createCourse signature, getPublishedCoursesByTeacher curriculum nesting)
- `lib/db/class-sessions.ts` (add `markSessionRescheduled`)
- `lib/db/explore.ts` (add `course_categories` to ExplorableTeacher)
- `lib/actions/courses.ts` (category + tags handling in create/update)
- `lib/actions/cohorts.ts` (free cohort forcing + lock check)
- `lib/actions/class-sessions.ts` (add `rescheduleSessionAction`)
- `lib/email/sender.ts` (class_rescheduled subject + body)
- `constants/routes.ts` (add `courseCurriculum` route)
- `app/(teacher)/dashboard/courses/new/form.tsx` (category + tags)
- `app/(teacher)/dashboard/courses/[courseId]/edit/form.tsx` (category + tags)
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/new/form.tsx` (free toggle)
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/edit/form.tsx` (free toggle + lock)
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/schedule/session-list.tsx` (reschedule button)
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx` (curriculum manage link)
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx` (free cohort badge, hide refund)
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/discount-codes/page.tsx` (free cohort banner)
- `app/(teacher-public)/[subdomain]/page.tsx` (curriculum on course cards)
- `app/(teacher-public)/[subdomain]/join/[token]/page.tsx` (free CTA)
- `app/(teacher-public)/[subdomain]/join/[token]/pay/[enrollmentId]/page.tsx` (defensive redirect for free)
- `app/api/student/enroll/route.ts` (free auto-approve branch)
- `app/api/cron/fee-reminders/route.ts` (skip free cohorts)
- `components/public/CourseCard.tsx` (category badge + tags + curriculum)
- `components/teacher/SessionCard.tsx` (rescheduleButton slot)

---

## Email triggers added

| Trigger | Type | Recipients | Channel |
|---|---|---|---|
| Teacher reschedules a class session | `class_rescheduled` | Enrolled students (active + pending honoring `pending_can_see_schedule`) | Email + in-app notification |

---

## Build order + dependencies

1. **Step 1-3** (categories + tags) — independent, can ship first.
2. **Step 4** (explore data) — depends on 1-3; unblocks Lane F.
3. **Step 5-9** (curriculum) — independent of 1-4 mechanically; can run in parallel.
4. **Step 10-11** (free cohort) — independent of curriculum; touches enrollment API.
5. **Step 12-15** (rescheduling) — independent; new EmailType is additive.

Internal-to-this-lane: 12 must precede 13 (action references the email type); 13 must precede 14 (UI calls action).

---

## Edge cases consolidated

- **Archived cohort:** all server actions in this lane already gate on `cohort.status === 'archived'` → return `COHORT_ARCHIVED`. Curriculum is course-level, so cohort archival doesn't affect it. Free toggle / reschedule explicitly blocked on archive.
- **Confirmed enrollments locking edits:** existing fee_type/billing_day lock pattern extended to free toggle.
- **Plan-locked teacher:** every new action calls `checkPlanLock` first.
- **Concurrent reschedule of same session:** second call sees `rescheduled_to_id != null` and rejects.
- **Recurring series + reschedule:** only the single occurrence moves; series itself untouched. Documented in dialog copy.
- **Free cohort + monthly fee_type:** rejected server-side (D5 decision).
- **Free cohort + discount codes:** UI hides/disables; server actions for code creation should reject if `cohort.fee_pkr === 0` (defensive — minor edit to `lib/actions/discount-codes.ts`).
- **Curriculum on a draft course:** RLS public-read policy denies; only the owning teacher sees it until published.
- **Tag normalization collisions:** `["Math", "math"]` collapses to `["math"]`; no error, just dedupe.
- **Category enum drift:** if we ever add a category, existing rows stay valid (text column). Removed values would orphan existing rows — for v1 we treat the enum as append-only.

---

## Out of scope

- Drag-and-drop reorder for curriculum (use up/down buttons; revisit after user feedback).
- Per-cohort curriculum override (D4 decision).
- Bulk reschedule of an entire recurring series (single-occurrence only).
- Re-rescheduling an already-rescheduled session (would create a chain — defer).
- Rescheduling a cancelled session (the cancel is final; teacher creates a new session manually).
- Curriculum on the enrolled-student dashboard (deferred unless trivial — see Step 9).
- Admin-managed category list (hardcoded enum suffices for launch).
- Custom Postgres RPC for atomic reschedule (mitigation in Step 13 is acceptable).
