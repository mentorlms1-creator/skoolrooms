# Lane L — Performance Optimization Plan

Pagination at 500+ teachers + edge caching. Goal: platform stays responsive as it scales from <100 to 5000+ teachers without a full rewrite.

---

## Current state (audit)

### Surfaces that load unbounded lists today

Walked the codebase looking for `from('<table>').select(...)` without `.limit()` / `.range()` and confirmed which renders are user-facing.

| Surface | File | Today | Worst-case row count | Notes |
|---|---|---|---|---|
| Public explore page | `app/(platform)/explore/page.tsx:28` | Loads **every** publicly-listed, non-suspended, non-locked teacher; then in JS computes per-teacher cohort/enrollment aggregates | All eligible teachers (potentially 5000+) | Already ISR `revalidate=3600`. JS-side filtering + sort by `student_count`. |
| Explore — cohorts join | `lib/db/explore.ts:89-94` | `cohorts.select(*).in('teacher_id', teacherIds).is('deleted_at', null).neq('status', 'archived')` | Cohorts × teachers — huge | Returned to JS for fee/student-count math |
| Explore — enrollments join | `lib/db/explore.ts:146-150` | `enrollments.select('cohort_id').in('cohort_id', cohortIds).eq('status', 'active')` | All active enrollments across all eligible cohorts | Counted in JS |
| Explore — courses join | `lib/db/explore.ts:101-107` | `courses.select(...).in('teacher_id', teacherIds).eq('status', 'published')` | All published courses across all eligible teachers | For category facets |
| Explore — ratings | `app/(platform)/explore/page.tsx:32` → `getTeacherRatingsMap(teachers.map(t => t.id))` | Two more unbounded queries: all cohorts of all eligible teachers, then all `cohort_feedback` rows for those cohorts | Lane F's helper, `lib/db/feedback.ts:103` | Same N-shaped scan |
| Admin teachers list | `app/(platform)/admin/teachers/page.tsx:17` → `getAllTeachers()` (`lib/db/admin.ts:109`) | All teachers + all their cohorts + all active enrollments → counted in JS | All teachers (5000+) + all their cohorts + active enrollments | Renders into client-side `DataTable` (paginates in browser, but full payload crosses the wire) |
| Admin payouts queue | `app/(platform)/admin/payouts/page.tsx:22` → `getAllPayouts()` (`lib/db/payouts.ts:111`) | Already capped at `.limit(200)`. Mixes pending + history in one page | 200 most recent payouts | OK short-term; needs status-split + history pagination as volume grows |
| Admin pending subscriptions | `app/(platform)/admin/payments/page.tsx:24` → `getPendingSubscriptions()` (`lib/db/admin.ts:908`) | All `teacher_subscriptions` with `status='pending_verification'` | Bounded by ops backlog (rarely >50) | Low priority — workflow keeps queue small |
| Admin activity log | `app/(platform)/admin/activity/page.tsx:51-54` | Already paginated: `getActivityLog({ limit: 50, offset })` + `getActivityLogCount()` | Page-by-page only | Offset pagination — fine until table is huge, then index-only count gets slow. Cursor would be safer at scale. |
| Admin teachers-with-debit | `lib/db/payouts.ts:343` | All teacher_balances rows where `outstanding_debit_pkr > 0`, no limit | Bounded by debt cases | Low priority |
| Admin earnings summary | `lib/db/payouts.ts:381` | All `confirmed` student_payments + all `completed` teacher_payouts (full table scans for sums) | Entire payment history (could reach 10k+ over time) | Needs aggregate pushed into SQL or materialized view |
| Admin top revenue cohorts | `lib/db/admin.ts:832` (`getRevenueByCohort`) | All cohorts + all enrollments + all confirmed payments → JS group/sort | Entire payments table | Needs SQL aggregate (`group by cohort_id`) or denormalized row |
| Admin dashboard plan distribution | `lib/db/admin.ts:434-444` | `teachers.select('plan')` — entire teachers table | All teachers | Should be a SQL `count(*) ... group by plan` |
| Cohort students table | `lib/db/enrollments.ts:303` (`getEnrollmentsByCohort`) | All enrollments for a cohort, joined with student | Bounded by cohort size cap (Section 13 plan limit, but free/solo/academy currently allow 30/100/unlimited per cohort indirectly via plan caps) | Becomes a problem only at "academy" tier with 200+ in a cohort |
| Teacher student list | `app/(teacher)/dashboard/students/page.tsx:23` → `getAllStudentsByTeacher(teacher.id)` (`lib/db/enrollments.ts:474`) | All enrollments across all teacher's cohorts joined with student + cohort + course | Bounded by teacher's plan limit on max_students (e.g. 100 solo, 500 academy, "unlimited" practical: a few thousand) | Renders into client `DataTable` with browser-side paginate |
| Teacher courses list | `app/(teacher)/dashboard/courses/page.tsx:31` → `getTeacherCourses(teacher.id)` | All teacher's courses (no `.limit`) | Plan caps: free 1, solo 10, academy unlimited (a few hundred max) | Acceptable now; switch to paginated grid if "academy" teachers grow large catalogs |
| Teacher cohorts list | various course pages call `lib/db/cohorts.ts` helpers | Per-course cohorts; bounded by per-course count | Acceptable | — |
| Messaging — teacher threads | `lib/db/messages.ts:137` (`getThreadsForTeacher`) | All `direct_messages` involving teacher (sender or recipient), then collapse to threads in JS | Grows linearly with message volume | Will be the worst offender once messaging gets used. Lane B builds it; Lane L hardens it. |
| Messaging — student threads | `lib/db/messages.ts:161` | Same shape | Same | Same |
| Notifications | `lib/db/notifications.ts:67` (`getNotificationsForUser`) | Already capped at `limit=20` | OK | "Show more" needs cursor when we expose history view |
| Teacher subdomain page | `app/(teacher-public)/[subdomain]/page.tsx:19` | `getPublishedCoursesByTeacherWithCurriculum` + `getPublishedTestimonialsByTeacher` per-request | Per-teacher bounded (handful of courses) | **Not cached** — every visit hits DB. Big win available via ISR. |

**Summary of priority work:**

1. **Explore page**: needs cursor pagination + reshape the aggregate queries into SQL `group by` (or a Postgres view) so we stop pulling every cohort/enrollment row into Node.
2. **Admin teachers**: needs server-side pagination (DataTable → server-driven mode).
3. **Admin earnings/revenue/plan-distribution**: push aggregates into SQL.
4. **Teacher subdomain pages**: add ISR with tag-based revalidation.
5. **Activity log**: convert to cursor pagination (keeps page-N navigation working but stable under writes).
6. **Messaging threads** (handoff to Lane B): plan now so Lane B builds with cursor pagination from day 1.

---

## 1. Pagination strategy

### Why cursor pagination

- **Stable under writes.** A new row inserted between page loads doesn't shift indices, so the user never sees duplicates or skipped rows.
- **Constant-time per page.** Offset pagination requires the DB to scan + skip N rows; at 50,000 rows offset=10000 is measurably slow even with an index.
- **Trivial server math.** `WHERE created_at < $cursor.created_at OR (created_at = $cursor.created_at AND id < $cursor.id) ORDER BY created_at DESC, id DESC LIMIT $page_size+1`.

### Where each pattern applies

| Surface | Pattern | URL shape |
|---|---|---|
| Explore (public, infinite scroll) | Cursor on `(created_at DESC, id DESC)` over the *eligible* teacher set. Filtering applied server-side. | `?cursor=<base64({created_at,id})>&limit=24` |
| Admin teachers list | Cursor (preferred) or page+offset (fallback to keep DataTable simple). DataTable extended to support server-driven mode. | `?cursor=...&limit=50&search=...&plan=...` |
| Admin payouts history | Cursor on `(processed_at DESC NULLS LAST, id DESC)` for completed/failed; pending stays unpaged (small set). | `?cursor=...&limit=50&status=history` |
| Admin activity log | **Already** offset paginated (`?page=N`). Migrate to cursor on `(created_at DESC, id DESC)`. Keep `?page` query for one release as backwards-compat redirect. | `?cursor=...&limit=50` |
| Admin pending subscriptions | Stays unpaged (queue is operationally small). Add `.limit(200)` defensive cap. | n/a |
| Admin teachers-with-debit | Stays unpaged; add `.limit(500)` cap with a banner if cap hit. | n/a |
| Cohort students | Cohort sizes capped by plan limits, but add cursor anyway for the rare 500+ cohort. | `?cursor=...&limit=50` |
| Teacher student list | Cursor on `(enrolled_at DESC, enrollment_id DESC)`. DataTable server-mode. | `?cursor=...&limit=50&q=...&status=...` |
| Messaging threads | Cursor on `(last_message_at DESC, thread_id DESC)`. Build into Lane B's design. | `?cursor=...&limit=30` |
| Notifications history | Cursor on `(created_at DESC, id DESC)`. Existing `limit=20` becomes the page size. | `?cursor=...&limit=20` |

### Cursor encoding

- Encode as base64-JSON: `btoa(JSON.stringify({ t: row.created_at, i: row.id }))`. Opaque to clients.
- Decoded server-side; mismatched/invalid cursor → 400, which client treats as "start from page 1".
- Helper lives in `lib/pagination/cursor.ts`:
  ```ts
  export function encodeCursor(row: { created_at: string; id: string }): string
  export function decodeCursor(cursor: string): { created_at: string; id: string } | null
  export type CursorPage<T> = { rows: T[]; nextCursor: string | null }
  ```

### Page size & "load more" UX

- Public explore: infinite scroll (intersection observer triggers next fetch). Page size 24 (3 cols × 8 rows on desktop).
- Admin tables: explicit "Load more" button — admins want predictable navigation, not infinite scroll. Page size 50.
- Cap max `limit` at 100 server-side (defensive — clients can't request 10000 in one shot).

### Don't ship offset+count for big tables

`SELECT count(*)` over a table that's growing into the millions is a heap scan. For activity_log and student_payments, the "page X of Y" UI needs to disappear in favor of "Older / Newer" buttons. Cursor pagination accepts that we don't know the total count — that's fine.

---

## 2. Edge caching

Next.js 16 / Vercel has three relevant levers; we use all three.

### Lever A — ISR via `export const revalidate = N`

Best for whole-page cache (HTML + RSC payload).

| Page | Today | After |
|---|---|---|
| `/explore` | `revalidate = 3600` ✓ | Keep 3600. Add tag-based revalidation (`unstable_cache` on the inner queries) so when a teacher publishes/suspends, the page invalidates within seconds. |
| `/[subdomain]` (teacher public profile) | Dynamic | Add `revalidate = 3600`. Each teacher's page is independent and rarely changes. |
| `/[subdomain]/c/[courseId]` (public course detail) | Lane E1 may build this | Wire ISR `revalidate = 3600` from day 1. |
| `/[subdomain]/join/[token]` | Dynamic | **Stays dynamic** — tokens expire and must always be revalidated server-side. |
| Marketing pages (`/`, `/pricing`, `/about`, `/help`) | Dynamic today | Add `revalidate = 86400` (1 day). |

### Lever B — `unstable_cache` for fine-grained server-function caching

Wrap individual data-layer functions whose results are reusable across many requests.

| Function | Cache key | Tags | TTL |
|---|---|---|---|
| `getExplorableTeachers(filters)` (cursor variant) | `['explore', cursor, JSON.stringify(filters)]` | `['explore-list']` | 600s |
| `getTeacherRatingsMap(ids)` | `['ratings', sorted(ids).join(',')]` | `['ratings']` + per-teacher `ratings:${teacherId}` | 3600s |
| `getTeacherBySubdomain(subdomain)` | `['teacher-public', subdomain]` | `[\`teacher:${teacherId}\`]` (set inside the cached fn after fetch) | 3600s |
| `getPublishedCoursesByTeacherWithCurriculum(teacherId)` | `['teacher-courses', teacherId]` | `[\`teacher-courses:${teacherId}\`]` | 3600s |
| `getPublishedTestimonialsByTeacher(teacherId)` | `['teacher-testimonials', teacherId]` | `[\`teacher-testimonials:${teacherId}\`]` | 3600s |
| `getAllPlans()` (Lane H constant-ish data) | `['plans']` | `['plans']` | 86400s |
| `getPlatformSetting(key)` | `['platform-setting', key]` | `[\`platform-setting:${key}\`]` | 600s |

`unstable_cache` is per-deployment, in-memory + edge — no Redis needed.

### Lever C — Response headers

For dynamic routes that benefit from a short edge cache:

| Route | Header | Reason |
|---|---|---|
| `/explore` (RSC payload variant) | `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600` | Belt-and-braces with ISR |
| `/[subdomain]` | `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400` | Vercel edge holds it warmly |
| API routes returning rating aggregates / public catalogs | `s-maxage=300` | Don't add to write paths |
| Admin routes | **No public caching** — admin pages stay private and uncached |

### Invalidation

`revalidateTag()` is the right primitive in Next 16. Wire into the existing Server Action endpoints:

| Trigger | Tags to invalidate |
|---|---|
| Teacher saves profile (`lib/actions/teachers.ts`) | `teacher:${teacherId}`, `explore-list` |
| Teacher suspends/unsuspends (admin) | `teacher:${teacherId}`, `explore-list` |
| Teacher publishes/unpublishes a course (`lib/actions/courses.ts`) | `teacher-courses:${teacherId}`, `explore-list` |
| Cohort created/archived | `teacher-courses:${teacherId}`, `explore-list` |
| Feedback submitted (`lib/actions/feedback.ts`) | `ratings`, `ratings:${teacherId}`, `explore-list` |
| Testimonial published/unpublished (`lib/actions/testimonials.ts`) | `teacher-testimonials:${teacherId}`, `teacher:${teacherId}` |
| Plan price changed (admin) | `plans` |
| Platform setting updated | `platform-setting:${key}` |

`revalidatePath` calls already exist throughout `lib/actions/*` — Lane L *adds* matching `revalidateTag` calls beside them. Don't replace `revalidatePath` because it covers the page-level ISR, while `revalidateTag` invalidates the inner cached functions.

---

## 3. Index review

Running through `003_indexes.sql` against the cursor columns we'll be reading:

| Cursor / WHERE | Existing index | Action |
|---|---|---|
| `teachers (is_publicly_listed, is_suspended, created_at DESC, id DESC)` for explore cursor | None matching | **Add** `idx_teachers_public_listing` (composite, partial). |
| `teachers (created_at DESC, id DESC)` for admin list cursor | None matching | **Add** `idx_teachers_created_at_id`. |
| `cohorts (teacher_id, deleted_at)` for explore aggregate scan | `idx_cohorts_course_id` only | **Add** `idx_cohorts_teacher_active` (partial: `WHERE deleted_at IS NULL AND status != 'archived'`). |
| `enrollments (cohort_id, status)` | `idx_enrollments_cohort_id` (status not part of key) | **Add** `idx_enrollments_cohort_status` (composite). |
| `enrollments (created_at DESC, id DESC)` for teacher-students cursor | None | **Add** `idx_enrollments_created_at_id`. |
| `cohort_feedback (cohort_id)` for ratings scan | `idx_cohort_feedback_cohort_id` ✓ | OK |
| `direct_messages (thread_id, created_at DESC)` | `idx_direct_messages_thread`, `idx_direct_messages_created_at` (separate) | **Add** composite `idx_direct_messages_thread_created` so per-thread reads are index-only. |
| `direct_messages (recipient_id, recipient_type, created_at DESC)` for thread list | None matching | **Add** `idx_direct_messages_recipient_created` (composite). |
| `admin_activity_log (created_at DESC, id DESC)` cursor | `idx_admin_activity_log_created_at` (single col) | Existing index covers it; cursor scan benefits from a combined `(created_at, id)` only marginally — defer unless we measure a hot spot. |
| `notifications (user_id, user_type, created_at DESC)` | None on `notifications` (table not in 003) | **Add** `idx_notifications_user_created` (composite). |
| `teacher_payouts (status, requested_at DESC)` and `(status, processed_at DESC)` | `idx_teacher_payouts_teacher_status`, `idx_teacher_payouts_created_at` | **Add** `idx_teacher_payouts_status_processed` (partial: `WHERE status IN ('completed','failed')`). |
| `student_payments (status, created_at)` for admin ops counts | `idx_student_payments_created_at` | **Add** partial `idx_student_payments_pending` `WHERE status = 'pending_verification'` for fast queue counts. |
| `courses (teacher_id, status, deleted_at)` for explore category facets | None composite | **Add** `idx_courses_teacher_status_published` (partial: `WHERE status = 'published' AND deleted_at IS NULL`). |

All new indexes are concurrent-safe additions — no rewrites of existing data.

---

## 4. Admin-side patterns

### `DataTable` server-driven mode

`components/ui/DataTable.tsx` is currently client-side only (uses `getPaginationRowModel`, `getFilteredRowModel` — both browser-side). Add a new prop:

```ts
type DataTableProps<TData> = {
  // ...existing...
  serverPagination?: {
    pageSize: number
    nextCursor: string | null
    prevCursor: string | null
    onPageChange: (cursor: string | null) => void  // client handler that pushes URL
    totalCountHint?: number  // optional, for "showing 50 of ~1200" UI
  }
}
```

When `serverPagination` is passed:
- Skip `getPaginationRowModel` (no client paging).
- Render "Load more" / "Older" / "Newer" buttons that call `onPageChange` with the next/prev cursor.
- Keep client-side sorting as a no-op when server-paginated (or expose `serverSorting` callback later).

### Search and filter handling on server-paginated tables

URL-driven filters (search query, status, plan, etc.). On change:
1. Client component reads `useSearchParams`.
2. Updates URL via `router.replace('/admin/teachers?q=...&plan=...&cursor=')`.
3. Server component re-fetches with the new params.
4. Cursor reset to `null` whenever filters change (otherwise the cursor points into the previous filtered set).

For text search (e.g. teacher name), use Postgres `ilike` `%term%` on indexed columns when possible. For multi-column search, add a `tsvector` column in a follow-up — out of scope for this plan.

### Cap row count assumptions

Current admin dashboards assume small result sets. Hard caps:
- Per-page row count: 50 (default), 25, or 100 (selectable).
- Server enforces `Math.min(requested_limit, 100)`.
- "Load more" stops loading after 1000 rows visible (front-end safety) and shows "narrow your filters to see more".

---

## 5. Per-surface refactor recipe

### 5.1 Explore page

**Today:** `getExplorableTeachers()` returns full set; client filters in memory.

**After:**
1. Split helper:
   - `getExplorableTeacherIds(filters, cursor, limit)` → returns `{ teacherIds, nextCursor }` using a single `teachers` query with the filter predicates pushed into SQL where possible (city = exact match, subject_tags overlap via `&&` operator on text[], teaching_levels overlap, fee range as a join).
   - `getExplorableTeacherDetails(teacherIds)` → batches all the joins (cohorts, enrollments, courses, ratings) keyed by the page's teacher IDs only — drops query size from "every teacher" to "24 per page".
2. Wrap `getExplorableTeacherDetails` in `unstable_cache` keyed on the sorted teacher-id list.
3. Page becomes:
   ```ts
   export default async function ExplorePage({ searchParams }: ...) {
     const { city, subject, level, minFee, maxFee, cursor } = await searchParams
     const filters = { city, subject, level, minFee, maxFee }
     const { teacherIds, nextCursor } = await getExplorableTeacherIds(filters, cursor, 24)
     const teachers = await getExplorableTeacherDetails(teacherIds)
     // ratings folded into details fetch
     return <ExploreFilters teachers={teachers} nextCursor={nextCursor} ... />
   }
   ```
4. `ExploreFilters` adds an intersection-observer "Load more" trigger that pushes `?cursor=` into the URL. URL stays shareable.
5. Filter dropdowns (subject/level/city) are now derived from the *paginated* set, which means the dropdown can't include options that aren't on the current page. Solve with a separate, cached `getExploreFacets()` call that returns distinct subject_tags / teaching_levels / cities across the full eligible set — small payload, cached 1h with tag `explore-list`.

### 5.2 Admin teachers list

**Today:** `getAllTeachers()` pulls everything.

**After:**
1. New `getAdminTeachersPage({ cursor, limit, search, plan, status })` returning `{ rows, nextCursor }`.
2. The student count per teacher should *not* be a JS aggregate over all enrollments. Either:
   - **Best:** add a `student_count` column on `teachers` that's maintained by trigger on enrollment insert/update (out of scope for Lane L — use option B for now).
   - **Now:** compute student counts only for the visible page (50 rows × ~N cohorts per teacher) using a single `cohorts → enrollments` pair query scoped to those teacher IDs.
3. Wire `TeacherListTable` to use DataTable's new `serverPagination` prop.
4. URL-sync: `/admin/teachers?cursor=&q=&plan=&status=`.

### 5.3 Admin payouts page

**Today:** `getAllPayouts()` returns 200 mixed rows; UI splits into pending vs history.

**After:**
1. Split: `getPendingPayouts()` (no limit needed — pending queue is small, but cap at 200 defensively) + `getPayoutHistoryPage({ cursor, limit })`.
2. Pending list renders as today; History becomes a cursor-paginated list with "Load more".
3. Tags: `payouts-pending` (invalidated on payout state change), `payouts-history`.

### 5.4 Admin activity log

**Today:** offset pagination via `?page=N` works fine until the table grows past ~100k rows.

**After:**
1. Add `getActivityLogCursor({ cursor, limit, teacherId, actionType })` returning `{ rows, nextCursor }`.
2. Drop `getActivityLogCount` from the page — replace "Page N of M" UI with "Newer / Older" buttons.
3. Backwards-compat: if `?page=` is present in URL, redirect to cursor mode (or keep both for one release).

### 5.5 Admin earnings / revenue aggregates

**Today:** `getAdminEarningsSummary()` and `getRevenueByCohort()` SELECT entire confirmed-payments table into Node and reduce in JS.

**After:**
1. Replace with SQL aggregate calls via `supabase.rpc('admin_earnings_summary')` and `supabase.rpc('admin_revenue_by_cohort')` — push the `SUM` and `GROUP BY` into Postgres.
2. Define functions in a new migration `018_admin_aggregate_functions.sql` (out of Lane L's index migration). For Lane L, document the need but do **not** ship the SQL — call this out as follow-up.

### 5.6 Teacher subdomain page

**Today:** Dynamic per request.

**After:**
1. Add `export const revalidate = 3600` to `app/(teacher-public)/[subdomain]/page.tsx`.
2. Add `generateStaticParams` returning the top N teachers by traffic (out of scope for Lane L data-wise — start with empty array, ISR fills cache lazily on first hit).
3. Wrap `getTeacherBySubdomain`, `getPublishedCoursesByTeacherWithCurriculum`, and `getPublishedTestimonialsByTeacher` in `unstable_cache` with per-teacher tags as listed in §2 Lever B.
4. On profile/course/testimonial mutations, call `revalidateTag(\`teacher:${teacherId}\`)`.

### 5.7 Teacher student list

**Today:** Loads all enrollments × students × cohorts × courses into memory.

**After:**
1. New `getStudentsByTeacherPage({ teacherId, cursor, limit, q, status })` that returns `{ rows, nextCursor }`.
2. Top-of-page stat cards (`unique students`, `active`, `pending`) need totals — keep a separate, cheap `getStudentStatsByTeacher(teacherId)` using `count` queries (not a full row pull). Three `count` queries vs one `select *` is a big win at scale.
3. `StudentTable` uses DataTable server mode.

### 5.8 Cohort students table

Sub-bounded by plan limits, but: add the same cursor pattern (`getEnrollmentsByCohortPage({ cohortId, cursor, limit })`). Default page size 50.

### 5.9 Messaging threads (Lane B handoff)

Lane B is building messaging — Lane L delivers a *requirement* doc to Lane B, not code:

> Build `getThreadsForTeacherPage({ teacherId, cursor, limit })` from day 1, cursor on `(last_message_at DESC, thread_id DESC)`.
> Don't compute per-thread `unread_count` by scanning every message — store it on a `message_threads` table updated by trigger, or compute it via a single `select thread_id, count(*) ... group by thread_id where read_at is null and recipient_id=...`.

Add this note to `PLAN_B_messaging.md` follow-ups list (do not edit Lane B's plan in this lane — flag in the SendMessage to team-lead).

### 5.10 Notifications

Already capped at 20. When we build a "show all notifications" view, use cursor pagination from the start.

---

## 6. Migration

`supabase/migrations/017_pagination_indexes.sql`:

```sql
-- ============================================================================
-- 017_pagination_indexes.sql
-- Indexes supporting cursor pagination + filter pushdown for Lane L.
-- All indexes are CREATE INDEX IF NOT EXISTS so the migration is idempotent.
-- Use CONCURRENTLY in production to avoid table locks.
-- ============================================================================

-- TEACHERS — explore cursor + admin list cursor
CREATE INDEX IF NOT EXISTS idx_teachers_public_listing
  ON teachers (created_at DESC, id DESC)
  WHERE is_publicly_listed = true AND is_suspended = false;

CREATE INDEX IF NOT EXISTS idx_teachers_created_at_id
  ON teachers (created_at DESC, id DESC);

-- COHORTS — explore aggregate scan
CREATE INDEX IF NOT EXISTS idx_cohorts_teacher_active
  ON cohorts (teacher_id)
  WHERE deleted_at IS NULL AND status <> 'archived';

-- ENROLLMENTS — cohort+status filter, cursor for teacher students page
CREATE INDEX IF NOT EXISTS idx_enrollments_cohort_status
  ON enrollments (cohort_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_created_at_id
  ON enrollments (created_at DESC, id DESC);

-- COURSES — explore category facets
CREATE INDEX IF NOT EXISTS idx_courses_teacher_status_published
  ON courses (teacher_id)
  WHERE status = 'published' AND deleted_at IS NULL;

-- DIRECT_MESSAGES — per-thread + per-recipient cursor scans
CREATE INDEX IF NOT EXISTS idx_direct_messages_thread_created
  ON direct_messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_created
  ON direct_messages (recipient_id, recipient_type, created_at DESC);

-- NOTIFICATIONS — per-user cursor scan
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, user_type, created_at DESC);

-- TEACHER_PAYOUTS — history cursor
CREATE INDEX IF NOT EXISTS idx_teacher_payouts_status_processed
  ON teacher_payouts (status, processed_at DESC NULLS LAST)
  WHERE status IN ('completed', 'failed');

-- STUDENT_PAYMENTS — fast pending-queue counts
CREATE INDEX IF NOT EXISTS idx_student_payments_pending
  ON student_payments (created_at DESC)
  WHERE status = 'pending_verification';
```

Notes:
- **No data migration** — pure index adds.
- Ship as a single migration; they're cheap on a small table and acceptable on bigger ones if `CONCURRENTLY` is used (Supabase migrations support it via `set lock_timeout`).
- Migration file does *not* include `CONCURRENTLY` keyword by default — Lane L's recommendation is to add it manually before running on production (Supabase migration runner blocks `CONCURRENTLY` in transactions, so we'd run this one outside a transaction).

---

## 7. Files summary

### Create
- `supabase/migrations/017_pagination_indexes.sql` — index additions per §6.
- `lib/pagination/cursor.ts` — `encodeCursor`, `decodeCursor`, `CursorPage<T>` helpers.
- `lib/pagination/limits.ts` — shared `MAX_PAGE_SIZE = 100`, `DEFAULT_PAGE_SIZE = 50`, `EXPLORE_PAGE_SIZE = 24`.
- `docs/phase3/PLAN_L_performance.md` — this file.

### Edit
- `lib/db/explore.ts` — split into `getExplorableTeacherIds(filters, cursor, limit)` + `getExplorableTeacherDetails(ids)` + `getExploreFacets()`. Wrap details + facets in `unstable_cache` with tag `explore-list`.
- `lib/db/feedback.ts` — wrap `getTeacherRatingsMap` in `unstable_cache` with `ratings` tag.
- `lib/db/teachers.ts` — add `getTeacherBySubdomain` cache wrapper (tag `teacher:${id}`).
- `lib/db/courses.ts` — add cache wrapper around `getPublishedCoursesByTeacherWithCurriculum` (tag `teacher-courses:${id}`); add `getTeacherCoursesPage` for future paginated list (deferred — flag only).
- `lib/db/testimonials.ts` — cache wrapper around `getPublishedTestimonialsByTeacher` (tag `teacher-testimonials:${id}`).
- `lib/db/admin.ts` — add `getAdminTeachersPage`, `getStudentStatsByTeacher`, `getActivityLogCursor`. Keep old functions for one release (deprecate via comment).
- `lib/db/payouts.ts` — split `getAllPayouts` into `getPendingPayouts` + `getPayoutHistoryPage`.
- `lib/db/enrollments.ts` — add `getStudentsByTeacherPage`, `getEnrollmentsByCohortPage`. Keep `getAllStudentsByTeacher` for migration window then delete.
- `lib/actions/teachers.ts` / `lib/actions/courses.ts` / `lib/actions/feedback.ts` / `lib/actions/testimonials.ts` / `lib/actions/admin.ts` / `lib/actions/admin-plans.ts` — beside each existing `revalidatePath`, add matching `revalidateTag` calls per the table in §2.
- `components/ui/DataTable.tsx` — add `serverPagination?: { ... }` prop and switch off client paging when present.
- `app/(platform)/explore/page.tsx` — read cursor from `searchParams`, call new paginated helpers, pass `nextCursor` and `facets` to `ExploreFilters`.
- `app/(platform)/admin/teachers/page.tsx` — read cursor + filters, call `getAdminTeachersPage`, pass to `TeacherListTable` server-paginated.
- `app/(platform)/admin/payouts/page.tsx` — split fetches; render History as cursor-paginated section.
- `app/(platform)/admin/activity/page.tsx` — switch from offset to cursor reads.
- `app/(teacher)/dashboard/students/page.tsx` — read cursor + filters, call `getStudentsByTeacherPage`, render stats from `getStudentStatsByTeacher`.
- `app/(teacher)/dashboard/courses/[courseId]/cohorts/[cohortId]/students/page.tsx` — paginated cohort enrollments.
- `app/(teacher-public)/[subdomain]/page.tsx` — add `export const revalidate = 3600`; rely on inner `unstable_cache` calls for tag-based invalidation.
- `app/(teacher-public)/[subdomain]/layout.tsx` — set `Cache-Control` header on the response (via `headers()` or middleware) for edge-CDN caching.
- `components/public/ExploreFilters.tsx` — add intersection-observer "Load more" + URL cursor sync; consume `facets` prop.
- `components/admin/TeacherListTable.tsx` — wire to DataTable server-pagination mode + URL search params.

### No change
- `supabase/migrations/001_initial_schema.sql` — no schema changes, only indexes.
- RLS policies (`002_rls_policies.sql`) — no policy changes; cursor reads still go through `createAdminClient()` server-side.
- `lib/email/*`, `lib/r2/*`, `lib/payment/*` — out of scope.

---

## 8. Non-goals (explicit)

- **No Redis / Upstash caching layer.** ISR + `unstable_cache` cover the load profile until 5000+ teachers / 100k+ DAU. Revisit when p95 TTFB > 500ms after this lane ships.
- **No database read replicas.** Supabase Pro supports them but cost/complexity outweighs benefit at MVP scale.
- **No DataLoader / fully de-N+1'd query layer.** Lane L de-N+1s only the worst offenders (explore, admin teachers, admin earnings); the rest stay as is.
- **No CDN beyond Vercel Edge.** No CloudFront / Fastly. Vercel's built-in edge is good enough.
- **No materialized views.** Considered for the explore page rating aggregate (see PLAN_F note about `teacher_rating_aggregates` view). Defer until measurement says it's needed — `unstable_cache` + per-teacher invalidation should suffice up to several thousand teachers.
- **No background job queue for cache warming.** Cold-cache hits go through normal ISR generation; we do not pre-warm.
- **No PostgreSQL `tsvector` full-text search.** Admin search stays `ilike` until a teacher reports it's slow on their list.
- **No SQL aggregate functions in this lane** (admin earnings/revenue) — flagged as a follow-up requiring its own migration `018_admin_aggregate_functions.sql`.

---

## 9. RLS check

- All paginated reads go through `createAdminClient()` (service role) on the server side — same pattern the codebase already uses. No client-side Supabase paginated reads introduced.
- `unstable_cache` runs server-side only; cached payloads never expose internal IDs that aren't already public (teacher IDs, course IDs).
- `revalidateTag` calls must run from Server Actions / server contexts; never from Client Components. The plan respects this.
- No cross-tenant cache key collisions: every per-teacher cache key includes `teacherId`. Admin caches are not exposed to teacher/student routes.

---

## 10. Edge cases (consolidated)

| Case | Behavior |
|---|---|
| Cursor decoded but row no longer exists (deleted between renders) | Server falls back to `WHERE created_at < $cursor.created_at` (drops the `OR id <` tiebreak) — equivalent to "page from this timestamp"; one row may repeat or be missed but UI does not crash. |
| Filter changes but cursor not reset on client | Server resets cursor to `null` whenever any filter param differs from the cursor's encoded snapshot. Cursor encoded with `filters_hash` field for this check. |
| User holds `Load more` button down (rapid double-fire) | Client component guards with `isLoadingMore` boolean; ignores additional triggers until previous request resolves. |
| Search `q` param changes mid-scroll | URL update with `cursor=null`; client resets list to first page. |
| `unstable_cache` returns stale data right after a mutation | Server Action calls `revalidateTag` synchronously before redirect/return. Browser's next request rebuilds the cache. Race window measured in ms. |
| ISR page invalidated mid-render | Next 16 serves stale-while-revalidate; the stale render returns immediately, fresh render completes in background. Acceptable. |
| Admin enables 100-row page size on a slow connection | Initial paint takes longer; cursor still works. Client persists choice in `localStorage`. |
| Empty result with cursor (out-of-bounds page) | Server returns `{ rows: [], nextCursor: null }`; UI shows "No more results" instead of error. |
| Index not yet created in dev DB | Queries still work (Postgres uses seq-scan fallback) — slower but correct. Migration must run before Lane L code ships to prod. |
| Tag invalidation propagates to a page that's currently being rendered | Next 16 cache layer atomic — render either uses old or new, never both halves. |
| Public explore deep-link with `?cursor=` in the URL | Server-rendered initial paint respects the cursor; cards from page 1 not visible. UX choice: should `?cursor=` be a "permalink to position N" or always reset to page 1 on direct visit? **Decision: respect it.** Users sharing such links is rare; SEO crawlers see page 1 anyway because they don't carry cursors. |
| Teacher unpublishes profile mid-render of explore | Cached page may still show them for up to 600s. `revalidateTag('explore-list')` from the unpublish action shrinks this to seconds. |
| 5000+ eligible teachers — query cost on first page render | `idx_teachers_public_listing` makes the cursor scan O(log n + page_size). Without index, seq scan would be 100ms+. With index: <5ms. |

---

## 11. Test plan

### Synthetic load
- Seed script: insert 600 fake teachers (mix of plans, half publicly listed) + 5–20 cohorts each + 0–100 enrollments per cohort + sprinkle `cohort_feedback` rows.
- Measure explore page TTFB via `curl -w '%{time_starttransfer}'` before/after Lane L. Target: <300ms cold (with index), <50ms warm (ISR hit).
- Same for admin teachers list with 1000 teachers — target: <500ms initial paint.

### Functional
- Cursor pagination: load page 1 → click "Load more" → URL updates → reload page → still on the second batch. Inserting a row at the top between loads does not duplicate or skip.
- Filter change: applying `?city=Lahore` resets cursor.
- Cache invalidation: edit teacher profile → reload `/explore` within 30s → updated profile visible (tag invalidation).
- Cache invalidation: submit cohort feedback → teacher's rating badge on `/explore` updates within 30s.
- Index sanity: `EXPLAIN ANALYZE` on the explore cursor query shows index scan on `idx_teachers_public_listing`, not seq scan.

### Vercel preview
- Deploy to preview branch, hit `/explore` and `/[subdomain]` from `curl -I` and confirm `cache-control: s-maxage=...` headers present.
- Lighthouse on `/explore`: target LCP < 2.5s, TBT < 200ms.

### No automated tests in this lane
Repo has no Jest / Vitest / Playwright setup. All testing manual + via Vercel preview.

---

## 12. Out-of-scope follow-ups (logged for future lanes)

1. **`018_admin_aggregate_functions.sql`** — SQL functions for `admin_earnings_summary`, `admin_revenue_by_cohort`, `admin_plan_distribution`. Removes large in-memory reductions in `lib/db/admin.ts` and `lib/db/payouts.ts`.
2. **`teacher_rating_aggregates` materialized view** — refresh on cohort_feedback insert via trigger. Drops explore-page query count from 4 to 3.
3. **Triggered `student_count` denormalization** — adds `teachers.student_count int` maintained by enrollment trigger. Drops admin teachers list from 3 queries to 1.
4. **`message_threads` summary table** — pre-aggregated unread counts and last_message_at for messaging UX. Coordinate with Lane B before they finalize the schema.
5. **`tsvector` full-text search** for admin teacher search and explore search-by-name.
6. **Upstash Redis cache layer** when in-process `unstable_cache` cache misses become a problem (multi-region or extreme write rates).
7. **Edge function for the explore cursor query** to push first paint inside Vercel Edge runtime — only if cold TTFB exceeds budget.
