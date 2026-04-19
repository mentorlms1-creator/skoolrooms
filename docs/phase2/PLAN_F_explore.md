# Lane F — Explore Page Polish Plan

Star ratings on teacher cards + city/location filter on explore page.

---

## Current state (audit)

### Star ratings — source data
- **`cohort_feedback` schema (001_initial_schema.sql line 480):** `id`, `cohort_id uuid FK cohorts`, `student_id uuid FK students`, `rating int CHECK (1–5)`, `comment text nullable`, `created_at`. `UNIQUE(cohort_id, student_id)`.
- **No `is_published` field** on `cohort_feedback` (only `teacher_testimonials` has that). Treat every row as eligible. Lane C does not gate publication of ratings — it gates testimonials. **Confirmed by reading 011_retention_tables.sql lines 8–34 (testimonials only) and lines 41–58 (cohort_feedback policies — no is_published anywhere).**
- **RLS on `cohort_feedback` (011 lines 41–58):** teachers read their own; students insert + read own. No public read policy. The aggregator query MUST run server-side via `createAdminClient()` (service role) — same pattern `lib/db/explore.ts` already uses.
- **`lib/db/feedback.ts`** exists with `submitCohortFeedback`, `getFeedbackByCohort(cohortId)`, `getStudentFeedbackForCohort`. No aggregate helper yet — add it here.
- **Index (003_indexes.sql line 112):** `idx_cohort_feedback_cohort_id ON cohort_feedback(cohort_id)`. Sufficient for join-by-cohort lookup; an additional teacher-id index is unnecessary because join goes through `cohorts` which is indexed by teacher_id.

### Star ratings — UI
- `components/public/TeacherCard.tsx` is a server component; renders photo, name, city, bio, subject tags, levels, fee, student count, "Not accepting students" badge. The stats row is at `TeacherCard.tsx:97`. The rating badge slots cleanly in the header area (next to name) or under the city.
- No star icon in use yet on public components. `lucide-react` `Star` icon is available (used in `RichTextEditor.tsx`).

### City/location filter
- **`teachers.city` already exists** (001_initial_schema.sql line 81 — `city text` nullable).
- **Already surfaced** in `ProfileSettingsForm.tsx` (lines 89–93) with a free-text input. Users self-type; no canonical list. **No migration needed.** **Do not add a new column.**
- **Already returned** by `getExplorableTeachers` (`lib/db/explore.ts:50`, `:67`, `:198`) and **already rendered** on `TeacherCard.tsx:49–51`.
- Filter UI in `components/public/ExploreFilters.tsx` does NOT have a city control yet. The page derives `allSubjects` and `allLevels` from the result set (page.tsx:26–39); same pattern can derive `allCities`.
- **No URL-param sync today.** All filters are local React state in `ExploreFilters.tsx`. Adding `?city=...` requires shifting either the city filter (or all filters) to `useSearchParams()` + `router.replace()`. Plan: add URL sync ONLY for city to keep the change small and shareable, leaving subject/level/fee as in-memory state. (Optional follow-up: lift all filters to URL params — out of scope for Lane F.)

### Caching / memoization
- The page already uses ISR: `export const revalidate = 3600` (page.tsx:14). The ratings aggregate piggybacks on the same revalidation window — no extra `unstable_cache` needed at MVP scale (early teacher count is small; one extra `select` per page render is fine). If teacher count grows past ~500, switch to a Postgres view: `CREATE VIEW teacher_rating_aggregates AS SELECT t.id AS teacher_id, AVG(cf.rating)::numeric(3,2) AS avg, COUNT(*) AS count FROM teachers t JOIN cohorts c ON c.teacher_id = t.id JOIN cohort_feedback cf ON cf.cohort_id = c.id GROUP BY t.id;` — note for follow-up, not part of this plan.

### Lane E1 cross-dependency
- Lane E1 is being planned in parallel and may introduce course categories. If `courses.category_id` (or similar) lands, the explore page should expose a category filter too. **Not a blocker for Lane F.** Watch for Lane E1's plan; if it merges first, add `?category=` filter as a follow-up PR.

---

## Gaps vs polish goals

| Gap | Status |
|---|---|
| `getTeacherRatingsMap(teacherIds)` aggregate helper | Missing |
| Wire ratings into `getExplorableTeachers` result OR fetch alongside in page | Missing |
| `StarRating` display component (read-only, ½-step rendering) | Missing |
| TeacherCard renders rating badge when `count > 0` | Missing |
| Hide rating badge entirely when `count === 0` | Missing |
| City filter dropdown in `ExploreFilters` | Missing |
| `?city=...` URL param sync (shareable links) | Missing |
| `getExplorableTeachers` accepting a `city` filter (or filter client-side, see below) | Decision needed |
| Lane E1 category filter | Out of scope (note) |

---

## Migration

**None required.** `cohort_feedback` exists (001), `teachers.city` exists (001). RLS policies for `cohort_feedback` exist (011). All reads happen via service role from `lib/db/`.

---

## Implementation plan (ordered steps)

---

### Step 1: Aggregate ratings helper

**Files touched:** `lib/db/feedback.ts`.

Add to `lib/db/feedback.ts`:

```ts
export type TeacherRatingAggregate = {
  avg: number   // 0..5 with one decimal place
  count: number // total ratings
}

export async function getTeacherRatingsMap(
  teacherIds: string[],
): Promise<Map<string, TeacherRatingAggregate>>
```

**Query strategy** (one round-trip):
1. `select id, teacher_id from cohorts where teacher_id in (teacherIds) and deleted_at is null` — build cohort→teacher map.
2. `select cohort_id, rating from cohort_feedback where cohort_id in (cohortIds)` — fetch all ratings.
3. In JS, walk ratings, look up teacher via cohort map, accumulate sum + count per teacher, divide for avg, round to 1 decimal.

**Why two queries instead of a Postgres aggregate JOIN:** Supabase JS client cannot express GROUP BY across joined tables cleanly; two indexed lookups are cheap and keep the helper readable. Indices `idx_cohorts_teacher_id` (already present per 003) and `idx_cohort_feedback_cohort_id` (003 line 112) cover both lookups.

**Edge cases:**
- Empty `teacherIds` → return `new Map()` immediately (skip queries).
- Teacher with cohorts but zero ratings → omit from map (caller treats missing key as `count=0` and hides the badge).
- Archived/deleted cohorts: include them. Once a student has rated, the rating represents their experience — archiving the cohort shouldn't erase the score. (Soft-deleted cohorts via `deleted_at` are excluded — those represent removed cohorts, not historical ones.)
- Draft / unpublished courses: ratings come from cohorts directly; cohort status doesn't affect inclusion (a draft course can't have an enrolled student who left feedback anyway).
- Numeric type: `avg` is a `number`, computed as `Math.round((sum / count) * 10) / 10` so the UI gets `4.5`, not `4.4999`.

---

### Step 2: Wire ratings into the explore page

**Files touched:** `lib/db/explore.ts`, `app/(platform)/explore/page.tsx`.

**Decision: do not change `ExplorableTeacher` shape inside `getExplorableTeachers`.** Fetch ratings in the page and pass them down separately. This keeps `getExplorableTeachers` single-purpose and avoids touching every other consumer of `ExplorableTeacher` (none today, but future-proof).

In `app/(platform)/explore/page.tsx`:
```ts
const teachers = await getExplorableTeachers({ city: cityParam })
const ratings = await getTeacherRatingsMap(teachers.map((t) => t.id))
```

Pass `ratings` through `ExploreFilters` → `TeacherCard` as `Map<string, TeacherRatingAggregate>` (or as a plain `Record<string, {avg, count}>` if Map serialization across the server/client boundary becomes awkward — `Record` is safer for RSC props).

**Async params:** the page must accept `searchParams` (Next 16 async signature):
```ts
export default async function ExplorePage({
  searchParams,
}: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams
  ...
}
```

Per CLAUDE.md "params/searchParams are async (await)".

---

### Step 3: City filter in `getExplorableTeachers`

**Files touched:** `lib/db/explore.ts`.

Extend the existing `ExploreFilters` type (line 26):
```ts
export type ExploreFilters = {
  subject?: string
  level?: string
  minFee?: number
  maxFee?: number
  city?: string
}
```

Apply the city filter in the same loop as subject/level (line 173 area):
```ts
if (filters?.city) {
  if (!teacher.city || teacher.city.toLowerCase() !== filters.city.toLowerCase()) continue
}
```

**Case-insensitive exact match.** Substring match is wrong for cities ("Lahore" must not match "Bahawalpur"). Trim both sides before comparing — defensive against teachers entering `" Lahore "`.

**Why filter in JS not SQL:** the existing function already filters in JS for subject/level (because `teaching_levels` is `text[]` and the filter is case-insensitive substring). Match the existing pattern.

---

### Step 4: City dropdown in `ExploreFilters`

**Files touched:** `app/(platform)/explore/page.tsx`, `components/public/ExploreFilters.tsx`.

**Page side (page.tsx):** derive `allCities` from the unfiltered teacher list (so the dropdown stays stable when a city is chosen) and pass it to `ExploreFilters`:

```ts
// Fetch unfiltered list to compute available cities, then re-filter in-memory or
// run a second filtered query. Simpler: do not pass city to getExplorableTeachers;
// filter on the client only. See "Decision" below.
const cities = [...new Set(teachers.map((t) => t.city).filter(Boolean))].sort()
```

**Decision: filter on the client (in-memory) for parity with subject/level/fee.** All explore filtering today happens in `ExploreFilters` (client component) over the full teacher set. Adding a city to that same useMemo is one line. The server-side filter from Step 3 is still useful for direct deep-links like `/explore?city=Lahore` (server returns the filtered set on initial render — faster perceived load), but the client also re-applies the filter so changing the dropdown doesn't require a server round-trip.

**Component side (ExploreFilters.tsx):**
- Add prop `allCities: string[]` and prop `initialCity?: string` (from URL param).
- Add `const [city, setCity] = useState(initialCity ?? '')`.
- Render a shadcn `Select` mirroring the Subject/Level controls — same `_all` sentinel pattern (lines 80–96).
- Add city to the `useMemo` filter (line 38) before subject:
  ```ts
  if (city) {
    if (!teacher.city || teacher.city.toLowerCase() !== city.toLowerCase()) return false
  }
  ```
- Add city to the "Clear filters" reset (line 150) and to the visible-when condition.
- On `onValueChange`: also call `router.replace('/explore?city=...' )` (preserving other params if/when added) to keep URL in sync. Use `next/navigation`'s `useRouter` and `useSearchParams`.

**Combobox vs. Select:** start with `Select` (already imported, consistent with other filters). If the city list grows large enough to be unwieldy in a dropdown (~50+), upgrade to a shadcn `Combobox` with search in a follow-up.

---

### Step 5: Star rating display component

**Files touched:** `components/public/StarRating.tsx` (new), `components/public/TeacherCard.tsx`.

**New component `components/public/StarRating.tsx`** (server-compatible, no `'use client'`):
```tsx
type StarRatingProps = {
  value: number      // 0..5, may have one decimal
  count: number      // total reviews
  size?: 'sm' | 'md' // default 'sm'
}
```

Render strategy: 5 `<Star>` icons from `lucide-react`. For each star index `i` (1..5):
- `value >= i` → filled star (`fill-primary text-primary`).
- `value >= i - 0.5` → half-filled star. Implementation: stack two icons absolutely — full Star with `text-muted-foreground/40`, then a half-clipped filled Star on top using `clip-path: inset(0 50% 0 0)`. Or use the simpler approach: render `<StarHalf>` (lucide also exports `StarHalf`) with `fill-primary text-primary`.
- otherwise → empty star (`text-muted-foreground/40`, no fill).

Show `value.toFixed(1)` and `(count) reviews` next to the stars. Plural-aware: `count === 1 ? 'review' : 'reviews'`.

**Dark mode:** uses `text-primary`, `text-muted-foreground` — semantic tokens only, no hex. Per CLAUDE.md rules 14–15, this is mandatory.

**TeacherCard wiring:**
- Add prop `rating?: TeacherRatingAggregate` (optional — undefined for teachers with no ratings).
- Render `<StarRating value={rating.avg} count={rating.count} />` in the header area immediately under the city line (`TeacherCard.tsx:51`).
- **If `rating` is undefined OR `rating.count === 0` → render nothing.** No "0 reviews" badge, no empty stars — keeps the card uncluttered for new teachers and avoids implying low quality where there's just no data.

`ExploreFilters.tsx` passes `rating={ratingsMap[teacher.id]}` to each `TeacherCard`.

---

### Step 6: Half-star edge cases & correctness

- `value` rounding: half-step rendering means `4.7` shows as 5 stars (since `4.7 >= 4.5` and `4.7 >= 5` is false but `4.7 - 0.5 = 4.2`, so star 5 renders half? — re-verify the logic above; the rule is "fill if value >= i; else half-fill if value >= i - 0.5; else empty". For `value = 4.7`: stars 1–4 fill, star 5 is `4.7 >= 4.5` → half. Correct.)
- `value = 5.0`: all 5 fill.
- `value = 0.4`: rounded down to all empty (no half on star 1 because `0.4 < 0.5`). Acceptable.
- `value` should never exceed 5 by construction (DB CHECK clamps to 1..5).
- `count = 0`: caller does not pass `rating`. Component guards too (defense in depth).

---

### Step 7: Lane E1 category filter (note only)

**Out of scope for Lane F.** When Lane E1's plan lands:
- If `courses.category_id` is added, extend `ExploreFilters` server-side to accept `category` and join through `cohorts → courses`.
- Add a `Category` Select to `ExploreFilters.tsx` next to City.
- URL param `?category=...` follows the same shape as `?city=...`.

Track as a follow-up issue once Lane E1 merges — do not block Lane F on this.

---

## Files summary

### Create
- `components/public/StarRating.tsx` — read-only star display, server-compatible.

### Edit
- `lib/db/feedback.ts` — add `getTeacherRatingsMap(teacherIds)` and `TeacherRatingAggregate` type.
- `lib/db/explore.ts` — add `city?: string` to `ExploreFilters`; apply case-insensitive exact match in the filter loop.
- `app/(platform)/explore/page.tsx` — accept async `searchParams`, pass `city` to `getExplorableTeachers`, fetch ratings map, derive `allCities`, pass both to `ExploreFilters`.
- `components/public/ExploreFilters.tsx` — add `allCities`, `initialCity`, `ratings` props; render city `Select`; sync `?city=` via `useRouter` + `useSearchParams`; add city to clear-filters reset; pass `rating` to each `TeacherCard`.
- `components/public/TeacherCard.tsx` — add optional `rating` prop; render `<StarRating>` under city line when `rating?.count > 0`.

### No change
- `supabase/migrations/*` — no migration; `cohort_feedback` and `teachers.city` already exist.
- `app/(teacher)/dashboard/settings/page.tsx`, `components/teacher/ProfileSettingsForm.tsx`, `lib/actions/teachers.ts` — city editing is already in place.

---

## RLS check

- `cohort_feedback` policies (011 lines 41–58): teacher-read-own, student-insert-own, student-read-own. **No public-read policy.** Aggregation MUST run via `createAdminClient()` server-side (Step 1). Do not attempt to subscribe or fetch from the browser. The browser only ever receives the pre-aggregated `{avg, count}` numbers via Server Component props — individual ratings/comments are never exposed.
- `teachers` table: `is_publicly_listed` + `is_suspended` already gated in `getExplorableTeachers`. City filter does not change the gate.

---

## Edge cases (consolidated)

| Case | Behavior |
|---|---|
| Teacher with 0 ratings | No badge, no "0 reviews" text. Card renders normally. |
| Teacher with 1 rating | Badge shows stars + `(1 review)` (singular). |
| Teacher with deleted cohort that had ratings | Soft-deleted cohorts (`deleted_at != null`) excluded; archived cohorts included. |
| Teacher with no city set | Excluded from city dropdown (filter `Boolean`); never matches a `?city=X` filter. |
| `?city=Lahore` deep-link, no teacher matches | Empty state ("No teachers found") — same as existing subject/level empty state. |
| `?city=` with weird casing or whitespace | Server-side filter trims + lowercases both sides. |
| Draft course (no published cohort) | No enrollments → no ratings; teacher with only draft courses already excluded by the "skip teachers with no cohorts" guard at `explore.ts:146`. |
| Half-star rounding boundary (e.g., 4.25) | `4.25 < 4.5` → star 5 empty, star 4 fills (since `4.25 >= 4`). Consistent. |
| Browser without JS | Server-rendered initial state respects `?city=` param. Filter UI itself is interactive (client component) and degrades to "no further filtering" without JS — acceptable. |
| Mobile viewport | `flex-wrap` on the filter bar (line 76) handles the extra Select naturally. Verify visually on a 360px viewport. |

---

## Test plan

- Manual: seed 2 teachers in different cities with mixed cohort_feedback rows. Confirm:
  - Teacher with 0 ratings shows no badge.
  - Teacher with `[5,5,4]` shows 4.7 stars, "(3 reviews)".
  - `/explore?city=Lahore` filters server-side AND the dropdown reflects "Lahore" pre-selected.
  - Changing the dropdown updates the URL without a full reload.
  - Dark mode: stars render in `--primary` color; empty stars are muted; readable in both themes.
  - RLS: confirm anon key cannot SELECT from `cohort_feedback` directly (separate sanity check, not introduced by this plan).
- No automated tests required for this lane (no test infra in repo per current conventions).
