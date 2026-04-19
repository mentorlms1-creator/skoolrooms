# Lane E2 — Students + Analytics + Plan/Billing Polish

Phase 2 polish for teacher-facing student management, cohort analytics, and the Settings → Billing/Plan surface. Builds on Lane A (earnings, payouts), Lane C (cohort_feedback, retention) and Lane H (progress PDF, second fee reminder).

> **Reference:** ARCHITECTURE.md sections 3 (schema), 9 (critical systems — at-risk lists, etc.), 13 (plan limits).

---

## Audit summary

| Concern | What already exists | What is missing |
|---|---|---|
| Parent contact | `students.parent_name`, `students.parent_phone` (001_initial_schema.sql:162-163). No edit UI. | `parent_email` column. Teacher view + edit modal. Student-side edit form. |
| Progress per enrollment | `getAttendanceSummary(studentId, cohortId)` and `getOverallAttendanceSummary(studentId)` in `lib/db/attendance.ts:144,188`. Lane H computes a richer report for PDF. | Per-enrollment "Progress" tab on the cohort student detail panel; per-cohort progress card on student dashboard / cohort page. |
| Private teacher notes | None. | New `teacher_student_notes` table + RLS + actions + UI. |
| At-risk / disengaged / no-submissions | Attendance data + assignments + submissions exist. `getOverdueSubmissions(cohortId)` in `lib/db/assignments.ts`. **No `last_login_at` on students.** | New "Health" page, three flagged-student lists, indexes for performance, optional `students.last_login_at` column. |
| Revenue per cohort | `student_payments.teacher_payout_amount_pkr` per enrollment. Lane A's `getTeacherEarnings` aggregates platform-wide. | Cohort-scoped sum + projection + completion rate in a per-cohort analytics card/page. |
| Subscription history | `getTeacherSubscriptions(teacherId)` exists; rendered raw on `app/(teacher)/dashboard/settings/plan/page.tsx`. | Move into a dedicated **Settings → Billing** page with invoice download and clearer columns. |
| Plan features list + grandfathered badge | Plan page shows enabled/disabled lists by name only. `teacher_plan_snapshot` table populated for grandfathered teachers. | Render every feature with check/lock icon and **per-limit values** (snapshot vs live), badge "Grandfathered" + diff table. |

---

## 1) Parent / Guardian contact fields

### 1a. Migration — `supabase/migrations/012_student_guardian_email.sql`
```sql
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_email text;
-- No NOT NULL, no default. Optional.
-- No index needed (low-cardinality lookup, never filtered on).
```
Note: keep existing `parent_name` / `parent_phone` columns; we use those names everywhere instead of `guardian_*` to match the existing schema. (The task brief says "guardian_*"; defer to the established `parent_*` naming and just add `parent_email`.)

### 1b. lib/db
- **Edit `lib/db/students.ts`** — extend `StudentRow` type with `parent_email: string | null`. Add `updateStudentGuardian(studentId, { parent_name, parent_phone, parent_email })`. Reuse existing `updateStudent` if shape is friendly; otherwise add a typed wrapper that whitelists only the three columns.

### 1c. Server actions
- **Edit `lib/actions/students.ts`** (create if it does not exist; current code path for updates is via the page-local server actions). Add:
  - `updateStudentGuardianAsTeacher(studentId, input)` — `requireTeacher()`, verify the student has at least one enrollment in a cohort owned by the teacher (call `getEnrollmentsByStudentForTeacher`). Returns `ApiResponse<StudentRow>`.
  - `updateOwnGuardianContact(input)` — `requireStudent()`, updates own row (auth_id → student_id lookup).

### 1d. UI — Teacher
- **Edit `app/(teacher)/dashboard/students/[studentId]/page.tsx`** — add a "Guardian" card under Profile showing `parent_name`, `parent_phone`, `parent_email` (each with a "—" placeholder when null) and an Edit button.
- **New** `app/(teacher)/dashboard/students/[studentId]/GuardianEditDialog.tsx` (Client Component). shadcn Dialog + Form (Input × 3). Submits to `updateStudentGuardianAsTeacher`. Uses `useTransition` and the global toast.
- **Edit** `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/EnrollmentPaymentsModal.tsx` — extend the modal (or add a sibling) to surface the same three fields read-only with an "Open student" link to the detail page. Avoid duplicating the edit dialog.

### 1e. UI — Student
- **New** `app/(student)/student/settings/profile/page.tsx` (or extend the existing `app/(student)/student/settings/` form if it already covers name/phone — `form.tsx` is present). Add an "Emergency / Guardian Contact" section to the existing form. Same three inputs, all optional. Submits via `updateOwnGuardianContact`.
- shadcn primitives: `Input`, `Label`, `Button` (already in `components/ui/`).

### 1f. Edge cases
- Email: validate format client- and server-side. Disallow strings > 254 chars. Don't enforce uniqueness — different students can share a parent.
- Phone: free text (no canonicalization). Match the loose validation already used for `students.phone`.
- Don't block save if the student row has only some fields filled — partial updates allowed.
- Teacher cannot edit guardian info for a student outside their own cohorts (RLS + server-side check).

---

## 2) Per-enrollment progress (Classes Attended)

Reuse, do not re-implement. `getAttendanceSummary(studentId, cohortId)` already returns `{ attended, total, percentage }` excluding cancelled sessions; Lane H's PDF route computes the full per-class breakdown — lift that helper out so the UI uses the same source.

### 2a. lib/db
- **Edit `lib/db/attendance.ts`** — add `getAttendanceTimelineForStudent(studentId, cohortId)`. Returns rows of `{ session_id, scheduled_at, cancelled, present }` ordered by `scheduled_at ASC`. Implementation: select all non-deleted sessions for the cohort, left-join the student's attendance row, project `present := attendance.present ?? false`, `cancelled := session.cancelled_at IS NOT NULL`. This is the canonical source for both the UI tab and the Lane H PDF — Lane H **must** import this rather than duplicate.
- **Edit `lib/db/assignments.ts`** — add `getSubmissionStatsForStudent(studentId, cohortId)`: `{ total_assignments, submitted, on_time, late, missing }`. Reuse existing `getOverdueSubmissions` shape rather than re-deriving overdue.

### 2b. UI — Teacher (per-enrollment "Progress" tab)
- **Edit** `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx` — when a teacher opens a student row (existing `StudentRowActions` already opens dialogs), add a "Progress" action that opens a new dialog.
- **New** `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/StudentProgressDialog.tsx` (Server Component dialog content fetched on demand via a thin wrapper, OR Client Component that takes prefetched timeline as props from the page). Layout:
  - Top stat row: `Attended X / Y (Z%)` ring (mirror the student-dashboard ring SVG — don't copy/paste, lift it into `components/ui/AttendanceRing.tsx`).
  - Submissions card (assignments stat block).
  - Timeline list with date (PKT via `formatPKT`), badge: Present / Absent / Cancelled.
- **Refactor** the student dashboard SVG ring (`app/(student)/student/page.tsx:144-197`) to use the new shared `AttendanceRing` component so we have one source.

### 2c. UI — Student (own progress per cohort)
- **Edit** `app/(student)/student/courses/[cohortId]/page.tsx` (whichever path renders cohort detail to a student — verify exact path). Add a "Your progress" card with the same `AttendanceRing` and a 5-row "Recent classes" preview, plus a "View all" link to a per-cohort `/progress` sub-route if the list is long. Reuse `getAttendanceTimelineForStudent`.
- Student dashboard already has overall attendance; do NOT replace it. Add a per-active-cohort breakdown grid below the main bento grid — small cards each linking to the cohort's progress section.

### 2d. Edge cases
- Empty cohort (zero sessions): show "No classes have been scheduled yet" instead of "0/0 (0%)".
- Cancelled sessions never count in attended OR total — keep the existing semantics from `getAttendanceSummary`.
- Future sessions (scheduled_at > now): exclude from total in the percentage calc but **show** in the timeline labelled "Upcoming".

---

## 3) Private teacher notes per student

### 3a. Migration — `supabase/migrations/013_teacher_student_notes.sql`
```sql
CREATE TABLE teacher_student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES cohorts(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tsn_teacher_student ON teacher_student_notes (teacher_id, student_id, created_at DESC);
CREATE INDEX idx_tsn_cohort ON teacher_student_notes (cohort_id) WHERE cohort_id IS NOT NULL;

ALTER TABLE teacher_student_notes ENABLE ROW LEVEL SECURITY;

-- Teacher can SELECT/INSERT/UPDATE/DELETE only their own notes
CREATE POLICY teacher_student_notes_owner ON teacher_student_notes
  FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()))
  WITH CHECK (teacher_id = (SELECT id FROM teachers WHERE supabase_auth_id = auth.uid()));

-- Students never see this table; no policy for students.
```

### 3b. lib/db
- **New** `lib/db/teacher-student-notes.ts`:
  - `listNotesForStudent(teacherId, studentId, cohortId?)` ordered by `created_at DESC`.
  - `createNote(teacherId, studentId, body, cohortId?)`.
  - `updateNote(teacherId, noteId, body)` — verify ownership.
  - `deleteNote(teacherId, noteId)` — verify ownership.

### 3c. Server actions
- **New** `lib/actions/teacher-student-notes.ts` — wrap each db function with `requireTeacher()` + ownership re-check (defence in depth on top of RLS) + revalidatePath of the student detail route.

### 3d. UI
- **New** `app/(teacher)/dashboard/students/[studentId]/NotesSection.tsx` (Client Component). Renders inside the existing student detail page (`page.tsx`) below Enrollments. Composition:
  - Form: `Textarea` + "Add note" button (auto-resize) + optional `Select` cohort scope from this student's enrollments under this teacher.
  - List: each note as a `Card` with body, edit button (inline `Textarea`), delete button (`AlertDialog` confirm), and `formatPKT(created_at, 'relative')`.
  - Use `useTransition` and optimistic updates for add/edit/delete.
- shadcn primitives: `Textarea`, `Button`, `AlertDialog`, `Select`. Install with `npx shadcn@latest add textarea alert-dialog select` if any not yet present.

### 3e. Edge cases
- Note length: hard cap 4000 chars (DB CHECK + client maxlength).
- Deleting a cohort: notes keep `cohort_id = NULL` (ON DELETE SET NULL) so history stays even if cohort is removed.
- Notes are private — never expose in any student-facing or admin endpoint. Admin panel should not surface them either (intentional; teachers should treat them as a personal pad, not a moderation surface).
- If teacher loses access to a student (all enrollments revoked), notes still belong to them and remain visible on the student detail page (which still loads under their account because the past-enrollments check accepts any historical enrollment).

---

## 4) At-risk / disengaged / no-submissions analytics

### 4a. Optional migration — `supabase/migrations/014_student_last_login.sql`
Pick one of two approaches. **Decision: add column.**
```sql
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
CREATE INDEX idx_students_last_login_at ON students (last_login_at) WHERE last_login_at IS NOT NULL;
```
Update the student auth callback (`app/auth/callback/...` or wherever Supabase Auth `signInWithPassword` succeeds) to write `students.last_login_at = now()` via an admin-client server action. Wrap in a try/catch — login must not fail if this update fails.

> Alternative considered: read `auth.users.last_sign_in_at` directly. Rejected because the `auth` schema is gated behind service role only; querying it for every "disengaged" check requires per-student lookups. A denormalized column with an index is the cheaper read path.

### 4b. lib/db — `lib/db/student-health.ts` (new)
On-demand queries scoped to a teacher (favoured over a materialized view — counts are small per teacher, freshness matters, MV refresh adds cron complexity).

- `listAtRiskStudents(teacherId)` → students with attendance < 70% across their enrollments under this teacher. Implementation: for each active enrollment under the teacher, compute `getAttendanceSummary(studentId, cohortId)` (or aggregate in one SQL via a CTE). Return rows of `{ student_id, name, cohort_id, cohort_name, course_title, percentage, attended, total }`. Filter: only include students with `total >= 3` (avoid flagging cohorts that just started).
- `listDisengagedStudents(teacherId, daysThreshold = 10)` → students enrolled in any active cohort under the teacher whose `last_login_at < now() - daysThreshold` OR `last_login_at IS NULL` and `enrollment.created_at < now() - daysThreshold`. Returns `{ student_id, name, last_login_at, enrollments_count }`.
- `listNoSubmissionStudents(teacherId)` → for each cohort owned by teacher with `>= 1` published assignment, return enrollments where the student has 0 submissions across the cohort's assignments. Output: `{ student_id, name, cohort_name, course_title, assignment_count }`.

Index helpers (add to migration 014 if missing):
```sql
CREATE INDEX IF NOT EXISTS idx_attendance_student_present ON attendance (student_id, present);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions (student_id);
```
(Verify these don't already exist in `003_indexes.sql`.)

### 4c. UI
- **New** `app/(teacher)/dashboard/students/health/page.tsx` (Server Component). Three sections, each backed by `DataTable` (`components/ui/DataTable.tsx` already wraps `@tanstack/react-table`):
  1. **At-risk** — columns: Student, Cohort, Attendance % (red badge if < 50%, amber 50-70%), Last class date.
  2. **Disengaged** — columns: Student, Last login, Enrollments. CTA: "Send check-in" → opens the messaging composer (Lane B) prefilled.
  3. **No submissions** — columns: Student, Cohort, # assignments missed, "View assignments" link.
- Each section has a count chip + an "Export CSV" button (server action returning a blob via `Response`).
- Add a sidebar nav item under "Students" → "Student Health" (`constants/nav-items.ts`, gated by `canUseFeature(teacher.id, 'student_health_signals')` — feature key already exists in `constants/features.ts`).
- For teachers without the feature, show a `PlanLimitGuard` upsell card instead of the lists.

### 4d. Edge cases
- New teacher (no enrollments): each section shows `EmptyState` with a tailored message ("No active students yet").
- Cohort with 0 assignments: skip in no-submission list (denominator zero, false positive).
- A student who is at-risk *and* disengaged *and* missing submissions appears in all three lists — that is intentional.
- Performance: cap each list at 200 rows (`.limit(200)` on the underlying query). Show "Showing first 200 of X" if exceeded — this is a polish surface, not an export tool.

---

## 5) Revenue per cohort + projection + completion rate

### 5a. lib/db
- **Edit `lib/db/cohorts.ts`** — add `getCohortAnalytics(cohortId, teacherId)`:
  ```ts
  type CohortAnalytics = {
    revenue_collected_pkr: number       // sum of confirmed teacher_payout_amount_pkr
    revenue_pending_pkr: number         // sum of pending payments × cut rate at current plan
    projected_revenue_pkr: number       // monthly cohorts only: fee × active enrolled × months_remaining
    completion_rate: number | null      // archived cohorts only
    enrolled_active: number
    enrolled_total: number
    months_remaining: number | null
  }
  ```
- Verify ownership inside the helper (teacher_id matches), return null otherwise.
- Reuse Lane A's `getTeacherEarnings` aggregation logic — extract the shared SQL into a `lib/db/_payment-aggregations.ts` helper if duplication grows. Don't duplicate cut rate handling.

### 5b. Projection rules
- Only meaningful for `fee_type = 'monthly'` cohorts. For `one_time` cohorts, projection equals `fee_pkr × pending_enrollments` (one-shot future inflow).
- `months_remaining = max(0, ceil((cohort.end_date - today) / 30))`. If `end_date` is null (open-ended cohort), use a 12-month horizon and label the projection as "Next 12 months" in the UI.

### 5c. Completion rate
- Defined for archived cohorts only: `count(enrollments WHERE status='completed') / count(enrollments WHERE status IN ('completed','active','withdrawn'))`. Excludes `pending` (never started) and `revoked` (admin removed).
- Returns `null` for non-archived cohorts and the UI just hides the stat.

### 5d. UI
- **Edit** `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx` — add an Analytics card with these stats inline (don't add a new route — keep the cohort detail surface as the single source). Render four `StatCard`-style tiles: Collected, Pending, Projected (with horizon label), Completion Rate (or "—").
- Gate the card behind `canUseFeature(teacher.id, 'revenue_analytics')`. Free-plan teachers see a locked card with an upsell.

### 5e. Edge cases
- Refunded payments: subtract `teacher_payout_amount_pkr` from collected for any payment with `refunded_at IS NOT NULL`. Mirror Lane A's logic exactly.
- Manual "Mark as Paid" payments: per CLAUDE.md rule 18, those have `platform_cut_pkr = 0` and are recorded; **include them** in revenue (teacher's gross income) but flag them visually with a tooltip "Includes Rs. X recorded as paid offline".
- Cohort with no enrollments: completion rate `null`, projected `0`, collected `0` — render "No revenue data yet" empty state inside the card.

---

## 6) Teacher subscription history page (Settings → Billing)

### 6a. Audit
`getTeacherSubscriptions(teacherId)` already exists (`lib/db/subscriptions.ts:181`). It is currently rendered inline at the bottom of `app/(teacher)/dashboard/settings/plan/page.tsx`. We are **moving** that section into a dedicated Billing page so the Plan page can focus on features/usage.

### 6b. Files
- **New** `app/(teacher)/dashboard/settings/billing/page.tsx` (Server Component). Imports `getTeacherSubscriptions`, `getTeacherBalance`, optionally `getRecentPayoutsByTeacher` (from Lane A `lib/db/payouts.ts` if shipped).
- **Edit** `app/(teacher)/dashboard/settings/plan/page.tsx` — remove the Subscription History section (kept in plan currently at lines 219-271) and add a small "View billing history →" link pointing to the new page.
- **Edit** `constants/nav-items.ts` (and the settings sub-nav if there is one) — add a "Billing" tab under Settings, between "Plan" and "Payments".
- **Edit** `constants/routes.ts` — `ROUTES.TEACHER.settingsBilling = '/dashboard/settings/billing'`.

### 6c. UI
- Three sections, each as a Card:
  1. **Subscription history** — DataTable with columns Plan, Amount, Period, Method (icon: Bank / JazzCash / EasyPaisa / Gateway), Status badge, Date. Action column: "Download invoice" if `status = 'approved'` (link to `/api/teacher/invoice/[subscriptionId]` — see 6d).
  2. **Recent payouts** (if Lane A is live) — pulled in by reading `lib/db/payouts.ts`.
  3. **Outstanding balance** — pulled from `teacher_balances`; mirrors what the Earnings page shows but as a snapshot here.
- Mobile: card view; Desktop: table view. Mirror the existing pattern at `plan/page.tsx:223-269`.

### 6d. Invoice download (lightweight)
- **New** `app/api/teacher/invoice/[subscriptionId]/route.ts` — GET, requires teacher, verifies ownership, returns a server-rendered PDF.
- Reuse `@react-pdf/renderer` (Lane H adds the dependency). If Lane H has not landed yet, mark this section "Phase 2.1 — depends on Lane H". A simple HTML→PDF body: teacher name, plan, period, amount, method, status, "Skool Rooms" header.
- File naming: `invoice-${subscription.id}.pdf`. `Content-Disposition: attachment`.

### 6e. Edge cases
- Pending / rejected subscriptions don't generate an invoice (button hidden).
- Trial periods don't have a subscription row → no entry in history; show a one-line note "Trial does not appear in billing history."
- Free plan teachers: page shows the section title and an empty state ("You're on the Free plan — no billing history yet.").

---

## 7) Settings → Plan: full feature list with included/locked icons + grandfathered badge + diff

### 7a. Files
- **Edit** `app/(teacher)/dashboard/settings/plan/page.tsx`.
- **Edit** `lib/db/teachers.ts` — extend `getTeacherPlanDetails` (or add `getTeacherPlanDetailsWithSnapshot`) to also return:
  ```ts
  {
    snapshot: {
      isGrandfathered: boolean
      capturedAt: string | null
      features: Record<FeatureKey, boolean>
      limits: Record<LimitKey, number>
    } | null
  }
  ```
  Source: `teacher_plan_snapshot.snapshot_json` (table is already at `001_initial_schema.sql:279`).

### 7b. UI structure
Replace the current two-list layout (Included / Not Available, lines 181-216) with a single table-style list rendering **every** feature in `FEATURE_DISPLAY_NAMES` plus the four limits (`max_courses`, `max_students`, `max_cohorts_active`, `max_storage_mb`):
- Column 1: Feature/Limit name
- Column 2: Live plan value — check icon (success), lock icon (muted) for booleans; numeric value (or "Unlimited" if `>= UNLIMITED_VALUE`) for limits
- Column 3: **Your effective value** — same as live unless snapshot grandfathers it
- Column 4 (only when grandfathered): "Was" — original snapshot value, with delta badge (e.g. `+5 students`)

### 7c. Grandfathered badge
- If `snapshot.isGrandfathered === true`, show a `Badge variant="outline"` next to the plan name in the Current Plan card: "Grandfathered" with a tooltip "You're on legacy terms captured on {capturedAt PKT}. Some features/limits won't change if we update this plan."
- Below the Features card, show a collapsible "What's different from the current plan?" section listing only the rows where snapshot value > live value.

### 7d. Reuse rules
- **Don't** call `canUseFeature` per row (one DB call per feature). Instead read the joined `plan_features` snapshot for the teacher's plan once, plus the snapshot row, and compute everything in memory.
- Lift the lock/check icons into `components/ui/PlanFeatureIcon.tsx` so we can reuse on the marketing pricing page later.

### 7e. Edge cases
- Teacher on Free plan — no snapshot row exists; the table shows live values only and no "Was" column.
- Snapshot exists but is identical to live values — treat `isGrandfathered=false`, suppress badge.
- New feature added to `FEATURE_DISPLAY_NAMES` but not yet in `plan_features` — render row with "—" (and a sentry log on the server side so we know to backfill).

---

## File-touch summary

| Path | Action |
|---|---|
| `supabase/migrations/012_student_guardian_email.sql` | new |
| `supabase/migrations/013_teacher_student_notes.sql` | new |
| `supabase/migrations/014_student_last_login.sql` | new |
| `lib/db/students.ts` | edit (parent_email, updateStudentGuardian) |
| `lib/db/attendance.ts` | edit (getAttendanceTimelineForStudent) |
| `lib/db/assignments.ts` | edit (getSubmissionStatsForStudent) |
| `lib/db/teacher-student-notes.ts` | new |
| `lib/db/student-health.ts` | new |
| `lib/db/cohorts.ts` | edit (getCohortAnalytics) |
| `lib/db/teachers.ts` | edit (snapshot fields) |
| `lib/db/_payment-aggregations.ts` | new (only if duplication appears) |
| `lib/actions/students.ts` | new or edit (guardian update actions) |
| `lib/actions/teacher-student-notes.ts` | new |
| `app/(teacher)/dashboard/students/[studentId]/page.tsx` | edit (Guardian card, NotesSection) |
| `app/(teacher)/dashboard/students/[studentId]/GuardianEditDialog.tsx` | new |
| `app/(teacher)/dashboard/students/[studentId]/NotesSection.tsx` | new |
| `app/(teacher)/dashboard/students/health/page.tsx` | new |
| `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx` | edit (Progress action) |
| `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/StudentProgressDialog.tsx` | new |
| `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/page.tsx` | edit (CohortAnalytics card) |
| `app/(teacher)/dashboard/settings/plan/page.tsx` | edit (full feature list, grandfathered badge, drop history) |
| `app/(teacher)/dashboard/settings/billing/page.tsx` | new |
| `app/api/teacher/invoice/[subscriptionId]/route.ts` | new (depends on Lane H) |
| `app/(student)/student/settings/form.tsx` | edit (guardian section) |
| `app/(student)/student/page.tsx` | edit (per-cohort progress grid, lift ring) |
| `app/(student)/student/courses/[cohortId]/page.tsx` | edit (Your progress card) |
| `components/ui/AttendanceRing.tsx` | new (lifted from student dashboard) |
| `components/ui/PlanFeatureIcon.tsx` | new |
| `constants/routes.ts` | edit (settingsBilling, studentsHealth) |
| `constants/nav-items.ts` | edit (Billing tab, Health tab) |

---

## Cross-lane reuse contract

| Lane H needs from E2 | E2 needs from other lanes |
|---|---|
| `getAttendanceTimelineForStudent` (single source for the PDF) | Lane H's `@react-pdf/renderer` install + invoice route pattern |
| | Lane A's `getTeacherEarnings` aggregation (cohort revenue subset) |
| | Lane B's messaging composer URL (for "Send check-in" CTA on disengaged list) |

**Implementation order recommendation** — ship items 1, 3, 7 first (additive, low risk, no inter-lane deps). Ship 5 once Lane A's helpers are stable. Ship 4 last (it bites if `last_login_at` writes regress login). Ship 6 after Lane H so invoices work day-1.

---

## Non-goals / explicit deferrals

- No multi-teacher note sharing (Phase 3).
- No automatic at-risk email alerts to teachers — these lists are pull-based; push notifications can come in Phase 2.1.
- No revenue forecasting beyond the simple linear `fee × students × months_remaining` calc. Churn-aware projections are a future analytics rebuild.
- No CSV import/export of guardian contacts (out of scope; teachers can use the existing per-student edit).
