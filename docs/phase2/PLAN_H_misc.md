# Lane H — Misc Crons + PDFs + Cohort Duplication Plan

---

## Current state (audit)

### Cohort duplication
- No `duplicateCohortAction` exists anywhere in `lib/actions/cohorts.ts`.
- `lib/db/cohorts.ts` has `createCohort()` which we can call directly; no rrule stored on the cohort row itself — rrule lives on individual `class_sessions` rows (`recurrence_rule` column). The cohort row has no rrule template column.
- The cohort detail page (`app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx`) has an action area with Edit + StatusBadge; the Duplicate button will slot in next to Edit.

### Progress report PDF
- `@react-pdf/renderer` is NOT in `package.json` (confirmed: only pdf-related package found is none; `rrule` is present at `^2.8.1`).
- No `/api/teacher/progress-report/` route exists.
- `lib/db/assignments.ts` has `getOverdueSubmissions(cohortId)` and `getSubmissionCountsByAssignment()` — useful for the PDF data.
- `lib/db/class-sessions.ts` has `getSessionsByCohort()` which includes `cancelled_at`.
- Attendance data is in `attendance` table (existing `lib/db/attendance.ts` presumably).

### Overdue assignment flagging
- `lib/db/assignments.ts` already has `getOverdueSubmissions(cohortId): OverdueStudent[]` — full implementation exists.
- `assignment-list.tsx` already renders `{assignment.overdueCount} overdue` in red text when > 0.
- The assignments page (`app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/assignments/page.tsx`) must be populating `overdueCount` — need to verify it passes per-student overdue breakdown for the student detail page (it currently aggregates only).
- Per-student overdue breakdown on the per-student page: not yet wired (no per-student page references `getOverdueSubmissions` filtered to one student).

### Second fee reminder
- `app/api/cron/fee-reminders/route.ts` fires a single reminder 3 days before `billing_day`.
- No `fee_reminder_overdue` email type exists in `types/domain.ts` (`EmailType.FEE_REMINDER = 'fee_reminder'` is the only one).
- `notifications_log` table has columns: `recipient_type`, `recipient_id`, `type`, `channel`, `status`, `metadata`, `sent_at` — sufficient for idempotency check with `type` + `metadata` (billing_month + student_id).
- `TIMING` constant in `constants/plans.ts` already has `FEE_REMINDER_DAYS_BEFORE: 3` and `MAX_BILLING_DAY: 28`; we add a `FEE_REMINDER_OVERDUE_DAYS_AFTER: 5` constant there.

---

## Gaps vs BUILD_PLAN

| BUILD_PLAN item | Gap |
|---|---|
| Cohort duplication (Phase 2 Retention) | No action, no UI button, no DB helper |
| Progress report PDF (Phase 2 Retention) | No route, no renderer dep, no PDF component |
| Overdue assignment flagging (Phase 2 Teacher Polish) | DB helper exists; per-student page not wired; badge in assignment list is present |
| Second fee reminder 5 days after billing_day (Phase 2 Teacher Polish) | Not in cron; EmailType missing; TIMING constant missing |

---

## npm deps to add

- `@react-pdf/renderer` — latest stable at time of install. Run: `npm install @react-pdf/renderer`
  - Note: `@react-pdf/renderer` renders entirely on the server (Node.js canvas); no browser bundle concern for an API route.
  - Add `@types/react-pdf` if a `@types` package exists; otherwise types are bundled.

---

## Implementation plan (ordered steps)

---

### Step 1: Cohort duplication

**Files touched:** `lib/db/cohorts.ts`, `lib/actions/cohorts.ts`, `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx`, `constants/routes.ts` (if needed).

#### 1a — DB helper: `duplicateCohort()` in `lib/db/cohorts.ts`

Add after `archiveCohort`:

```ts
export async function duplicateCohort(
  sourceCohortId: string,
  teacherId: string,
): Promise<CohortRow | null>
```

Logic:
1. Fetch source cohort with `getCohortById(sourceCohortId)`. Verify `teacher_id === teacherId`; return null if not.
2. Insert a new cohorts row with:
   - `teacher_id`: same
   - `course_id`: same
   - `name`: `${source.name} (copy)`
   - `fee_type`: same
   - `fee_pkr`: same
   - `billing_day`: same
   - `max_students`: same
   - `pending_can_see_schedule`: same
   - `pending_can_see_announcements`: same
   - `waitlist_enabled`: same
   - `is_registration_open`: `false` (copy starts closed; teacher opens when ready)
   - `status`: `'draft'` (new status — teacher must set dates and publish)
   - `start_date`: `null` (teacher sets this)
   - `end_date`: `null` (teacher sets this)
   - `invite_token`: `crypto.randomUUID()` (always regenerate)
   - `archived_at`: `null`, `deleted_at`: `null`
3. Return the new row.

**Schema note:** `cohorts.status` is currently used as `'draft' | 'upcoming' | 'active' | 'archived'`. Draft is already a valid `CohortStatus` per `types/domain.ts` — confirm before inserting. If `start_date` / `end_date` are `NOT NULL` in the DB schema, use today + 1 day as a placeholder (teacher must update before going live) rather than null.

> **Risk:** Check `001_initial_schema.sql` for NOT NULL constraints on `start_date`/`end_date` before implementing. If NOT NULL, insert a placeholder date `'2099-01-01'` with a clear status `'draft'` so teacher knows to update.

**Class sessions:** Per the task brief, the copy is a "template fork" — no session rows are generated at duplication time. Session rows are generated when the teacher opens the schedule tab and saves a schedule. This is already how new cohorts work (schedule is configured post-creation). No extra logic needed.

#### 1b — Plan limit enforcement in `duplicateCohortAction()`

Add `duplicateCohortAction(cohortId: string): Promise<ApiResponse<{ cohortId: string; inviteToken: string }>>` in `lib/actions/cohorts.ts`:

1. Auth: `getAuthenticatedTeacher()` — return error if null.
2. Plan lock: `checkPlanLock(teacher)` — return `getPlanLockError()` if locked.
3. Fetch source cohort; verify ownership.
4. Plan limit check: `countActiveCohorts(teacher.id)` vs `getLimit(teacher.id, 'max_cohorts_active')`.
   - Draft status cohorts do NOT count toward active limit (per architecture: only `active` status and `upcoming` with `start_date <= today` count). So duplicating to `draft` does not consume a slot — but add the check anyway for safety so that when the teacher sets start_date and status changes, they won't be surprised.
   - Actually skip the limit check here since draft doesn't count; add a note in the UI that activating will count toward the limit.
5. Call `duplicateCohort(cohortId, teacher.id)`.
6. Return `{ cohortId: newCohort.id, inviteToken: newCohort.invite_token }`.

#### 1c — UI: Duplicate button on cohort detail page

In `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx`:

- Import `duplicateCohortAction` from `@/lib/actions/cohorts`.
- Add a Client Component button (or use a form with Server Action) in the header action area alongside the Edit button.
- Pattern: a `<form action={...}>` with a hidden `cohortId` input and a submit button labeled "Duplicate". On success, `router.push` to the new cohort's edit page (`ROUTES.TEACHER.cohortEdit(courseId, newCohortId)`).
- Use `useTransition` or a simple loading state. Show toast on error.
- Button is visible regardless of archived status (duplicating an archived cohort to a fresh draft is valid and intentional — teacher wants to run the same cohort again).

**Test criteria:**
- Click Duplicate → new cohort created with name `"X (copy)"`, status `draft`, new invite_token.
- Redirected to new cohort's edit page where teacher sets start/end dates.
- Original cohort untouched.
- Archived cohort can also be duplicated (intentional).

---

### Step 2: Progress report PDF generation

**Files touched:** `app/api/teacher/progress-report/[enrollmentId]/route.ts` (new), `lib/db/attendance.ts` (read existing), `lib/db/assignments.ts` (read existing), `lib/db/enrollments.ts` (read existing).

#### 2a — npm install

```bash
npm install @react-pdf/renderer
```

Add to `package.json` dependencies. No PostCSS or Tailwind integration needed — PDF styles use `StyleSheet.create()` from `@react-pdf/renderer`.

#### 2b — API route: `GET /api/teacher/progress-report/[enrollmentId]`

File: `app/api/teacher/progress-report/[enrollmentId]/route.ts`

Auth: Use `createAdminClient()` on server. Auth check: require teacher session via Supabase cookie — call `createClient()` (async SSR client), `supabase.auth.getUser()`, then look up teacher. Verify the enrollment belongs to one of this teacher's cohorts.

Data fetching (all server-side, no client):
1. Fetch enrollment → student name, cohort name, cohort dates, fee_type.
2. Fetch teacher name from `teachers` table.
3. Fetch all non-cancelled class sessions for cohort: `getSessionsByCohort(cohortId)` → filter `cancelled_at IS NULL` for denominator; count total sessions and non-cancelled sessions.
4. Fetch attendance for this student in this cohort (from `attendance` table — `student_id + cohort_id` or via session IDs).
5. Fetch all assignments for cohort + submission status for this student: use `getAssignmentsByCohort()` + `getSubmissionsByStudentForCohort()`.
6. For monthly cohorts: fetch `student_payments` for this enrollment ordered by `payment_month`; compute paid/overdue months using `monthlyBillingSchedule`.

PDF content (using `@react-pdf/renderer`):
- Header: Platform name "Skool Rooms", date generated (PKT).
- Student: name, cohort name, course name, teacher name.
- Period: cohort start_date → end_date.
- Attendance: "Attended X of Y sessions" (Y = non-cancelled total).
- Assignments: total assigned, submitted, reviewed, overdue count.
- Payment status (monthly only): list of months with status (Paid / Pending / Overdue).
- Simple monochrome design — no brand colors needed (keep PDF readable on print).

Response:
```ts
const pdfBuffer = await renderToBuffer(<ProgressReportDocument ... />)
return new NextResponse(pdfBuffer, {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="progress-report-${studentName}.pdf"`,
  },
})
```

Use `renderToBuffer` from `@react-pdf/renderer` (Node.js server-side render — synchronous-ish via Promise).

#### 2c — UI: Download Report button

**Location 1:** Teacher cohort students page (`app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx`) — add a "Download Report" link button on each active enrollment row. This is a plain `<a href="/api/teacher/progress-report/{enrollmentId}" target="_blank">` — no JS needed, browser handles the download.

**Location 2:** Per-enrollment row inside `EnrollmentPaymentsModal.tsx` (already exists as a new file in git status) — add a small "Progress Report" link at the bottom of the modal.

No client state needed — anchor tag triggers a GET download directly.

**Test criteria:**
- Click "Download Report" for an active enrollment.
- Browser downloads a PDF named `progress-report-StudentName.pdf`.
- PDF contains correct student name, cohort name, attendance counts, assignment summary.
- Returns 401 if called by a different teacher's session.
- Returns 404 if enrollment doesn't belong to this teacher's cohort.

---

### Step 3: Overdue assignment flagging

This is largely already done in the codebase. The gap is the per-student page view.

#### 3a — Verify existing assignment list badge (no change needed)

`assignment-list.tsx` line 127–129 already renders `{assignment.overdueCount} overdue` in red. The `overdueCount` is populated in the assignment page server component via `getSubmissionCountsByAssignment()`. **No change needed here** — it's already working.

#### 3b — Per-student overdue list on cohort students page

**Location:** `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx`

Current state: lists active students with payment status. Does not show per-student overdue assignments.

**Addition:** For each active enrollment row, compute how many assignments are overdue for that student. This requires a per-student overdue count.

**New DB helper in `lib/db/assignments.ts`:**
```ts
export async function getOverdueCountByStudent(
  cohortId: string,
  studentId: string,
): Promise<number>
```
Logic: query past-due assignments for the cohort, then count how many lack a submission from this student. This is a subset of the existing `getOverdueSubmissions()` — filter by `student_id`.

**UI change:** Add a small badge column "Overdue" to the active students table. If `overdueCount > 0`, render a red `StatusBadge` or inline `<span>` with `N overdue`. If 0, render nothing (no clutter).

**Performance note:** Fetching per-student overdue counts N times in a loop is an N+1 query. Instead, call `getOverdueSubmissions(cohortId)` once (already returns all overdue student records), then group by `student_id` in JS to build a `Map<studentId, number>`. Pass this map into the student rows. This avoids any new DB calls.

Implementation:
1. In `students/page.tsx`, call `getOverdueSubmissions(cohortId)` once after fetching enrollments.
2. Build `const overdueByStudent = new Map<string, number>()` from the result (count per student_id).
3. Pass `overdueCount={overdueByStudent.get(enrollment.student_id) ?? 0}` to each student row component.
4. Render a small red badge in the row when `overdueCount > 0`.

**Test criteria:**
- Student with 2 overdue assignments → badge shows "2 overdue" in red.
- Student with no overdue → no badge (clean row).
- No new DB queries added (single `getOverdueSubmissions` call at page level).

---

### Step 4: Second fee reminder cron extension

**Files touched:** `app/api/cron/fee-reminders/route.ts`, `types/domain.ts`, `constants/plans.ts`.

#### 4a — Add `FEE_REMINDER_OVERDUE_DAYS_AFTER` to `constants/plans.ts`

```ts
export const TIMING = {
  // ... existing
  FEE_REMINDER_OVERDUE_DAYS_AFTER: 5,
}
```

#### 4b — Add `FEE_REMINDER_OVERDUE` EmailType to `types/domain.ts`

```ts
export const EmailType = {
  // ... existing
  FEE_REMINDER_OVERDUE: 'fee_reminder_overdue',
}
```

#### 4c — Add email template handling in `lib/email/sender.ts`

The `sendEmail()` function dispatches by `type`. Add a case for `'fee_reminder_overdue'` that sends a slightly different subject/body: "OVERDUE: Your fee for [cohort] was due on [date] — please pay as soon as possible."

Reuse the same data shape as `fee_reminder` (`studentName`, `cohortSummary`, `billingDay`, `cohortCount`) — add an `overdueDate` field (the billing_day date string for the past month).

#### 4d — Extend `fee-reminders/route.ts` to fire the second reminder

The existing cron runs daily. The extension adds a second pass in the same cron handler (same file, same `GET` export — both reminders run in one invocation).

**Second reminder logic:**
1. Calculate `overdueTargetDate = today - TIMING.FEE_REMINDER_OVERDUE_DAYS_AFTER` (5 days ago).
2. Extract `overdueTargetBillingDay = overdueTargetDate.getDate()`. Skip if > 28.
3. The billing month for the overdue check = `firstOfMonthPKT(overdueTargetDate)` — this is the month whose billing_day was 5 days ago.
4. Find monthly cohorts where `billing_day === overdueTargetBillingDay` (same query pattern as first reminder).
5. For each active enrollment in those cohorts:
   a. Check if a `confirmed` payment exists for `payment_month = billingMonth` — if yes, skip.
   b. Check `notifications_log` for an existing record with `type = 'fee_reminder_overdue'`, `recipient_id = student_id`, and `metadata->>'billing_month' = billingMonth` — if found, skip (idempotency).
   c. If no confirmed payment AND no prior overdue reminder for this month: add to the overdue reminder batch.
6. Send one combined overdue reminder email per student (same batching pattern as first reminder).
7. After sending, write a `notifications_log` row: `{ recipient_type: 'student', recipient_id: studentId, type: 'fee_reminder_overdue', channel: 'email', status: 'sent', metadata: { billing_month: billingMonth } }`.

**Note on existing first reminder idempotency:** The existing first reminder does NOT write to `notifications_log` — it only checks for existing payments. This means if the cron runs multiple times on the same day (retry), it re-sends. This is a pre-existing issue, not Lane H's scope — do not fix it here.

**CRON_SECRET:** Already validated at the top of the existing handler. The extension runs inside the same try/catch block — no changes to auth.

**Vercel cron schedule:** `fee-reminders` is already scheduled daily in `vercel.json`. No schedule change needed.

**Test criteria:**
- Cohort billing_day = 10, today = April 15 (5 days after). Student has no confirmed payment for April. → Overdue reminder fires once.
- Same scenario run again same day → `notifications_log` check prevents duplicate.
- Student who paid April confirmed → no overdue email.
- First reminder (3 days before) still fires correctly for a different billing_day cohort in the same cron run.

---

## Open questions for team-lead

1. **`start_date`/`end_date` NOT NULL constraint on cohorts:** If these columns have NOT NULL in the migration, `duplicateCohort()` must insert placeholder dates (e.g. `'2099-01-01'`) and note it in the UI. Needs a quick check of `001_initial_schema.sql` before implementing Step 1.

2. **`'draft'` cohort status in `CohortStatus` enum:** Confirm `draft` is a valid DB-level check constraint value in `cohorts.status`. If not (if the DB only allows `'upcoming' | 'active' | 'archived'`), the duplicate should start as `'upcoming'` with a placeholder start date.

3. **First fee reminder idempotency gap:** The existing `fee-reminders` cron doesn't write to `notifications_log`, so it can resend on retry. Fixing it is out of Lane H scope but worth flagging — should it be fixed as part of Step 4 while we're touching the file?

4. **PDF auth mechanism:** The progress report route at `GET /api/teacher/progress-report/[enrollmentId]` must authenticate the teacher. The cleanest way is to use the Supabase SSR cookie client (`createClient()` from `@/supabase/server`) and call `supabase.auth.getUser()`. Confirm this pattern is correct for API routes (vs Server Components that use `requireTeacher()`).

5. **`@react-pdf/renderer` version:** Install `@react-pdf/renderer@latest` or pin to `^3.4.x`? The v3.x API (`renderToBuffer`, `Document`, `Page`, `Text`, `View`) is stable. Recommend pinning `^3.4.0` to avoid breaking API changes from a hypothetical v4.

6. **Overdue assignment badge on cohort students page performance:** The plan uses `getOverdueSubmissions(cohortId)` which does 3 sequential DB queries. For cohorts with many students + many assignments this is fine. Confirm there is no pre-existing call to this function on the students page (to avoid double-fetching).

---

## Answers from team-lead

1. **Both NOT NULL** (verified `001_initial_schema.sql:116-117`). Duplicate cohort must populate both. Use a sensible default: `start_date = today + 30 days`, `end_date = today + 60 days` (30-day duration default). Teacher edits both in the subsequent edit page. Show a prominent banner on the edit page after duplication: "Review start and end dates before publishing — defaults set to 30-day duration starting in 30 days."

2. **`'draft'` is safe** — no CHECK constraint on `cohorts.status` (verified). Default is `'upcoming'` but any text value is allowed. BUILD_PLAN Week 3 treats `'draft'` as a known application-level status. Use `status = 'draft'` for duplicated cohorts.

3. **YES, fix the first-reminder idempotency gap while you're there.** It's a pre-existing bug, small fix, and you're already touching the file. Add the same `notifications_log` check + write pattern. EmailType for the first reminder is `'fee_reminder'`. Use metadata `{ billing_month, variant: 'upcoming' }` for first reminder, `{ billing_month, variant: 'overdue' }` for second, to keep them distinct.

4. **PDF route auth approved — use the standard pattern:** `requireTeacher()` from `lib/auth/guards.ts` works in API routes. Internally it uses `createClient()` from `@supabase/ssr` + `supabase.auth.getUser()` via cookies. No change to the guard; just import and call it at the top of the route handler. If teacher ID from `requireTeacher()` doesn't own the enrollment's cohort, return 403.

5. **Pin `@react-pdf/renderer@^3.4.0`.** Stable API. Add to `package.json` dependencies. Run `npm install` when implementer starts. If install fails in CI/Vercel for any reason (native dep issues), fall back to plain HTML-to-PDF via a server-side headless browser would be a Phase 3 problem — not your concern.

6. **Confirmed: `getOverdueSubmissions` is NOT called from the cohort students page.** Safe to add without double-fetch risk. Verified via grep.

## Additional guidance

- **No new migration for Lane H.** Confirmed.
- **EmailType addition**: `'fee_reminder_overdue'`. Lane C adds 'referral_converted' (already in enum — no edit). Lane G adds 'subdomain_changed'. Use anchor-specific Edit on types/domain.ts so you don't clobber other lanes' edits.
- **Duplicate cohort UI**: "Duplicate" button in cohort detail page header (not the cohorts list). Label: "Duplicate Cohort". Icon: Copy (Lucide). On success, router.push to the new cohort's /edit page with a success toast.
- **Draft status does NOT count toward `max_cohorts_active` limit** (per BUILD_PLAN §13 plan limits counting rules). Cohort plan check on duplicate should NOT block — draft cohorts are free. The plan check only applies when teacher later transitions draft→upcoming.
- **Cohort duplication does NOT copy**: invite_token (fresh), class_sessions (none; teacher configures), enrollments (none; fresh cohort), announcements/attendance/assignments (cohort-scoped, start empty).
- **Cohort duplication DOES copy**: name (suffix " (copy)"), course_id, session_type, fee_type, fee_pkr, billing_day, max_students, pending_can_see_*, waitlist_enabled.
- **PDF report date range**: show for the full cohort period (start_date to end_date) not just a single month. Attendance = total non-cancelled sessions between cohort.start_date and today (or end_date if archived). Payments = list all payment_months with status. Submissions = all assignments with per-student status.
- **Overdue assignment per-student breakdown**: server-fetch once at page level, group by student_id in JS (O(n) map over the returned array). Pass count to each row component.
