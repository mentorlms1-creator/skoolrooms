# Lane D — Admin Enhancements Plan

---

## Current State (Audit)

### Admin pages currently present

| Route | File | What it does |
|-------|------|-------------|
| `/admin` | `app/(platform)/admin/page.tsx` | Dashboard: MRR stat card (sum of active paid subs — current month), signup trend, plan distribution donut, revenue-by-cohort bar, smart alert card |
| `/admin/teachers` | `app/(platform)/admin/teachers/page.tsx` | Teacher list via `TeacherListTable` (DataTable with sort/search) |
| `/admin/teachers/[teacherId]` | `app/(platform)/admin/teachers/[teacherId]/page.tsx` | Teacher detail: profile, plan, subscription history, activity log (last 50). Admin actions: change plan, extend expiry, extend trial, suspend/reactivate |
| `/admin/payments` | `app/(platform)/admin/payments/page.tsx` | Subscription screenshot queue (pending_verification rows) |
| `/admin/settings` | `app/(platform)/admin/settings/page.tsx` | Platform settings form (all `platform_settings` rows) |
| `/admin/operations` | `app/(platform)/admin/operations/page.tsx` | Three stat cards: active cohorts, total students, pending payments |

### Admin components currently present

| File | Purpose |
|------|---------|
| `components/admin/TeacherListTable.tsx` | DataTable wrapper for teacher list |
| `components/admin/TeacherDetailActions.tsx` | Change plan / extend expiry / suspend buttons |
| `components/admin/SubscriptionQueue.tsx` | Screenshot approve/reject queue |
| `components/admin/PlatformSettingsForm.tsx` | Platform settings form |
| `app/(platform)/admin/RevenueChart.tsx` | Recharts bar chart — revenue by cohort (static, no time axis) |
| `app/(platform)/admin/PlanChart.tsx` | Recharts donut chart — plan distribution |

### Admin DB helpers currently present (`lib/db/admin.ts`)

- `getAllTeachers()` — list with student count
- `getTeacherDetail()` — profile + subscription history + activity log
- `logAdminActivity()` — insert to admin_activity_log
- `getActivityLog(teacherId?)` — query log, limit 100
- `getAdminDashboardStats()` — MRR (scalar), signups, plan distribution, 21-day activity heatmap
- `getOperationsStats()` — active cohorts, total students, pending payments
- `getPlatformSettings()` / `updatePlatformSetting()` — settings CRUD
- `getTeacherAnalytics()` — per-teacher revenue/student data
- `getTeacherPaymentSettings()` — teacher bank details
- `getRevenueByCohort()` — top 6 cohorts by revenue (platform-wide)
- `getPendingSubscriptions()` — subscription queue
- `getTopAdminAlert()` — smart priority alert

### Admin Server Actions currently present (`lib/actions/admin.ts`)

- `changePlanAction()`
- `extendExpiryAction()`
- `extendTrialAction()`
- `suspendTeacherAction()`
- `reactivateTeacherAction()`
- `updatePlatformSettingsAction()`

### Admin API routes currently present

- None specific to the new features (reset-password, wipe-test-account are stub-only per ARCHITECTURE.md).

---

## Gaps vs BUILD_PLAN Phase 2

| Feature | Gap |
|---------|-----|
| MRR chart (12 months) | Existing MRR is a single scalar. No time-series, no 12-month history. Need DB helper + Recharts line chart component. |
| Churn rate % | No computation exists anywhere. Need DB query + formula. |
| Conversion rate (Free→Paid) | No computation exists. Need DB query tracking who moved from free→paid in a period. |
| ARPU | No computation. Derivable: `MRR ÷ active paid teachers`. |
| LTV | No computation. Derivable: `ARPU ÷ churn`. |
| Bulk email all teachers | No bulk email action. Need new Server Action + sendEmail() loop. Requires EmailType approval. |
| View-as teacher | No impersonation. Need Supabase Auth admin API session + activity log. |
| Full activity log UI | Log data exists in teacher detail page (last 50, no filter). Need standalone paginated filterable page. |
| Emergency password reset | `/api/admin/teachers/[id]/reset-password` listed in ARCHITECTURE.md but not built. Need API route + Server Action. |
| Wipe test account | `/api/admin/teachers/[id]/wipe-test-account` listed in ARCHITECTURE.md but not built. Need API route + guard. |
| Plan CRUD | No plan create/archive/delete UI. Only changePlanAction for teachers exists. Need plans management page. |
| Plan preview | No preview mechanism. Need UI diff component. |
| Grandfathered teachers list | No filterable list. teacher_plan_snapshot exists in schema but no UI. |

---

## Implementation Plan (Ordered Steps)

---

### Step 1: Metrics Dashboard (MRR/churn/conversion/ARPU/LTV)

**Files to CREATE:**
- `lib/db/admin-metrics.ts` — all time-series and derived KPI queries
- `app/(platform)/admin/metrics/page.tsx` — Metrics page (Server Component)
- `app/(platform)/admin/metrics/MrrChart.tsx` — Client Component (Recharts, dynamic import)
- `app/(platform)/admin/metrics/KpiCards.tsx` — Client Component (churn, conversion, ARPU, LTV summary cards)

**Files to EDIT:**
- `app/(platform)/admin/layout.tsx` or sidebar nav constants — add "Metrics" nav item pointing to `/admin/metrics`

**DB queries needed (`lib/db/admin-metrics.ts`):**

```typescript
// getMrrTimeSeries(months: number = 12): { month: string; mrr: number }[]
// For each of the last N calendar months:
//   SELECT COALESCE(SUM(p.price_pkr), 0) AS mrr
//   FROM teachers t
//   JOIN plans p ON p.slug = t.plan
//   WHERE t.plan != 'free'
//     AND t.is_suspended = false
//     AND t.plan_expires_at >= date_trunc('month', target_month)
//     AND t.created_at < date_trunc('month', target_month) + interval '1 month'
//
// NOTE: This is an approximation — we don't have a historical subscription state
// table. True time-series MRR requires event sourcing. For Phase 2, we derive
// from teacher_subscriptions (confirmed rows) grouped by period_start month:
//   SELECT date_trunc('month', period_start) AS month,
//          SUM(amount_pkr) AS mrr
//   FROM teacher_subscriptions
//   WHERE status = 'confirmed'
//   GROUP BY 1
//   ORDER BY 1 DESC
//   LIMIT 12
// This counts revenue recognized (subscription approved) per month.
// Expose as getMrrTimeSeries().

// getChurnRate(periodStart: string, periodEnd: string): number
// Formula: (teachers who were on paid plan at periodStart AND are now free/suspended/expired) / (teachers on paid plan at periodStart)
// Implementation: query teacher_subscriptions confirmed in prior period, then check current teacher.plan='free' OR is_suspended OR plan_expires_at < now().
// Returns a percentage (0–100).

// getConversionRate(periodStart: string, periodEnd: string): number
// Formula: teachers whose FIRST teacher_subscriptions.confirmed row falls in the period / all free teachers who existed at periodStart
// Implementation: JOIN teachers ON first_subscription = date range; denominator = count of teachers on free plan at period start.

// getArpu(): number
// Formula: MRR / count of active paid teachers
// Both already computable from getAdminDashboardStats() — derive here.

// getLtv(arpu: number, churnRate: number): number
// Formula: ARPU / (churnRate / 100)  [monthly LTV]
// Pure arithmetic, no DB query.

// getGrandfatheredTeacherCount(): number
// SELECT COUNT(*) FROM teacher_plan_snapshot WHERE captured_at < (SELECT MAX(updated_at) FROM plans WHERE slug = t.snapshot_json->>'planSlug')
// Simpler: count teachers who have a teacher_plan_snapshot row at all.
```

**Page layout:**
- `/admin/metrics` — Server Component:
  - Fetches `getMrrTimeSeries()`, computes churn/conversion/ARPU/LTV
  - Renders `<MrrChart data={...} />` (Recharts LineChart, dynamic import)
  - Renders `<KpiCards churn arpu ltv conversion />` (summary numbers)
  - Period selector: Last 3/6/12 months (searchParam `?months=12` passed to DB helper)

**Component notes:**
- `MrrChart` — Recharts LineChart, dynamic import (no SSR), same style as existing `RevenueChart.tsx`. X-axis: month label; Y-axis: PKR.
- `KpiCards` — four stat cards (reuse StatCard pattern from `admin/page.tsx` inline).
- Reuse existing `Card`, `CardHeader`, `CardContent`, `PageHeader` from shadcn.

**Testable criteria:**
- `/admin/metrics` renders without error.
- MRR chart shows 12 months of data (zeros if no subs).
- Churn % renders as a number (can be 0 on fresh data).
- ARPU = 0 when no paid teachers; updates when plans are assigned.

---

### Step 2: Bulk Email All Teachers

**Files to CREATE:**
- `app/(platform)/admin/email/page.tsx` — Compose + send page (Server Component wrapper)
- `app/(platform)/admin/email/BulkEmailForm.tsx` — Client Component (textarea subject/body + confirm modal)
- `lib/actions/admin-email.ts` — `bulkEmailTeachersAction(formData)`

**Files to EDIT:**
- Sidebar nav — add "Email" entry → `/admin/email`

**Action logic (`bulkEmailTeachersAction`):**
```
1. requireAdmin()
2. Validate: subject (max 200 chars), body (max 5000 chars), non-empty.
3. Fetch all non-suspended teacher emails from teachers table (service role, no RLS bypass needed here — admin client already does).
4. Loop in batches of 50 (Brevo limit per API call) — call sendEmail() with EmailType.
5. Log to admin_activity_log: action_type='bulk_email_sent', metadata: { recipient_count, subject }.
6. Return { success, sent: number }.
```

**Open question for team-lead:** `sendEmail()` in `lib/email/sender.ts` takes an `EmailType` enum (`types/domain.ts`). Bulk admin broadcast is not in the current enum. **Need team-lead approval to add `'admin_broadcast'` to the `EmailType` enum before building this.** Until approved, plan this step but do not touch `types/domain.ts`.

**Testable criteria:**
- Admin submits subject + body → confirmation modal → confirm → action fires → toast "Sent to N teachers".
- admin_activity_log row inserted with `action_type='bulk_email_sent'`.
- Empty subject/body shows inline validation error, never reaches sendEmail().

---

### Step 3: View-as Teacher (Read-Only Shadow View)

**Files to CREATE:**
- `app/api/admin/view-as/[teacherId]/route.ts` — POST: generate impersonation token, log to activity log. GET: revoke.
- `app/(platform)/admin/teachers/[teacherId]/ViewAsButton.tsx` — Client Component (confirm dialog → POST → redirect).

**Files to EDIT:**
- `app/(platform)/admin/teachers/[teacherId]/page.tsx` — add `<ViewAsButton teacherId={...} />` to the action column.

**Implementation approach:**
- Supabase Auth Admin API: `supabase.auth.admin.generateLink({ type: 'magiclink', email: teacher.email })` gives a one-time sign-in URL. Admin can navigate to teacher's dashboard impersonating them.
- Alternatively (simpler, no cross-session token): store a short-lived `view_as_teacher_id` cookie (signed, 30-min TTL) in the admin session. The teacher dashboard layout checks for this cookie and renders a "Read-only admin view" banner. All write Server Actions check for this cookie and return 403.
- **Chosen approach:** Signed cookie (no Supabase admin link leak risk, revocable by clearing cookie). Cookie name: `admin_view_as`, value: `{ teacherId, expiresAt }` signed with `CRON_SECRET`.
- Revoke: DELETE `/api/admin/view-as` clears the cookie and logs the revoke event.
- Banner: Component in teacher layout that reads cookie server-side, renders "ADMIN VIEW — Read only [Exit]" stripe in destructive color.

**Activity logging:** Every `view_as_start` and `view_as_end` event logged to admin_activity_log with `action_type='view_as_start'` / `'view_as_end'`, metadata: `{ target_teacher_id, target_teacher_email }`.

**Files to CREATE:**
- `app/api/admin/view-as/route.ts` — POST (start), DELETE (end)
- `components/admin/ViewAsBar.tsx` — banner shown inside teacher dashboard during impersonation
- `lib/actions/admin-view-as.ts` — `startViewAsAction(teacherId)`, `endViewAsAction()`

**Files to EDIT:**
- `app/(teacher)/dashboard/layout.tsx` — read `admin_view_as` cookie; if present and not expired, render `<ViewAsBar />`. Pass `isViewAs` bool down to layout so write actions can check.

**Testable criteria:**
- Admin clicks "View as" on teacher detail → confirmation dialog → cookie set → redirected to `/dashboard` with read-only banner.
- Attempting any Server Action while in view-as mode returns 403 "Admin view — writes disabled".
- Clicking "Exit admin view" clears cookie, logs `view_as_end`, redirects back to `/admin/teachers/[teacherId]`.

---

### Step 4: Emergency Password Reset + Test-Account Wipe

#### 4a — Emergency Password Reset

**Files to CREATE:**
- `app/api/admin/teachers/[teacherId]/reset-password/route.ts` — POST handler (already listed in ARCHITECTURE.md §5 but not built)
- `lib/actions/admin-teacher-ops.ts` — `generatePasswordResetLinkAction(teacherId)`

**API route logic:**
```
1. requireAdmin() (verify session from header / cookie)
2. supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email: teacher.email })
3. logAdminActivity: action_type='password_reset_generated', performed_by=admin.email, metadata: { teacher_id, teacher_email }
4. Return { resetLink }
5. Admin copies link and delivers out-of-band (email/phone). Link is single-use.
```

**UI:** Add "Generate Recovery Link" button to `TeacherDetailActions.tsx`. On click → confirm dialog → calls action → shows link in a copyable read-only input. Link never auto-sent by platform.

**Files to EDIT:**
- `components/admin/TeacherDetailActions.tsx` — add "Generate Recovery Link" section

**Testable criteria:**
- Button click → confirmation → link shown (format: Supabase recovery URL).
- admin_activity_log row with `action_type='password_reset_generated'`.
- Second click generates a new link (old one is invalidated by Supabase).

#### 4b — Wipe Test Account

**Files to CREATE:**
- `app/api/admin/teachers/[teacherId]/wipe-test-account/route.ts` — POST (already in ARCHITECTURE.md)

**Guard rules (critical, hard-fail if violated):**
1. Teacher email MUST contain `+test` OR teacher email domain MUST be `test.skoolrooms.com`. Any other email → 403 `NOT_TEST_ACCOUNT`.
2. Requires a confirmation token in request body: admin must type teacher's email to confirm (UI enforced + server-side verified).
3. Logs to admin_activity_log BEFORE deleting (so there's an audit trail even if something fails mid-wipe).

**Wipe order (FK dependency order):**
```
1. assignment_submissions WHERE student in teacher's cohorts
2. attendance WHERE class_session in teacher's cohorts
3. announcement_reads WHERE announcement in teacher's cohorts
4. announcement_comments WHERE announcement in teacher's cohorts
5. announcements WHERE cohort in teacher's cohorts
6. assignments WHERE cohort in teacher's cohorts
7. student_payments WHERE enrollment in teacher's cohorts
8. enrollments WHERE cohort in teacher's cohorts
9. class_sessions WHERE cohort in teacher's cohorts
10. cohorts WHERE teacher_id = teacherId
11. courses WHERE teacher_id = teacherId
12. teacher_subscriptions WHERE teacher_id = teacherId
13. teacher_plan_snapshot WHERE teacher_id = teacherId
14. teacher_balances WHERE teacher_id = teacherId
15. teacher_payment_settings WHERE teacher_id = teacherId
16. admin_activity_log WHERE teacher_id = teacherId (keep for audit — DO NOT delete)
17. R2 files: list and delete by prefix teachers/{teacherId}/*, thumbnails/{teacherId}/*, profiles/{teacherId}/*
18. teachers WHERE id = teacherId
19. supabaseAdmin.auth.admin.deleteUser(teacher.auth_id)
```

**UI:** `WipeTestAccountButton.tsx` in `TeacherDetailActions.tsx`, only rendered if teacher email matches test pattern.

**Testable criteria:**
- Non-test email → button not rendered in UI, POST returns 403.
- Test email + wrong confirmation token → 400.
- Test email + correct confirmation → all rows deleted, Supabase auth user deleted, 200.

---

### Step 5: Plan CRUD + Preview

**Files to CREATE:**
- `lib/db/admin-plans.ts` — `getAllPlans()`, `getPlanWithFeatures()`, `createPlan()`, `updatePlan()`, `archivePlan()`, `deletePlan()`, `getSubscriberCountByPlan()`
- `app/(platform)/admin/plans/page.tsx` — Plan list page (Server Component)
- `app/(platform)/admin/plans/[planId]/page.tsx` — Plan edit page (Server Component)
- `app/(platform)/admin/plans/[planId]/PlanEditForm.tsx` — Client Component (limits + feature toggles)
- `app/(platform)/admin/plans/[planId]/PlanPreviewCard.tsx` — Preview component (shows what a teacher would see for this plan)
- `lib/actions/admin-plans.ts` — `createPlanAction()`, `updatePlanAction()`, `archivePlanAction()`, `deletePlanAction()`

**Files to EDIT:**
- Sidebar nav — add "Plans" entry → `/admin/plans`

**DB helper notes (`lib/db/admin-plans.ts`):**

```typescript
// getAllPlans(): Plan[] — all plans ordered by display_order
// getPlanWithFeatures(planId): { plan: Plan, features: PlanFeature[], featureRegistry: FeatureRegistry[] }
// getSubscriberCountByPlan(planId): number — count teachers currently on this plan (not free, not expired)
// createPlan(input): plan row — INSERT with sensible defaults
// updatePlan(planId, input): — UPDATE limits + feature toggles
//   If any numeric limit LOWERED → trigger grandfathering check:
//     Find teachers on this plan with usage exceeding new limit → insert/update teacher_plan_snapshot
//     Return { affectedCount } so UI can show the grandfathering modal
// archivePlan(planId): — set is_active=false, is_visible=false (cannot un-archive)
// deletePlan(planId): — only if getSubscriberCountByPlan(planId) === 0, else error 'PLAN_HAS_SUBSCRIBERS'
```

**Plan preview:**
- `PlanPreviewCard` renders a read-only card showing plan name, price, limits (courses/students/cohorts/storage), features (enabled/locked), and transaction cut. Identical to the pricing page card but labeled "PREVIEW — not published".
- Show preview inline on the edit page in a two-column layout: left = edit form, right = live preview that updates as admin types (React state, no server round-trip).

**Grandfathering modal:**
- On `updatePlanAction()` response with `affectedCount > 0`: show `GrandfatheredModal` (`components/admin/GrandfatheredModal.tsx`) listing "N teachers will keep their old limits because their usage exceeds the new limit." Two buttons: "Confirm & Apply" (proceed, snapshots already written server-side) / "Cancel" (revert form).
- Snapshots are created server-side atomically with the plan update (both in same action). The modal is purely informational — action already ran.

**Testable criteria:**
- Create new plan → appears in list, teachers can be assigned to it via `changePlanAction`.
- Edit Solo plan limit down → `affectedCount > 0` → modal shown → confirm → affected teachers' snapshots exist.
- Delete plan with 0 subscribers → deleted. Delete plan with 1+ subscribers → error "Plan has active subscribers".
- Archive plan → is_active=false → plan no longer shows in pricing page, hidden from new signups.

---

### Step 6: Grandfathered Teachers List

**Files to CREATE:**
- `lib/db/admin-plans.ts` (add) — `getGrandfatheredTeachers()`: returns teachers who have a `teacher_plan_snapshot` where snapshot limits are MORE generous than the current live plan limits.
- `app/(platform)/admin/plans/grandfathered/page.tsx` — Grandfathered teachers list page (Server Component)
- `components/admin/GrandfatheredTable.tsx` — DataTable (name, email, plan, snapshot date, snapshot vs live limit comparison)

**Files to EDIT:**
- `app/(platform)/admin/plans/page.tsx` — add link "View grandfathered teachers (N)" at top.

**DB query:**
```sql
-- getGrandfatheredTeachers()
SELECT t.id, t.name, t.email, t.plan,
       tps.snapshot_json, tps.captured_at,
       p.max_courses, p.max_students, p.max_cohorts_active, p.max_storage_mb
FROM teacher_plan_snapshot tps
JOIN teachers t ON t.id = tps.teacher_id
JOIN plans p ON p.id = tps.plan_id
WHERE
  (tps.snapshot_json->>'max_courses')::int     > p.max_courses     OR
  (tps.snapshot_json->>'max_students')::int    > p.max_students    OR
  (tps.snapshot_json->>'max_cohorts_active')::int > p.max_cohorts_active OR
  (tps.snapshot_json->>'max_storage_mb')::int  > p.max_storage_mb
ORDER BY tps.captured_at DESC;
```

**Table columns:** Name, Email, Plan, Snapshot Date, Limit Differences (e.g. "Courses: 10 (snapshot) vs 5 (live)"), Actions: "View Teacher" → `/admin/teachers/[id]`.

**Filter options:** Plan dropdown (All / Free / Solo / Academy). Search by name/email (client-side via DataTable).

**Testable criteria:**
- Teacher with snapshot that exceeds current plan limits → appears in list.
- Teacher with snapshot matching current limits → NOT in list.
- Plan dropdown filter works.

---

### Step 7: Activity Log Filterable UI

**Files to CREATE:**
- `app/(platform)/admin/activity/page.tsx` — Global activity log page (Server Component)
- `components/admin/ActivityLogTable.tsx` — DataTable with filters

**Files to EDIT:**
- Sidebar nav — add "Activity" entry → `/admin/activity`
- `app/(platform)/admin/teachers/[teacherId]/page.tsx` — add "View full log" link to `/admin/activity?teacherId=xxx`

**DB helper edits (`lib/db/admin.ts`):**
- Extend `getActivityLog()` to accept `{ teacherId?, actionType?, limit?, offset? }` for pagination.
- Add `getActivityLogCount(filters)` for total count (pagination).

**Page behaviour:**
- Server Component reads `searchParams`: `?teacherId=`, `?actionType=`, `?page=`.
- Renders `ActivityLogTable` (Client Component with shadcn DataTable) pre-populated with server-fetched data.
- Filter bar: Teacher search (by name/email → resolves to teacherId), Action Type dropdown (all known action_type values), Date range (from/to, DateRangeFilter component already exists on the dashboard).
- Pagination: 50 rows/page, server-side (pass page via searchParams → offset in DB query).
- Each row: timestamp (PKT), action type (formatted label), performed_by, teacher name + link (if teacherId present), metadata (collapsible JSON viewer).

**Testable criteria:**
- `/admin/activity` shows all log entries, newest first.
- `?teacherId=X` pre-filters to that teacher.
- `?actionType=suspend_teacher` filters to only suspend events.
- Pagination works: 51 entries → two pages.

---

## Migration Requirements

No new DB schema changes are required for any of the steps above. All tables used (`teacher_plan_snapshot`, `admin_activity_log`, `teachers`, `teacher_subscriptions`, `plans`, `plan_features`, `feature_registry`) already exist in migration `001_initial_schema.sql`. The wipe route uses only existing tables plus the Supabase Auth Admin API.

**Migration 011 is NOT needed** based on current scope. Confirm with team-lead if bulk email requires an `email_delivery_log` schema change (it shouldn't — `email_delivery_log` already exists in schema).

---

## Sidebar Nav Changes Required

All new pages need nav entries. The sidebar is controlled by `constants/nav-items.ts` (role=admin). Add:

| Label | Href | Icon |
|-------|------|------|
| Metrics | `/admin/metrics` | `TrendingUp` |
| Plans | `/admin/plans` | `Layers` |
| Email | `/admin/email` | `Mail` |
| Activity | `/admin/activity` | `ScrollText` |

Existing nav order: Dashboard → Teachers → Payments → Payouts (Lane A) → Plans → Metrics → Email → Activity → Settings → Operations.

---

## File Summary

### New files to CREATE

```
lib/db/admin-metrics.ts
lib/db/admin-plans.ts
lib/actions/admin-email.ts
lib/actions/admin-plans.ts
lib/actions/admin-teacher-ops.ts
lib/actions/admin-view-as.ts

app/(platform)/admin/metrics/page.tsx
app/(platform)/admin/metrics/MrrChart.tsx
app/(platform)/admin/metrics/KpiCards.tsx

app/(platform)/admin/email/page.tsx
app/(platform)/admin/email/BulkEmailForm.tsx

app/(platform)/admin/plans/page.tsx
app/(platform)/admin/plans/[planId]/page.tsx
app/(platform)/admin/plans/[planId]/PlanEditForm.tsx
app/(platform)/admin/plans/[planId]/PlanPreviewCard.tsx
app/(platform)/admin/plans/grandfathered/page.tsx

app/(platform)/admin/activity/page.tsx

app/api/admin/view-as/route.ts
app/api/admin/teachers/[teacherId]/reset-password/route.ts
app/api/admin/teachers/[teacherId]/wipe-test-account/route.ts

components/admin/ActivityLogTable.tsx
components/admin/GrandfatheredTable.tsx
components/admin/GrandfatheredModal.tsx
components/admin/ViewAsBar.tsx
components/admin/WipeTestAccountButton.tsx
```

### Existing files to EDIT

```
types/domain.ts                             — add 'admin_broadcast' to EmailType enum (approved)
lib/db/admin.ts                             — extend getActivityLog() with pagination + filters
components/admin/TeacherDetailActions.tsx  — add Generate Recovery Link + Wipe Test Account buttons
constants/nav-items.ts                      — add Metrics, Plans, Email, Activity to ADMIN_NAV_ITEMS only
```

NOTE: `app/(teacher)/dashboard/layout.tsx` is NOT touched by Lane D. Lane B owns it and will wire ViewAsBar via adminBannerSlot.

---

## Open Questions for Team-Lead

1. **EmailType enum for bulk broadcast:** `sendEmail()` in `lib/email/sender.ts` requires an `EmailType` value. Adding `'admin_broadcast'` requires editing `types/domain.ts`. Is team-lead approving this addition, or should bulk email call Brevo SDK directly (bypassing `sendEmail()` for this one case, skipping notifications_log + email_delivery_log writes)?

2. **View-as approach:** Signed cookie approach chosen (no Supabase magic-link leak). Confirm this is acceptable. Alternative: Supabase `generateLink({ type: 'magiclink' })` gives a direct sign-in URL — admin visits teacher dashboard as that teacher, but this creates a real session in teacher's name and is harder to revoke. Cookie approach is safer.

3. **Should view-as also log every page visit**, or just `view_as_start` + `view_as_end`? If every page, we need middleware to write to admin_activity_log on each request — expensive. Recommend: log start/end only, with timestamp and duration.

4. **MRR time-series data:** The cleanest time-series MRR would require snapshotting active subscriptions monthly (event sourcing). Current schema has `teacher_subscriptions` rows with `period_start`/`period_end`. Proposal: sum `amount_pkr` from confirmed subscriptions grouped by `date_trunc('month', period_start)`. This shows "revenue recognized per month" not "recurring monthly balance". Confirm this definition is acceptable for Phase 2.

5. **Plan CRUD — slug immutability:** Once a plan row is created, the `slug` is used in `teachers.plan` (text FK by convention, not enforced). If admin renames a plan slug, all teachers on that plan would reference a non-existent slug. Recommendation: make slug read-only after creation, only allow name/price/limits/features edits. Confirm.

6. **Bulk email batch size and rate limit:** Brevo free tier is 300 emails/day. If there are more than 300 teachers, a single bulk email will exceed the daily limit. Should the action queue and send 300 today and the rest tomorrow (requires a job queue), or fail with a clear error "Only 300 emails/day on current Brevo plan — upgrade to send to all N teachers"? Recommend the error approach for Phase 2 simplicity.

7. **Activity log UI — should metadata be shown to admin in expanded form?** Current teacher detail page truncates JSON. For the full activity log UI, recommend a collapsible `<pre>` block per row. Confirm no PII concern with metadata values (they contain teacher emails from `performed_by`, plan slugs — no student PII).

---

## Answers from team-lead

1. **Approved: add `'admin_broadcast'` to EmailType enum** in `types/domain.ts`. Route bulk email through `sendEmail()` — the audit trail via `notifications_log` + `email_delivery_log` matters more than convenience. Do NOT bypass sendEmail.

2. **Signed cookie approach approved.** Do NOT use Supabase magic-link — too hard to revoke, too easy to leak. Cookie name `admin_view_as`, HttpOnly, Secure, SameSite=Lax, signed with `CRON_SECRET`, 30-min TTL.

3. **Log start/end only for view-as.** On `view_as_end`, include `duration_seconds` in metadata. Don't log per-page-visit — too noisy, too expensive.

4. **MRR definition approved** (revenue recognized per month from confirmed `teacher_subscriptions.period_start`). Add a small footnote below the MRR chart: "Revenue recognized in each month (confirmed subscriptions). Not a snapshot of active recurring balance."

5. **Slug immutable after creation.** Approved. Edit form disables slug input with tooltip "Slug cannot be changed after plan creation. Archive this plan and create a new one with the desired slug." Name/price/description/limits/features all editable.

6. **Brevo daily-limit: fail fast, no job queue.** Pre-check in `bulkEmailTeachersAction`: `SELECT COUNT(*) FROM teachers WHERE is_suspended=false`. If count > 300, return `{ success: false, error: 'Would exceed Brevo daily limit (300). Current teachers: N. Upgrade Brevo plan to send to all.', code: 'BREVO_LIMIT' }`. UI disables submit button with warning banner when count > 300.

7. **Metadata as collapsible `<pre>` block approved.** Use `<details><summary>View details</summary><pre>{JSON}</pre></details>` — native HTML, zero JS cost.

---

## Cross-Lane Coordination (CRITICAL — from team-lead 2026-04-19)

**Lane D does NOT touch `app/(teacher)/dashboard/layout.tsx`.** Lane B owns all shared layouts including `SidebarShell`.

**ViewAsBar deliverables owned by Lane D (pure, no layout wiring):**
- `lib/admin/view-as-session.ts` — `getViewAsSession()` server-side helper: reads `admin_view_as` cookie, verifies signature against `CRON_SECRET`, checks TTL, returns `{ teacherId, teacherEmail, startedAt } | null`
- `components/admin/ViewAsBar.tsx` — pure presentational component; receives session data as props; renders read-only banner with "ADMIN VIEW — Read only [Exit]" and a form that calls `endViewAsAction()`
- `lib/actions/admin-view-as.ts` — `startViewAsAction(teacherId)`, `endViewAsAction()`; `endViewAsAction` computes `duration_seconds = now - startedAt`, writes `view_as_end` log entry
- `app/api/admin/view-as/route.ts` — POST (start): set cookie + log `view_as_start`; DELETE (end): clear cookie + log `view_as_end` with `duration_seconds`

**Lane B will inject ViewAsBar** into `SidebarShell` via a new `adminBannerSlot` prop. Lane D delivers the component; Lane B wires it in. No coordination needed between lanes for this — just deliver the component with the correct prop interface.

**`supabase_auth_id` fix:** Teacher auth column is `supabase_auth_id`, not `auth_id`. Wipe step 19 is:
```typescript
await supabaseAdmin.auth.admin.deleteUser(teacher.supabase_auth_id)
```

**Nav items:** Only touch `ADMIN_NAV_ITEMS` array in `constants/nav-items.ts`. Do NOT touch teacher or student nav arrays — Lane B owns those.

## Updated File Summary (post team-lead corrections)

### New files to CREATE (final list)

```
lib/db/admin-metrics.ts
lib/db/admin-plans.ts
lib/admin/view-as-session.ts               ← moved from lib/actions/ to lib/admin/
lib/actions/admin-email.ts
lib/actions/admin-plans.ts
lib/actions/admin-teacher-ops.ts
lib/actions/admin-view-as.ts

app/(platform)/admin/metrics/page.tsx
app/(platform)/admin/metrics/MrrChart.tsx
app/(platform)/admin/metrics/KpiCards.tsx

app/(platform)/admin/email/page.tsx
app/(platform)/admin/email/BulkEmailForm.tsx

app/(platform)/admin/plans/page.tsx
app/(platform)/admin/plans/[planId]/page.tsx
app/(platform)/admin/plans/[planId]/PlanEditForm.tsx
app/(platform)/admin/plans/[planId]/PlanPreviewCard.tsx
app/(platform)/admin/plans/grandfathered/page.tsx

app/(platform)/admin/activity/page.tsx

app/api/admin/view-as/route.ts
app/api/admin/teachers/[teacherId]/reset-password/route.ts
app/api/admin/teachers/[teacherId]/wipe-test-account/route.ts

components/admin/ActivityLogTable.tsx
components/admin/GrandfatheredTable.tsx
components/admin/GrandfatheredModal.tsx
components/admin/ViewAsBar.tsx
components/admin/WipeTestAccountButton.tsx
```

### Existing files to EDIT (final list)

```
types/domain.ts                             — add 'admin_broadcast' to EmailType enum
lib/db/admin.ts                             — extend getActivityLog() with pagination + filters
components/admin/TeacherDetailActions.tsx  — add Generate Recovery Link + Wipe Test Account buttons
constants/nav-items.ts                      — add Metrics, Plans, Email, Activity to ADMIN_NAV_ITEMS only
```

Note: `app/(teacher)/dashboard/layout.tsx` is **REMOVED** from Lane D's edit list — Lane B owns it.

## Cross-lane coordination — IMPORTANT

**ViewAsBar layout injection conflict with Lane B.** Lane B owns all teacher/student layout edits. To avoid conflict, split the ViewAsBar responsibility:

- **Lane D creates** (no layout edits from D):
  - `lib/admin/view-as-session.ts` — exports `getViewAsSession()` (reads `admin_view_as` cookie, returns `{ teacherId, teacherEmail } | null`)
  - `components/admin/ViewAsBar.tsx` — pure component, accepts `{ teacherEmail, expiresAt }` props, renders destructive-color stripe with Exit button
  - view-as server actions and API routes
  - Does NOT edit `app/(teacher)/dashboard/layout.tsx`

- **Lane B will edit** `app/(teacher)/dashboard/layout.tsx` to:
  - Call `getViewAsSession()` server-side
  - Pass the session result to `SidebarShell`'s new `adminBannerSlot` prop (ADD THIS PROP along with notificationSlot — it's a single SidebarShell extension)
  - Render `<ViewAsBar teacherEmail={...} />` conditionally inside that slot

I'll coordinate by putting this in Lane B's brief. Lane D: your deliverable for view-as is components + helpers + actions + cookie logic only. No layout.tsx edits.

**Nav items coordination** — `constants/nav-items.ts` is edited by both B and D. Lane B adds to `TEACHER_NAV_ITEMS` + `STUDENT_NAV_ITEMS` (Messages). Lane D adds to `ADMIN_NAV_ITEMS` (Metrics, Plans, Email, Activity). These are separate arrays — no conflict if both implementers carefully scope their edits.

**Migration:** Lane D confirmed no migration needed. Migration 011 unused. Migration 010 is Lane B's.

**Wipe test account step-19 — auth user deletion** — use `supabaseAdmin.auth.admin.deleteUser(teacher.auth_id)`. Confirmed column name is `supabase_auth_id` on the teachers table (not `auth_id`). Update your wipe logic.
