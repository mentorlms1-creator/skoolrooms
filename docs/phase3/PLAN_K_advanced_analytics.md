# Lane K — Advanced Admin Analytics (NRR + Cohort Performance)

---

## Scope Statement

Extend the existing admin metrics dashboard with two SaaS-grade analytics views:

1. **Net Revenue Retention (NRR)** — for teachers paying at month M, what fraction of that revenue is retained at month M+N (3, 6, 12)?
2. **Cohort-level teacher performance** — for teachers who signed up in month M, what fraction are still active at M+1, M+3, M+6, M+12?

Both views are admin-only, derived on-demand (no new tables), cached with `unstable_cache` (1h TTL). Lane D shipped `lib/db/admin-metrics.ts` with `getMrrTimeSeries`, `getChurnMetrics`, `getConversionMetrics`, `getAdminKpiMetrics`. **This plan EXTENDS that work — do not rewrite Lane D's helpers.**

---

## Current State (Audit)

### Admin metrics already shipped (Lane D)

| File | Purpose |
|------|---------|
| `lib/db/admin-metrics.ts` | `getMrrTimeSeries(months)`, `getChurnMetrics()`, `getConversionMetrics()`, `getAdminKpiMetrics()` |
| `app/(platform)/admin/metrics/page.tsx` | Server Component. Fetches MRR + KPIs, renders chart + cards. Period selector (3/6/12 months via `?months=`). |
| `app/(platform)/admin/metrics/MrrChart.tsx` | Client Component, Recharts LineChart, dynamic-import-friendly. |
| `app/(platform)/admin/metrics/KpiCards.tsx` | Client Component, 4 stat cards (ARPU, LTV, Churn, Conversion). |

### Sidebar nav (constants/nav-items.ts)

`ADMIN_NAV_ITEMS` already contains a `Metrics` entry pointing to `/admin/metrics` (icon `TrendingUp`, group `Management`). No new nav entry needed for Lane K — advanced analytics lives as a sub-route or tab under the existing Metrics page.

### Schema facts (verified against `supabase/migrations/001_initial_schema.sql`)

- `plans` table column for monthly subscription cost is **`price_pkr`** (int, PKR). Brief mentioned `monthly_price_pkr` — that does not exist; correct column is `price_pkr`.
- `teachers` columns relevant: `id`, `created_at`, `plan` (text — slug, e.g. `'free'`, `'solo'`, `'academy'`), `is_suspended` (bool), `plan_expires_at` (timestamptz, nullable), `supabase_auth_id`.
- `teacher_subscriptions`: `teacher_id`, `plan` (text slug), `amount_pkr` (int), `status` (text — `'confirmed'` is the success state), `period_start` (date), `period_end` (date), `approved_at` (timestamptz), `created_at` (timestamptz).
- **No `refunded_at` column on `teacher_subscriptions`.** Refund tracking exists on `student_payments` (`refunded_at`, `refund_note`, `platform_absorbed_refund`) — that is student→teacher refunds, NOT teacher subscription refunds. Teacher subscription refunds are not tracked in the current schema. **Plan implication: NRR cannot subtract teacher subscription refunds; we treat each `confirmed` row at face value.** Document this limitation in the page footnote.

### Time helpers available (`lib/time/pkt.ts`)

- `firstOfMonthPKT(date)` → `'YYYY-MM-01'` string in PKT
- `monthlyBillingSchedule(start, end)` → array of `'YYYY-MM-01'` between two ISO date strings
- `formatPKT(utc, format)` → display formatting
- `currentPKT()` → current PKT-shifted Date

---

## Gap vs Lane D

Lane D produced **point-in-time** metrics: current MRR, current churn (ever-paid teachers now non-paying), current conversion. None of Lane D's helpers compute **cohort-relative** metrics — i.e. "of teachers who were paying in month M, what % are still paying in M+12?" That is the NRR / cohort-retention gap this plan fills.

---

## Design Decisions (locked before implementation)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module location | New file `lib/db/admin-advanced-metrics.ts` | Lane D's `admin-metrics.ts` is already 173 lines and conceptually scoped to point-in-time KPIs. Cohort-relative analytics is a distinct concern — a separate file keeps both modules under 300 LOC and prevents accidental edits to Lane D's surface. |
| Compute strategy | On-demand at view time | Teacher count is small (<1000). No materialized table. Revisit if 1s budget breached. |
| Caching | `unstable_cache(fn, key, { revalidate: 3600 })` keyed on the current PKT day (`firstOfMonthPKT(currentPKT())` is too coarse — use ISO date string of today in PKT). | Admin metrics tolerate 1h staleness; recompute at most once/hour. |
| Routing | New sub-route `app/(platform)/admin/metrics/advanced/page.tsx` | Inline-tab on `/admin/metrics` would re-fetch all of Lane D's queries on every tab toggle — wasteful. Sub-route is cleaner, lets Lane D's page stay untouched, gives users a bookmarkable URL. Add a "View advanced analytics →" link at the bottom of `/admin/metrics`. |
| Nav | No new top-level nav entry | Advanced analytics is a power-user drill-down, not a daily-use page. Discoverable from `/admin/metrics`. |
| Charts | Recharts (already installed, used by Lane D) | Match existing visual style. Lazy-load the chart component (Client Component imported as-is — no SSR concerns since Lane D already does the same). |
| Timezone | All month buckets computed in PKT via `firstOfMonthPKT` | Consistency with Lane D's MRR series and BUILD_PLAN rule "all display in PKT". |
| Free plan in NRR | Excluded from numerator AND denominator | NRR measures revenue retention; free plan generates zero revenue. Including them would dilute the metric. |
| Re-signup case | Counted as recovered (revenue restored) | Standard SaaS NRR convention: if a teacher churned mid-window and re-subscribed by month M+N, they contribute their M+N revenue to the retained bucket. |
| Plan price change mid-window | Use teacher's actual price at M+N | Standard NRR — that's the entire point of the metric (captures expansion/contraction). |
| Teacher subscription refunds | Not subtracted (no schema support) | Documented limitation in page footnote. |

---

## Module Spec — `lib/db/admin-advanced-metrics.ts`

All queries use `createAdminClient` (service role, bypasses RLS — intentional for admin metrics, same pattern as Lane D).

### Type definitions

```typescript
export type NrrCohortPoint = {
  cohortMonth: string         // 'YYYY-MM' — the starting month M
  startingMrr: number         // sum of paying teachers' price_pkr in month M
  retainedMrr: number         // sum of those same teachers' price_pkr at M+N (0 if churned)
  retainedTeacherCount: number
  churnedTeacherCount: number
  startingTeacherCount: number
  nrrPercent: number          // retainedMrr / startingMrr * 100; null/0 if startingMrr=0
}

export type NrrMetrics = {
  nrr3: NrrCohortPoint | null   // most recent cohort with full 3-month window available
  nrr6: NrrCohortPoint | null
  nrr12: NrrCohortPoint | null  // headline metric
  // Waterfall breakdown for NRR_12 cohort
  waterfall: {
    starting: number
    expansion: number     // teachers who upgraded plan; (newPrice - oldPrice) summed
    churn: number         // teachers who left; oldPrice summed (subtract)
    contraction: number   // teachers who downgraded; (oldPrice - newPrice) summed (subtract)
    ending: number        // starting + expansion - churn - contraction
  } | null
}

export type SignupCohortRow = {
  cohortMonth: string         // 'YYYY-MM'
  signedUp: number            // total teachers signed up in this month
  active1m: number            // count active at M+1
  active3m: number
  active6m: number
  active12m: number
  retention1m: number         // active1m / signedUp * 100
  retention3m: number
  retention6m: number
  retention12m: number
}

export type CohortRetentionTable = {
  rows: SignupCohortRow[]     // newest first, last 18 cohorts
}
```

### Function: `getNrrMetrics()`

**Strategy:** for each horizon N in [3, 6, 12]:

1. Pick cohort month M = `firstOfMonthPKT(now) - (N+1) months` (most recent month where M+N has a complete view).
2. Query teachers paying in month M:
   ```sql
   SELECT DISTINCT ts.teacher_id, ts.plan, ts.amount_pkr
   FROM teacher_subscriptions ts
   WHERE ts.status = 'confirmed'
     AND ts.period_start <= <end_of_M>
     AND ts.period_end   >= <start_of_M>
   ```
   For each teacher in M, take the **latest** confirmed sub overlapping M as their "starting" plan + amount.
3. For each of those teachers, query their state at M+N:
   ```sql
   SELECT teacher_id, plan, amount_pkr
   FROM teacher_subscriptions
   WHERE status = 'confirmed'
     AND teacher_id = ANY(<starting_ids>)
     AND period_start <= <end_of_M+N>
     AND period_end   >= <start_of_M+N>
   ```
   Latest overlapping confirmed sub wins.
4. Also fetch each teacher's CURRENT `plan` and `is_suspended` state from `teachers` table at M+N month — if `is_suspended` was true at M+N, treat as churned (amount = 0). Note: we don't have historical suspension state, so use current state as proxy. **Document limitation: suspension is not time-travel accurate.**
5. Compute per-teacher delta: `endingAmount - startingAmount`. Sum into buckets:
   - `expansion` = sum of positive deltas where teacher still active
   - `contraction` = sum of `|delta|` where delta is negative AND teacher still active
   - `churn` = sum of `startingAmount` where teacher has no overlapping confirmed sub at M+N
6. `retainedMrr = startingMrr + expansion - churn - contraction`
7. `nrrPercent = round(retainedMrr / startingMrr * 100)`. Healthy SaaS sees ≥100% (expansion outpaces churn).
8. Build waterfall only for the NRR_12 cohort.

**Edge cases:**
- Cohort month M has zero paying teachers → return `null` for that horizon (can't compute retention of zero).
- Teacher had a sub overlapping M but `amount_pkr = 0` (free trial sub row, if any exist) → exclude.
- Teacher had multiple subs overlapping M (e.g. trial + paid) → take the row with the highest `amount_pkr` (the paying one).
- Plan price changed in the live `plans` table mid-window → irrelevant; we use `teacher_subscriptions.amount_pkr` snapshot, not live `plans.price_pkr`. ✓
- Teacher in M is now on `'free'` plan with no overlapping confirmed sub at M+N → churned. ✓
- Teacher re-signed: had sub in M, churned at M+3, re-confirmed at M+10. Has overlapping confirmed sub at M+12 → counted as retained. ✓

### Function: `getCohortRetentionTable()`

**Strategy:**

1. Compute cohort month list: last 18 PKT months, ending at the most recent **completed** month (`firstOfMonthPKT(now)` minus 1).
2. For each cohort month M:
   - `signedUp` = `SELECT COUNT(*) FROM teachers WHERE created_at >= <start_of_M> AND created_at < <end_of_M>` (created_at is UTC — convert M boundaries to UTC for the query, but cohort label stays PKT-relative).
   - For each horizon h in [1, 3, 6, 12] months:
     - If `M + h months > current PKT month` → leave that cell as `null` (cohort not yet old enough).
     - Else: count those teachers who, at the snapshot point M+h, have:
       - A confirmed `teacher_subscriptions` row overlapping M+h month, AND
       - `is_suspended = false` currently (proxy — same limitation as NRR).
3. Return rows newest-cohort-first.

**"Active" definition (locked):** has a confirmed `teacher_subscriptions` row overlapping the snapshot month AND is not currently suspended. Free plan is NOT active (matches brief).

**Edge cases:**
- Cohort with `signedUp = 0` → skip the row entirely (don't render an all-`—` row).
- Horizon hasn't elapsed yet → cell renders as `—` in UI.
- Teacher signed up M, never paid → counts toward `signedUp`, never toward any active cell. Retention = 0.
- Teacher signed up M, paid M+2, paid M+6, lapsed → retention1m = 0, retention3m = active (overlap at M+3? need confirmed sub overlapping M+3 month — depends on period_end), retention6m = active, retention12m = depends.

### Caching wrapper

```typescript
import { unstable_cache } from 'next/cache'

export const getNrrMetricsCached = unstable_cache(
  async () => getNrrMetrics(),
  ['admin-nrr-metrics'],
  { revalidate: 3600, tags: ['admin-metrics'] }
)

export const getCohortRetentionTableCached = unstable_cache(
  async () => getCohortRetentionTable(),
  ['admin-cohort-retention'],
  { revalidate: 3600, tags: ['admin-metrics'] }
)
```

Page calls the `*Cached` variants. Test paths can call the raw functions.

---

## Page Spec — `app/(platform)/admin/metrics/advanced/page.tsx`

**Type:** Server Component.

**Layout (single column, matches Lane D's style):**

```
[Header]
  H1: "Advanced Analytics"
  Subtitle: "Net revenue retention and cohort-level teacher performance."
  Back link: "← Metrics" → /admin/metrics

[NRR Section]
  Card: "Net Revenue Retention"
    Three big stat cards in a 3-col grid:
      - NRR_3:  "108%" with sub "3-month cohort: Mar 2026"
      - NRR_6:  "112%" with sub "6-month cohort: Dec 2025"
      - NRR_12: "121%" with sub "12-month cohort: Jun 2025"  [highlighted as primary]

  Card: "NRR_12 Waterfall (Jun 2025 → Jun 2026)"
    Recharts BarChart (waterfall style: starting | +expansion | -churn | -contraction | ending)
    Labels with PKR values
    Colored bars: starting=primary, expansion=green, churn=destructive, contraction=warning, ending=primary

[Cohort Retention Section]
  Card: "Teacher Cohort Retention"
    Description: "Of teachers who signed up in month M, what % are still paying at +1m / +3m / +6m / +12m?"
    Table (last 18 cohorts, newest first):
      | Cohort Month | Signed Up | +1m | +3m | +6m | +12m |
      | Apr 2026     | 23        | 78% |  —  |  —  |  —   |
      | Mar 2026     | 19        | 84% | 68% |  —  |  —   |
      | ...
    Cells render as "—" when horizon not yet elapsed.

  Card: "Cohort Retention Curves"
    Recharts LineChart with multiple lines (one per cohort, last 6 cohorts only — more lines would be unreadable).
    X-axis: months since signup (0, 1, 3, 6, 12)
    Y-axis: retention %
    Legend: cohort month label.

[Footer]
  Small text:
    "NRR uses confirmed teacher_subscriptions only. Refunds are not subtracted (not tracked in current schema). Suspension state is current-snapshot, not time-travel accurate. Cached 1h."
```

**Files to create for the page:**

| File | Purpose | Component type |
|------|---------|---------------|
| `app/(platform)/admin/metrics/advanced/page.tsx` | Server Component, fetches both helpers | Server |
| `app/(platform)/admin/metrics/advanced/NrrCards.tsx` | 3 stat cards + waterfall chart container | Client (chart needs interactivity) |
| `app/(platform)/admin/metrics/advanced/NrrWaterfallChart.tsx` | Recharts BarChart waterfall | Client |
| `app/(platform)/admin/metrics/advanced/CohortRetentionTable.tsx` | Table component | Client (if sortable) or Server (if static) — start with Server, no sort |
| `app/(platform)/admin/metrics/advanced/CohortRetentionChart.tsx` | Recharts multi-line LineChart | Client |

**Reused components:** `Card`, `CardHeader`, `CardTitle`, `CardContent` from `components/ui/card`.

**No new shadcn components needed.** Table can be plain `<table>` with Tailwind classes (matches the simple density of Lane D's KPI cards). If sortable filters are added later, swap for `DataTable`.

---

## Files to CREATE

```
lib/db/admin-advanced-metrics.ts

app/(platform)/admin/metrics/advanced/page.tsx
app/(platform)/admin/metrics/advanced/NrrCards.tsx
app/(platform)/admin/metrics/advanced/NrrWaterfallChart.tsx
app/(platform)/admin/metrics/advanced/CohortRetentionTable.tsx
app/(platform)/admin/metrics/advanced/CohortRetentionChart.tsx
```

## Files to EDIT

```
app/(platform)/admin/metrics/page.tsx — add a "View advanced analytics →" link at the bottom (single line; no other change).
```

**Do NOT edit:**
- `lib/db/admin-metrics.ts` (Lane D — extend, don't rewrite; we extend by creating a sibling file).
- `constants/nav-items.ts` (no new nav entry; advanced is a sub-route, discoverable from /admin/metrics).
- `BUILD_PLAN.md` / `ARCHITECTURE.md` (per task brief).

## Migrations

**None.** All queries hit existing tables: `teachers`, `teacher_subscriptions`, `plans`. No schema changes, no new indexes (the existing `idx_teacher_subscriptions_teacher_id` from migration 003 covers our access patterns; we filter by `teacher_id` and `status` + range scans on `period_start`/`period_end`).

---

## DB Query Shapes (concrete)

### NRR — starting cohort fetch (per horizon N)

```sql
-- Inputs: month_start (date, e.g. '2025-06-01'), month_end (date, '2025-06-30')
-- Returns: teacher_id, plan, amount_pkr (latest confirmed sub overlapping month)
SELECT DISTINCT ON (teacher_id) teacher_id, plan, amount_pkr
FROM teacher_subscriptions
WHERE status = 'confirmed'
  AND period_start <= $month_end
  AND period_end   >= $month_start
  AND amount_pkr > 0
ORDER BY teacher_id, period_start DESC, created_at DESC;
```

If Supabase JS client doesn't support `DISTINCT ON`, fetch all overlapping rows and dedupe in memory keyed on `teacher_id`, picking the row with max `(period_start, created_at)`.

### NRR — ending state fetch (per horizon N)

```sql
SELECT DISTINCT ON (teacher_id) teacher_id, plan, amount_pkr
FROM teacher_subscriptions
WHERE status = 'confirmed'
  AND teacher_id = ANY($starting_ids)
  AND period_start <= $end_month_end
  AND period_end   >= $end_month_start
  AND amount_pkr > 0
ORDER BY teacher_id, period_start DESC, created_at DESC;
```

### Cohort retention — signed up

```sql
SELECT id, created_at FROM teachers
WHERE created_at >= $cohort_start_utc
  AND created_at <  $cohort_end_utc;
```

Boundaries are converted from PKT month boundaries to UTC by subtracting 5 hours (PKT = UTC+5 fixed offset, no DST in Pakistan).

### Cohort retention — active at horizon M+h

```sql
SELECT DISTINCT teacher_id FROM teacher_subscriptions
WHERE status = 'confirmed'
  AND teacher_id = ANY($cohort_ids)
  AND period_start <= $horizon_end
  AND period_end   >= $horizon_start
  AND amount_pkr > 0;
```

Then JOIN with `teachers.is_suspended = false` (in-memory filter against a single `SELECT id, is_suspended FROM teachers WHERE id = ANY($cohort_ids)` fetch).

---

## Edge Cases (full enumeration)

| Case | Behavior |
|------|----------|
| Zero teachers paid in starting cohort month | Return `null` for that NRR horizon; UI shows "—" with subtitle "no paying teachers in <month>" |
| Single teacher in starting cohort, churned by M+N | NRR_N = 0%, churnedTeacherCount = 1 |
| Teacher upgraded Solo → Academy mid-window | Counted as expansion: `expansion += (academy.amount - solo.amount)` |
| Teacher downgraded Academy → Solo mid-window | Counted as contraction: `contraction += (academy.amount - solo.amount)` |
| Teacher held same plan, plan's `price_pkr` was raised in `plans` table | NO change to NRR (we use historical `teacher_subscriptions.amount_pkr`, not live plan price). This is correct — they paid the old price for the period they paid. |
| Teacher had two confirmed subs overlapping starting month (renewal) | Take the one with later `period_start`, ties broken by later `created_at`. Use that as their starting amount. |
| Teacher signed up free, never paid | Excluded from NRR entirely. Counted in cohort retention table's `signedUp` denominator, never in active numerator. |
| Teacher signed up paid in M, immediately churned, re-signed M+11 | NRR_12: starting=Mpaid_amount, ending=M11paid_amount → counts as retained (not pure churn) |
| Teacher currently suspended | NRR: treated as churned (0 retained revenue). Cohort retention: not active. |
| Teacher's `plan_expires_at` is in the past | Already captured by "no overlapping confirmed sub at M+N" — they would have a sub up to expiry, none after. |
| Teacher subscription was refunded (status would have been `refunded` if such status existed — currently no such row state) | Not handled. `confirmed` rows are all we have. Document in footer. |
| Cohort month is the current PKT month (incomplete) | Excluded from cohort retention table — start at the most recent **completed** PKT month (current minus 1). |
| `plans.price_pkr` is 0 for a plan a teacher is on | Filter `amount_pkr > 0` in queries — avoids dividing by zero in derived metrics. |
| 18-cohort retention table when platform is < 18 months old | Show only the months that exist (no synthetic empty rows for months before launch). |
| Teacher's `created_at` is in the future (clock skew) | Excluded from cohorts (`created_at < $cohort_end_utc` filter). Defensive. |
| Two teachers with same `created_at` | Both counted in the same cohort. ✓ |
| Cache stampede on first hit after expiry | Acceptable — single admin user, two parallel requests at worst. `unstable_cache` deduplicates within a single render. |
| Service role can't read tables (config error) | Throws; page renders Next.js error boundary. Acceptable for admin page; document in test plan. |

---

## Performance Budget

- **Target: <1s for page render with 500 teachers.**
- NRR computes 3 horizons × 2 queries each = 6 Supabase round-trips. Each query is `WHERE status = 'confirmed' AND teacher_id IN (<=500 ids)` — uses `idx_teacher_subscriptions_teacher_id`. Expected: <100ms each → ~600ms total.
- Cohort retention: 1 query for cohort signups (`WHERE created_at IN range`, scans `teachers`), then 18 cohorts × 4 horizons = 72 active-state queries. **This is too many round-trips.**
  - **Optimization:** Fetch ALL confirmed `teacher_subscriptions` for the last 18+12 = 30 months in one query, then bucket in memory. Single query: `SELECT teacher_id, period_start, period_end, amount_pkr FROM teacher_subscriptions WHERE status='confirmed' AND period_end >= now - interval '30 months'`. Expected row count: ≤500 teachers × ~12 monthly subs avg = 6000 rows — small. <200ms.
  - One additional `SELECT id, created_at, is_suspended FROM teachers` (single scan, ≤500 rows). <50ms.
  - In-memory bucketing in JS: O(teachers × cohorts × horizons) = 500 × 18 × 4 = 36k iterations. Negligible.
- **Total without cache: ~850ms. Within budget.**
- **With `unstable_cache`: ~5ms cache hit.**
- If 1s budget is breached at 1000+ teachers: materialize a `teacher_monthly_revenue_snapshot(teacher_id, month, amount_pkr)` table via a nightly cron. **Not in this plan's scope** — defer to a future migration.

---

## Test Plan

### Unit-level (manual, no test framework yet in repo)

1. **NRR — empty state.**
   - Truncate `teacher_subscriptions` in dev DB.
   - Visit `/admin/metrics/advanced`.
   - Expected: NRR_3, NRR_6, NRR_12 cards show "—" with subtitle "no paying teachers". No crash.

2. **NRR — single retained teacher.**
   - Insert 1 confirmed sub with `period_start = now - 13 months`, `period_end = now - 1 month`, `amount_pkr = 5000`.
   - Insert 1 confirmed sub for same teacher with `period_start = now - 1 month`, `period_end = now`, `amount_pkr = 5000`.
   - Expected: NRR_12 = 100%, expansion = 0, churn = 0.

3. **NRR — expansion case.**
   - Same as #2 but second sub `amount_pkr = 8000`.
   - Expected: NRR_12 = 160% (8000/5000). Waterfall: starting=5000, expansion=3000, churn=0, contraction=0, ending=8000.

4. **NRR — churn case.**
   - Insert 1 confirmed sub `period_end = now - 11 months`, `amount_pkr = 5000`. No later subs.
   - Expected: NRR_12 = 0%, churnedTeacherCount = 1.

5. **NRR — re-signup recovered.**
   - Sub at M=now-13mo (5000), gap, sub at M=now-1mo (5000).
   - Expected: still counted as retained (overlap at M+12 = now-1mo). NRR_12 = 100%.

6. **Cohort retention — newly signed-up teacher with no payment.**
   - Insert teacher with `created_at = now - 2 months`. No subs.
   - Expected: row for that month shows `signedUp=1`, all retention cells = 0% or `—` for unelapsed.

7. **Cohort retention — paid teacher.**
   - Teacher created `now - 6 months`, sub from `now - 6 months` ongoing.
   - Expected: retention1m, retention3m, retention6m all = 100% in their cohort row. retention12m = `—` (not yet elapsed).

8. **Cohort retention — table excludes current month.**
   - No row for the current PKT calendar month (incomplete).

### Integration-level

9. **Cache.** First page load fetches; second load (within 1h) returns same data without DB hits — verify by adding a `console.log` in the helpers. Use `revalidateTag('admin-metrics')` from a teacher action to bust if needed (out of scope for this plan).

10. **Performance.** Seed 500 teachers + 6000 subs. `time curl http://localhost:3000/admin/metrics/advanced` (cold). Expect <1.5s including SSR. Warm: <100ms.

11. **Auth guard.** `/admin/metrics/advanced` without admin session → redirect to `/login` (handled by `requireAdmin()` in page).

12. **Dark mode.** Toggle theme, verify Recharts uses `var(--primary)`, `var(--muted-foreground)`, `var(--popover)`, `var(--border)` (matches Lane D's MrrChart styling).

13. **PKT correctness.** Set system clock to `2026-04-01 02:00 UTC` (= `2026-04-01 07:00 PKT`). Verify the cohort table includes March 2026 as the most-recent completed cohort (not April). Set to `2026-03-31 21:00 UTC` (= `2026-04-01 02:00 PKT`) — same outcome.

### Edge-case smoke tests

14. Teacher with `is_suspended=true` and active sub overlapping M+N → counted as churned in NRR, inactive in cohort retention.

15. Two teachers, same starting cohort, one upgraded one downgraded → NRR waterfall has both `expansion > 0` and `contraction > 0`.

16. Plan price field changed in `plans` table after teacher's last subscription → NRR unaffected (uses `amount_pkr` snapshot in `teacher_subscriptions`).

---

## Open Questions for Team-Lead

1. **Cohort retention "active" definition.** Locked as: confirmed sub overlapping the snapshot month AND `is_suspended = false`. Brief said "has a paid subscription AND not suspended; Free-plan is NOT active." Confirmed match. ✅

2. **18-month cohort window — keep or extend?** Suggest 18 to keep table compact (vertical scroll fits ~20 rows comfortably). If team wants 24, trivial change in `getCohortRetentionTable`.

3. **`plans.price_pkr` vs `monthly_price_pkr`.** Brief mentioned `plans.monthly_price_pkr` — that column does NOT exist; correct column is `price_pkr` (verified in `001_initial_schema.sql:16`). Plan uses `price_pkr`. **Confirm this is just a brief typo, not a schema change request.**

4. **Teacher subscription refunds.** No `refunded_at` or refund status on `teacher_subscriptions`. Plan does not subtract refunds from NRR (impossible). If team wants refund-aware NRR, a schema migration is required (add `teacher_subscriptions.refunded_at`, `refund_amount_pkr`). **Out of scope for this plan unless team approves a migration.**

5. **Suspension time-travel.** Current schema doesn't track when `teachers.is_suspended` changed. Plan uses current suspension state as a proxy for "active at M+N". For accurate historical retention, we'd need an audit table on `teachers.is_suspended`. **Documented as a footnote on the page; out of scope to fix.**

6. **`unstable_cache` cache key.** Plan uses `['admin-nrr-metrics']` (static). This means ALL admins see the same cached value, which is fine. Cache busts on revalidate (1h) or `revalidateTag('admin-metrics')`. Confirm we want a manual "Refresh" button on the page (extra UX, ~10min work, omitted by default).

7. **Discoverability.** Currently advanced analytics is reachable only from a footer link on `/admin/metrics`. Should we also add a sub-nav row inside `/admin/metrics` (tabs: "Overview" | "Advanced")? Default plan: just a footer link — keeps Lane D's layout untouched. Confirm.

---

## Cross-Lane Coordination

- **No conflicts with Lane D.** Lane D owns `lib/db/admin-metrics.ts` and `app/(platform)/admin/metrics/{page,MrrChart,KpiCards}.tsx`. Lane K creates a sibling file (`admin-advanced-metrics.ts`) and a sub-route (`metrics/advanced/`). Only Lane D file Lane K touches: `app/(platform)/admin/metrics/page.tsx` to add a single footer link — coordinate with Lane D owner before merging if Lane D is also modifying that file.
- **No conflicts with Lane B (sidebars/layouts).** No nav item changes; no layout edits.
- **No conflicts with other Phase 3 lanes** based on the brief (Lane J = certificates, Lane L = perf optimization).

---

## Non-Goals (explicit)

- No cohort performance for students (teachers only).
- No real-time updates (1h cache is fine).
- No CSV export (can add later if asked — would be a small Server Action returning a CSV download).
- No materialized tables (revisit if perf budget breached).
- No refund-adjusted NRR (schema doesn't support; would need migration).
- No historical suspension tracking (schema doesn't support; would need audit table).
- No predictive analytics, forecasts, or trendlines beyond what Recharts renders directly from the data points.

---

## Implementation Order (recommended for the engineer)

1. Create `lib/db/admin-advanced-metrics.ts` with raw `getNrrMetrics()` and `getCohortRetentionTable()` (no cache wrappers yet). Add a tiny script under `scripts/` (or just a one-off ts-node call) to invoke each helper against dev DB and console.log the result. Verify shapes.
2. Add `unstable_cache` wrappers.
3. Create `app/(platform)/admin/metrics/advanced/page.tsx` (Server Component) calling the cached helpers. Render JSON in a `<pre>` first to confirm wiring.
4. Build `NrrCards` (no chart) → render the 3 NRR percentages. Verify with seeded data.
5. Build `NrrWaterfallChart` (Recharts BarChart). Style-match Lane D's MrrChart.
6. Build `CohortRetentionTable` (Server Component, plain `<table>` with Tailwind).
7. Build `CohortRetentionChart` (Recharts LineChart, multi-series).
8. Add footer link on `/admin/metrics/page.tsx`.
9. Smoke-test all 16 test cases.
10. Verify dark mode, PKT correctness, performance budget.

End of plan.
